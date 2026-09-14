/** Phone screenshots of the shipyard charge bar, flagship tile, and d8 lighting. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./shoot.mjs";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { newMatch, newPlayer, newBrain, makeRng, setRng, TUNING } = G;

const ART = "/opt/cursor/artifacts/screenshots";
const DOCS = resolve("docs/pr53");
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

async function save(page, name) {
  const dest = `shots/${name}.png`;
  await page.screenshot({ path: dest });
  await copyFile(dest, `${ART}/${name}.png`);
  await copyFile(dest, `${DOCS}/${name}.png`);
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
      const flag = document.querySelector(".yard-cell-flag");
      const name = flag?.querySelector(".yard-cell-name");
      const sub = flag?.querySelector(".yard-cell-sub");
      const art = flag?.querySelector(".yard-cell-art");
      const star = flag?.textContent?.includes("★");
      const cr = charge?.getBoundingClientRect();
      const br = board?.getBoundingClientRect();
      const fr = flag?.getBoundingClientRect();
      const nr = name?.getBoundingClientRect();
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
      };
    });

    assert.match(layout.chargeText, /Charge flagship weapons/i);
    assert.equal(layout.chipText, String(TUNING.weaponChargeCost));
    assert.equal(layout.chipOk, true);
    assert.equal(layout.aboveBoard, true, "charge bar must sit above the fleet map");
    assert.equal(layout.footLauncher, false);
    assert.match(layout.name, /Flagship Level One/i);
    assert.match(layout.sub, /upgrade → Level Two/i);
    assert.equal(layout.hasStar, false);
    assert.equal(layout.hasSquare, true);
    assert.equal(layout.overflow, 0);
    assert.ok(layout.flagClip <= 1, `flagship tile clipped by ${layout.flagClip}px`);
    assert.ok(layout.nameClip <= 1, `flagship name clipped by ${layout.nameClip}px`);
    assert.equal(layout.nameInside, true, "Flagship Level One must stay inside the centre tile");

    await save(page, `shipyard_charge_${vp.width}x${vp.height}`);
    console.log(`PASS shipyard ${vp.width}x${vp.height}`, layout);
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

  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto("http://localhost:4323/lab/?view=faces&q=high", { waitUntil: "networkidle" });
    await page.waitForTimeout(1600);
    await save(page, "d8_lit_faces_390x844");
    await ctx.close();
    console.log("PASS d8 faces lighting shot");
  }

  console.log("PASS shipyard + d8 shots");
} finally {
  await browser.close();
  server.close();
}
