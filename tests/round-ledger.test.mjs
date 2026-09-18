/**
 * The round review is a sum, so it has to add up.
 *
 * `components/RoundReport.tsx` reads a round downwards — started with, minus
 * Attack, plus Shields, minus Direct, plus Repair, plus blocking, left with —
 * and a player will check it. It closes only because every term is what the
 * settle *used*, not what was rolled: shields that exceeded the attack stopped
 * only the attack, and blocking that exceeded what got through stopped only
 * that.
 *
 * This replays real matches and asserts the column equals the engine's own
 * `hpAfter` every round. It fails if `settlePlayer` changes shape — a new term,
 * a different clamp — and the review would quietly start lying.
 *
 * The maths mirrored here is `ledgerSide` in the component:
 *   shieldsUsed = attack - superShieldStopped + escalation - incoming
 *   after = before - attack + superShield + shieldsUsed
 *           - escalation + blocked - direct + repair
 */
import test from "node:test";
import assert from "node:assert/strict";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { applyAction, makeRng, newBrain, newMatch, newPlayer, nextActions, setRng, TUNING } = G;

/** The review's own arithmetic, kept in step with `ledgerSide` by hand. */
function ledgerTotal(report, attackAgainst) {
  const superShield = report.superShieldStopped ?? 0;
  const shields = Math.max(0, attackAgainst - superShield + report.escalation - report.incoming);
  return (
    report.hpBefore -
    attackAgainst +
    superShield +
    shields -
    report.escalation +
    report.blocked -
    report.direct +
    report.repair
  );
}

function playMatch(seed) {
  setRng(makeRng(seed));
  const state = newMatch(`ledger-${seed}`, "0000", "you", "You", "solo");
  state.players.guest = newPlayer("enemy", "Enemy", "ready");
  state.status = "active";
  const brains = { host: newBrain("balanced", "medium"), guest: newBrain("balanced", "hard") };
  const checked = [];

  for (let step = 0; step < 900 && state.status === "active"; step += 1) {
    let moved = false;
    for (const side of ["host", "guest"]) {
      const player = state.players[side];
      if (!player) continue;
      if (player.phase === "report") {
        const enemy = state.players[side === "host" ? "guest" : "host"];
        // The attack that arrived is the other commander's, snapshotted into
        // this report at the volley — never their live tally, which has moved on.
        const attackAgainst = player.report.enemyTally?.attack ?? 0;
        checked.push({
          round: player.report.round,
          side,
          expected: player.report.hpAfter,
          got: ledgerTotal(player.report, attackAgainst),
          report: player.report,
        });
        void enemy;
      }
      const actions = nextActions(state, side, brains[side]);
      if (!actions.length) continue;
      applyAction(state, side, actions[0]);
      moved = true;
    }
    if (!moved) break;
  }
  return checked;
}

test("the round review's column equals the health the engine settled on", () => {
  let rounds = 0;
  let withBlocking = 0;
  let withRepair = 0;
  let withEscalation = 0;
  for (let seed = 1; seed <= 8; seed += 1) {
    for (const row of playMatch(seed)) {
      rounds += 1;
      assert.equal(
        row.got,
        row.expected,
        `seed ${seed}, ${row.side}, round ${row.round}: the review reads ${row.got}, the engine settled on ${row.expected}`,
      );
      if (row.report.blocked > 0) withBlocking += 1;
      if (row.report.repair > 0) withRepair += 1;
      if (row.report.escalation > 0) withEscalation += 1;
    }
  }
  // A green test over rounds where nothing ever happened would prove nothing.
  assert.ok(rounds > 80, `only ${rounds} rounds checked`);
  assert.ok(withBlocking > 0, "no round with a blocking ship was checked");
  assert.ok(withRepair > 0, "no round with repair was checked");
  assert.ok(withBlocking > 0 && withRepair > 0);
});

/**
 * Escalation is a term in the column and the matches above rarely run long
 * enough to meet it, so it gets its own round. It is added to `incoming` after
 * Shields, which is exactly why the review cannot treat Shields as cancelling
 * it: a commander whose Shields covered the whole attack still takes the
 * escalation.
 */
test("the column still closes in a late round, where escalation is arriving", () => {
  setRng(makeRng(7));
  const state = newMatch("ledger-late", "0000", "A", "A", "versus");
  state.players.guest = newPlayer("B", "B", "ready");
  state.status = "active";
  const late = TUNING.escalateAfterRound + 3;
  for (const side of ["host", "guest"]) {
    state.players[side].round = late;
    state.players[side].phase = "ready";
  }
  applyAction(state, "host", { type: "roll", dice: [] });
  applyAction(state, "guest", { type: "roll", dice: [] });
  for (const side of ["host", "guest"]) {
    applyAction(state, side, { type: "submit" });
  }
  for (const side of ["host", "guest"]) {
    const player = state.players[side];
    if (player.phase === "brace") applyAction(state, side, { type: "brace", ships: [] });
  }

  let sawEscalation = false;
  for (const side of ["host", "guest"]) {
    const report = state.players[side].report;
    if (!report) continue;
    if (report.escalation > 0) sawEscalation = true;
    const attackAgainst = report.enemyTally?.attack ?? 0;
    assert.equal(
      ledgerTotal(report, attackAgainst),
      report.hpAfter,
      `${side} in round ${report.round}: the review and the engine disagree`,
    );
  }
  assert.ok(sawEscalation, `round ${late} should be past TUNING.escalateAfterRound`);
});
