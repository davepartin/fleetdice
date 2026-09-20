/**
 * Phone shots of a solo win recap: the headline names the difficulty, and
 * the victory painting fills the column without letterbox gutters.
 *
 *   node tools/cap-solo-win-recap.mjs        (needs pnpm dev on :3000)
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { applyAction, makeRng, newBrain, newMatch, newPlayer, setRng } = G;

const BASE = "http://localhost:3000";
const OUT = "/workspace/docs";
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2 };

function paint(player, shipFaces, flag = 1) {
  const ships = player.dice.filter((die) => !die.flag);
  ships.forEach((die, index) => {
    die.value = shipFaces[index];
  });
  const flagDie = player.dice.find((die) => die.flag);
  flagDie.value = flag;
  player.flag.face = flag;
}

function soloWinSave(difficulty) {
  setRng(makeRng(11));
  const state = newMatch("solo-win-ui", "0000", "you", "You", "solo");
  state.players.guest = newPlayer("enemy", "Enemy", "ready");
  state.players.host.phase = "ready";
  state.status = "active";
  applyAction(state, "host", { type: "roll", dice: [] });
  applyAction(state, "guest", { type: "roll", dice: [] });
  paint(state.players.host, [2, 2, 2, 2]);
  paint(state.players.guest, [4, 4, 4, 1]);
  for (const side of ["host", "guest"]) {
    for (const ship of state.players[side].ships) ship.disabledRound = state.players[side].round;
  }
  state.players.host.hp = 18;
  state.players.guest.hp = 0;
  applyAction(state, "host", { type: "submit" });
  applyAction(state, "guest", { type: "submit" });
  state.status = "active";
  state.players.host.phase = "over";
  state.players.guest.phase = "over";
  state.winner = "host";
  if (state.players.host.report) state.players.host.report.hpAfter = 18;
  return {
    schema: 1,
    savedAt: Date.now(),
    state,
    brain: newBrain("balanced", difficulty),
  };
}

async function injectAndOpen(page, save) {
  await page.goto(`${BASE}/solo/`, { waitUntil: "domcontentloaded" });
  await page.evaluate((payload) => {
    localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(payload));
  }, save);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Carry on/i }).click({ timeout: 8000 });
  await page.locator(".recap").waitFor({ state: "visible", timeout: 12000 });
}

function measure(page) {
  return page.evaluate(() => {
    const recap = document.querySelector(".recap");
    const art = document.querySelector(".recap-art");
    const img = art?.querySelector("img");
    const title = document.querySelector(".recap-head h2")?.textContent?.trim() || null;
    const recapBox = recap?.getBoundingClientRect();
    const artBox = art?.getBoundingClientRect();
    const imgBox = img?.getBoundingClientRect();
    const ledger = document.querySelector(".volley-ledger");
    const ledgerBox = ledger?.getBoundingClientRect();
    const style = art ? getComputedStyle(art) : null;
    return {
      title,
      recapW: recapBox ? Math.round(recapBox.width) : null,
      recapH: recapBox ? Math.round(recapBox.height) : null,
      artW: artBox ? Math.round(artBox.width) : null,
      artH: artBox ? Math.round(artBox.height) : null,
      imgW: imgBox ? Math.round(imgBox.width) : null,
      imgH: imgBox ? Math.round(imgBox.height) : null,
      artLeft: artBox ? Math.round(artBox.left) : null,
      recapLeft: recapBox ? Math.round(recapBox.left) : null,
      src: img?.getAttribute("src") || null,
      objectFit: img ? getComputedStyle(img).objectFit : null,
      maxWidth: style?.maxWidth || null,
      overflowX: recap ? recap.scrollWidth > recap.clientWidth + 1 : null,
      ledgerOnScreen: Boolean(
        recapBox &&
          ledgerBox &&
          ledgerBox.top >= recapBox.top - 4 &&
          ledgerBox.top < recapBox.bottom,
      ),
    };
  });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});
const errors = [];
const page = await browser.newPage({ viewport: PHONE, isMobile: true, hasTouch: true });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const results = {};
const fail = [];

async function capture(name, difficulty, viewport = PHONE) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await injectAndOpen(page, soloWinSave(difficulty));
  await page.waitForTimeout(700);
  const shot = await measure(page);
  results[name] = shot;
  await page.screenshot({ path: `${OUT}/${name}.png` });

  const label = difficulty[0].toUpperCase() + difficulty.slice(1);
  if (shot.title !== `You beat ${label}`) fail.push(`${name}: title was ${shot.title}`);
  if (!shot.src?.includes("victory")) fail.push(`${name}: missing victory art`);
  if (shot.objectFit !== "cover") fail.push(`${name}: art object-fit is ${shot.objectFit}`);
  if (shot.maxWidth && shot.maxWidth !== "none") fail.push(`${name}: art max-width is ${shot.maxWidth}`);
  if ((shot.artW ?? 0) + 8 < (shot.recapW ?? 0)) {
    fail.push(`${name}: art ${shot.artW}px wide in a ${shot.recapW}px column`);
  }
  if (Math.abs((shot.artLeft ?? 0) - (shot.recapLeft ?? 0)) > 4) {
    fail.push(`${name}: art left ${shot.artLeft} vs recap ${shot.recapLeft}`);
  }
  if ((shot.artH ?? 99) > 180) fail.push(`${name}: art still ${shot.artH}px tall`);
  if (shot.overflowX) fail.push(`${name}: recap overflows horizontally`);
  if (!shot.ledgerOnScreen) fail.push(`${name}: final-volley ledger is not on the first screen`);
}

await capture("solo-win-expert", "expert");
await capture("solo-win-low", "low");
await capture("solo-win-expert-390x620", "expert", { width: 390, height: 620, deviceScaleFactor: 2 });

await browser.close();

console.log(JSON.stringify({ results, errors: errors.slice(0, 12), fail }, null, 2));
if (fail.length) {
  console.error("FAIL", fail);
  process.exit(1);
}
console.log("PASS solo win recap");
