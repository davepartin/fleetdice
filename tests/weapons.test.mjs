import test from "node:test";
import assert from "node:assert/strict";
import { bundlePath } from "../sim/bundle.mjs";
const G = await import(bundlePath);
const { newMatch, newPlayer, applyAction, previewTally, publicMatchView, weaponsOf, weaponStatus,
  WEAPON_IDS, TUNING, tally, makeRng, setRng, parseSoloSave, newBrain, checkMove,
  superShieldReduction, chooseCombatWeapon, nextActions, planShopping } = G;

function match(round = 4) {
  setRng(makeRng(481));
  const s = newMatch("weapons", "0000", "A", "A", "solo");
  s.players.guest = newPlayer("B", "B", "shop");
  for (const p of Object.values(s.players)) {
    p.phase = "shop"; p.round = round; p.energy = 24;
  }
  return s;
}
function charge(s, side, id) { applyAction(s, side, { type: "shop", operation: "weapon", weapon: id }); }
function rollBoth(s) {
  for (const side of ["host", "guest"]) {
    applyAction(s, side, { type: "ready" });
    applyAction(s, side, { type: "roll", dice: [] });
  }
}
function faces(p, values, flag = 1) {
  p.ships.forEach((ship, i) => {
    ship.sides = 10;
    const die = p.dice.find(d => d.id === ship.id);
    die.sides = 10; die.value = values[i];
  });
  p.flag.face = flag;
  p.dice.find(d => d.flag).value = flag;
}
function settle(s) {
  applyAction(s, "host", { type: "submit" });
  applyAction(s, "guest", { type: "submit" });
  for (const side of ["host", "guest"]) {
    if (s.status !== "finished" && s.players[side].phase === "brace") applyAction(s, side, { type: "brace", ships: [] });
  }
}

test("new battles start with four locked weapons; each charges for exactly six once", () => {
  const s = match(); const p = s.players.host;
  for (const id of WEAPON_IDS) {
    assert.equal(weaponStatus(weaponsOf(p), id), "locked");
    const before = p.energy;
    charge(s, "host", id);
    assert.equal(p.energy, before - 6);
    assert.equal(weaponStatus(weaponsOf(p), id), "available");
    assert.throws(() => charge(s, "host", id), /once/);
    assert.equal(p.energy, before - 6);
  }
  assert.equal(p.energy, 0);
});

test("charging refuses insufficient Energy and use outside the shipyard without a spend", () => {
  const s = match(); const p = s.players.host;
  p.energy = 5;
  assert.throws(() => charge(s, "host", "attack"), /Energy/);
  assert.equal(p.energy, 5);
  assert.equal(weaponStatus(weaponsOf(p), "attack"), "locked");
  p.phase = "ready"; p.energy = 10;
  assert.throws(() => charge(s, "host", "attack"), /shipyard/);
  assert.equal(p.energy, 10);
  assert.throws(() => applyAction(s, "host", { type: "weapon", weapon: "attack" }), /Roll/);
});

test("a charge survives later rounds and Attack scales at use, not purchase", () => {
  const s = match(3); charge(s, "host", "attack");
  s.players.host.round = s.players.guest.round = 9;
  rollBoth(s);
  const p = s.players.host;
  const before = previewTally(p).attack; const bank = p.energy;
  applyAction(s, "host", { type: "weapon", weapon: "attack" });
  assert.equal(previewTally(p).attack, before + 18);
  assert.equal(p.energy, bank);
  applyAction(s, "host", { type: "roll", dice: [p.dice[0].id] });
  assert.equal(previewTally(p).attack, tally(p.dice, p.flag.level).attack + 18);
});

test("one weapon per volley; used charges cannot fire or recharge again", () => {
  const s = match(); charge(s, "host", "attack"); charge(s, "host", "repair"); rollBoth(s);
  applyAction(s, "host", { type: "weapon", weapon: "attack" });
  assert.throws(() => applyAction(s, "host", { type: "weapon", weapon: "repair" }), /one flagship weapon/);
  settle(s);
  applyAction(s, "host", { type: "continue" });
  assert.throws(() => charge(s, "host", "attack"), /once/);
  applyAction(s, "host", { type: "ready" });
  applyAction(s, "host", { type: "roll", dice: [] });
  assert.throws(() => applyAction(s, "host", { type: "weapon", weapon: "attack" }), /cannot recharge/);
  applyAction(s, "host", { type: "weapon", weapon: "repair" });
  assert.equal(previewTally(s.players.host).heal, tally(s.players.host.dice, 1).heal + 20);
});

