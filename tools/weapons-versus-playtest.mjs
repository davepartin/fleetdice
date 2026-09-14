/** Two independent players, real room transactions, local Firebase only.
 * Start the auth/Firestore emulators, run pnpm build:emulator, then this file.
 * Restore the production export with BASE_PATH= pnpm build afterwards.
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./shoot.mjs";
const APP = "http://localhost:4323";
const DB = "http://127.0.0.1:8080/v1/projects/space-tribes/databases/(default)/documents";
const chunks = resolve("out/_next/static");
const scripts = (await readdir(chunks, { recursive: true })).filter(file => file.endsWith(".js"));
assert.ok((await Promise.all(scripts.map(file => readFile(resolve(chunks, file), "utf8"))))
  .some(code => code.includes("127.0.0.1:8080:9099")), "Run pnpm build:emulator first; this test never uses live Firebase.");
const server = await serve(resolve("out"), 4323);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
function unpack(v) {
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k,x]) => [k, unpack(x)]));
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(unpack);
  if ("nullValue" in v) return null;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  return v.stringValue ?? v.timestampValue;
}
function pack(v) {
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(pack) } };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k,x]) => [k,pack(x)])) } };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  return { stringValue: v };
}
async function read(id) {
  const response = await fetch(`${DB}/fd3Matches/${id}`, { headers: { Authorization: "Bearer owner" } });
  assert.ok(response.ok);
  return unpack({ mapValue: await response.json() });
}
async function patchState(id, state) {
  const response = await fetch(`${DB}/fd3Matches/${id}?updateMask.fieldPaths=state&updateMask.fieldPaths=version`, {
    method: "PATCH", headers: { "content-type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ fields: { state: pack(state), version: pack(state.version) } }),
  });
  assert.ok(response.ok, await response.text());
}
async function seat() {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await ctx.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/ERR_INTERNET_DISCONNECTED|Failed to get document because the client is offline/i.test(m.text())) errors.push(m.text()); });
  return { ctx, page };
}
async function waitFor(fn, message) {
  for (let i = 0; i < 50; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 200)); }
  throw new Error(message);
}
try {
  const host = await seat(); const guest = await seat();
  await host.page.goto(`${APP}/versus/`, { waitUntil: "networkidle" });
  await host.page.fill("input", "Weapon Host");
  await host.page.getByRole("button", { name: /Create the room/i }).click();
  await host.page.waitForSelector("[data-room-code]", { timeout: 40000 });
  const code = await host.page.getAttribute("[data-room-code]", "data-room-code");
  await guest.page.goto(`${APP}/join/?code=${code}`, { waitUntil: "networkidle" });
  await guest.page.fill("input", "Weapon Guest");
  await guest.page.getByRole("button", { name: /Join the game/i }).click();
  await host.page.getByRole("button", { name: /^Roll Fleet/ }).waitFor({ timeout: 30000 });
  await guest.page.getByRole("button", { name: /^Roll Fleet/ }).waitFor({ timeout: 30000 });
  const id = new URL(host.page.url()).searchParams.get("id");
  assert.ok(id);
  const doc = await read(id);
  const s = doc.state;
  s.round = 6; s.version++;
  for (const p of Object.values(s.players)) { p.round = 6; p.phase = "shop"; p.energy = 18; p.hp = p.maxHp = 100; }
  await patchState(id, s);
  for (const [page, name] of [[host.page, "Attack"], [guest.page, "Super Shield"]]) {
    await page.getByRole("button", { name: "Charge flagship weapons" }).click();
    await page.getByRole("button", { name: `Charge ${name} for 6 Energy`, exact: true }).dblclick({ force: true });
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Return to battle", exact: true }).click();
    await page.getByRole("button", { name: /^Roll Fleet/ }).click();
  }
  await waitFor(async () => (await read(id)).state.players.guest.phase === "rolling", "both rolled");
  const charged = await read(id);
  assert.equal(charged.state.players.host.energy, 12);
  assert.equal(charged.state.players.guest.energy, 12);
  console.log("PASS real transactions: double taps charge each fleet exactly once");

  await host.page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
  await host.page.getByRole("button", { name: "Use Attack", exact: true }).click();
  await waitFor(async () => (await read(id)).state.players.host.weapons.attack.usedRound === 6, "host activation committed");
  await guest.page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
  await guest.page.locator(".weapon-enemy-status summary").click();
  assert.match(await guest.page.locator(".weapon-enemy-status").innerText(), /Attack\s+Available/);
  assert.doesNotMatch(await guest.page.locator(".weapon-enemy-status").innerText(), /Used R6/);
  console.log("PASS guest sees charged Attack without seeing the hidden activation");
  await guest.page.getByRole("button", { name: "Use Super Shield", exact: true }).click();
  await waitFor(async () => (await read(id)).state.players.guest.weapons.shield.usedRound === 6, "shield committed");
  await guest.ctx.setOffline(true);
  await new Promise(r => setTimeout(r, 500));
  await guest.ctx.setOffline(false);
  // Firestore keeps a live stream open after reconnect; wait for usable UI.
  await guest.page.reload({ waitUntil: "domcontentloaded" });
  await guest.page.getByRole("button", { name: "Use flagship weapon", exact: true }).click();
  assert.equal(await guest.page.locator(".weapon-card-used").count(), 1);
  await guest.page.getByRole("button", { name: "Back", exact: true }).click();
  console.log("PASS connection loss and reload retain the used charge and occupied seat");

  for (const page of [host.page, guest.page]) await page.getByRole("button", { name: "Lock in", exact: true }).click();
  await new Promise(r => setTimeout(r, 3200));
  for (const page of [host.page, guest.page]) {
    const block = page.getByRole("button", { name: "Take it all on the flagship", exact: true });
    if (await block.count()) await block.click();
    await page.locator(".weapon-report").waitFor({ timeout: 12000 });
    assert.match(await page.locator(".weapon-report").innerText(), /Attack · \+12/);
    assert.match(await page.locator(".weapon-report").innerText(), /Super Shield/);
  }
  const resolved = await read(id);
  const r = resolved.state.players.guest.report;
  assert.equal(r.superShieldStopped, Math.floor(r.enemyTally.attack / 2));
  assert.equal(r.hpAfter, r.hpBefore - r.damage + r.repair);
  assert.equal(r.enemyWeapons.attack.usedRound, 6);
  console.log("PASS simultaneous reveal: both summaries match committed combat arithmetic");
  assert.deepEqual(errors, []);
  console.log("PASS two-player browser console is clean; existing Firestore rules accept the new state");
} finally { await browser.close(); server.close(); }
