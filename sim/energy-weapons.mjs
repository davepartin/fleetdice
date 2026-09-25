/**
 * Measure unlock costs for Energy Attack and Energy Shield.
 *
 * Both costs live in TUNING. This sweeps a few values that are not 6 and
 * prints win rate, charge/fire rate, stored amount when fired, and length.
 *
 *   node sim/energy-weapons.mjs           60 matches a cell (default)
 *   node sim/energy-weapons.mjs 40        smaller sample
 */

import { bundlePath } from "./bundle.mjs";
const G = await import(bundlePath);

const {
  TUNING,
  ENERGY_WEAPON_IDS,
  WEAPON_NAMES,
  applyAction,
  applyDifficultyStart,
  makeRng,
  newBrain,
  newMatch,
  newPlayer,
  nextActions,
  setRng,
  weaponsOf,
  weaponStatus,
  weaponStored,
} = G;

const N = Number(process.argv[2]) || 60;
const COSTS = [3, 4, 5, 8, 10];

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}
function pad(text, width, right = false) {
  const value = String(text);
  return right ? value.padStart(width) : value.padEnd(width);
}
function table(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(String(header).length, ...rows.map((row) => String(row[index] ?? "").length)),
  );
  const line = (cells, right) =>
    cells.map((cell, index) => pad(cell ?? "", widths[index], right && index > 0)).join("  ");
  console.log(line(headers, false));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) console.log(line(row, true));
}
function mean(values) {
  return values.reduce((sum, value) => sum + (value || 0), 0) / Math.max(1, values.length);
}
function ciMean(values) {
  const n = values.length;
  if (n < 2) return 0;
  const avg = mean(values);
  const varr = values.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) / (n - 1);
  return 1.96 * Math.sqrt(varr / n);
}

function play(attackCost, shieldCost, forbidGuest, seed) {
  const savedAttack = TUNING.weaponEnergyAttackCost;
  const savedShield = TUNING.weaponEnergyShieldCost;
  TUNING.weaponEnergyAttackCost = attackCost;
  TUNING.weaponEnergyShieldCost = shieldCost;
  setRng(makeRng(seed));
  const state = newMatch("energy-weapons-sim", "0000", "A", "A", "versus");
  state.players.guest = newPlayer("B", "B", "ready");
  applyDifficultyStart(state.players.host, "medium");
  applyDifficultyStart(state.players.guest, "medium");
  state.status = "active";
  state.players.host.phase = "ready";
  const brains = { host: newBrain("balanced", "medium"), guest: newBrain("balanced", "medium") };
  const firedStored = { host: [], guest: [] };
  const charged = { host: { energyAttack: 0, energyShield: 0 }, guest: { energyAttack: 0, energyShield: 0 } };
  const fired = { host: { energyAttack: 0, energyShield: 0 }, guest: { energyAttack: 0, energyShield: 0 } };
  let guard = 0;
  try {
    while (state.status !== "finished" && guard < 4000) {
      guard += 1;
      let moved = false;
      for (const side of ["host", "guest"]) {
        for (const action of nextActions(state, side, brains[side])) {
          if (state.status === "finished") break;
          if (forbidGuest && side === "guest") {
            if (action.type === "shop" && action.operation === "weapon" && ENERGY_WEAPON_IDS.includes(action.weapon)) continue;
            if (action.type === "weapon-fill") continue;
            if (action.type === "weapon" && ENERGY_WEAPON_IDS.includes(action.weapon)) continue;
          }
          try {
            if (action.type === "shop" && action.operation === "weapon" && ENERGY_WEAPON_IDS.includes(action.weapon)) {
              charged[side][action.weapon] += 1;
            }
            if (action.type === "weapon" && ENERGY_WEAPON_IDS.includes(action.weapon)) {
              fired[side][action.weapon] += 1;
              firedStored[side].push({ id: action.weapon, stored: weaponStored(weaponsOf(state.players[side]), action.weapon) });
            }
            applyAction(state, side, action);
            moved = true;
          } catch {
            /* skip a move that stopped being legal */
          }
        }
      }
      if (!moved) break;
    }
    const length = Math.max(state.players.host.round, state.players.guest.round);
    const hostStock = weaponsOf(state.players.host);
    const guestStock = weaponsOf(state.players.guest);
    return {
      finished: state.status === "finished",
      winner: state.winner,
      length,
      charged,
      fired,
      firedStored,
      hostCharged: Object.fromEntries(ENERGY_WEAPON_IDS.map((id) => [id, hostStock[id].chargedRound !== null ? 1 : 0])),
      guestCharged: Object.fromEntries(ENERGY_WEAPON_IDS.map((id) => [id, guestStock[id].chargedRound !== null ? 1 : 0])),
      hostFired: Object.fromEntries(ENERGY_WEAPON_IDS.map((id) => [id, hostStock[id].usedRound !== null ? 1 : 0])),
      guestFired: Object.fromEntries(ENERGY_WEAPON_IDS.map((id) => [id, guestStock[id].usedRound !== null ? 1 : 0])),
    };
  } finally {
    TUNING.weaponEnergyAttackCost = savedAttack;
    TUNING.weaponEnergyShieldCost = savedShield;
  }
}

