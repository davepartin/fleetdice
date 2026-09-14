/** Phone screenshots of the FLAGSHIP WEAPONS panel polish. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./shoot.mjs";
import { bundlePath } from "../sim/bundle.mjs";
const G = await import(bundlePath);
const { newMatch, newPlayer, newBrain, applyAction, makeRng, setRng, WEAPON_IDS, TUNING } = G;

const ART = "/opt/cursor/artifacts/screenshots";
await mkdir("shots", { recursive: true });
await mkdir(ART, { recursive: true });
const server = await serve(resolve("out"), 4322);
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});

function roundOne() {
  setRng(makeRng(52));
  const s = newMatch("weapon-round1", "0000", "you", "You", "solo");
  s.players.guest = newPlayer("enemy", "Enemy", "ready");
  return s;
}

function mixed() {
  setRng(makeRng(52));
  const s = newMatch("weapon-mixed", "0000", "you", "You", "solo");
  s.players.guest = newPlayer("enemy", "Enemy", "shop");
  s.round = 6;
  for (const p of Object.values(s.players)) {
    p.round = 6; p.energy = 24; p.phase = "shop"; p.hp = 100; p.maxHp = 100;
  }
  for (const id of WEAPON_IDS) applyAction(s, "host", { type: "shop", operation: "weapon", weapon: id });
  applyAction(s, "guest", { type: "shop", operation: "weapon", weapon: "shield" });
  s.players.guest.weapons.attack = { chargedRound: 5, usedRound: 5, use: { id: "attack", round: 5, amount: 10 } };
  for (const side of ["host", "guest"]) {
    applyAction(s, side, { type: "ready" });
    applyAction(s, side, { type: "roll", dice: [] });
  }
  return s;
}

async function pageWith(state, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.addInitScript(save => {
    if (!localStorage.getItem("fd3.solo.battle.v1")) localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(save));
  }, { schema: 1, savedAt: Date.now(), state, brain: newBrain("balanced", "low") });
  await page.goto("http://localhost:4322/solo/?q=low", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Carry on/ }).click();
  return { ctx, page };
}

async function measureRow(page) {
  const row = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll(".weapon-enemy-box")].map(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top, width: r.width, height: r.height };
    });
    const tops = boxes.map(b => b.top);
    const dialog = document.querySelector("dialog");
    const inner = document.querySelector(".weapon-window-inner");
    const body = document.querySelector(".weapon-window-body");
    const guide = document.querySelector("#weapon-title")?.innerText ?? "";
    const attack = document.querySelector(".weapon-attack .weapon-effect")?.innerText ?? "";
    const footer = dialog?.querySelector("footer")?.getBoundingClientRect();
    const rowBox = document.querySelector(".weapon-enemy-row")?.getBoundingClientRect();
    const lock = document.querySelector(".weapon-enemy-locked .weapon-enemy-lock");
    const icon = lock?.previousElementSibling;
    const lockR = lock?.getBoundingClientRect();
    const iconR = icon?.getBoundingClientRect();
    const hues = [...document.querySelectorAll(".weapon-enemy-box")].map(box => {
      const symbol = box.querySelector(".weapon-symbol");
      return {
        id: [...box.classList].find(c => c.startsWith("weapon-") && !c.startsWith("weapon-enemy")),
        color: symbol ? getComputedStyle(symbol).color : "",
      };
    });
    return {
      count: boxes.length,
      sameRow: boxes.length ? Math.max(...tops) - Math.min(...tops) <= 2 : false,
      overflow: document.documentElement.scrollWidth - innerWidth,
      dialogOverflow: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
      innerCan: inner ? inner.scrollHeight - inner.clientHeight : 0,
      bodyCan: body ? body.scrollHeight - body.clientHeight : 0,
      bodyOverflow: body ? getComputedStyle(body).overflowY : "",
      boxW: boxes[0]?.width ?? 0,
      boxH: boxes[0]?.height ?? 0,
      guide,
      attack,
      aboveFooter: !!(rowBox && footer && rowBox.bottom <= footer.top + 1),
      lockBeside: !!(lockR && iconR && lockR.left >= iconR.right - 2),
      hues,
    };
  });
  assert.equal(row.count, 4);
  assert.equal(row.sameRow, true, "enemy boxes must sit on one row");
  assert.equal(row.overflow, 0);
  assert.equal(row.dialogOverflow, 0);
  assert.ok(row.innerCan <= 2, `weapon panel scrolls by ${row.innerCan}px`);
  assert.ok(row.bodyCan <= 2, `weapon cards sit in a scroller (${row.bodyCan}px)`);
  assert.notEqual(row.bodyOverflow, "auto");
  assert.equal(row.aboveFooter, true, "enemy row must sit above Back, not under it");
  assert.equal(row.lockBeside, true, "lock must sit beside the icon, not over it");
  for (const hue of row.hues) {
    assert.match(hue.color, /^rgb\(/, `${hue.id} icon should have a colour`);
    assert.doesNotMatch(hue.color, /rgb\(137,\s*150,\s*1(78|84)\)/, `${hue.id} icon should stay coloured, not grey`);
  }
  return row;
}

async function saveShot(page, name) {
  const dest = `shots/${name}.png`;
  await page.locator(".weapon-window").screenshot({ path: dest });
  await copyFile(dest, `${ART}/${name}.png`);
}

try {
  {
    const { ctx, page } = await pageWith(roundOne(), { width: 390, height: 844 });
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    const row = await measureRow(page);
    assert.match(row.guide, /Each flagship weapon once a game/);
    assert.match(row.guide, /Only one per round/);
    assert.doesNotMatch(row.guide, /wisely|—/);
    assert.doesNotMatch(await page.locator(".weapon-window").innerText(), /Roll your fleet before using a weapon/);
    assert.doesNotMatch(await page.locator(".weapon-window").innerText(), /FLAGSHIP WEAPONS/);
    assert.match(row.attack, new RegExp(String.raw`round\s*\(\s*1\s*\)\s*×\s*${TUNING.weaponAttackPerRound}\s*=\s*${TUNING.weaponAttackPerRound} Attack`));
    assert.equal(await page.locator(".weapon-enemy-locked").count(), 4);
    await saveShot(page, "weapons_panel_compact_locked_390x844");
    console.log("round1", row);
    await ctx.close();
  }
  for (const vp of [{ width: 390, height: 844 }, { width: 390, height: 620 }, { width: 360, height: 780 }]) {
    const { ctx, page } = await pageWith(mixed(), vp);
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    const row = await measureRow(page);
    assert.equal(await page.locator(".weapon-enemy-box.weapon-rotate.weapon-enemy-locked").count(), 1);
    assert.equal(await page.locator(".weapon-enemy-box.weapon-shield.weapon-enemy-available").count(), 1);
    assert.equal(await page.locator(".weapon-enemy-box.weapon-attack.weapon-enemy-used").count(), 1);
    assert.equal(await page.locator(".weapon-enemy-box.weapon-repair.weapon-enemy-locked").count(), 1);
    assert.match(row.attack, new RegExp(String.raw`round\s*\(\s*6\s*\)\s*×\s*${TUNING.weaponAttackPerRound}\s*=\s*${12} Attack`));
    await saveShot(page, `weapons_panel_compact_mixed_${vp.width}x${vp.height}`);
    console.log(`mixed ${vp.width}x${vp.height}`, row);
    await ctx.close();
  }
  console.log("PASS panel shots");
} finally {
  await browser.close();
  server.close();
}
