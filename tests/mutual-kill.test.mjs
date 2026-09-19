/**
 * When both flagships fall in the same volley, the winner is the commander
 * who landed more damage — Attack after Shields, Super Shield and blocking,
 * plus Escalation and Direct. That is `report.damage`, the same figure
 * `settlePlayer` used. Equal landed damage falls back to match-long
 * `stats.damageDealt`, then a draw.
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

function playerWith(damage, damageDealt = 0) {
  const player = newPlayer("x", "X", "report");
  player.hp = 0;
  player.report = { damage };
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

test("mutualKillBreak uses landed damage, not raw Attack", () => {
  const host = playerWith(30);
  const guest = playerWith(20);
  const decided = mutualKillBreak(host, guest);
  assert.equal(decided.winner, "host");
  assert.equal(decided.decidedBy, "volley");
  assert.equal(decided.hostLanded, 20);
  assert.equal(decided.guestLanded, 30);
});

test("higher Direct with lower Attack wins a mutual kill", () => {
  // Host: four 2s → Attack 8, Direct 8. Guest: three 4s and a 1 → Attack 12, Shields 1.
  // No ships standing in front: host lands 7 + 8 = 15, guest lands 12.
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
  assert.ok(host.tally.attack < guest.tally.attack, "host Attack is the smaller one");
  assert.ok(host.tally.direct > guest.tally.direct, "host Direct is the bigger one");
  assert.equal(guest.report.damage, damageAfterBlocking(guest.incoming, guest.directIncoming, guest.report.blocked));
  assert.equal(host.report.damage, damageAfterBlocking(host.incoming, host.directIncoming, host.report.blocked));
  assert.ok(guest.report.damage > host.report.damage, "host landed more, even with less Attack");
  assert.equal(state.status, "finished");
  assert.equal(state.winner, "host");
  assert.equal(mutualKillBreak(host, guest).decidedBy, "volley");
});

test("blocking is inside the mutual-kill number — Direct can still win", () => {
  // Both sides sit at 5 health. Four d4s can stand in front of 16, so only
  // Direct gets through. Host rolls four 2s (Attack 8, Direct 8). Guest rolls
  // three 2s and a 4 (Attack 10, Direct 6). Old rule: guest's 10 Attack wins.
  // New rule: host's 8 Direct beats guest's 6 after the wall of ships.
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
  assert.ok(host.tally.attack < guest.tally.attack, "host Attack is lower");
  assert.ok(host.report.blocked > 0 && guest.report.blocked > 0, "ships actually stood in front");
  assert.equal(guest.report.damage, 8);
  assert.equal(host.report.damage, 6);
  assert.equal(state.winner, "host");
});

test("equal landed damage falls back to match-long damageDealt", () => {
  const host = playerWith(16, 40);
  const guest = playerWith(16, 10);
  const decided = mutualKillBreak(host, guest);
  assert.equal(decided.winner, "host");
  assert.equal(decided.decidedBy, "match");
  assert.equal(decided.hostLanded, 16);
  assert.equal(decided.guestLanded, 16);
});

test("equal landed damage and equal match damage is a draw", () => {
  const decided = mutualKillBreak(playerWith(16, 26), playerWith(16, 26));
  assert.equal(decided.winner, "draw");
  assert.equal(decided.decidedBy, "draw");
});

test("a real even volley uses the damageDealt fallback, then a draw", () => {
  // Four 2s land 16. Four 4s land 16. Same number, so the running total decides.
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
  assert.ok(fallback.players.host.hp <= 0 && fallback.players.guest.hp <= 0);
  assert.equal(fallback.players.host.report.damage, fallback.players.guest.report.damage);
  assert.equal(mutualKillBreak(fallback.players.host, fallback.players.guest).decidedBy, "match");
  assert.equal(fallback.winner, "host");

  const drawn = freshMatch(17);
  rollAndPaint(drawn, [2, 2, 2, 2], [4, 4, 4, 4]);
  for (const side of ["host", "guest"]) {
    for (const ship of drawn.players[side].ships) ship.disabledRound = drawn.players[side].round;
    drawn.players[side].hp = 10;
  }
  // incoming this volley is 8 on the guest and 16 on the host. Start the
  // running totals so they finish level.
  drawn.players.host.stats.damageDealt = 18;
  drawn.players.guest.stats.damageDealt = 10;
  applyAction(drawn, "host", { type: "submit" });
  applyAction(drawn, "guest", { type: "submit" });
  assert.ok(drawn.players.host.hp <= 0 && drawn.players.guest.hp <= 0);
  assert.equal(drawn.players.host.report.damage, drawn.players.guest.report.damage);
  assert.equal(drawn.players.host.stats.damageDealt, drawn.players.guest.stats.damageDealt);
  assert.equal(drawn.winner, "draw");
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
