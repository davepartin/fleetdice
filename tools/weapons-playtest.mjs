/** Real phone UI coverage for charge, cancel, fire, reload, and both summaries. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./shoot.mjs";
import { bundlePath } from "../sim/bundle.mjs";
const G = await import(bundlePath);
const { newMatch, newPlayer, newBrain, applyAction, makeRng, setRng, WEAPON_IDS, TUNING } = G;
const server = await serve(resolve("out"), 4321);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
await mkdir("shots", { recursive: true });

function fixture(shop = false, lethal = false) {
  setRng(makeRng(52));
  const s = newMatch("weapon-phone-fixture", "0000", "you", "You", "solo");
  s.players.guest = newPlayer("enemy", "Enemy", "shop");
  s.round = 6;
  for (const p of Object.values(s.players)) { p.round = 6; p.energy = 24; p.phase = "shop"; p.hp = 100; p.maxHp = 100; }
  if (shop) { s.players.guest.phase = "report"; return s; }
  for (const id of WEAPON_IDS) applyAction(s, "host", { type: "shop", operation: "weapon", weapon: id });
  applyAction(s, "guest", { type: "shop", operation: "weapon", weapon: "attack" });
  for (const side of ["host", "guest"]) {
    applyAction(s, side, { type: "ready" });
    applyAction(s, side, { type: "roll", dice: [] });
  }
  applyAction(s, "guest", { type: "weapon", weapon: "attack" });
  applyAction(s, "guest", { type: "submit" });
  if (lethal) s.players.host.hp = 1;
  return s;
}
async function pageWith(state, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript(save => {
    if (!localStorage.getItem("fd3.solo.battle.v1")) localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(save));
  }, { schema: 1, savedAt: Date.now(), state, brain: newBrain("balanced", "low") });
  await page.goto("http://localhost:4321/solo/?q=low", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Carry on/ }).click();
  return { ctx, page };
}
async function saved(page) { return page.evaluate(() => JSON.parse(localStorage.getItem("fd3.solo.battle.v1")).state.players.host); }
async function frame(page) {
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector("dialog");
    const footer = dialog?.querySelector("footer")?.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - innerWidth,
      dialogOverflow: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
      footerBottom: footer?.bottom, height: innerHeight };
  });
  assert.equal(layout.overflow, 0);
  assert.equal(layout.dialogOverflow, 0);
  if (layout.footerBottom) assert.ok(layout.footerBottom <= layout.height);
}
async function launcherOnScreen(page) {
  const button = page.getByRole("button", { name: /flagship weapon/i }).first();
  await button.waitFor({ state: "visible" });
  const box = await button.boundingBox();
  const vp = page.viewportSize();
  assert.ok(box && vp, "flagship weapon control must exist");
  assert.ok(box.y >= 0 && box.y + box.height <= vp.height,
    `flagship weapon control at y=${box.y.toFixed(0)} h=${box.height.toFixed(0)} is off the ${vp.width}×${vp.height} screen`);
  assert.ok(box.width >= 120, "flagship weapon control must be wide enough to tap");
}
try {
  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 620 }, { width: 360, height: 780 }]) {
    const { ctx, page } = await pageWith(fixture(true), viewport);
    await launcherOnScreen(page);
    await page.getByRole("button", { name: "Charge flagship weapons" }).click();
    await frame(page);
    assert.equal(await page.locator(".weapon-card-locked").count(), 4);
    const beforeCancel = await saved(page);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.deepEqual((await saved(page)).weapons, beforeCancel.weapons);
    assert.equal((await saved(page)).energy, beforeCancel.energy);
    await page.getByRole("button", { name: "Charge flagship weapons" }).click();
    for (const name of ["Rotate Flagship", "Super Shield", "Attack", "Repair"]) {
      await page.getByRole("button", { name: `Charge ${name} for 6 Energy`, exact: true }).click();
    }
    assert.equal((await saved(page)).energy, 0);
    assert.equal(await page.locator(".weapon-card-available").count(), 4);
    await page.getByRole("button", { name: "Tips", exact: true }).click();
    await frame(page);
    await page.getByRole("button", { name: "Tips", exact: true }).click();
    await page.screenshot({ path: `shots/weapons-charged-${viewport.width}x${viewport.height}.png` });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Carry on/ }).click();
    await page.getByRole("button", { name: "Charge flagship weapons" }).click();
    assert.equal(await page.locator(".weapon-card-available").count(), 4);
    assert.ok(await page.getByRole("button", { name: "Charge Attack for 6 Energy", exact: true }).isDisabled());
    await ctx.close();
    console.log(`PASS charging/cancel/reload/short-screen ${viewport.width}x${viewport.height}`);
  }
  {
    const broke = fixture(true);
    broke.players.host.energy = TUNING.weaponChargeCost - 1;
    const { ctx, page } = await pageWith(broke, { width: 375, height: 812 });
    await launcherOnScreen(page);
    assert.match(
      await page.getByRole("button", { name: "Charge flagship weapons" }).innerText(),
      new RegExp(`Need ${TUNING.weaponChargeCost} Energy to charge`, "i"),
    );
    await page.getByRole("button", { name: "Charge flagship weapons" }).click();
    assert.match(await page.locator(".weapon-guide").first().innerText(), new RegExp(`Need ${TUNING.weaponChargeCost} Energy to charge`));
    assert.equal(await page.getByRole("button", { name: `Charge Attack for ${TUNING.weaponChargeCost} Energy`, exact: true }).isDisabled(), true);
    await ctx.close();
    console.log("PASS shipyard empty-state when the bank is short of a charge");
  }
  for (const [id, name] of [["rotate", "Rotate Flagship"], ["shield", "Super Shield"], ["attack", "Attack"], ["repair", "Repair"]]) {
    const { ctx, page } = await pageWith(fixture(), { width: 375, height: 812 });
    await launcherOnScreen(page);
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    await frame(page);
    // A real modal traps keyboard focus: Tab cannot reach Roll or Lock in.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest("dialog")));
    }
    const ownBefore = await saved(page);
    await page.keyboard.press("Escape");
    assert.equal((await saved(page)).rolls, ownBefore.rolls);
    assert.equal((await saved(page)).phase, "rolling");
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    await page.locator(".weapon-enemy-status summary").click();
    assert.match(await page.locator(".weapon-enemy-status").innerText(), /Available/);
    assert.doesNotMatch(await page.locator(".weapon-enemy-status").innerText(), /Used R6/);
    await page.getByRole("button", { name: `Use ${name}`, exact: true }).click();
    if (id === "rotate") {
      const direction = page.getByRole("button", { name: "+1 face", exact: true });
      const rect = await direction.boundingBox();
      assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= 812, "rotation directions must appear without scrolling");
      await direction.click();
    }
    assert.equal((await saved(page)).weapons[id].usedRound, 6);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Carry on/ }).click();
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    assert.equal(await page.locator(".weapon-card-used").count(), 1);
    assert.equal(await page.locator(".weapon-card-available button:enabled").count(), 0);
    if (id === "attack") await page.screenshot({ path: "shots/weapons-used-375.png" });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Lock in", exact: true }).click();
    await page.waitForTimeout(3200);
    const block = page.getByRole("button", { name: /Take.*flagship/i });
    if (await block.count()) await block.first().click();
    await page.locator(".weapon-report").waitFor({ state: "visible", timeout: 12000 });
    assert.match(await page.locator(".weapon-report").innerText(), /Enemy used Attack · \+12/);
    await page.locator(".weapon-report summary").click();
    assert.match(await page.locator(".weapon-report").innerText(), /Used R6/);
    await frame(page);
    if (id === "shield") {
      await page.waitForTimeout(1800);
      await page.screenshot({ path: "shots/weapons-volley-375.png" });
    }
    await ctx.close();
    console.log(`PASS ${name}: modal/fire/reload/hidden enemy activation/report`);
  }
  const final = await pageWith(fixture(false, true), { width: 375, height: 812 });
  await final.page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
  await final.page.getByRole("button", { name: "Use Attack", exact: true }).click();
  await final.page.getByRole("button", { name: "Lock in", exact: true }).click();
  await final.page.locator(".recap .weapon-status-list").first().waitFor({ timeout: 20000 });
  assert.equal(await final.page.locator(".recap .weapon-status-list").count(), 2);
  assert.match(await final.page.locator(".recap").innerText(), /Used R6/);
  await final.ctx.close();
  console.log("PASS final battle recap includes both weapon inventories");
  assert.deepEqual(errors, []);
  console.log("PASS no browser console errors");
} finally { await browser.close(); server.close(); }
