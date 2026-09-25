/**
 * Phone shots of the six-weapon screen, a mid-fill, the shipyard charge
 * view, and a round summary that names Energy Attack.
 *
 *   node tools/energy-weapons-shots.mjs
 *
 * Needs `pnpm build` first (`out/`). Writes into docs/.
 */

import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./shoot.mjs";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const {
  newMatch, newPlayer, newBrain, applyAction, makeRng, setRng, TUNING,
  CLASSIC_WEAPON_IDS, ENERGY_WEAPON_IDS,
} = G;

const DOCS = resolve("docs");
await mkdir(DOCS, { recursive: true });
await mkdir("shots", { recursive: true });
const server = await serve(resolve("out"), 4323);
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});

function shopState() {
  setRng(makeRng(52));
  const s = newMatch("energy-shots-shop", "0000", "you", "You", "solo");
  s.players.guest = newPlayer("enemy", "Enemy", "shop");
  s.round = 6;
  for (const p of Object.values(s.players)) {
    p.round = 6; p.energy = 40; p.phase = "shop"; p.hp = 48; p.maxHp = 60;
  }
  return s;
}

function sixOpen() {
  const s = shopState();
  for (const id of [...CLASSIC_WEAPON_IDS, ...ENERGY_WEAPON_IDS]) {
    applyAction(s, "host", { type: "shop", operation: "weapon", weapon: id });
  }
  applyAction(s, "host", { type: "weapon-fill", weapon: "energyAttack" });
  applyAction(s, "host", { type: "weapon-fill", weapon: "energyAttack" });
  applyAction(s, "host", { type: "weapon-fill", weapon: "energyAttack" });
  applyAction(s, "host", { type: "weapon-fill", weapon: "energyShield" });
  applyAction(s, "host", { type: "weapon-fill", weapon: "energyShield" });
  for (const side of ["host", "guest"]) {
    applyAction(s, side, { type: "ready" });
    applyAction(s, side, { type: "roll", dice: [] });
  }
  return s;
}

function firedReport() {
  const s = sixOpen();
  applyAction(s, "host", { type: "weapon", weapon: "energyAttack" });
  applyAction(s, "host", { type: "submit" });
  applyAction(s, "guest", { type: "submit" });
  for (const side of ["host", "guest"]) {
    if (s.status !== "finished" && s.players[side].phase === "brace") {
      applyAction(s, side, { type: "brace", ships: [] });
    }
  }
  return s;
}

async function pageWith(state, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript((save) => {
    localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(save));
  }, { schema: 1, savedAt: Date.now(), state, brain: newBrain("balanced", "low") });
  await page.goto("http://localhost:4323/solo/?q=low", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Carry on/ }).click();
  await page.waitForTimeout(400);
  return { ctx, page };
}

async function measureWindow(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector("dialog.weapon-window");
    const inner = document.querySelector(".weapon-window-inner");
    const body = document.querySelector(".weapon-window-body");
    const cards = [...document.querySelectorAll(".weapon-card")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        name: el.querySelector("h3")?.textContent ?? "",
        top: Math.round(r.top),
        left: Math.round(r.left),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
      };
    });
    const overflowers = [...document.querySelectorAll(".weapon-window *")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > innerWidth + 1 || r.left < -1;
    }).map((el) => el.className);
    return {
      cards: cards.length,
      names: cards.map((c) => c.name),
      innerScroll: inner ? inner.scrollHeight - inner.clientHeight : 0,
      bodyScroll: body ? body.scrollHeight - body.clientHeight : 0,
      dialogH: dialog ? Math.round(dialog.getBoundingClientRect().height) : 0,
      viewH: innerHeight,
      overflowers,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

async function save(page, name, selector = ".weapon-window") {
  const dest = resolve(DOCS, `${name}.png`);
  const shot = resolve("shots", `${name}.png`);
  const target = page.locator(selector).first();
  if (await target.count()) await target.screenshot({ path: dest });
  else await page.screenshot({ path: dest });
  await copyFile(dest, shot);
  console.log("wrote", dest);
}

try {
  const views = [
    { width: 375, height: 812 },
    { width: 390, height: 620 },
    { width: 360, height: 780 },
  ];

  {
    const { ctx, page } = await pageWith(shopState(), { width: 375, height: 812 });
    await page.getByRole("button", { name: /Charge flagship weapons/i }).click();
    await page.locator(".weapon-window").waitFor({ state: "visible" });
    const layout = await measureWindow(page);
    assert.equal(layout.cards, 6, "shipyard must show all six weapons");
    assert.deepEqual(layout.names, [
      "Rotate Flagship", "Repair", "Attack", "Super Shield", "Energy Attack", "Energy Shield",
    ]);
    assert.ok(layout.innerScroll <= 2, `shipyard weapons window scrolls by ${layout.innerScroll}px`);
    assert.ok(layout.bodyScroll <= 2, `shipyard cards sit in a scroller (${layout.bodyScroll}px)`);
    assert.equal(layout.overflowX, 0);
    await save(page, "energy-weapons-shipyard-charge-375x812");
    await ctx.close();
  }

  for (const vp of views) {
    const { ctx, page } = await pageWith(sixOpen(), vp);
    await page.getByRole("button", { name: /Flagship Weapon|Use flagship weapon/i }).click();
    await page.locator(".weapon-window").waitFor({ state: "visible" });
    const layout = await measureWindow(page);
    assert.equal(layout.cards, 6, `${vp.width}x${vp.height} must show all six`);
    assert.deepEqual(layout.names, [
      "Rotate Flagship", "Repair", "Attack", "Super Shield", "Energy Attack", "Energy Shield",
    ]);
    assert.ok(layout.innerScroll <= 4, `${vp.width}x${vp.height} window scrolls by ${layout.innerScroll}px`);
    assert.ok(layout.bodyScroll <= 4, `${vp.width}x${vp.height} cards scroll by ${layout.bodyScroll}px`);
    assert.equal(layout.overflowX, 0, `${vp.width}x${vp.height} overflows horizontally`);
    await save(page, `energy-weapons-six-${vp.width}x${vp.height}`);
    if (vp.width === 375) {
      await save(page, "energy-weapons-midfill-375x812", ".weapon-card-energy.weapon-energyAttack");
    }
    await ctx.close();
  }

  {
    const { ctx, page } = await pageWith(firedReport(), { width: 375, height: 812 });
    await page.waitForTimeout(600);
    const text = await page.locator("body").innerText();
    assert.match(text, /Energy Attack/);
    const report = page.locator(".round-report, .volley-ledger, .match-hud").first();
    if (await page.locator(".round-report").count()) {
      await save(page, "energy-weapons-round-summary-375x812", ".round-report");
    } else {
      await page.screenshot({ path: resolve(DOCS, "energy-weapons-round-summary-375x812.png") });
    }
    void report;
    await ctx.close();
  }

  console.log("PASS energy weapon shots");
} finally {
  await browser.close();
  server.close();
}
