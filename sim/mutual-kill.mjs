/**
 * How often is a match decided by a mutual kill, and would the rules disagree?
 *
 * Three ways to break the tie when both flagships fall in the same volley:
 *
 *   attack  — the Attack rolled, before anything answered it (the original rule)
 *   landed  — the damage that actually landed, `report.damage` (shipped 20 Sep)
 *   health  — the final health, which is negative, and the one closer to zero
 *             wins (the owner's proposal: repair, Shields and blocking all count)
 *
 * Run: node sim/mutual-kill.mjs [matches]
 */
import { bundlePath } from "./bundle.mjs";

const G = await import(bundlePath);
const { PLANS, applyAction, applyDifficultyStart, makeRng, newBrain, newMatch, newPlayer, nextActions, setRng } = G;

const N = Number(process.argv[2] ?? 1200);
const TIERS = ["low", "medium", "hard", "expert"];

function playMatch(seed, tierA, tierB) {
  setRng(makeRng(seed));
  const s = newMatch("mk", "0000", "A", "A", "versus");
  s.players.guest = newPlayer("B", "B", "ready");
  applyDifficultyStart(s.players.host, tierA);
  applyDifficultyStart(s.players.guest, tierB);
  s.status = "active";
  s.players.host.phase = "ready";
  const brains = {
    host: newBrain(PLANS[seed % PLANS.length], tierA),
    guest: newBrain(PLANS[(seed + 2) % PLANS.length], tierB),
  };
  let guard = 0;
  while (s.status !== "finished" && guard < 4000) {
    guard += 1;
    let moved = false;
    for (const side of ["host", "guest"]) {
      for (const action of nextActions(s, side, brains[side])) {
        if (s.status === "finished") break;
        try {
          applyAction(s, side, action);
          moved = true;
        } catch {
          /* an action the state no longer allows */
        }
      }
    }
    if (!moved) break;
  }
  return s;
}

/** Winner under each rule, or "draw". */
function verdicts(state) {
  const host = state.players.host;
  const guest = state.players.guest;
  const pick = (a, b) => (a === b ? "draw" : a > b ? "host" : "guest");
  return {
    // What each commander rolled, before Shields or blocking answered it.
    attack: pick(host.tally?.attack ?? 0, guest.tally?.attack ?? 0),
    // What actually landed on the other flagship this volley.
    landed: pick(guest.report?.damage ?? 0, host.report?.damage ?? 0),
    // Where each flagship ended up. Less far below zero wins.
    health: pick(host.hp, guest.hp),
  };
}

let mutual = 0;
let decided = 0;
const disagree = { attackVsLanded: 0, landedVsHealth: 0, attackVsHealth: 0 };
const drawsBy = { attack: 0, landed: 0, health: 0 };
const depths = [];

for (let i = 0; i < N; i += 1) {
  const tierA = TIERS[i % TIERS.length];
  const tierB = TIERS[(i + 1) % TIERS.length];
  const state = playMatch(1000 + i * 7919, tierA, tierB);
  if (state.status !== "finished") continue;
  decided += 1;
  const host = state.players.host;
  const guest = state.players.guest;
  if (host.hp > 0 || guest.hp > 0) continue;
  mutual += 1;
  const v = verdicts(state);
  if (v.attack !== v.landed) disagree.attackVsLanded += 1;
  if (v.landed !== v.health) disagree.landedVsHealth += 1;
  if (v.attack !== v.health) disagree.attackVsHealth += 1;
  for (const rule of ["attack", "landed", "health"]) if (v[rule] === "draw") drawsBy[rule] += 1;
  depths.push({ host: host.hp, guest: guest.hp, gap: Math.abs(host.hp - guest.hp) });
}

const pct = (n) => `${((n / Math.max(1, mutual)) * 100).toFixed(1)}%`;
console.log(`\n=== mutual kills, ${decided} finished matches ===\n`);
console.log(`  both flagships fell together: ${mutual} (${((mutual / Math.max(1, decided)) * 100).toFixed(1)}% of matches)`);
if (!mutual) {
  console.log("\n  no mutual kills in this run — try more matches\n");
  process.exit(0);
}
console.log(`\n  where the rules disagree about who won:`);
console.log(`    Attack rolled vs damage landed: ${disagree.attackVsLanded} (${pct(disagree.attackVsLanded)})`);
console.log(`    damage landed vs final health:  ${disagree.landedVsHealth} (${pct(disagree.landedVsHealth)})`);
console.log(`    Attack rolled vs final health:  ${disagree.attackVsHealth} (${pct(disagree.attackVsHealth)})`);
console.log(`\n  ties that fall through to the next rung:`);
for (const rule of ["attack", "landed", "health"]) {
  console.log(`    ${rule.padEnd(7)}: ${drawsBy[rule]} (${pct(drawsBy[rule])})`);
}
const gaps = depths.map((d) => d.gap).sort((a, b) => a - b);
const worst = depths.reduce((a, b) => (Math.min(b.host, b.guest) < Math.min(a.host, a.guest) ? b : a));
console.log(`\n  how far below zero the two flagships end:`);
console.log(`    median gap between them: ${gaps[Math.floor(gaps.length / 2)]}`);
console.log(`    deepest single flagship: ${Math.min(worst.host, worst.guest)}`);
console.log("");
