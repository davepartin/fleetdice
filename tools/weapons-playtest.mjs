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
    const inner = dialog?.querySelector(".weapon-window-inner");
    const body = dialog?.querySelector(".weapon-window-body");
    const lock = dialog?.querySelector(".weapon-enemy-locked .weapon-enemy-lock");
    const icon = lock?.previousElementSibling;
    const lockR = lock?.getBoundingClientRect();
    const iconR = icon?.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - innerWidth,
      dialogOverflow: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
      footerBottom: footer?.bottom, height: innerHeight,
      innerCan: inner ? inner.scrollHeight - inner.clientHeight : 0,
      bodyCan: body ? body.scrollHeight - body.clientHeight : 0,
      bodyOverflow: body ? getComputedStyle(body).overflowY : "",
      lockBeside: !!(lockR && iconR && lockR.left >= iconR.right - 2),
      hasLock: !!lock,
    };
  });
  assert.equal(layout.overflow, 0);
  assert.equal(layout.dialogOverflow, 0);
  if (layout.footerBottom) assert.ok(layout.footerBottom <= layout.height);
  if (layout.bodyOverflow) {
    assert.ok(layout.innerCan <= 2, `weapon panel scrolls by ${layout.innerCan}px`);
    assert.ok(layout.bodyCan <= 2, `weapon cards sit in a scroller (${layout.bodyCan}px)`);
    assert.notEqual(layout.bodyOverflow, "auto");
  }
  if (layout.hasLock) assert.equal(layout.lockBeside, true, "lock must sit beside the icon, not over it");
}
async function launcherOnScreen(page) {
  const button = page.getByRole("button", { name: /flagship weapon/i }).first();
  await button.waitFor({ state: "visible" });
  const box = await button.boundingBox();
  const vp = page.viewportSize();
  assert.ok(box && vp, "flagship weapon control must exist");
  assert.ok(box.y >= 0 && box.y + box.height <= vp.height,
    `flagship weapon control at y=${box.y.toFixed(0)} h=${box.height.toFixed(0)} is off the ${vp.width}×${vp.height} screen`);
}
async function assertDockWeaponLayout(page, using) {
  const layout = await page.evaluate(() => {
    const launcher = document.querySelector(".flagship-control-row > .weapon-launcher");
    const nested = document.querySelector(".flagship-line .weapon-launcher");
    const inAction = document.querySelector(".roll-dock-action .weapon-launcher");
    const face = document.querySelector(".flagship-face-copy") || document.querySelector(".flagship-line > span:last-child");
    const chip = document.querySelector(".flagship-line");
    const row = document.querySelector(".flagship-control-row");
    const dock = document.querySelector(".roll-dock");
    const extra = document.querySelector(".weapon-using-cue");
    const action = document.querySelector(".roll-dock-action");
    const lr = launcher?.getBoundingClientRect();
    const cr = chip?.getBoundingClientRect();
    const rr = row?.getBoundingClientRect();
    const primaries = action ? [...action.querySelectorAll("button")].map((b) => ({
      text: (b.textContent || "").replace(/\s+/g, " ").trim(),
      width: b.getBoundingClientRect().width,
    })) : [];
    return {
      hasRowLauncher: !!launcher,
      nested: !!nested,
      hasActionLauncher: !!inAction,
      extra: !!extra,
      faceText: face?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      faceClip: face ? face.scrollWidth - face.clientWidth : 99,
      chipClip: chip ? chip.scrollWidth - chip.clientWidth : 99,
      rowClip: row ? row.scrollWidth - row.clientWidth : 99,
      dockClip: dock ? dock.scrollWidth - dock.clientWidth : 99,
      launcher: lr && { y: lr.y, h: lr.height, w: lr.width, text: (launcher.textContent || "").replace(/\s+/g, " ").trim() },
      chip: cr && { y: cr.y, h: cr.height, w: cr.width, right: cr.right },
      row: rr && { y: rr.y, h: rr.height },
      vw: innerWidth,
      primaries,
    };
  });
  assert.equal(layout.hasActionLauncher, false, "weapon must not sit in roll-dock-action above Roll Fleet");
  assert.equal(layout.nested, false, "weapon must not nest inside the face chip");
  assert.ok(layout.hasRowLauncher, "Flagship Weapon must sit beside the face chip in the same row");
  assert.equal(layout.extra, false, "no second Using line below the chip");
  assert.ok(layout.faceClip <= 1, `face chip clipped by ${layout.faceClip}px (${layout.faceText})`);
  assert.ok(layout.chipClip <= 1, `flagship chip clipped by ${layout.chipClip}px`);
  assert.ok(layout.rowClip <= 1, `flagship row clipped by ${layout.rowClip}px`);
  assert.ok(layout.dockClip <= 1, `roll dock clipped horizontally by ${layout.dockClip}px`);
  assert.ok(layout.launcher && layout.chip && layout.row);
  assert.ok(layout.launcher.w >= 44, `weapon tap ${layout.launcher.w.toFixed(0)}px is too small`);
  assert.ok(layout.launcher.w <= 8.5 * 16 + 4, `weapon tap ${layout.launcher.w.toFixed(0)}px should stay a compact ~8.5rem side button`);
  assert.ok(layout.launcher.w < layout.vw * 0.48, `weapon tap ${layout.launcher.w.toFixed(0)}px is a 50/50 column, not a compact control`);
  assert.ok(layout.launcher.y >= layout.row.y - 1);
  assert.ok(layout.launcher.y + layout.launcher.h <= layout.row.y + layout.row.h + 1,
    "Flagship Weapon must share a row with the face chip, not sit on its own line");
  assert.ok(Math.abs(layout.launcher.y - layout.chip.y) < 12, "face chip and Flagship Weapon must sit on the same row");
  assert.ok(layout.launcher.y + layout.launcher.h / 2 > layout.chip.y);
  assert.ok(layout.launcher.y + layout.launcher.h / 2 < layout.chip.y + layout.chip.h);
  const big = layout.primaries.filter((b) => b.width >= layout.vw * 0.55);
  assert.ok(big.length <= 2, `roll-dock-action has ${big.length} wide buttons; only Roll/Reroll/Lock in should be large`);
  if (using) assert.match(layout.launcher.text, new RegExp(`Using ${using}`, "i"));
  else assert.match(layout.launcher.text, /Flagship Weapon/i);
}
try {
  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 620 }, { width: 360, height: 780 }]) {
    const { ctx, page } = await pageWith(fixture(true), viewport);
    await launcherOnScreen(page);
    await page.getByRole("button", { name: "Charge flagship weapons" }).click();
    await frame(page);
    assert.equal(await page.locator(".weapon-card-locked").count(), 4);
    const beforeBack = await saved(page);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    assert.deepEqual((await saved(page)).weapons, beforeBack.weapons);
    assert.equal((await saved(page)).energy, beforeBack.energy);
    await page.getByRole("button", { name: "Charge flagship weapons" }).click();
    for (const name of ["Rotate Flagship", "Super Shield", "Attack", "Repair"]) {
      await page.getByRole("button", { name: `Charge ${name} for 6 Energy`, exact: true }).click();
    }
    assert.equal((await saved(page)).energy, 0);
    assert.equal(await page.locator(".weapon-card-available").count(), 4);
    assert.match(await page.locator(".weapon-attack .weapon-effect").innerText(),
      new RegExp(String.raw`round\s*\(\s*${6}\s*\)\s*×\s*${TUNING.weaponAttackPerRound}\s*=\s*${6 * TUNING.weaponAttackPerRound} Attack`));
    await page.getByRole("button", { name: "Tips", exact: true }).click();
    await frame(page);
    await page.getByRole("button", { name: "Tips", exact: true }).click();
    await page.screenshot({ path: `shots/weapons-charged-${viewport.width}x${viewport.height}.png` });
    await page.getByRole("button", { name: "Back", exact: true }).click();
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
    assert.match(await page.locator("#weapon-title").innerText(), new RegExp(`Need ${TUNING.weaponChargeCost} Energy to charge`));
    assert.equal(await page.getByRole("button", { name: `Charge Attack for ${TUNING.weaponChargeCost} Energy`, exact: true }).isDisabled(), true);
    await ctx.close();
    console.log("PASS shipyard empty-state when the bank is short of a charge");
  }
  {
    const shop = fixture(true);
    shop.round = 3;
    for (const p of Object.values(shop.players)) p.round = 3;
    const { ctx, page } = await pageWith(shop, { width: 375, height: 812 });
    await page.getByRole("button", { name: "Charge flagship weapons" }).click();
    assert.match(await page.locator(".weapon-attack .weapon-effect").innerText(),
      new RegExp(String.raw`round\s*\(\s*3\s*\)\s*×\s*${TUNING.weaponAttackPerRound}\s*=\s*${3 * TUNING.weaponAttackPerRound} Attack`));
    await page.screenshot({ path: "shots/weapons-attack-equation-375.png" });
    await ctx.close();
    console.log("PASS Attack card shows round × 2 = N Attack");
  }
  {
    const s = newMatch("weapon-round1", "0000", "you", "You", "solo");
    s.players.guest = newPlayer("enemy", "Enemy", "ready");
    const { ctx, page } = await pageWith(s, { width: 390, height: 844 });
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    await frame(page);
    assert.match(await page.locator("#weapon-title").innerText(), /Each flagship weapon once a game/);
    assert.match(await page.locator("#weapon-title").innerText(), /Only one per round/);
    assert.doesNotMatch(await page.locator("#weapon-title").innerText(), /wisely|—/);
    assert.doesNotMatch(await page.locator(".weapon-window").innerText(), /Roll your fleet before using a weapon/);
    assert.match(await page.locator(".weapon-attack .weapon-effect").innerText(),
      new RegExp(String.raw`round\s*\(\s*1\s*\)\s*×\s*${TUNING.weaponAttackPerRound}\s*=\s*${TUNING.weaponAttackPerRound} Attack`));
    assert.equal(await page.locator(".weapon-enemy-boxes .weapon-enemy-box").count(), 4);
    assert.equal(await page.locator(".weapon-enemy-locked").count(), 4);
    const row = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll(".weapon-enemy-box")].map(el => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, width: r.width };
      });
      const tops = boxes.map(b => b.top);
      const dialog = document.querySelector("dialog");
      const footer = dialog?.querySelector("footer")?.getBoundingClientRect();
      const rowBox = document.querySelector(".weapon-enemy-row")?.getBoundingClientRect();
      return {
        sameRow: Math.max(...tops) - Math.min(...tops) <= 2,
        overflow: document.documentElement.scrollWidth - innerWidth,
        dialogOverflow: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
        aboveFooter: !!(rowBox && footer && rowBox.bottom <= footer.top + 1),
      };
    });
    assert.equal(row.sameRow, true, "enemy weapon boxes must sit on one row");
    assert.equal(row.overflow, 0);
    assert.equal(row.dialogOverflow, 0);
    assert.equal(row.aboveFooter, true, "enemy row must sit above Back, not under it");
    await page.screenshot({ path: "shots/weapons-panel-round1-locked-390x844.png" });
    await ctx.close();
    console.log("PASS round 1 locked panel copy, Attack equation, four-box enemy row");
  }
  {
    const s = fixture();
    s.players.guest.weapons.rotate = { chargedRound: null, usedRound: null };
    s.players.guest.weapons.shield = { chargedRound: 6, usedRound: null };
    s.players.guest.weapons.attack = { chargedRound: 5, usedRound: 5, use: { id: "attack", round: 5, amount: 10 } };
    s.players.guest.weapons.repair = { chargedRound: null, usedRound: null };
    s.players.guest.weaponThisRound = null;
    for (const viewport of [{ width: 390, height: 844 }, { width: 390, height: 620 }, { width: 360, height: 780 }]) {
      const { ctx, page } = await pageWith(s, viewport);
      await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
      await frame(page);
      assert.equal(await page.locator(".weapon-enemy-box.weapon-rotate.weapon-enemy-locked").count(), 1);
      assert.equal(await page.locator(".weapon-enemy-box.weapon-shield.weapon-enemy-available").count(), 1);
      assert.equal(await page.locator(".weapon-enemy-box.weapon-attack.weapon-enemy-used").count(), 1);
      assert.equal(await page.locator(".weapon-enemy-box.weapon-repair.weapon-enemy-locked").count(), 1);
      const row = await page.evaluate(() => {
        const boxes = [...document.querySelectorAll(".weapon-enemy-box")].map(el => el.getBoundingClientRect());
        const tops = boxes.map(b => b.top);
        const dialog = document.querySelector("dialog");
        const footer = dialog?.querySelector("footer")?.getBoundingClientRect();
        const rowBox = document.querySelector(".weapon-enemy-row")?.getBoundingClientRect();
        return {
          count: boxes.length,
          sameRow: Math.max(...tops) - Math.min(...tops) <= 2,
          overflow: document.documentElement.scrollWidth - innerWidth,
          dialogOverflow: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
          aboveFooter: !!(rowBox && footer && rowBox.bottom <= footer.top + 1),
        };
      });
      assert.equal(row.count, 4);
      assert.equal(row.sameRow, true);
      assert.equal(row.overflow, 0);
      assert.equal(row.dialogOverflow, 0);
      assert.equal(row.aboveFooter, true, "enemy row must sit above Back, not under it");
      await page.screenshot({ path: `shots/weapons-enemy-row-mixed-${viewport.width}x${viewport.height}.png` });
      await ctx.close();
      console.log(`PASS mixed enemy row ${viewport.width}x${viewport.height}`);
    }
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 390, height: 620 }, { width: 360, height: 780 }]) {
    const attackFace = fixture();
    attackFace.players.host.flag.face = 6;
    const { ctx, page } = await pageWith(attackFace, viewport);
    await launcherOnScreen(page);
    await assertDockWeaponLayout(page);
    const faceText = await page.locator(".flagship-face-copy").innerText();
    assert.match(faceText, /Attack/);
    assert.match(faceText, /Attack per even/);
    assert.doesNotMatch(faceText, /…|\.\.\./);
    await page.screenshot({ path: `shots/weapons-dock-chip-${viewport.width}x${viewport.height}.png` });
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    await page.getByRole("button", { name: "Use Attack", exact: true }).click();
    await assertDockWeaponLayout(page, "Attack");
    if (viewport.width === 390 && viewport.height === 844) {
      await page.screenshot({ path: "shots/weapons-dock-using-390x844.png" });
    }
    await ctx.close();
    console.log(`PASS dock sibling layout ${viewport.width}x${viewport.height}`);
  }
  for (const [id, name] of [["rotate", "Rotate Flagship"], ["shield", "Super Shield"], ["attack", "Attack"], ["repair", "Repair"]]) {
    const { ctx, page } = await pageWith(fixture(), { width: 375, height: 812 });
    await launcherOnScreen(page);
    await assertDockWeaponLayout(page);
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
    assert.equal(await page.locator(".weapon-enemy-status summary").count(), 0);
    assert.equal(await page.locator(".weapon-enemy-boxes .weapon-enemy-box").count(), 4);
    assert.equal(await page.locator(".weapon-enemy-box.weapon-attack.weapon-enemy-available").count(), 1);
    assert.equal(await page.locator(".weapon-enemy-box.weapon-attack.weapon-enemy-used").count(), 0);
    assert.equal(await page.locator('.weapon-enemy-box[aria-label="Attack · Available"]').count(), 1);
    await page.getByRole("button", { name: `Use ${name}`, exact: true }).click();
    if (id === "rotate") {
      const direction = page.getByRole("button", { name: "Turn the flagship +1", exact: true });
      const rect = await direction.boundingBox();
      assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= 812, "rotation directions must appear without scrolling");
      assert.ok(rect.height <= 52, `rotate +1 is ${rect.height}px tall; must stay a normal primary control`);
      await page.screenshot({ path: "shots/weapons-rotate-375.png" });
      await direction.click();
    }
    assert.equal((await saved(page)).weapons[id].usedRound, 6);
    assert.equal(await page.locator(".weapon-using-cue").count(), 0, "no second Using line above Lock in");
    const short = { rotate: "Rotate", shield: "Shield", attack: "Attack", repair: "Repair" };
    await assertDockWeaponLayout(page, short[id]);
    if (id === "rotate") await page.screenshot({ path: "shots/weapons-using-rotate-375.png" });
    if (id === "attack") await page.screenshot({ path: "shots/weapons-using-375.png" });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Carry on/ }).click();
    await page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
    assert.equal(await page.locator(".weapon-card-used").count(), 1);
    assert.equal(await page.locator(".weapon-card-available button:enabled").count(), 0);
    if (id === "attack") await page.screenshot({ path: "shots/weapons-used-375.png" });
    await page.getByRole("button", { name: "Back", exact: true }).click();
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
