/**
 * A solo win names the computer the player actually fought, and the
 * victory painting fills the phone column without letterbox gutters.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const recap = readFileSync(new URL("../components/BattleRecap.tsx", import.meta.url), "utf8");
const match = readFileSync(new URL("../components/MatchScreen.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../lib/useMatch.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const ai = readFileSync(new URL("../lib/ai.ts", import.meta.url), "utf8");

test("a solo win headline names the difficulty the player chose", () => {
  assert.match(recap, /difficultyLabel/);
  assert.match(recap, /const beatName = difficultyLabel \|\| enemyName/);
  assert.match(recap, /You beat \$\{beatName\}/);
  assert.match(match, /controller\.mode === "solo" && controller\.difficulty/);
  assert.match(match, /DIFFICULTY\[controller\.difficulty\]\.label/);
  assert.match(hook, /difficulty: settings\.difficulty/);
});

test("versus and losses keep the opponent's name, not a difficulty", () => {
  const recapCall = match.slice(match.indexOf("<BattleRecap"), match.indexOf("</BattleRecap>"));
  assert.match(recapCall, /difficultyLabel=\{/);
  assert.match(recapCall, /controller\.mode === "solo"/);
  // A loss still uses enemyName. Mutual-kill wins stay "You win".
  const titleBlock = recap.slice(recap.indexOf("const title ="), recap.indexOf("const mutualWhy"));
  assert.match(titleBlock, /\$\{enemyName\} wins/);
  assert.doesNotMatch(titleBlock, /You beat \$\{enemyName\}/);
  assert.match(titleBlock, /You win/);
  const versusReturn = hook.slice(hook.lastIndexOf("return {"));
  assert.match(versusReturn, /mode: "versus"/);
  assert.doesNotMatch(versusReturn, /difficulty:/);
});

test("difficulty labels on screen come from the tiers, not a hardcoded Easy", () => {
  assert.match(ai, /label: "Low"/);
  assert.match(ai, /label: "Medium"/);
  assert.match(ai, /label: "Hard"/);
  assert.match(ai, /label: "Expert"/);
  assert.doesNotMatch(match, /You beat Easy/);
  assert.doesNotMatch(recap, /You beat Easy/);
});

test("the new home-art victory banner fills the column and keeps the math close", () => {
  const art = css.match(/\.recap-art \{[^}]+\}/);
  assert.ok(art, "recap-art block is missing");
  assert.match(art[0], /height:\s*10\.75rem/);
  assert.match(art[0], /min-height:\s*10\.75rem/);
  assert.match(art[0], /overflow:\s*hidden/);
  assert.doesNotMatch(art[0], /max-width/);
  assert.match(css, /\.recap-art img \{[^}]*width:\s*100%/);
  assert.match(css, /\.recap-art img \{[^}]*object-fit:\s*cover/);
  assert.match(recap, /fleet-dice-recap-victory\.jpg/);
  assert.match(recap, /fleet-dice-recap-defeated\.jpg/);
  assert.match(recap, /recap-outcome-word/);
  assert.match(recap, /"Victory"\s*:\s*"Defeated"/);
  assert.match(css, /\.recap-outcome-word \{[^}]*font-size:\s*clamp\(3\.2rem, 16vw, 4\.35rem\)/);
  // Shrinking the poster used to leave black side gutters. Height may drop
  // on a short phone; width must not.
  assert.doesNotMatch(css, /\.recap-art \{[^}]*max-width:\s*15rem/);
  assert.doesNotMatch(css, /\.recap-art \{[^}]*margin-inline:\s*auto/);
  assert.match(
    css,
    /@media \(max-height: 700px\) \{\s*\.recap-art \{\s*height:\s*8\.4rem/,
    "short-screen recap-art must stay a full-width banner",
  );
});
