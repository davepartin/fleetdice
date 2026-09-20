/**
 * The end-of-match recap points down only while there is more to scroll.
 * A caret that is always on, or one that takes a tap, would lie.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const recap = readFileSync(new URL("../components/BattleRecap.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the recap measures leftover scroll before it shows the more-below caret", () => {
  assert.match(recap, /data-recap-more-below/);
  assert.match(recap, /recap-more-below/);
  assert.match(recap, /MORE_BELOW_PX/);
  assert.match(recap, /scrollHeight - el\.scrollTop - el\.clientHeight > MORE_BELOW_PX/);
  assert.match(recap, /ResizeObserver/);
  assert.match(recap, /addEventListener\("load"/);
  assert.match(recap, /onScroll=\{checkMore\}/);
  assert.doesNotMatch(
    recap,
    /<button[^>]*recap-more-below/,
    "the caret is a hint, not a control",
  );
});

test("the more-below caret sits over the recap and never steals a tap", () => {
  const block = css.match(/\.recap-more-below \{[\s\S]*?^\.recap-more-below\.is-shown/m);
  assert.ok(block, "recap-more-below block is missing");
  assert.match(block[0], /pointer-events:\s*none/);
  assert.match(block[0], /position:\s*absolute/);
  assert.match(block[0], /opacity:\s*0/);
  assert.match(css, /\.recap-more-below\.is-shown \{[\s\S]*?opacity:\s*0\.92/);
  assert.match(css, /@keyframes recap-caret-hint/);
  assert.match(css, /@keyframes recap-caret-pulse/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("the caret does not rewrite mutual art or the last-volley column", () => {
  assert.match(recap, /function MutualArt/);
  assert.match(recap, /fleet-dice-mutual/);
  const lastRound = recap.slice(
    recap.indexOf("function LastRound"),
    recap.indexOf("export function BattleRecap"),
  );
  assert.match(lastRound, /VolleyLedger/);
  assert.doesNotMatch(lastRound, /recap-more-below/);
});
