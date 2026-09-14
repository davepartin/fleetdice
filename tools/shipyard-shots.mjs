/** Phone screenshots of the shipyard charge button, full-width map, and Charged state. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./shoot.mjs";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { newMatch, newPlayer, newBrain, makeRng, setRng, applyAction, WEAPON_IDS, TUNING } = G;

const ART = "/opt/cursor/artifacts/screenshots";
const DOCS = resolve("docs/shipyard-polish");
await mkdir("shots", { recursive: true });
await mkdir(ART, { recursive: true });
await mkdir(DOCS, { recursive: true });

const server = await serve(resolve("out"), 4323);
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});

function shopState() {
  setRng(makeRng(52));
  const s = newMatch("shipyard-charge-shot", "0000", "you", "You", "solo");
  s.players.guest = newPlayer("enemy", "Enemy", "report");
  s.round = 2;
  for (const p of Object.values(s.players)) {
    p.round = 2;
    p.energy = 16;
    p.phase = "shop";
    p.hp = 57;
    p.maxHp = 60;
  }
  s.players.guest.hp = 54;
  s.players.guest.maxHp = 60;
  return s;
}

function chargedState() {
  const s = shopState();
  s.players.host.energy = 24;
  for (const id of WEAPON_IDS) {
    applyAction(s, "host", { type: "shop", operation: "weapon", weapon: id });
  }
  return s;
}

async function save(page, name) {
  const dest = `shots/${name}.png`;
  await page.screenshot({ path: dest });
  await copyFile(dest, `${ART}/${name}.png`);
  await copyFile(dest, `${DOCS}/${name}.png`);
}

function parseRgb(color) {
  const m = color.match(/rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

try {
  for (const vp of [
    { width: 390, height: 844 },
    { width: 390, height: 620 },
    { width: 360, height: 780 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.addInitScript((save) => {
      if (!localStorage.getItem("fd3.solo.battle.v1")) {
        localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(save));
      }
    }, { schema: 1, savedAt: Date.now(), state: shopState(), brain: newBrain("balanced", "low") });
    await page.goto("http://localhost:4323/solo/?q=low", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Carry on/ }).click();
    await page.getByRole("button", { name: "Charge flagship weapons" }).waitFor({ state: "visible" });

    const layout = await page.evaluate(() => {
      const charge = document.querySelector(".yard-charge .weapon-launcher");
      const chip = document.querySelector(".yard-charge .yard-price");
      const board = document.querySelector(".yard-board");
      const foot = document.querySelector(".yard-foot");
      const flag = document.querySelector(".yard-cell-flag");
      const name = flag?.querySelector(".yard-cell-name");
      const sub = flag?.querySelector(".yard-cell-sub");
      const art = flag?.querySelector(".yard-cell-art");
      const star = flag?.textContent?.includes("★");
      const cr = charge?.getBoundingClientRect();
      const br = board?.getBoundingClientRect();
      const fr = flag?.getBoundingClientRect();
      const nr = name?.getBoundingClientRect();
      const cs = charge ? getComputedStyle(charge) : null;
      return {
        chargeText: (charge?.textContent || "").replace(/\s+/g, " ").trim(),
        chipText: (chip?.textContent || "").replace(/\s+/g, " ").trim(),
        chipOk: chip?.classList.contains("yard-price-ok") ?? false,
        aboveBoard: !!(cr && br && cr.bottom <= br.top + 1),
        footLauncher: !!document.querySelector(".yard-foot .weapon-launcher"),
        name: (name?.textContent || "").replace(/\s+/g, " ").trim(),
        sub: (sub?.textContent || "").replace(/\s+/g, " ").trim(),
        hasStar: !!star,
        hasSquare: !!art?.querySelector("svg path"),
        overflow: document.documentElement.scrollWidth - innerWidth,
        flagClip: flag ? flag.scrollWidth - flag.clientWidth : 0,
        nameClip: name ? name.scrollWidth - name.clientWidth : 0,
        nameInside: !!(fr && nr && nr.left >= fr.left - 1 && nr.right <= fr.right + 1),
        boardAboveFoot: !!(br && foot &&
          br.bottom <= foot.getBoundingClientRect().top + 2),
        chargeWidth: cr ? Math.round(cr.width) : 0,
        boardWidth: br ? Math.round(br.width) : 0,
        chargeLeft: cr ? Math.round(cr.left) : 0,
        boardLeft: br ? Math.round(br.left) : 0,
        chargeBg: cs?.backgroundImage || cs?.backgroundColor || "",
        chargeColor: cs?.color || "",
      };
    });

    assert.match(layout.chargeText, /Charge flagship weapons/i);
    assert.equal(layout.chipText, String(TUNING.weaponChargeCost));
    assert.equal(layout.chipOk, true);
    assert.equal(layout.aboveBoard, true, "charge button must sit above the fleet map");
    assert.equal(layout.footLauncher, false);
    assert.match(layout.name, /Flagship Level One/i);
    assert.match(layout.sub, /→ Level Two/i);
    assert.equal(layout.hasStar, false);
    assert.equal(layout.hasSquare, true);
    assert.equal(layout.overflow, 0);
    assert.ok(layout.flagClip <= 1, `flagship tile clipped by ${layout.flagClip}px`);
    assert.ok(layout.nameClip <= 1, `flagship name clipped by ${layout.nameClip}px`);
    assert.equal(layout.nameInside, true, "Flagship Level One must stay inside the centre tile");
    assert.equal(layout.boardAboveFoot, true, "the fleet map must sit above Return to battle");
    assert.ok(
      Math.abs(layout.boardWidth - layout.chargeWidth) <= 2,
      `fleet map ${layout.boardWidth}px must match charge button ${layout.chargeWidth}px`,
    );
    assert.ok(
      Math.abs(layout.boardLeft - layout.chargeLeft) <= 2,
      `fleet map left ${layout.boardLeft} must match charge left ${layout.chargeLeft}`,
    );
    assert.match(layout.chargeBg, /gradient/i, "charge control must be a filled button, not an outline");

    await save(page, `shipyard_charge_${vp.width}x${vp.height}`);
    console.log(`PASS shipyard ${vp.width}x${vp.height}`, layout);
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.addInitScript((save) => {
      if (!localStorage.getItem("fd3.solo.battle.v1")) {
        localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(save));
      }
    }, { schema: 1, savedAt: Date.now(), state: chargedState(), brain: newBrain("balanced", "low") });
    await page.goto("http://localhost:4323/solo/?q=low", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Carry on/ }).click();
    await page.getByRole("button", { name: "Charge flagship weapons" }).click();
    await page.locator(".weapon-btn-charged").first().waitFor({ state: "visible" });

    const charged = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll(".weapon-btn-charged")];
      return buttons.map((btn) => {
        const cs = getComputedStyle(btn);
        return {
          text: (btn.textContent || "").trim(),
          color: cs.color,
          backgroundImage: cs.backgroundImage,
          backgroundColor: cs.backgroundColor,
        };
      });
    });
    assert.equal(charged.length, 4, "all four weapons should show Charged");
    for (const btn of charged) {
      assert.equal(btn.text, "Charged");
      assert.match(btn.backgroundImage, /gradient/i, "Charged must be a coloured fill, not a flat black");
      const ink = parseRgb(btn.color);
      assert.ok(ink, `Charged ink unreadable: ${btn.color}`);
      assert.ok(ink.r < 50 && ink.g < 50 && ink.b < 50, `Charged ink should be dark on a coloured fill (${btn.color})`);
    }

    await save(page, "weapons_charged_390x844");
    console.log("PASS charged weapons", charged);
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.addInitScript((save) => {
      if (!localStorage.getItem("fd3.solo.battle.v1")) {
        localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(save));
      }
    }, { schema: 1, savedAt: Date.now(), state: shopState(), brain: newBrain("balanced", "low") });
    await page.goto("http://localhost:4323/solo/?q=low", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Carry on/ }).click();
    await page.getByRole("button", { name: "Charge flagship weapons" }).waitFor({ state: "visible" });
    const desktop = await page.evaluate(() => {
      const frame = document.querySelector(".app-frame")?.getBoundingClientRect();
      const board = document.querySelector(".yard-board")?.getBoundingClientRect();
      const charge = document.querySelector(".yard-charge .weapon-launcher")?.getBoundingClientRect();
      return {
        frameWidth: frame ? Math.round(frame.width) : 0,
        boardWidth: board ? Math.round(board.width) : 0,
        chargeWidth: charge ? Math.round(charge.width) : 0,
        boardLeft: board ? Math.round(board.left) : 0,
        chargeLeft: charge ? Math.round(charge.left) : 0,
      };
    });
    assert.equal(desktop.frameWidth, 390, "desktop must stay the 390px phone column");
    assert.ok(Math.abs(desktop.boardWidth - desktop.chargeWidth) <= 2, "desktop map must match charge width");
    await save(page, "shipyard_desktop_1280x800");
    console.log("PASS desktop phone column", desktop);
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto("http://localhost:4323/lab/?q=high", { waitUntil: "networkidle" });
    await page.waitForTimeout(1600);
    await save(page, "d8_lit_board_390x844");
    await ctx.close();
    console.log("PASS d8 board lighting shot");
  }

  console.log("PASS shipyard polish shots");
} finally {
  await browser.close();
  server.close();
}
