/**
 * When both flagships fall in the same volley, health keeps counting past zero
 * and the commander blown up by less wins: −12 beats −24.
 *
 * That number is the whole match in one figure — every Attack that got through,
 * minus every Shield, every blocking ship and every point of Repair — which is
 * why Repair counts here and did not under the two earlier rules. Equal depth
 * falls back to match-long `stats.damageDealt`, then a draw.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const {
  applyAction,
  damageAfterBlocking,
  makeRng,
  mutualKillBreak,
  newMatch,
  newPlayer,
  setRng,
} = G;

function freshMatch(seed = 11) {
  setRng(makeRng(seed));
  const state = newMatch("mutual", "0000", "A", "A", "versus");
  state.players.guest = newPlayer("B", "B", "ready");
  state.players.host.phase = "ready";
  state.status = "active";
  return state;
}

/** Face 1 on the flagship adds Energy only — no combat bonus to confuse the tally. */
function paint(player, shipFaces, flag = 1) {
  const ships = player.dice.filter((die) => !die.flag);
  assert.equal(ships.length, shipFaces.length, `${player.name} fleet size`);
  ships.forEach((die, index) => {
    die.value = shipFaces[index];
  });
  const flagDie = player.dice.find((die) => die.flag);
  flagDie.value = flag;
  player.flag.face = flag;
}

function rollAndPaint(state, hostFaces, guestFaces) {
  applyAction(state, "host", { type: "roll", dice: [] });
  applyAction(state, "guest", { type: "roll", dice: [] });
  paint(state.players.host, hostFaces);
  paint(state.players.guest, guestFaces);
}

/** A fallen flagship, `hp` below zero by however much. */
function playerWith(hp, damageDealt = 0) {
  const player = newPlayer("x", "X", "report");
  player.hp = hp;
  player.stats.damageDealt = damageDealt;
  return player;
}

function ledgerTotal(report, attackAgainst) {
  const superShield = report.superShieldStopped ?? 0;
  const shields = Math.max(0, attackAgainst - superShield + report.escalation - report.incoming);
  return (
    report.hpBefore -
    attackAgainst +
    superShield +
    shields -
    report.escalation +
    report.blocked +
    -report.direct +
    report.repair
  );
}

test("the flagship blown up by less takes the match", () => {
  const decided = mutualKillBreak(playerWith(-12), playerWith(-24));
  assert.equal(decided.winner, "host", "−12 beats −24");
  assert.equal(decided.decidedBy, "health");
  assert.equal(decided.hostHp, -12);
  assert.equal(decided.guestHp, -24);
});

test("Repair counts, which is the whole reason for this rule", () => {
  // Both flagships sit on 10 and both take a lethal volley, with nobody able
  // to block. The host swapped one 6 for a 3: less Attack out, but Shield 3
  // and Repair 3 back. It lands 21 where the guest lands 22 — so the old rule
  // handed this to the guest — and still ends nearer zero, because Repair
  // resolves in the same step as the damage.
  const state = freshMatch(23);
  rollAndPaint(state, [3, 6, 6, 6], [6, 6, 6, 4]);
  for (const side of ["host", "guest"]) {
    for (const ship of state.players[side].ships) ship.disabledRound = state.players[side].round;
    state.players[side].hp = 10;
  }
  applyAction(state, "host", { type: "submit" });
  applyAction(state, "guest", { type: "submit" });

  const host = state.players.host;
  const guest = state.players.guest;
  assert.ok(host.hp <= 0 && guest.hp <= 0, "both flagships fell");
  assert.ok(host.report.repair > 0, "the host actually repaired");
  assert.ok(
    guest.report.damage < host.report.damage,
    "the host landed less damage, so the old rule would have handed this to the guest",
  );
  assert.ok(host.hp > guest.hp, "and still ended nearer zero");
  assert.equal(state.status, "finished");
  assert.equal(state.winner, "host");
  assert.equal(mutualKillBreak(host, guest).decidedBy, "health");
});

test("blocking keeps you nearer zero too", () => {
  // Both sides on 5 with four d4s that can stand in front. What the ships stop
  // never reaches the flagship, so it never deepens the number.
  const state = freshMatch();
  rollAndPaint(state, [2, 2, 2, 2], [2, 2, 2, 4]);
  state.players.host.hp = 5;
  state.players.guest.hp = 5;
  applyAction(state, "host", { type: "submit" });
  applyAction(state, "guest", { type: "submit" });

  const host = state.players.host;
  const guest = state.players.guest;
  assert.equal(state.status, "finished");
  assert.ok(host.hp <= 0 && guest.hp <= 0, "both flagships fell");
  assert.ok(host.report.blocked > 0 && guest.report.blocked > 0, "ships actually stood in front");
  // Whoever the engine called, it must be the shallower flagship.
  const decided = mutualKillBreak(host, guest);
  if (host.hp !== guest.hp) {
    assert.equal(decided.winner, host.hp > guest.hp ? "host" : "guest");
    assert.equal(decided.decidedBy, "health");
  }
  assert.equal(state.winner, decided.winner);
});

