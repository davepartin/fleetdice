/** Phone proof for d4-first building and one upgrade step per ship per round. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { newBrain, newMatch, newPlayer, makeRng, setRng } = G;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const WIDTH = Number(process.env.VIEWPORT_WIDTH ?? 375);
const HEIGHT = Number(process.env.VIEWPORT_HEIGHT ?? 812);
const OUT = `docs/shipyard-pacing-${WIDTH}x${HEIGHT}.png`;

function shopState() {
  setRng(makeRng(92));
  const state = newMatch("shipyard-pacing", "0000", "you", "You", "solo");
  state.players.guest = newPlayer("enemy", "Enemy", "report");
  state.round = 2;
  for (const player of Object.values(state.players)) {
    player.round = 2;
    player.energy = 30;
    player.phase = "shop";
  }
  const openedSlot = state.players.host.ships[0].slot;
  state.players.host.ships = state.players.host.ships.slice(1);
  return state;
}

await mkdir("docs", { recursive: true });
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  await page.addInitScript((save) => {
    localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(save));
  }, { schema: 1, savedAt: Date.now(), state: shopState(), brain: newBrain("balanced", "low") });
  await page.goto(`${BASE}/solo/?q=low`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Carry on/i }).click();

  await page.locator(".yard-cell-empty").click();
  const hullChoices = page.locator(".yard-hull");
  assert.equal(await hullChoices.count(), 1, "an empty bay must offer exactly one new hull");
  assert.match((await hullChoices.first().innerText()).replace(/\s+/g, " "), /Build d4/i);
  assert.doesNotMatch((await hullChoices.first().innerText()).replace(/\s+/g, " "), /d6|d8|d10/i);
  await hullChoices.first().click();

  const freshD4 = page.getByRole("button", { name: /d4 ship, upgrade to d6/i }).first();
  await freshD4.click();
  await page.getByRole("button", { name: /Upgrade · 2 Energy/i }).click();

  const grownD6 = page.getByRole("button", { name: /d6 ship, upgrade available next round/i });
  await grownD6.click();
  await page.getByRole("button", { name: /Already upgraded this round/i }).waitFor({ state: "visible" });
  assert.equal(await page.getByRole("button", { name: /Upgrade · 3 Energy/i }).count(), 0);

  await page.getByRole("button", { name: /Close/i }).click();
  await page.getByRole("button", { name: /d4 ship, upgrade to d6/i }).first().click();
  await page.getByRole("button", { name: /Upgrade · 2 Energy/i }).waitFor({ state: "visible" });

  const layout = await page.evaluate(() => ({
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
    yardOverflow: (() => {
      const yard = document.querySelector(".yard");
      return yard ? yard.scrollWidth - yard.clientWidth : null;
    })(),
  }));
  assert.equal(layout.pageOverflow, 0);
  assert.ok((layout.yardOverflow ?? 1) <= 1);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: OUT });
  console.log("PASS shipyard pacing", layout, OUT);
} finally {
  await context.close();
  await browser.close();
}
