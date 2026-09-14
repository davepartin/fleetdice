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

test("Attack copy names the round formula from TUNING and still shows the current amount", () => {
  assert.match(engine, /This round × \$\{TUNING\.weaponAttackPerRound\}/);
  assert.match(weapons, /weaponAttack\(player\.round\)/);
  assert.match(weapons, /\+\{weaponAttack\(player\.round\)\} Attack/);
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
  assert.match(css, /\.weapon-window \.btn\.weapon-rotate-btn/);
  assert.doesNotMatch(weapons, /−1 face/);
});

test("the roll dock shows Using plus the weapon name after it fires", () => {
  assert.match(weapons, /Using \{WEAPON_NAMES\[used\.id\]\}/);
  assert.match(match, /WeaponUsingCue/);
  assert.match(css, /\.weapon-using-cue/);
  assert.match(weapons, /weapon-launcher-using/);
});
