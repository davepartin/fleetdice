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
  assert.match(engine, /round \(\$\{round\}\) × \$\{TUNING\.weaponAttackPerRound\} = \$\{weaponAttack\(round\)\} Attack/);
  assert.match(weapons, /weaponEffect\(id, player\.round\)/);
  assert.doesNotMatch(weapons, /weapon-effect-now/);
  assert.doesNotMatch(weapons, /This round/);
});

test("the weapons window has one short rule line and Back, not Cancel", () => {
  assert.match(weapons, /Each flagship weapon once a game\. Only one per round/);
  assert.doesNotMatch(weapons, /t-display">Flagship weapons/);
  assert.doesNotMatch(weapons, /You may use one flagship weapon per round/);
  assert.doesNotMatch(weapons, /Roll your fleet before using a weapon/);
  assert.doesNotMatch(weapons, /Your volley is locked in/);
  assert.match(weapons, />Back</);
  assert.doesNotMatch(weapons, />Cancel</);
  assert.doesNotMatch(weapons, /pressing Cancel/);
  assert.match(help, /Back closes the weapon window/);
  assert.doesNotMatch(help, /Cancel closes the weapon window/);
});

test("enemy weapon status is a four-box row, not a disclosure", () => {
  assert.match(weapons, /EnemyWeaponRow/);
  assert.match(weapons, /weapon-enemy-row/);
  assert.match(weapons, /weapon-enemy-box/);
  assert.match(weapons, /weapon-enemy-\$\{status\}/);
  assert.match(weapons, /weapon-enemy-mark/);
  assert.doesNotMatch(weapons, /<details className="weapon-enemy-status"/);
  assert.doesNotMatch(weapons, /weapon status<\/summary>/);
  assert.match(css, /\.weapon-enemy-boxes \{ display: grid; grid-template-columns: repeat\(4,/);
  assert.match(css, /\.weapon-enemy-slash/);
  assert.match(css, /\.weapon-enemy-lock/);
  assert.match(css, /\.weapon-enemy-mark \{ display: flex/);
  assert.match(css, /\.weapon-enemy-box\.weapon-shield \{ --weapon-color: var\(--color-shield\)/);
  assert.doesNotMatch(css, /\.weapon-enemy-locked \.weapon-symbol \{[^}]*opacity/);
  assert.doesNotMatch(css, /\.weapon-enemy-lock \{[^}]*position: absolute/);
  assert.match(weapons, /EnemyWeaponRow[\s\S]{0,120}<footer>/);
  assert.match(help, /Each flagship weapon once a game, but only one per round/);
  assert.match(help, /round \(the current round\) × \$\{TUNING\.weaponAttackPerRound\}/);
});

test("the weapons panel does not put the four cards in a scrolling pane", () => {
  assert.match(css, /\.weapon-window-body \{[^}]*overflow: hidden/);
  assert.match(css, /\.weapon-window-inner \{[^}]*overflow: hidden/);
  assert.doesNotMatch(css, /\.weapon-window-scroll/);
  assert.match(weapons, /weapon-window-body/);
  assert.match(css, /\.weapon-lede \{/);
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
  assert.doesNotMatch(weapons, /weapon-launcher-dock/);
  assert.match(match, /roll-dock-action/);
  assert.doesNotMatch(match, /WeaponUsingCue/);
  assert.doesNotMatch(weapons, /weapon-using-cue/);
  assert.doesNotMatch(css, /\.weapon-using-cue/);
});

test("Flagship Weapon sits beside the face chip, not nested in it and not above Roll Fleet", () => {
  const dock = match.match(/flagship-control-row[\s\S]+?roll-dock-action/);
  assert.ok(dock, "flagship row must come before the primary action");
  assert.match(dock[0], /FlagshipLine you=\{you\} \/>/);
  assert.match(dock[0], /<FlagshipWeapons /);
  assert.doesNotMatch(dock[0], /FlagshipLine you=\{you\}>/);
  assert.doesNotMatch(match, /roll-dock-action[\s\S]{0,240}FlagshipWeapons/);
  assert.doesNotMatch(css, /\.roll-dock-action\s*>\s*\.weapon-launcher/);
  assert.doesNotMatch(css, /\.weapon-launcher-dock/);
  assert.match(css, /\.flagship-control-row\s*>\s*\.weapon-launcher \{[^}]*max-width:\s*8\.5rem/);
  assert.match(css, /\.match-hud-solo \.flagship-control-row > \.btn,\s*\n\s*\.match-hud-solo \.flagship-control-row > \.weapon-launcher/);
  assert.match(weapons, /return used \? `Using \$\{DOCK_NAME\[used\.id\]\}` : "Flagship Weapon"/);
  const how = readFileSync(new URL("../components/HowToPlay.tsx", import.meta.url), "utf8");
  assert.match(how, /help-weapon-btn">Flagship Weapon</);
});

test("the shipyard launcher says Need Energy to charge when the bank is short", () => {
  assert.match(weapons, /Need \$\{TUNING\.weaponChargeCost\} Energy to charge/);
  assert.match(css, /\.weapon-launcher-wait/);
  assert.match(weapons, /Use flagship weapon/);
});