test("Super Shield halves the entire Attack before Shields; Direct and War still land", () => {
  const s = match(9); charge(s, "host", "shield"); charge(s, "guest", "attack"); rollBoth(s);
  faces(s.players.host, [5, 5, 5, 5]); // 20 Shields, 4 Repair
  faces(s.players.guest, [10, 10, 10, 10]); // 40 Attack + 18 weapon, 12 Direct
  applyAction(s, "host", { type: "weapon", weapon: "shield" });
  applyAction(s, "guest", { type: "weapon", weapon: "attack" });
  settle(s);
  const r = s.players.host.report;
  assert.equal(r.superShieldStopped, 29);
  assert.equal(r.incoming, 13); // 58 - 29 - 20 + 4 War
  assert.equal(r.direct, 12);
  assert.equal(r.hpAfter, 39); // 60 - 13 - 12 + 4
  assert.equal(s.players.host.stats.shieldsBlocked, 20);
  assert.equal(r.weapon.amount, 29);
  assert.equal(r.enemyWeapon.amount, 18);
  assert.equal(superShieldReduction(s.players.host, 21), 10);
});

test("Repair always adds twenty, grows health and can save a lethal Direct volley", () => {
  for (const hp of [4, 60, 100]) {
    const s = match(); charge(s, "host", "repair"); rollBoth(s);
    faces(s.players.host, [1, 1, 1, 1], 6);
    faces(s.players.guest, [2, 2, 2, 2], 1);
    s.players.host.hp = hp; s.players.host.maxHp = Math.max(60, hp);
    applyAction(s, "host", { type: "weapon", weapon: "repair" });
    settle(s);
    const r = s.players.host.report;
    assert.equal(r.repair, 20);
    assert.equal(r.hpAfter, hp - r.damage + 20);
    assert.ok(r.hpAfter > 0);
    assert.equal(r.weapon.amount, 20);
    assert.equal(s.players.host.maxHp, Math.max(60, hp, r.hpAfter));
  }
});

test("rotation wraps both ways, needs charging and obeys the volley limit", () => {
  for (const [from, direction, to] of [[1, -1, 6], [6, 1, 1]]) {
    const s = match(); charge(s, "host", "rotate"); rollBoth(s);
    faces(s.players.host, [1, 2, 3, 4], from);
    applyAction(s, "host", { type: "flag-token", direction });
    assert.equal(s.players.host.flag.face, to);
    assert.equal(s.players.host.weapons.rotate.use.to, to);
    assert.throws(() => applyAction(s, "host", { type: "flag-token", direction }), /one flagship weapon/);
  }
  const s = match(); rollBoth(s);
  assert.throws(() => applyAction(s, "host", { type: "flag-token", direction: 1 }), /Charge/);
});

test("opponents see a charged threat but cannot see activation until the volley reveals", () => {
  for (const id of WEAPON_IDS) {
    const s = match(); charge(s, "guest", id); rollBoth(s);
    const before = publicMatchView(s, "host").players.guest;
    applyAction(s, "guest", id === "rotate" ? { type: "flag-token", direction: 1 } : { type: "weapon", weapon: id });
    const after = publicMatchView(s, "host").players.guest;
    assert.deepEqual(after.weapons, before.weapons);
    assert.equal(after.weaponThisRound, null);
    assert.deepEqual(after.flag, before.flag);
    assert.equal(after.tally, null);
    assert.deepEqual(after.dice, []);
    assert.equal(weaponStatus(publicMatchView(s, "guest").players.guest.weapons, id), "used");
    settle(s);
    assert.equal(s.players.host.report.enemyWeapon.id, id);
    assert.equal(weaponStatus(s.players.host.report.enemyWeapons, id), "used");
  }
});

test("a slow report keeps the weapon snapshot while the opponent charges next round", () => {
  const s = match(); charge(s, "guest", "attack"); rollBoth(s);
  applyAction(s, "guest", { type: "weapon", weapon: "attack" }); settle(s);
  const report = structuredClone(s.players.host.report);
  applyAction(s, "guest", { type: "continue" });
  const saved = parseSoloSave(JSON.stringify({ schema: 1, savedAt: Date.now(), state: s, brain: newBrain("balanced") }));
  assert.ok(saved, "returning to the shipyard after firing must still save and recover");
  s.players.guest.energy = 6;
  charge(s, "guest", "shield");
  const view = publicMatchView(s, "host");
  assert.deepEqual(view.players.host.report, report);
  assert.equal(weaponStatus(view.players.guest.weapons, "shield"), "locked");
  assert.equal(view.players.guest.weapons.attack.usedRound, 4);
});

