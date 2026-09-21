/**
 * Phone shots of solo win and loss recaps: both new header paintings fill the
 * column, the outcome word stays readable, and the final-volley math remains
 * on the first screen.
 *
 *   node tools/cap-solo-win-recap.mjs        (needs pnpm dev on :3000)
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { applyAction, makeRng, newBrain, newMatch, newPlayer, setRng } = G;

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// Resolve against this repo, not the machine the script was written on.
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "docs");
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

function soloRecapSave(difficulty, winner = "host") {
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
    state.players[side].hp = 8;
  }
  applyAction(state, "host", { type: "submit" });
  applyAction(state, "guest", { type: "submit" });
  // Keep it loadable as a solo save: status must stay "active". Then
  // restore a one-sided win so this is the ordinary victory screen.
  state.status = "active";
  state.players.host.phase = "over";
  state.players.guest.phase = "over";
  state.players.host.hp = winner === "host" ? 18 : -8;
  state.players.guest.hp = winner === "guest" ? 18 : -8;
  if (state.players.host.report) state.players.host.report.hpAfter = state.players.host.hp;
  if (state.players.guest.report) state.players.guest.report.hpAfter = state.players.guest.hp;
  state.winner = winner;
  return {
    schema: 1,
    savedAt: Date.now(),
    state,
    brain: newBrain("balanced", difficulty),
  };
}

async function hideDevChrome(page) {
  await page.addStyleTag({
    content: "nextjs-portal, #__next-build-watcher { display: none !important; }",
  });
}

async function injectAndOpen(page, save) {
  await page.goto(`${BASE}/solo/`, { waitUntil: "domcontentloaded" });
  await page.evaluate((payload) => {
    localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(payload));
  }, save);
  await page.reload({ waitUntil: "domcontentloaded" });
  await hideDevChrome(page);
  const carry = page.getByRole("button", { name: /Carry on/i });
  const recap = page.locator(".recap");
  const landed = await Promise.race([
    carry.waitFor({ state: "visible", timeout: 12000 }).then(() => "carry"),
    recap.waitFor({ state: "visible", timeout: 12000 }).then(() => "recap"),
  ]);
  if (landed === "carry") await carry.click();
  await recap.waitFor({ state: "visible", timeout: 12000 });
  await page.locator(".recap-scroll").evaluate((element) => { element.scrollTop = 0; });
  await hideDevChrome(page);
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
    const scroll = document.querySelector(".recap-scroll");
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
      objectPosition: img ? getComputedStyle(img).objectPosition : null,
      maxWidth: style?.maxWidth || null,
      scrollTop: scroll ? Math.round(scroll.scrollTop) : null,
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
const results = {};
const fail = [];

async function capture(name, difficulty, outcome = "won", viewport = PHONE) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`[${name}] ${String(e)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${name}] ${m.text()}`);
  });
  try {
    await injectAndOpen(page, soloRecapSave(difficulty, outcome === "won" ? "host" : "guest"));
    await page.waitForTimeout(700);
    await page.locator(".recap-scroll").evaluate((element) => { element.scrollTop = 0; });
    const shot = await measure(page);
    results[name] = shot;
    await page.screenshot({ path: `${OUT}/${name}.png` });

    const label = difficulty[0].toUpperCase() + difficulty.slice(1);
    const expectedTitle = outcome === "won" ? `You beat ${label}` : "Enemy wins";
    if (shot.title !== expectedTitle) fail.push(`${name}: title was ${shot.title}`);
    if (!shot.src?.includes(outcome === "won" ? "victory" : "defeated")) {
      fail.push(`${name}: missing ${outcome} art`);
    }
    const outcomeWord = await page.locator(".recap-outcome-word").innerText();
    if (outcomeWord !== (outcome === "won" ? "VICTORY" : "DEFEATED")) {
      fail.push(`${name}: outcome word was ${outcomeWord}`);
    }
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
    if (shot.scrollTop !== 0) fail.push(`${name}: recap opened at scroll ${shot.scrollTop}`);
    if (!shot.ledgerOnScreen) fail.push(`${name}: final-volley ledger is not on the first screen`);
  } finally {
    await context.close();
  }
}

await capture("solo-win-expert", "expert");
await capture("solo-win-low", "low");
await capture("solo-defeat", "medium", "lost");
await capture("solo-win-375x812", "expert", "won", { width: 375, height: 812, deviceScaleFactor: 3 });
await capture("solo-defeat-375x812", "medium", "lost", { width: 375, height: 812, deviceScaleFactor: 3 });
await capture("solo-win-expert-390x620", "expert", "won", { width: 390, height: 620, deviceScaleFactor: 2 });
await capture("solo-defeat-390x620", "medium", "lost", { width: 390, height: 620, deviceScaleFactor: 2 });

await browser.close();

console.log(JSON.stringify({ results, errors: errors.slice(0, 12), fail }, null, 2));
if (fail.length || errors.length) {
  console.error("FAIL", [...fail, ...errors]);
  process.exit(1);
}
console.log("PASS solo win recap");
