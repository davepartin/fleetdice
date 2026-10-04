/**
 * Exercise the current Energy weapons with real AI matches on every tier.
 * They start available and empty; only filling costs Energy.
 *   node sim/energy-weapons.mjs 60    matches per difficulty
 */
import assert from "node:assert/strict";
import { bundlePath } from "./bundle.mjs";
const G = await import(bundlePath);
const N = Number(process.argv[2]) || 60;
for (const difficulty of G.DIFFICULTIES) {
  const rounds = [];
  const fills = { energyAttack: 0, energyShield: 0 };
  const fires = { energyAttack: 0, energyShield: 0 };
  let backstops = 0;
  for (let seed = 1; seed <= N; seed++) {
    G.setRng(G.makeRng(seed));
    const state = G.newMatch("energy-usage", "0000", "A", "A", "versus");
    state.players.guest = G.newPlayer("B", "B", "ready");
    state.players.host.phase = "ready";
    state.status = "active";
    const brains = {};
    for (const side of ["host", "guest"]) {
      G.applyDifficultyStart(state.players[side], difficulty);
      brains[side] = G.newBrain("balanced", difficulty);
    }
    let guard = 0;
    while (state.status !== "finished" && guard++ < 4000) {
      let moved = false;
      for (const side of ["host", "guest"]) {
        for (const action of G.nextActions(state, side, brains[side])) {
          if (state.status === "finished") break;
          assert.ok(!(action.type === "shop" && action.operation === "weapon" && G.isEnergyWeapon(action.weapon)), "AI tried to buy an energy unlock");
          // The live Solo loop also skips provisional ship IDs from a batch.
          try { G.applyAction(state, side, action); }
          catch (error) {
            if (action.type === "shop" && action.operation === "upgrade" && /^sim\d+$/.test(action.shipId) && error.message === "That ship is no longer in your fleet.") continue;
            throw error;
          }
          moved = true;
          if (action.type === "weapon-fill") fills[action.weapon]++;
          if (action.type === "weapon" && G.isEnergyWeapon(action.weapon)) fires[action.weapon]++;
        }
      }
      assert.ok(moved, `AI match stalled: ${difficulty}, seed ${seed}`);
    }
    assert.equal(state.status, "finished");
    rounds.push(state.round);
    if (Object.values(state.players).some(p => p.round > G.TUNING.roundLimit)) backstops++;
  }
  console.log(JSON.stringify({difficulty, matches:N, meanRounds:Number((rounds.reduce((a,b)=>a+b,0)/N).toFixed(1)), minRounds:Math.min(...rounds), maxRounds:Math.max(...rounds), backstops, fills, fires}));
}