test("weapon states and pending activation survive saving and duplicate move receipts", () => {
  const s = match(); charge(s, "host", "repair"); rollBoth(s);
  const move = { id: "fire-once", sequence: 1, round: 4, phase: "rolling", rolls: 1, createdAt: Date.now(), action: { type: "weapon", weapon: "repair" } };
  assert.equal(checkMove(s, "host", {}, move), "apply");
  applyAction(s, "host", move.action);
  const saved = parseSoloSave(JSON.stringify({ schema: 1, savedAt: Date.now(), state: s, brain: newBrain("balanced") }));
  assert.deepEqual(saved.state.players.host.weapons, s.players.host.weapons);
  assert.equal(previewTally(saved.state.players.host).heal, previewTally(s.players.host).heal);
  assert.equal(checkMove(saved.state, "host", { host: { sequence: 1, id: "fire-once" } }, move), "acknowledged");
  delete saved.state.players.host.weapons.repair;
  assert.equal(parseSoloSave(JSON.stringify(saved)), null, "a damaged weapon save should not crash the battle screen");
});

test("legacy saved battles retain their existing rotation without granting new free weapons", () => {
  const s = match(); const p = s.players.host;
  delete p.weapons; delete p.weaponThisRound; p.flag.token = true;
  assert.equal(weaponStatus(weaponsOf(p), "rotate"), "available");
  assert.equal(weaponStatus(weaponsOf(p), "attack"), "locked");
  rollBoth(s); applyAction(s, "host", { type: "flag-token", direction: 1 });
  assert.equal(weaponStatus(weaponsOf(p), "rotate"), "used");
});

test("Attack weapon copy names the round formula from TUNING, not only the current total", () => {
  const text = G.weaponEffect("attack", 4);
  assert.match(text, new RegExp(String.raw`This round\s*×\s*${TUNING.weaponAttackPerRound}`));
  assert.equal(G.weaponAttack(4), 4 * TUNING.weaponAttackPerRound);
  assert.doesNotMatch(text, /^\+\d+ Attack$/);
});

test("AI weapon decisions do not depend on hidden enemy dice", () => {
  const s = match(9); for (const id of WEAPON_IDS) charge(s, "host", id); rollBoth(s);
  const p = s.players.host; const enemy = s.players.guest;
  const action = chooseCombatWeapon(p, enemy, .7, 6);
  enemy.dice.forEach(d => d.value = 1);
  enemy.tally = { attack: 9999, heal: 9999, defense: 9999 };
  assert.deepEqual(chooseCombatWeapon(p, enemy, .7, 6), action);
});

test("a healthy thin fleet spends six Energy on a hull, not a flagship weapon", () => {
  setRng(makeRng(9));
  const s = match(6);
  const p = s.players.guest;
  p.energy = 6;
  p.hp = 60;
  p.maxHp = 60;
  const acts = nextActions(s, "guest", newBrain("balanced", "hard"));
  assert.equal(
    acts.some((a) => a.type === "shop" && a.operation === "weapon"),
    false,
    "full health and four d4s should buy fleet, not a 6 Energy charge",
  );
  assert.ok(
    acts.some((a) => a.type === "shop" && (a.operation === "buy" || a.operation === "upgrade" || a.operation === "slot")),
    "the six Energy has to land on the fleet",
  );
});

test("a wounded flagship charges Repair before another hull", () => {
  setRng(makeRng(9));
  const s = match(7);
  const p = s.players.guest;
  p.energy = 6;
  p.hp = 16;
  p.maxHp = 60;
  const acts = nextActions(s, "guest", newBrain("balanced", "hard"));
  assert.equal(acts[0]?.type, "shop");
  assert.equal(acts[0]?.operation, "weapon");
  assert.equal(acts[0]?.weapon, "repair");
});

test("Repair is not fired just because the round number is high", () => {
  const s = match(11);
  charge(s, "host", "repair");
  rollBoth(s);
  faces(s.players.host, [1, 1, 1, 1], 6);
  s.players.host.hp = 55;
  s.players.guest.hp = 50;
  const enemy = publicMatchView(s, "host").players.guest;
  const action = chooseCombatWeapon(s.players.host, enemy, 0.25, 4);
  assert.ok(!action || action.weapon !== "repair", "55 health is not a Repair volley");
});

test("Repair fires when this volley actually threatens the flagship", () => {
  const s = match(8);
  charge(s, "host", "repair");
  rollBoth(s);
  faces(s.players.host, [1, 1, 1, 1], 6);
  s.players.host.hp = 12;
  const enemy = publicMatchView(s, "host").players.guest;
  const action = chooseCombatWeapon(s.players.host, enemy, 0.4, 4);
  assert.equal(action?.type, "weapon");
  assert.equal(action?.weapon, "repair");
});

