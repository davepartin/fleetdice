/** Measure and screenshot the phone column on a phone and a laptop window. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./shoot.mjs";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { newMatch, newPlayer, newBrain, makeRng, setRng } = G;

const ART = "/opt/cursor/artifacts/screenshots";
const DOCS = resolve("docs/phone-column");
await mkdir("shots", { recursive: true });
await mkdir(ART, { recursive: true });
await mkdir(DOCS, { recursive: true });

const server = await serve(resolve("out"), 4323);
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});

function roundOne() {
  setRng(makeRng(52));
  const s = newMatch("phone-column", "0000", "you", "You", "solo");
  s.players.guest = newPlayer("enemy", "Enemy", "ready");
  return s;
}

async function measureFrame(page) {
  return page.evaluate(() => {
    const frame = document.querySelector(".app-frame");
    const canvas = document.querySelector(".stage-canvas");
    const hud = document.querySelector(".hud");
    const dock = document.querySelector(".roll-dock, .match-bottom");
    const dialog = document.querySelector(".weapon-window");
    const fr = frame?.getBoundingClientRect();
    const cr = canvas?.getBoundingClientRect();
    const hr = hud?.getBoundingClientRect();
    const dr = dock?.getBoundingClientRect();
    const wr = dialog?.getBoundingClientRect();
    return {
      innerWidth,
      innerHeight,
      frame: fr ? { x: fr.x, width: fr.width, height: fr.height } : null,
      canvas: cr ? { x: cr.x, width: cr.width, height: cr.height } : null,
      hud: hr ? { x: hr.x, width: hr.width, height: hr.height } : null,
      dock: dr ? { x: dr.x, width: dr.width } : null,
      weapon: wr ? { x: wr.x, width: wr.width } : null,
      vvWidth: getComputedStyle(document.documentElement).getPropertyValue("--vv-width").trim(),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

async function saveShot(page, name) {
  const dest = `shots/${name}.png`;
  await page.screenshot({ path: dest, fullPage: false });
  await copyFile(dest, `${ART}/${name}.png`);
  await copyFile(dest, `${DOCS}/${name}.png`);
}

async function openHome(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width <= 430 ? 3 : 2 });
  const page = await ctx.newPage();
  await page.goto("http://localhost:4323/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  return { ctx, page };
}

async function openMatch(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width <= 430 ? 3 : 2 });
  const page = await ctx.newPage();
  await page.addInitScript(
    (save) => {
      if (!localStorage.getItem("fd3.solo.battle.v1")) {
        localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(save));
      }
    },
    { schema: 1, savedAt: Date.now(), state: roundOne(), brain: newBrain("balanced", "low") },
  );
  await page.goto("http://localhost:4323/solo/?q=low", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Carry on/ }).click();
  await page.waitForTimeout(1800);
  return { ctx, page };
}

function assertPhone(m, label) {
  assert.ok(m.frame, `${label}: missing .app-frame`);
  assert.equal(Math.round(m.frame.width), m.innerWidth, `${label}: phone frame must be full bleed`);
  assert.ok(Math.abs(m.frame.x) <= 1, `${label}: phone frame must sit at x=0, got ${m.frame.x}`);
  if (m.canvas) {
    assert.equal(Math.round(m.canvas.width), m.innerWidth, `${label}: canvas must be full bleed`);
  }
  if (m.hud) {
    assert.equal(Math.round(m.hud.width), m.innerWidth, `${label}: HUD must be full bleed`);
  }
  assert.equal(m.overflow, 0, `${label}: horizontal overflow`);
}

function assertDesktop(m, label) {
  assert.ok(m.frame, `${label}: missing .app-frame`);
  assert.equal(Math.round(m.frame.width), 390, `${label}: desktop column must be 390px, got ${m.frame.width}`);
  const expectedLeft = (m.innerWidth - 390) / 2;
  assert.ok(
    Math.abs(m.frame.x - expectedLeft) <= 1,
    `${label}: column should be centred (x≈${expectedLeft}, got ${m.frame.x})`,
  );
  if (m.canvas) {
    assert.equal(Math.round(m.canvas.width), 390, `${label}: canvas must match the column`);
    assert.ok(Math.abs(m.canvas.x - m.frame.x) <= 1, `${label}: canvas must sit in the column`);
  }
  if (m.hud) {
    assert.equal(Math.round(m.hud.width), 390, `${label}: HUD must match the column`);
  }
  if (m.weapon) {
    assert.ok(m.weapon.width <= 390, `${label}: weapons window overflowed the column (${m.weapon.width})`);
    assert.ok(m.weapon.x >= m.frame.x - 1, `${label}: weapons window left of the column`);
    assert.ok(m.weapon.x + m.weapon.width <= m.frame.x + m.frame.width + 1, `${label}: weapons window right of the column`);
  }
  assert.match(m.vvWidth, /^390px$/);
  assert.equal(m.overflow, 0, `${label}: horizontal overflow`);
}

try {
  const phone = { width: 390, height: 844 };
  const desktop = { width: 1280, height: 800 };

  {
    const { ctx, page } = await openHome(phone);
    const m = await measureFrame(page);
    assertPhone(m, "home 390×844");
    await saveShot(page, "home_phone_390x844");
    console.log("home phone", m.frame);
    await ctx.close();
  }
  {
    const { ctx, page } = await openHome(desktop);
    const m = await measureFrame(page);
    assertDesktop(m, "home 1280×800");
    await saveShot(page, "home_desktop_1280x800");
    console.log("home desktop", m.frame);
    await ctx.close();
  }
  {
    const { ctx, page } = await openMatch(phone);
    const m = await measureFrame(page);
    assertPhone(m, "match 390×844");
    await saveShot(page, "match_phone_390x844");
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    const open = await measureFrame(page);
    assertPhone(open, "weapons 390×844");
    assert.ok(open.weapon, "weapons window missing on phone");
    await saveShot(page, "weapons_phone_390x844");
    console.log("match phone", m.frame, "weapon", open.weapon);
    await ctx.close();
  }
  {
    const { ctx, page } = await openMatch(desktop);
    const m = await measureFrame(page);
    assertDesktop(m, "match 1280×800");
    await saveShot(page, "match_desktop_1280x800");
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    const open = await measureFrame(page);
    assertDesktop(open, "weapons 1280×800");
    await saveShot(page, "weapons_desktop_1280x800");
    console.log("match desktop", m.frame, "weapon", open.weapon);
    await ctx.close();
  }

  console.log("PASS phone-column shots");
} finally {
  await browser.close();
  server.close();
}