test("the Attack you rolled is not the score", () => {
  // Host: four 2s → Attack 8 and Direct 8. Guest: three 4s and a 1 → Attack 12.
  // The bigger Attack does not decide it; where the flagships end does.
  const state = freshMatch();
  rollAndPaint(state, [2, 2, 2, 2], [4, 4, 4, 1]);
  for (const side of ["host", "guest"]) {
    for (const ship of state.players[side].ships) ship.disabledRound = state.players[side].round;
    state.players[side].hp = 8;
  }
  applyAction(state, "host", { type: "submit" });
  applyAction(state, "guest", { type: "submit" });

  const host = state.players.host;
  const guest = state.players.guest;
  assert.ok(host.hp <= 0 && guest.hp <= 0, "both flagships fell");
  assert.ok(host.tally.attack < guest.tally.attack, "the host rolled the smaller Attack");
  assert.equal(guest.report.damage, damageAfterBlocking(guest.incoming, guest.directIncoming, guest.report.blocked));
  assert.equal(state.status, "finished");
  assert.equal(state.winner, host.hp > guest.hp ? "host" : "guest");
  assert.equal(mutualKillBreak(host, guest).decidedBy, "health");
});

test("the same number on both falls back to match-long damage", () => {
  const decided = mutualKillBreak(playerWith(-16, 40), playerWith(-16, 10));
  assert.equal(decided.winner, "host");
  assert.equal(decided.decidedBy, "match");
  assert.equal(decided.hostHp, -16);
  assert.equal(decided.guestHp, -16);
});

test("the same number and the same match damage is a draw", () => {
  const decided = mutualKillBreak(playerWith(-16, 26), playerWith(-16, 26));
  assert.equal(decided.winner, "draw");
  assert.equal(decided.decidedBy, "draw");
});

test("a real match that ends level uses the fallback, then a draw", () => {
  // Four 2s land 16 on one side; four 4s land 16 on the other. Same health
  // going in, same damage landing, so both end on the same number.
  const fallback = freshMatch(13);
  rollAndPaint(fallback, [2, 2, 2, 2], [4, 4, 4, 4]);
  for (const side of ["host", "guest"]) {
    for (const ship of fallback.players[side].ships) ship.disabledRound = fallback.players[side].round;
    fallback.players[side].hp = 10;
  }
  fallback.players.host.stats.damageDealt = 40;
  fallback.players.guest.stats.damageDealt = 10;
  applyAction(fallback, "host", { type: "submit" });
  applyAction(fallback, "guest", { type: "submit" });
  const fh = fallback.players.host;
  const fg = fallback.players.guest;
  assert.ok(fh.hp <= 0 && fg.hp <= 0);
  assert.equal(fh.hp, fg.hp, "both ended on the same number");
  assert.equal(mutualKillBreak(fh, fg).decidedBy, "match");
  assert.equal(fallback.winner, "host");

  const drawn = freshMatch(17);
  rollAndPaint(drawn, [2, 2, 2, 2], [4, 4, 4, 4]);
  for (const side of ["host", "guest"]) {
    for (const ship of drawn.players[side].ships) ship.disabledRound = drawn.players[side].round;
    drawn.players[side].hp = 10;
  }
  drawn.players.host.stats.damageDealt = 18;
  drawn.players.guest.stats.damageDealt = 10;
  applyAction(drawn, "host", { type: "submit" });
  applyAction(drawn, "guest", { type: "submit" });
  const dh = drawn.players.host;
  const dg = drawn.players.guest;
  assert.ok(dh.hp <= 0 && dg.hp <= 0);
  assert.equal(dh.hp, dg.hp);
  assert.equal(dh.stats.damageDealt, dg.stats.damageDealt);
  assert.equal(drawn.winner, "draw");
});

test("health below zero is kept, not clamped — the screens do the clamping", () => {
  // The rule needs the true figure. If settlePlayer ever floors hp at zero,
  // every mutual kill becomes a draw and this is the test that says so.
  const state = freshMatch(31);
  rollAndPaint(state, [6, 6, 6, 6], [6, 6, 6, 6]);
  for (const side of ["host", "guest"]) {
    for (const ship of state.players[side].ships) ship.disabledRound = state.players[side].round;
    state.players[side].hp = 3;
  }
  applyAction(state, "host", { type: "submit" });
  applyAction(state, "guest", { type: "submit" });
  assert.ok(state.players.host.hp < 0, `host should be under zero, got ${state.players.host.hp}`);
  assert.ok(state.players.guest.hp < 0, `guest should be under zero, got ${state.players.guest.hp}`);
});

test("the mutual-kill ledger still closes on both columns", () => {
  const state = freshMatch();
  rollAndPaint(state, [2, 2, 2, 2], [4, 4, 4, 1]);
  for (const side of ["host", "guest"]) {
    for (const ship of state.players[side].ships) ship.disabledRound = state.players[side].round;
    state.players[side].hp = 8;
  }
  applyAction(state, "host", { type: "submit" });
  applyAction(state, "guest", { type: "submit" });

  for (const side of ["host", "guest"]) {
    const report = state.players[side].report;
    const attackAgainst = report.enemyTally.attack;
    assert.equal(
      ledgerTotal(report, attackAgainst),
      report.hpAfter,
      `${side}: the column must still equal what the engine settled`,
    );
  }
});
