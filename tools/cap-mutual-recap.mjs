/**
 * Prove the mutual-kill recap and How to Play on a phone frame.
 * Needs `pnpm dev` on :3000.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

function mutualKillState({ youWin, names = { host: "You", guest: "Curtis" } }) {
  setRng(makeRng(11));
  const state = newMatch("mutual-ui", "0000", "you", names.host, "solo");
  state.players.guest = newPlayer("enemy", names.guest, "ready");
  state.players.host.phase = "ready";
  state.status = "active";
  applyAction(state, "host", { type: "roll", dice: [] });
  applyAction(state, "guest", { type: "roll", dice: [] });
  // Host: four 2s (A8 D8). Guest: three 4s and a 1 (A12 S1). Host lands more.
  paint(state.players.host, [2, 2, 2, 2]);
  paint(state.players.guest, [4, 4, 4, 1]);
  for (const side of ["host", "guest"]) {
    for (const ship of state.players[side].ships) ship.disabledRound = state.players[side].round;
    state.players[side].hp = 8;
  }
  if (!youWin) {
    // Flip the faces so Curtis (guest) lands more — Dave's "I lost" screen.
    paint(state.players.host, [4, 4, 4, 1]);
    paint(state.players.guest, [2, 2, 2, 2]);
  }
  applyAction(state, "host", { type: "submit" });
  applyAction(state, "guest", { type: "submit" });
  // Keep it loadable as a solo save: status must stay "active".
  state.status = "active";
  state.players.host.phase = "over";
  state.players.guest.phase = "over";
  return state;
}

function normalWinState() {
  const state = mutualKillState({ youWin: true });
  state.players.host.hp = 22;
  state.players.host.report.hpAfter = 22;
  state.winner = "host";
  return state;
}

function saveFor(state) {
  return {
    schema: 1,
    savedAt: Date.now(),
    state,
    brain: newBrain("balanced", "medium"),
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

async function measureRecap(page) {
  return page.evaluate(() => {
    const recap = document.querySelector(".recap");
    const box = recap?.getBoundingClientRect();
    const text = (recap?.innerText || "").replace(/\s+/g, " ").trim();
    const kicker =
      document.querySelector(".recap-mutual-banner")?.innerText.replace(/\s+/g, " ").trim() || null;
    const title = document.querySelector(".recap-head h2")?.textContent?.trim() || null;
    const why = document.querySelector(".recap-mutual-why")?.textContent?.trim() || null;
    const call = document.querySelector(".recap-deciding-call")?.textContent?.trim() || null;
    const score = [...document.querySelectorAll(".recap-deciding-num")].map((el) =>
      (el.textContent || "").trim(),
    );
    const ledger = document.querySelector(".volley-ledger");
    const ledgerRows = [...document.querySelectorAll(".volley-ledger-row .volley-ledger-label")].map(
      (el) => el.textContent.trim(),
    );
    const art = document.querySelector(".recap-art img");
    const mutualImg = document.querySelector(".recap-mutual-art img");
    const mutualEl = document.querySelector(".recap-mutual-art");
    const mutualArt = Boolean(mutualEl);
    const mutualH = mutualEl ? Math.round(mutualEl.getBoundingClientRect().height) : 0;
    const overflowX = recap ? recap.scrollWidth > recap.clientWidth + 1 : null;
    const banner = document.querySelector(".recap-mutual-banner");
    const bannerClip = banner ? banner.scrollWidth > banner.clientWidth + 1 : false;
    return {
      text,
      kicker,
      title,
      why,
      bannerClip,
      call,
      score,
      ledgerRows,
      hasLedger: Boolean(ledger),
      art: art ? art.getAttribute("src") : null,
      mutualSrc: mutualImg ? mutualImg.getAttribute("src") : null,
      mutualArt,
      mutualH,
      box: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
      overflowX,
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

// --- How to Play ---
await page.goto(`${BASE}/solo/`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /How to play/i }).click();
await page.waitForTimeout(600);
const helpText = await page.evaluate(() => document.body.innerText);
results.helpHasLanded = /landed more damage that round/i.test(helpText);
results.helpHasHeavier = /heavier attack/i.test(helpText);
await page.evaluate(() => {
  const el = [...document.querySelectorAll("h3, .t-display")].find((n) =>
    /Winning/i.test(n.textContent || ""),
  );
  el?.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/howtoplay-winning.png`, fullPage: false });

// --- Mutual kill: you lose (Dave vs Curtis) ---
await injectAndOpen(page, saveFor(mutualKillState({ youWin: false })));
await page.waitForTimeout(800);
results.loss = await measureRecap(page);
await page.screenshot({ path: `${OUT}/mutual-kill-defeat.png` });

// --- Mutual kill: you win ---
await injectAndOpen(page, saveFor(mutualKillState({ youWin: true })));
await page.waitForTimeout(800);
results.win = await measureRecap(page);
await page.screenshot({ path: `${OUT}/mutual-kill-victory.png` });

// --- Normal single-side win ---
await injectAndOpen(page, saveFor(normalWinState()));
await page.waitForTimeout(800);
results.normal = await measureRecap(page);
await page.screenshot({ path: `${OUT}/normal-victory.png` });

// Short phones: the art must not push the deciding score off the first screen.
for (const viewport of [
  { name: "390x620", width: 390, height: 620 },
  { name: "360x780", width: 360, height: 780 },
]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await injectAndOpen(page, saveFor(mutualKillState({ youWin: false })));
  await page.waitForTimeout(500);
  const short = await page.evaluate(() => {
    const recap = document.querySelector(".recap");
    const scroll = document.querySelector(".recap-scroll");
    const kicker = document.querySelector(".recap-mutual-banner");
    const score = document.querySelector(".recap-deciding-score");
    const title = document.querySelector(".recap-head h2");
    const vis = (el) => {
      if (!el || !recap) return false;
      const a = el.getBoundingClientRect();
      const b = recap.getBoundingClientRect();
      return a.top >= b.top - 4 && a.bottom <= b.bottom + 4;
    };
    return {
      kickerOnScreen: vis(kicker),
      titleOnScreen: vis(title),
      scoreOnScreen: vis(score),
      overflowX: recap ? recap.scrollWidth > recap.clientWidth + 1 : null,
      canScroll: scroll ? scroll.scrollHeight > scroll.clientHeight + 8 : false,
    };
  });
  results[viewport.name] = short;
  await page.screenshot({ path: `${OUT}/mutual-kill-defeat-${viewport.name}.png` });
}

await browser.close();

const fail = [];
if (!results.helpHasLanded) fail.push("How to Play does not say landed more damage");
if (results.helpHasHeavier) fail.push("How to Play still says heavier Attack");
for (const [name, recap] of [
  ["loss", results.loss],
  ["win", results.win],
]) {
  if (!/mutual destruction/i.test(recap.kicker || "")) fail.push(`${name}: missing MUTUAL DESTRUCTION`);
  if (!/greatest damage/i.test(recap.why || "")) fail.push(`${name}: missing greatest damage`);
  if (!recap.mutualSrc?.includes("mutual")) fail.push(`${name}: missing two-flagship still`);
  if (!recap.mutualArt) fail.push(`${name}: missing dual wreck art`);
  if ((recap.mutualH ?? 0) < 80) fail.push(`${name}: dual art collapsed to ${recap.mutualH}px`);
  if (!recap.hasLedger) fail.push(`${name}: missing combat ledger`);
  if (!recap.ledgerRows.includes("Repair")) fail.push(`${name}: ledger missing Repair`);
  if (!recap.ledgerRows.includes("Direct")) fail.push(`${name}: ledger missing Direct`);
  if (!recap.ledgerRows.includes("Attack")) fail.push(`${name}: ledger missing Attack`);
  if (recap.overflowX) fail.push(`${name}: recap overflows horizontally`);
  if (recap.bannerClip) fail.push(`${name}: MUTUAL DESTRUCTION is clipped`);
  if (recap.score.length !== 2) fail.push(`${name}: deciding score not two numbers`);
}
if (!/Curtis wins/i.test(results.loss.title || "")) fail.push(`loss title was ${results.loss.title}`);
if (!/You win/i.test(results.win.title || "")) fail.push(`win title was ${results.win.title}`);
if (results.normal.kicker) fail.push("normal win still shows MUTUAL DESTRUCTION");
if (results.normal.mutualArt) fail.push("normal win used the mutual dual-blast header");
if (!/You beat/i.test(results.normal.title || "")) fail.push(`normal title was ${results.normal.title}`);
if (!results.normal.art?.includes("victory")) fail.push("normal win lost victory art");
for (const name of ["390x620", "360x780"]) {
  const short = results[name];
  if (!short?.kickerOnScreen) fail.push(`${name}: Both fleets destroyed is off-screen`);
  if (!short?.titleOnScreen) fail.push(`${name}: winner title is off-screen`);
  if (!short?.scoreOnScreen) fail.push(`${name}: deciding score is off-screen`);
  if (short?.overflowX) fail.push(`${name}: recap overflows horizontally`);
}

console.log(JSON.stringify({ results, errors: errors.slice(0, 12), fail }, null, 2));
if (fail.length) {
  console.error("FAIL", fail);
  process.exit(1);
}
console.log("PASS mutual-kill recap + How to Play");
