/**
 * What the brain actually does with flagship weapons.
 *
 * Prints purchase / use / leftover-charge rates, Energy spent on weapons vs
 * fleet vs rerolls, and match length. Same engine the phone runs.
 *
 *   node sim/weapons.mjs              80 matches per tier × plan (default)
 *   node sim/weapons.mjs 40           smaller sample
 *   node sim/weapons.mjs 80 medium    one tier
 */

import { bundlePath } from "./bundle.mjs";
const G = await import(bundlePath);

const {
  DIFFICULTIES,
  PLANS,
  PLAN_LABEL,
  TUNING,
  WEAPON_IDS,
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
} = G;

const N = Number(process.argv[2]) || 80;
const ONLY = process.argv[3];

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
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
function ciMean(values) {
  const n = values.length;
  if (n < 2) return 0;
  const avg = mean(values);
  const varr = values.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) / (n - 1);
  return 1.96 * Math.sqrt(varr / n);
}

function play(planA, planB, difficulty, seed) {
  setRng(makeRng(seed));
  const state = newMatch("weapons-sim", "0000", "A", "A", "versus");
  state.players.guest = newPlayer("B", "B", "ready");
  applyDifficultyStart(state.players.host, difficulty);
  applyDifficultyStart(state.players.guest, difficulty);
  state.status = "active";
  state.players.host.phase = "ready";
  const brains = { host: newBrain(planA, difficulty), guest: newBrain(planB, difficulty) };
  const spent = {
    host: { weapon: 0, fleet: 0 },
    guest: { weapon: 0, fleet: 0 },
  };
  let guard = 0;
  while (state.status !== "finished" && guard < 4000) {
    guard += 1;
    let moved = false;
    for (const side of ["host", "guest"]) {
      for (const action of nextActions(state, side, brains[side])) {
        if (state.status === "finished") break;
        try {
          if (action.type === "shop") {
            if (action.operation === "weapon") spent[side].weapon += TUNING.weaponChargeCost;
            else spent[side].fleet += action.operation === "buy"
              ? G.priceOf(action.sides)
              : action.operation === "upgrade"
                ? G.upgradeCost(state.players[side].ships.find((ship) => ship.id === action.shipId)?.sides) ?? 0
                : action.operation === "slot"
                  ? G.nextSlotCost(state.players[side]) ?? 0
                  : G.flagshipUpgradeCost(state.players[side].flag.level) ?? 0;
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
  return { state, spent, finished: state.status === "finished" };
}

function commanderRow(player, spent) {
  const stock = weaponsOf(player);
  const charged = WEAPON_IDS.filter((id) => stock[id].chargedRound !== null);
  const used = WEAPON_IDS.filter((id) => stock[id].usedRound !== null);
  const unused = charged.filter((id) => stock[id].usedRound === null);
  return {
    charged: charged.length,
    used: used.length,
    unused: unused.length,
    byCharge: Object.fromEntries(WEAPON_IDS.map((id) => [id, stock[id].chargedRound !== null ? 1 : 0])),
    byUse: Object.fromEntries(WEAPON_IDS.map((id) => [id, stock[id].usedRound !== null ? 1 : 0])),
    weaponEnergy: spent.weapon,
    fleetEnergy: spent.fleet,
    rerollEnergy: player.stats.rerollEnergy,
    ships: player.ships.length,
    hp: player.hp,
  };
}

const tiers = ONLY ? [ONLY] : DIFFICULTIES;
const seed = { n: 1 };

console.log(`\nFlagship weapons — ${N} matches per plan, each plan vs Balanced, seeded.\n`);
console.log("Charge = bought in the shipyard. Use = fired in a volley. Unused = charged and still held at the end.\n");

for (const difficulty of tiers) {
  const lengths = [];
  const totals = [];
  const perPlan = [];
  const perWeapon = Object.fromEntries(WEAPON_IDS.map((id) => [id, { charge: 0, use: 0, n: 0 }]));

  for (const plan of PLANS) {
    const bucket = [];
    for (let i = 0; i < N; i += 1) {
      seed.n += 1;
      const { state, spent, finished } = play(plan, "balanced", difficulty, seed.n);
      if (!finished) continue;
      lengths.push(Math.max(state.players.host.round, state.players.guest.round));
      const host = commanderRow(state.players.host, spent.host);
      const guest = commanderRow(state.players.guest, spent.guest);
      bucket.push(host);
      totals.push(host, guest);
      for (const id of WEAPON_IDS) {
        perWeapon[id].charge += host.byCharge[id] + guest.byCharge[id];
        perWeapon[id].use += host.byUse[id] + guest.byUse[id];
        perWeapon[id].n += 2;
      }
    }
    perPlan.push({
      plan,
      n: bucket.length,
      charge: mean(bucket.map((row) => row.charged)),
      use: mean(bucket.map((row) => row.used)),
      unused: mean(bucket.map((row) => row.unused)),
      weaponE: mean(bucket.map((row) => row.weaponEnergy)),
      fleetE: mean(bucket.map((row) => row.fleetEnergy)),
      rerollE: mean(bucket.map((row) => row.rerollEnergy)),
      ships: mean(bucket.map((row) => row.ships)),
    });
  }

  console.log(`=== ${difficulty.toUpperCase()} — ${totals.length / 2} finished matches, ${totals.length} commanders ===\n`);
  table(
    ["plan", "charge", "use", "unused", "⚡ weapons", "⚡ fleet", "⚡ rerolls", "ships"],
    perPlan.map((row) => [
      PLAN_LABEL[row.plan],
      row.charge.toFixed(2),
      row.use.toFixed(2),
      row.unused.toFixed(2),
      row.weaponE.toFixed(1),
      row.fleetE.toFixed(1),
      row.rerollE.toFixed(1),
      row.ships.toFixed(1),
    ]),
  );
  console.log("");
  table(
    ["weapon", "charged", "fired", "left unused when charged"],
    WEAPON_IDS.map((id) => {
      const row = perWeapon[id];
      const chargedShare = row.charge / Math.max(1, row.n);
      const firedShare = row.use / Math.max(1, row.n);
      const unusedGivenCharge = row.charge ? (row.charge - row.use) / row.charge : 0;
      return [WEAPON_NAMES[id], pct(chargedShare), pct(firedShare), pct(unusedGivenCharge)];
    }),
  );
  const avgLen = mean(lengths);
  const weaponShare = mean(totals.map((row) => row.weaponEnergy / Math.max(1, row.weaponEnergy + row.fleetEnergy)));
  console.log(
    `\nMatch length ${avgLen.toFixed(1)} ± ${ciMean(lengths).toFixed(1)} rounds (range ${Math.min(...lengths)}–${Math.max(...lengths)}).`,
  );
  console.log(
    `Energy: weapons ${mean(totals.map((row) => row.weaponEnergy)).toFixed(1)}  fleet ${mean(totals.map((row) => row.fleetEnergy)).toFixed(1)}  rerolls ${mean(totals.map((row) => row.rerollEnergy)).toFixed(1)}  (${pct(weaponShare)} of shop Energy on weapons).`,
  );
  console.log(
    `Per commander: ${mean(totals.map((row) => row.charged)).toFixed(2)} charged, ${mean(totals.map((row) => row.used)).toFixed(2)} fired, ${mean(totals.map((row) => row.unused)).toFixed(2)} unused charges at the end.\n`,
  );
}