test("Attack is not fired just because the round number is nine", () => {
  const s = match(9);
  charge(s, "host", "attack");
  rollBoth(s);
  faces(s.players.host, [1, 1, 1, 1], 6);
  s.players.host.hp = 50;
  s.players.guest.hp = 50;
  const enemy = publicMatchView(s, "host").players.guest;
  const action = chooseCombatWeapon(s.players.host, enemy, 0.2, 4);
  assert.ok(!action || action.weapon !== "attack", "a weak roll into 50 health is not an Attack volley");
});

test("Attack fires when the extra hits would finish the other flagship", () => {
  const s = match(9);
  charge(s, "host", "attack");
  rollBoth(s);
  faces(s.players.host, [6, 6, 6, 6], 6);
  s.players.guest.hp = 10;
  const enemy = publicMatchView(s, "host").players.guest;
  const action = chooseCombatWeapon(s.players.host, enemy, 0.3, 4);
  assert.equal(action?.type, "weapon");
  assert.equal(action?.weapon, "attack");
});

test("a charged Rotate is spent on a modest late swing rather than held unused", () => {
  for (const [round, expectFire] of [[4, false], [10, true]]) {
    const s = match(round);
    charge(s, "host", "rotate");
    rollBoth(s);
    faces(s.players.host, [4, 4, 1, 1], 5);
    const action = chooseCombatWeapon(s.players.host, publicMatchView(s, "host").players.guest, 0.2, 6);
    if (expectFire) {
      assert.equal(action?.type, "flag-token", `round ${round} should spend the token`);
      assert.equal(action?.direction, -1);
    } else {
      assert.ok(!action || action.type !== "flag-token", `round ${round} still waits for a real swing`);
    }
  }
});

test("the Enemy times weapons from the public board, never a hidden activation", () => {
  const s = match(9);
  for (const id of WEAPON_IDS) {
    charge(s, "guest", id);
    charge(s, "host", id);
  }
  rollBoth(s);
  s.players.guest.rolls = TUNING.rollsPerRound + TUNING.paidRollsPerRound;
  s.players.guest.energy = 0;
  const brain = newBrain("balanced", "expert");
  const before = nextActions(s, "guest", brain);
  s.players.host.dice.forEach((d) => { d.value = 10; });
  s.players.host.tally = { attack: 9999, heal: 9999, defense: 0, energy: 0, direct: 99, face: 6, flagBonus: { attack: 0, defense: 0, energy: 0, heal: 0, direct: 0 }, run: null, lines: [] };
  s.players.host.weaponThisRound = { id: "attack", round: 9, amount: 18 };
  s.players.host.weapons.attack.usedRound = 9;
  s.players.host.weapons.attack.use = s.players.host.weaponThisRound;
  assert.deepEqual(nextActions(s, "guest", brain), before);
});

test("charging, firing and a later shipyard visit all survive a saved battle", () => {
  const s = match(5);
  charge(s, "host", "repair");
  rollBoth(s);
  applyAction(s, "host", { type: "weapon", weapon: "repair" });
  let saved = parseSoloSave(JSON.stringify({ schema: 1, savedAt: Date.now(), state: s, brain: newBrain("balanced") }));
  assert.equal(saved.state.players.host.weapons.repair.usedRound, 5);
  assert.equal(saved.state.players.host.weaponThisRound.id, "repair");
  settle(s);
  applyAction(s, "host", { type: "continue" });
  s.players.host.energy = 6;
  charge(s, "host", "attack");
  saved = parseSoloSave(JSON.stringify({ schema: 1, savedAt: Date.now(), state: s, brain: newBrain("balanced") }));
  assert.equal(weaponStatus(saved.state.players.host.weapons, "repair"), "used");
  assert.equal(weaponStatus(saved.state.players.host.weapons, "attack"), "available");
  assert.equal(saved.state.players.host.weapons.repair.usedRound, 5);
  assert.equal(saved.state.players.host.energy, 0);
});

test("Formation still buys a hull with 6 Energy after weapons entered the shop", () => {
  const player = newPlayer("f", "F", "shop");
  player.energy = 6;
  player.round = 3;
  player.open[0] = true;
  player.open[2] = true;
  player.ships = player.ships.filter((ship) => ship.slot !== 1);
  player.ships.push({ id: "corner2", sides: 4, disabledRound: null, slot: 2 });
  const acts = planShopping(player, "formation", 3, 1, 0);
  const buy = acts.find((a) => a.type === "shop" && a.operation === "buy");
  assert.ok(buy, "a live line still beats charging a weapon");
  assert.equal(buy.slotIndex, 1);
});