function summarise(rows, side = "both") {
  const finished = rows.filter((row) => row.finished);
  const lengths = finished.map((row) => row.length);
  const hostWins = finished.filter((row) => row.winner === "host").length;
  const draws = finished.filter((row) => row.winner === "draw").length;
  const stored = finished.flatMap((row) => {
    const picks = side === "host" ? row.firedStored.host : side === "guest" ? row.firedStored.guest : [...row.firedStored.host, ...row.firedStored.guest];
    return picks.map((entry) => entry.stored);
  });
  const storedBy = Object.fromEntries(ENERGY_WEAPON_IDS.map((id) => [id, []]));
  for (const row of finished) {
    const picks = side === "host" ? row.firedStored.host : side === "guest" ? row.firedStored.guest : [...row.firedStored.host, ...row.firedStored.guest];
    for (const entry of picks) storedBy[entry.id].push(entry.stored);
  }
  const commanders = side === "both" ? finished.length * 2 : finished.length;
  const chargeRate = (id) => {
    let hits = 0;
    for (const row of finished) {
      if (side !== "guest") hits += row.hostCharged[id];
      if (side !== "host") hits += row.guestCharged[id];
    }
    return hits / Math.max(1, commanders);
  };
  const fireRate = (id) => {
    let hits = 0;
    for (const row of finished) {
      if (side !== "guest") hits += row.hostFired[id];
      if (side !== "host") hits += row.guestFired[id];
    }
    return hits / Math.max(1, commanders);
  };
  return {
    n: finished.length,
    hostWin: hostWins / Math.max(1, finished.length),
    draw: draws / Math.max(1, finished.length),
    length: mean(lengths),
    lengthCi: ciMean(lengths),
    lengthMin: lengths.length ? Math.min(...lengths) : 0,
    lengthMax: lengths.length ? Math.max(...lengths) : 0,
    stored: mean(stored),
    charge: Object.fromEntries(ENERGY_WEAPON_IDS.map((id) => [id, chargeRate(id)])),
    fire: Object.fromEntries(ENERGY_WEAPON_IDS.map((id) => [id, fireRate(id)])),
    storedBy: Object.fromEntries(ENERGY_WEAPON_IDS.map((id) => [id, mean(storedBy[id])])),
  };
}

const seed = { n: 7000 };

function runCell(attackCost, shieldCost, forbidGuest, n = N) {
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    seed.n += 1;
    rows.push(play(attackCost, shieldCost, forbidGuest, seed.n));
  }
  return summarise(rows, forbidGuest ? "host" : "both");
}

function printBlock(title, cells) {
  console.log(`\n${title}\n`);
  table(
    ["cost", "n", "host win", "charged A", "fired A", "stored A", "charged S", "fired S", "stored S", "length"],
    cells.map((cell) => [
      cell.label,
      String(cell.row.n),
      pct(cell.row.hostWin),
      pct(cell.row.charge.energyAttack),
      pct(cell.row.fire.energyAttack),
      cell.row.storedBy.energyAttack.toFixed(2),
      pct(cell.row.charge.energyShield),
      pct(cell.row.fire.energyShield),
      cell.row.storedBy.energyShield.toFixed(2),
      `${cell.row.length.toFixed(1)} ± ${cell.row.lengthCi.toFixed(1)} (${cell.row.lengthMin}–${cell.row.lengthMax})`,
    ]),
  );
}

console.log(`\nEnergy flagship weapons — unlock cost sweep, ${N} Medium Balanced vs Balanced matches a cell, seeded.`);
console.log("Charge = unlocked in the shipyard. Fire = used in a volley. Stored = Energy in the tank at the moment of fire.");
console.log(`Classic four still cost ${TUNING.weaponChargeCost}. Candidates are never 6.\n`);

console.log("=== Both commanders may unlock and fill ===");
const both = COSTS.map((cost) => ({
  label: `${cost}/${cost}`,
  row: runCell(cost, cost, false),
}));
printBlock("Same unlock cost on both energy weapons", both);

console.log("\n=== Host may use energy weapons; guest is forbidden (win rate of having them) ===");
const attackOnly = COSTS.map((cost) => ({
  label: `A${cost} / S4`,
  row: runCell(cost, 4, true),
}));
printBlock("Energy Attack cost sweep, Energy Shield held at 4, guest cannot use either", attackOnly);

const shieldOnly = COSTS.map((cost) => ({
  label: `A4 / S${cost}`,
  row: runCell(4, cost, true),
}));
printBlock("Energy Shield cost sweep, Energy Attack held at 4, guest cannot use either", shieldOnly);

console.log("\nNames: A = Energy Attack, S = Energy Shield. Host win is the side that has the energy weapons in the forbidden-guest blocks.");
console.log("These printed numbers are the measurement. Do not invent others.\n");
