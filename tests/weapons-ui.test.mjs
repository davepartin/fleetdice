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
  assert.match(engine, /Round \(\$\{round\}\) × \$\{TUNING\.weaponAttackPerRound\} = \$\{weaponAttack\(round\)\} Attack/);
  assert.match(weapons, /function WeaponEffectLine/);
  assert.match(weapons, /weapon-effect-hit/);
  assert.match(weapons, /Round \(\{round\}\) × \{TUNING\.weaponAttackPerRound\} =/);
  assert.match(weapons, /weaponAttack\(round\)\} Attack/);
  assert.doesNotMatch(weapons, /weapon-effect-now/);
  assert.doesNotMatch(weapons, /This round/);
});

test("the weapons window has a FLAGSHIP WEAPONS title, two rule lines, and Back, not Cancel", () => {
  assert.match(weapons, /t-display">Flagship weapons/);
  assert.match(weapons, /One fire per round\. Four once a game;/);
  assert.match(weapons, /Energy Attack and Energy Shield refill/);
  assert.doesNotMatch(weapons, /use it wisely/);
  assert.doesNotMatch(weapons, /per round —/);
  assert.doesNotMatch(weapons, /Each flagship weapon <b>once<\/b> a game/);
  assert.doesNotMatch(weapons, /You may use one flagship weapon per round/);
  assert.doesNotMatch(weapons, /Roll your fleet before using a weapon/);
  assert.doesNotMatch(weapons, /Your volley is locked in/);
  assert.match(weapons, />Back</);
  assert.doesNotMatch(weapons, />Cancel</);
  assert.doesNotMatch(weapons, /pressing Cancel/);
  assert.match(help, /Back closes the weapon window/);
  assert.doesNotMatch(help, /Cancel closes the weapon window/);
});

test("enemy weapon status is a six-box row, not a disclosure", () => {
  assert.match(weapons, /EnemyWeaponRow/);
  assert.match(weapons, /weapon-enemy-row/);
  assert.match(weapons, /weapon-enemy-box/);
  assert.match(weapons, /weapon-enemy-\$\{status\}/);
  assert.match(weapons, /weapon-enemy-mark/);
  assert.doesNotMatch(weapons, /<details className="weapon-enemy-status"/);
  assert.doesNotMatch(weapons, /weapon status<\/summary>/);
  assert.match(css, /\.weapon-enemy-boxes \{ display: grid; grid-template-columns: repeat\(6,/);
  assert.match(css, /\.weapon-enemy-slash/);
  assert.match(css, /\.weapon-enemy-lock/);
  assert.match(css, /\.weapon-enemy-mark \{ display: flex/);
  assert.match(css, /\.weapon-enemy-box\.weapon-shield, \.weapon-enemy-box\.weapon-energyShield \{ --weapon-color: var\(--color-shield\)/);
  assert.doesNotMatch(css, /\.weapon-enemy-locked \.weapon-symbol \{[^}]*opacity/);
  assert.doesNotMatch(css, /\.weapon-enemy-lock \{[^}]*position: absolute/);
  assert.match(weapons, /EnemyWeaponRow[\s\S]{0,120}<footer>/);
  assert.match(help, /You may fire only one weapon per round/);
  assert.match(help, /Round \(the current round\) × \$\{TUNING\.weaponAttackPerRound\}/);
});

test("the weapons panel does not put the four cards in a scrolling pane", () => {
  assert.match(css, /\.weapon-window-body \{[^}]*overflow: hidden/);
  assert.match(css, /\.weapon-window-inner \{[^}]*overflow: hidden/);
  assert.doesNotMatch(css, /\.weapon-window-scroll/);
  assert.match(weapons, /weapon-window-body/);
  assert.match(css, /\.weapon-lede \{/);
  assert.match(css, /\.weapon-window-head h2 \{ font-size: 22px/);
});

test("rotate directions are filled primary buttons with −1 and +1 inside", () => {
  assert.match(weapons, /btn btn-primary weapon-rotate-btn/);
  assert.match(weapons, /<span className="weapon-rotate-dir">−1<\/span>/);
  assert.match(weapons, /<span className="weapon-rotate-dir">\+1<\/span>/);
  assert.match(css, /\.weapon-window \.btn\.weapon-rotate-btn \{/);
  assert.match(css, /min-height: 72px/);
  assert.match(css, /\.weapon-rotate-controls \{/);
  assert.doesNotMatch(css, /\.weapon-rotate-controls \{[^}]*position:\s*absolute/);
  assert.doesNotMatch(weapons, /autoFocus/);
  assert.doesNotMatch(weapons, /−1 face/);
  assert.match(weapons, /FLAG_FACES\.length\} up becomes 1/);
  assert.match(weapons, /1 down becomes \{FLAG_FACES\.length\}/);
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

test("the shipyard charge control is a filled top button with the upgrade Energy chip", () => {
  const yard = readFileSync(new URL("../components/Shipyard.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../components/ui.tsx", import.meta.url), "utf8");
  assert.match(yard, /className="yard-charge"/);
  assert.match(yard, /yard-board[\s\S]{0,400}yard-charge/);
  assert.doesNotMatch(yard, /yard-foot[\s\S]{0,220}FlagshipWeapons/);
  assert.match(weapons, /weapon-launcher-pad">Charge</);
  assert.match(weapons, />Flagship Weapons</);
  assert.match(weapons, /<EnergyPrice/);
  assert.match(weapons, /cost=\{nextCost\}/);
  assert.match(ui, /export function EnergyPrice/);
  assert.match(css, /\.weapon-launcher-pad \{/);
  assert.match(css, /\.weapon-launcher-pad \{[\s\S]*?border-radius:\s*50%/);
  assert.match(css, /\.weapon-launcher\.weapon-launcher-shop \{[\s\S]*?#0c1220/);
  assert.match(css, /\.weapon-launcher\.weapon-launcher-shop::before \{[\s\S]*?var\(--color-shield\)/);
  assert.match(css, /\.yard-charge \{/);
  assert.doesNotMatch(css, /\.yard-done\s*>\s*\.weapon-launcher/);
  assert.doesNotMatch(css, /\.yard-board \{ width: min\(86%/);
  assert.match(css, /\.weapon-launcher-wait/);
  assert.match(weapons, /One fire per round\. Four once a game; energy weapons refill/);
  assert.doesNotMatch(weapons, /Need \$\{TUNING\.weaponChargeCost\} Energy to charge/);
  assert.match(weapons, /Use flagship weapon/);
  assert.match(help, /Charge flagship weapons button sits below the fleet map/);
  const how = readFileSync(new URL("../components/HowToPlay.tsx", import.meta.url), "utf8");
  assert.match(how, /Charge flagship weapons button/);
});

test("Charged weapon controls are a coloured fill, not a dead black button", () => {
  assert.match(weapons, /weapon-btn-ready/);
  assert.match(weapons, /className=\{shop && status === "available" \? "weapon-btn-charged"/);
  assert.match(weapons, /energy \? "Unlocked" : "Charged"/);
  assert.match(css, /\.weapon-card > button\.weapon-btn-ready/);
  assert.match(css, /\.weapon-card > button\.weapon-btn-charged:disabled/);
  assert.match(css, /button\.weapon-btn-ready[\s\S]*?#090d17/);
  assert.match(css, /button\.weapon-btn-ready[\s\S]*?var\(--weapon-color\)/);
  assert.match(css, /\.weapon-launcher-shop\.weapon-launcher-charged \{[\s\S]*?opacity:\s*1/);
});

test("shipyard and the charge window share one Energy bank that counts down on spend", () => {
  const yard = readFileSync(new URL("../components/Shipyard.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../components/ui.tsx", import.meta.url), "utf8");
  assert.match(ui, /export function EnergyBank/);
  assert.match(ui, /Ticker value=\{shown\} duration=\{260\}/);
  assert.match(ui, /energy-bank-bolt/);
  assert.doesNotMatch(ui, />Energy</);
  assert.doesNotMatch(ui, /in the bank/);
  assert.match(yard, /<EnergyBank energy=\{energy\} spend=\{pendingSpend\}/);
  assert.match(yard, /function spendFor/);
  assert.match(weapons, /<EnergyBank energy=\{player\.energy\}/);
  assert.match(weapons, /weapon-window-head[\s\S]+EnergyBank/);
  assert.match(css, /\.energy-bank-spend/);
  assert.match(css, /\.yard-bank-value,\s*\n\s*\.energy-bank-value/);
});

test("weapon marks are equal-size SVGs and the enemy lock is a real padlock", () => {
  assert.match(weapons, /function WeaponIcon/);
  assert.match(weapons, /<StatIcon kind=\{kind\} size=\{size\} className="weapon-symbol"/);
  assert.doesNotMatch(weapons, /rotate: "↻"/);
  assert.doesNotMatch(weapons, /attack: "✦"/);
  assert.match(css, /\.weapon-symbol \{[^}]*width: 22px/);
  assert.match(css, /\.weapon-enemy-box \.weapon-symbol \{ width: 22px; height: 22px/);
  const lock = css.match(/\.weapon-enemy-lock \{[\s\S]*?\}/);
  assert.ok(lock, "enemy lock needs a size");
  assert.match(lock[0], /width: 16px/);
  assert.match(lock[0], /height: 19px/);
  assert.doesNotMatch(lock[0], /width: 11px/);
  assert.match(weapons, /viewBox="0 0 24 28"/);
});

test("the six weapons sit in the owner's grid with a compact Energy +1", () => {
  assert.match(engine, /WEAPON_GRID_IDS = \["rotate", "repair", "attack", "shield", "energyAttack", "energyShield"\]/);
  assert.match(weapons, /WEAPON_GRID_IDS\.map/);
  assert.match(weapons, /weapon-energy-plus/);
  assert.match(weapons, /Add 1 Energy to \$\{WEAPON_NAMES\[id\]\}/);
  assert.match(weapons, /filled\}\/\{TUNING\.weaponEnergyFillPerRound\} this round/);
  assert.match(weapons, /stored\}\/\{TUNING\.weaponEnergyStoreMax\}/);
  assert.match(css, /\.weapon-card-grid \{ display: grid; grid-template-columns: repeat\(2,/);
  assert.match(css, /\.weapon-energy-plus/);
  assert.match(css, /\.weapon-energyAttack \{ --weapon-color: var\(--color-attack\)/);
  assert.match(css, /\.weapon-energyShield \{ --weapon-color: var\(--color-shield\)/);
  assert.doesNotMatch(css, /\.weapon-window-scroll/);
});

test("the centre flagship tile spells the level and uses the d6 square, not a star", () => {
  const yard = readFileSync(new URL("../components/Shipyard.tsx", import.meta.url), "utf8");
  assert.match(yard, /FLAGSHIP_LEVEL_WORDS/);
  assert.match(yard, /\{NOUN\.flagship\} Level \{levelName\}/);
  assert.match(yard, /→ Level \$\{nextName\}/);
  assert.match(yard, /HullShape sides=\{FLAG_HULL\}/);
  assert.doesNotMatch(yard, /★/);
  assert.doesNotMatch(yard, /L\$\{offer\.level\} → L/);
  assert.doesNotMatch(yard, /yard-cell-art yard-cell-flag/);
  assert.match(css, /\.yard-cell-flag \.yard-cell-art svg path/);
  assert.match(css, /\.yard-cell \{[^}]*min-height: 0/);
  assert.match(css, /\.yard-cell-sub \{[^}]*white-space: nowrap/);
});
