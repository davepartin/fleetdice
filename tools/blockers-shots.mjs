/**
 * Phone-width shots of the Choose Your Blockers math row.
 *
 * Injects a solo save already on the block screen (same fixture shape as
 * tools/brace-repair-width.mjs), then captures the dock at 0 blocked and
 * after tapping a ship. Writes to docs/ so Dave can eye-check the row.
 *
 *   node tools/blockers-shots.mjs        (needs the static build on :4321,
 *                                        or set BASE / run `pnpm serve`)
 */
import { chromium } from "playwright";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./shoot.mjs";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { newMatch, newPlayer, newBrain } = G;

const BASE = process.env.BASE;
const DOCS = resolve("docs");
const ART = "/opt/cursor/artifacts/screenshots";
const VIEWPORT = { width: 390, height: 844 };

function fixture() {
  const s = newMatch("blockers-shot", "0000", "you", "You", "solo");
  s.players.guest = newPlayer("enemy", "Enemy", "ready");
  s.status = "active";
  const you = s.players.host;
  const enemy = s.players.guest;
  you.phase = "brace";
  you.round = 3;
  you.hp = 8;
  you.maxHp = 60;
  you.incoming = 9;
  you.directIncoming = 3;
  you.braceShips = [];
  you.tally = {
    attack: 0,
    defense: 0,
    energy: 4,
    direct: 0,
    heal: 1,
    lines: [],
    run: null,
    face: 4,
    flagBonus: { attack: 0, defense: 0, energy: 4, heal: 0, direct: 0 },
  };
  you.ships = [
    { id: "s-d6", sides: 6, disabledRound: null, slot: 1 },
    { id: "s-d8", sides: 8, disabledRound: null, slot: 2 },
    { id: "s-d4a", sides: 4, disabledRound: null, slot: 3 },
    { id: "s-d6b", sides: 6, disabledRound: null, slot: 4 },
    { id: "s-d4b", sides: 4, disabledRound: null, slot: 6 },
  ];
  you.open = [false, true, true, true, true, false, true, false];
  you.dice = [
    { id: "s-d6", sides: 6, value: 6, slot: 1 },
    { id: "s-d8", sides: 8, value: 8, slot: 2 },
    { id: "s-d4a", sides: 4, value: 4, slot: 3 },
    { id: "flag", sides: 6, value: 4, flag: true },
    { id: "s-d6b", sides: 6, value: 5, slot: 4 },
    { id: "s-d4b", sides: 4, value: 4, slot: 6 },
  ];
  you.flag = { level: 1, face: 4, token: false };
  enemy.hp = 31;
  enemy.round = 3;
  enemy.phase = "report";
  return s;
}

const save = {
  schema: 1,
  savedAt: Date.now(),
  state: fixture(),
  brain: newBrain("balanced", "low"),
};

await mkdir("shots", { recursive: true });
await mkdir(DOCS, { recursive: true });
await mkdir(ART, { recursive: true }).catch(() => {});

const server = BASE ? null : await serve(resolve("out"), 4324);
const origin = BASE || "http://localhost:4324";
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});

async function shot(page, name) {
  const dest = resolve("shots", `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  await copyFile(dest, resolve(DOCS, `${name}.png`));
  await copyFile(dest, resolve(ART, `${name}.png`)).catch(() => {});
  return dest;
}

try {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript((payload) => {
    localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(payload));
  }, save);
  await page.goto(`${origin}/solo/?q=low`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Carry on/ }).click();
  await page.locator(".brace-equation").waitFor({ state: "visible", timeout: 12000 });
  await page.waitForTimeout(900);

  await shot(page, "blockers-math-0");

  await page.evaluate(() => {
    const fd = window.__fd3;
    if (fd?.tap) fd.tap("s-d6");
  });
  await page.waitForTimeout(700);
  const blocked = await page.evaluate(() => {
    const el = document.querySelector('[data-brace-term="Blocked"] .t-num');
    return el ? el.textContent.trim() : null;
  });
  if (blocked !== "6") {
    // The 3D hatch is the phone path; the ship list is the fallback.
    const btn = page.getByRole("button", { name: /d6/ }).first();
    if (await btn.count()) await btn.click({ force: true });
    await page.waitForTimeout(400);
  }
  await shot(page, "blockers-math-blocked");

  const text = await page.evaluate(() => {
    const row = document.querySelector(".brace-summary");
    return row ? row.textContent.replace(/\s+/g, " ").trim() : "";
  });
  console.log(`  equation: ${text}`);
  await ctx.close();
} finally {
  await browser.close();
  if (server) server.close();
}

console.log("  wrote docs/blockers-math-0.png and docs/blockers-math-blocked.png");
