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
  CLASSIC_WEAPON_IDS,
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
  for (const id of CLASSIC_WEAPON_IDS) {
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
  s.players.host.energy = 12;
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

async function powerButtonPaint(card) {
  return card.locator(":scope > button").evaluate(button => {
    const style = getComputedStyle(button);
    return { background: style.backgroundImage, ink: style.color };
  });
}

async function measureWindow(page) {
  return page.evaluate(() => {
    // Test the painted button corners against the tile's curved inner rim.
    function roundedBox(el, inset = 0) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const corners = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map((corner) => {
        const values = style[`border${corner}Radius`].split(" ").map(parseFloat);
        return [Math.max(0, values[0] - inset), Math.max(0, (values[1] ?? values[0]) - inset)];
      });
      const w = r.width - 2 * inset, h = r.height - 2 * inset;
      const factor = Math.min(1, w / (corners[0][0] + corners[1][0]), w / (corners[2][0] + corners[3][0]), h / (corners[0][1] + corners[3][1]), h / (corners[1][1] + corners[2][1]));
      const radii = corners.map(([x, y]) => [x * factor, y * factor]);
      const left = r.left + inset, top = r.top + inset;
      const right = r.right - inset, bottom = r.bottom - inset;
      const centers = radii.map(([x, y], i) => [i === 0 || i === 3 ? left + x : right - x, i < 2 ? top + y : bottom - y]);
      return { left, top, right, bottom, radii, centers };
    }
    function contains(box, x, y) {
      if (x < box.left - .1 || x > box.right + .1 || y < box.top - .1 || y > box.bottom + .1) return false;
      return box.radii.every(([rx, ry], i) => {
        const [cx, cy] = box.centers[i];
        const inCorner = (i === 0 || i === 3 ? x < cx : x > cx) && (i < 2 ? y < cy : y > cy);
        return !inCorner || !rx || !ry || ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.01;
      });
    }
    const escapedCorners = [...document.querySelectorAll(".weapon-card button")].filter((button) => {
      const tile = button.closest(".weapon-card");
      const inset = parseFloat(getComputedStyle(tile).borderLeftWidth);
      const outer = roundedBox(tile, inset), inner = roundedBox(button);
      return inner.radii.some(([rx, ry], i) => {
        const [cx, cy] = inner.centers[i];
        const start = [Math.PI, 1.5 * Math.PI, 0, .5 * Math.PI][i];
        return Array.from({ length: 9 }, (_, step) => start + step * Math.PI / 16).some((a) => !contains(outer, cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
      });
    }).map((button) => button.textContent);
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
      escapedCorners,
      cards: cards.length,
      names: cards.map((c) => c.name),
      innerScroll: inner ? inner.scrollHeight - inner.clientHeight : 0,
      bodyScroll: body ? body.scrollHeight - body.clientHeight : 0,
      dialogH: dialog ? Math.round(dialog.getBoundingClientRect().height) : 0,
      viewH: innerHeight,
      overflowers,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      clippedControls: [...document.querySelectorAll(".weapon-card button, .weapon-window footer button")].filter((el) => {
        const r = el.getBoundingClientRect();
        const bounds = dialog.getBoundingClientRect();
        return r.bottom > bounds.bottom + 1 || r.top < bounds.top || r.right > bounds.right || r.left < bounds.left;
      }).map((el) => el.textContent),
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
    { width: 390, height: 844 },
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
    assert.doesNotMatch(await page.locator(".weapon-window").innerText(), /Unlock/);
    const emptyPaint = {};
    for (const id of ["energyAttack", "energyShield"]) {
      const card = page.locator(`.weapon-card.weapon-${id}`);
      assert.match(await card.innerText(), /Empty/);
      assert.match(await card.innerText(), /0\/5\s*added/);
      assert.equal(await card.getByRole("button", { name: /Add 1 Energy to/ }).isEnabled(), true);
      emptyPaint[id] = await powerButtonPaint(card);
    }
    await save(page, "energy-weapons-shipyard-charge-375x812");
    await page.getByRole("button", { name: "Add 1 Energy to Energy Shield", exact: true }).click();
    const shield = page.locator(".weapon-card.weapon-energyShield");
    assert.match(await shield.innerText(), /2\/40/);
    assert.match(await shield.innerText(), /1\/5\s*added/);
    await page.waitForTimeout(350);
    assert.equal(Number((await page.locator(".weapon-window [data-energy-bank]").innerText()).replace(/[^0-9]/g, "")), 39);
    const attack = page.locator(".weapon-card.weapon-energyAttack");
    await attack.getByRole("button", { name: "Add 1 Energy to Energy Attack", exact: true }).click();
    const attackPaint = await powerButtonPaint(attack);
    const shieldPaint = await powerButtonPaint(shield);
    for (const [card, paint, empty] of [[attack, attackPaint, emptyPaint.energyAttack], [shield, shieldPaint, emptyPaint.energyShield]]) {
      assert.equal(await card.locator(":scope > button").isDisabled(), true, "stored power does not allow firing in the shipyard");
      assert.notEqual(paint.background, empty.background, "a paid fill must light the power control immediately");
      assert.equal(paint.ink, "rgb(9, 13, 23)", "powered controls use dark readable text on the weapon color");
    }
    assert.notEqual(attackPaint.background, shieldPaint.background, "Attack and Shield must show different power colors");
    await save(page, "energy-weapons-shipyard-powered-375x812");
    await ctx.close();
  }

  for (const vp of views) {
    const { ctx, page } = await pageWith(sixOpen(), vp);
    await page.getByRole("button", { name: /Flagship Weapon|Use flagship weapon/i }).click();
    await page.locator(".weapon-window").waitFor({ state: "visible" });
    const layout = await measureWindow(page);
    await save(page, `energy-weapons-six-${vp.width}x${vp.height}`);
    console.log(JSON.stringify(layout));
    assert.equal(layout.cards, 6, `${vp.width}x${vp.height} must show all six`);
    assert.deepEqual(layout.names, [
      "Rotate Flagship", "Repair", "Attack", "Super Shield", "Energy Attack", "Energy Shield",
    ]);
    assert.ok(layout.innerScroll <= 4, `${vp.width}x${vp.height} window scrolls by ${layout.innerScroll}px`);
    assert.ok(layout.bodyScroll <= 4, `${vp.width}x${vp.height} cards scroll by ${layout.bodyScroll}px`);
    assert.equal(layout.overflowX, 0, `${vp.width}x${vp.height} overflows horizontally`);
    assert.deepEqual(layout.clippedControls, [], "all weapon controls and Back must fit in the dialog");
    assert.deepEqual(layout.escapedCorners, [], "button corners must stay inside each tile rim");
    for (const id of ["energyAttack", "energyShield"]) {
      assert.equal((await powerButtonPaint(page.locator(`.weapon-card.weapon-${id}`))).ink, "rgb(9, 13, 23)");
    }
    if (vp.width === 375) {
      await save(page, "energy-weapons-midfill-375x812", ".weapon-card-energy.weapon-energyAttack");
      const attack = page.locator(".weapon-card-energy.weapon-energyAttack");
      const shield = page.locator(".weapon-card-energy.weapon-energyShield");
      const bank = () => page.locator(".weapon-window [data-energy-bank]").innerText();
      const startBank = Number((await bank()).replace(/[^0-9]/g, ""));
      assert.match(await attack.innerText(), /3\/5\s*added/);
      await attack.getByRole("button", { name: "Add 1 Energy to Energy Attack", exact: true }).click();
      assert.match(await attack.innerText(), /4\/20/);
      assert.match(await attack.innerText(), /4\/5\s*added/);
      assert.match(await shield.innerText(), /4\/40/);
      await page.waitForTimeout(350);
      assert.equal(Number((await bank()).replace(/[^0-9]/g, "")), startBank - 1);
      await attack.getByRole("button", { name: "Add 1 Energy to Energy Attack", exact: true }).click();
      assert.equal(await attack.getByRole("button", { name: "Add 1 Energy to Energy Attack", exact: true }).isDisabled(), true);
      assert.match(await attack.innerText(), /5\/5\s*added/);
      assert.match(await attack.innerText(), /Round limit reached/);
      assert.equal(await shield.getByRole("button", { name: "Add 1 Energy to Energy Shield", exact: true }).isEnabled(), true);
      await shield.getByRole("button", { name: "Add 1 Energy to Energy Shield", exact: true }).click();
      assert.match(await shield.innerText(), /6\/40/);
      assert.match(await shield.innerText(), /3\/5\s*added/);
      const poweredAttack = await powerButtonPaint(attack);
      const poweredShield = await powerButtonPaint(shield);
      await save(page, "energy-weapons-plus-limit-375x812");
      await attack.getByRole("button", { name: "Use Energy Attack", exact: true }).click();
      await page.getByRole("button", { name: /Use flagship weapon/i }).click();
      assert.match(await attack.innerText(), /0\/20/);
      assert.match(await attack.innerText(), /5\/5\s*added/);
      assert.equal(await attack.getByRole("button", { name: "Add 1 Energy to Energy Attack", exact: true }).isDisabled(), true);
      assert.match(await shield.innerText(), /6\/40/);
      assert.notEqual((await powerButtonPaint(attack)).background, poweredAttack.background, "firing empties the store and darkens its control");
      assert.deepEqual(await powerButtonPaint(shield), poweredShield, "stored Shield power stays colored after the round's other weapon fires");
    }
    await ctx.close();
  }

  {
    const state = sixOpen();
    const stock = state.players.host.weapons;
    stock.rotate.chargedRound = null;
    stock.repair.usedRound = 3;
    stock.energyAttack.stored = 0;
    stock.energyAttack.filledThisRound = 0;
    stock.energyShield.stored = TUNING.weaponEnergyStoreMax;
    stock.energyShield.filledThisRound = 0;
    const { ctx, page } = await pageWith(state, { width: 360, height: 780 });
    await page.getByRole("button", { name: /Use flagship weapon/i }).click();
    const attack = page.locator(".weapon-card-energy.weapon-energyAttack");
    const shield = page.locator(".weapon-card-energy.weapon-energyShield");
    assert.equal(await attack.getByRole("button", { name: "Use Energy Attack", exact: true }).isDisabled(), true);
    assert.equal(await attack.getByRole("button", { name: "Add 1 Energy to Energy Attack", exact: true }).isEnabled(), true);
    assert.equal(await shield.getByRole("button", { name: "Add 1 Energy to Energy Shield", exact: true }).isDisabled(), true);
    assert.match(await shield.innerText(), /Store full/);
    await save(page, "energy-weapons-empty-full-360x780");
    await attack.getByRole("button", { name: "Add 1 Energy to Energy Attack", exact: true }).click();
    assert.match(await attack.innerText(), /1\/20/);
    assert.equal(await attack.getByRole("button", { name: "Use Energy Attack", exact: true }).isEnabled(), true);
    assert.match(await shield.innerText(), /40\/40/);
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
