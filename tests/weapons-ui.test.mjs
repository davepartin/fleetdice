/**
 * Flagship weapons window copy and chrome. Rules stay in tests/weapons.test.mjs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const weapons = readFileSync(new URL("../components/FlagshipWeapons.tsx", import.meta.url), "utf8");
const match = readFileSync(new URL("../components/MatchScreen.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../lib/engine.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const help = readFileSync(new URL("../lib/reference.ts", import.meta.url), "utf8");

test("Attack copy is the round times two as an equation from TUNING", () => {
  assert.match(engine, /\$\{round\} × \$\{TUNING\.weaponAttackPerRound\} = \$\{weaponAttack\(round\)\} Attack/);
  assert.match(weapons, /weaponEffect\(id, player\.round\)/);
  assert.doesNotMatch(weapons, /weapon-effect-now/);
  assert.doesNotMatch(weapons, /This round/);
});

test("the weapons window has one short rule line and Back, not Cancel", () => {
  assert.match(weapons, /You may use one flagship weapon per round/);
  assert.match(weapons, />Back</);
  assert.doesNotMatch(weapons, />Cancel</);
  assert.doesNotMatch(weapons, /pressing Cancel/);
  assert.match(help, /Back closes the weapon window/);
  assert.doesNotMatch(help, /Cancel closes the weapon window/);
});

test("rotate directions are filled primary buttons with −1 and +1 inside", () => {
  assert.match(weapons, /btn btn-primary weapon-rotate-btn/);
  assert.match(weapons, /<span className="weapon-rotate-dir">−1<\/span>/);
  assert.match(weapons, /<span className="weapon-rotate-dir">\+1<\/span>/);
  assert.match(css, /\.weapon-window \.btn\.weapon-rotate-btn \{ min-height: 44px/);
  assert.doesNotMatch(css, /weapon-rotate-dir \{[^}]*font-size: 32px/);
  assert.doesNotMatch(weapons, /−1 face/);
});

test("weapon status lives only on the launcher, not a second Using line", () => {
  assert.match(weapons, /Using \$\{DOCK_NAME\[used\.id\]\}/);
  assert.match(weapons, /weapon-launcher-using/);
  assert.match(weapons, /weapon-launcher-dock/);
  assert.match(match, /roll-dock-action/);
  assert.doesNotMatch(match, /WeaponUsingCue/);
  assert.doesNotMatch(weapons, /weapon-using-cue/);
  assert.doesNotMatch(css, /\.weapon-using-cue/);
});

test("the roll-dock weapon tap sits in the flagship chip, not above Roll Fleet", () => {
  const dock = match.match(/flagship-control-row[\s\S]+?roll-dock-action/);
  assert.ok(dock, "flagship row must come before the primary action");
  assert.match(dock[0], /FlagshipWeapons/);
  assert.match(dock[0], /FlagshipLine/);
  assert.doesNotMatch(match, /roll-dock-action[\s\S]{0,240}FlagshipWeapons/);
  assert.doesNotMatch(css, /\.roll-dock-action\s*>\s*\.weapon-launcher/);
  assert.match(css, /\.weapon-launcher-dock \{[^}]*max-width:\s*6\.75rem/);
  assert.doesNotMatch(weapons, /Use flagship weapon<\/button>/);
  assert.match(weapons, /return used \? `Using \$\{DOCK_NAME\[used\.id\]\}` : "Weapon"/);
  const how = readFileSync(new URL("../components/HowToPlay.tsx", import.meta.url), "utf8");
  assert.match(how, /help-weapon-btn">Weapon</);
});

test("the shipyard launcher says Need Energy to charge when the bank is short", () => {
  assert.match(weapons, /Need \$\{TUNING\.weaponChargeCost\} Energy to charge/);
  assert.match(css, /\.weapon-launcher-wait/);
  assert.match(weapons, /Use flagship weapon/);
});
