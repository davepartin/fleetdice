/**
 * The home screen and both battle modes share one stylesheet.
 * If the root layout stops importing it, the dice still draw and every
 * menu falls below them — which is exactly how the live home page broke.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the root layout still loads the design stylesheet", () => {
  const src = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(src, /import ["']\.\/globals\.css["']/);
});

test("the match shell cannot grow a dead page-scroll under the dock", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const htmlBlock = css.match(/html,\s*body \{[^}]*\}/);
  const bodyBlock = css.match(/\nbody \{[^}]*\}/);
  const hudBlock = css.match(/^\.hud \{[^}]*\}/m);
  const canvasBlock = css.match(/^\.stage-canvas \{[^}]*\}/m);
  const shellBlock = css.match(/^\.tutorial-shell \{[^}]*\}/m);
  const frameBlock = css.match(/^\.app-frame \{[^}]*\}/m);
  assert.ok(htmlBlock, "html, body need a sizing block");
  assert.ok(bodyBlock, "body needs its own lock-down block");
  assert.ok(hudBlock, "the HUD needs a sizing block");
  assert.ok(canvasBlock, "the canvas needs a sizing block");
  assert.ok(shellBlock, "the tutorial shell needs a sizing block");
  assert.ok(frameBlock, "the playable column needs a sizing block");

  // --vv-height is the real visible screen. 100dvh alone is what let Safari
  // paint a taller page than the player can see, then scroll into black.
  for (const [name, block] of [
    ["html, body", htmlBlock[0]],
    ["body", bodyBlock[0]],
    ["hud", hudBlock[0]],
    ["canvas", canvasBlock[0]],
    ["tutorial-shell", shellBlock[0]],
    ["app-frame", frameBlock[0]],
  ]) {
    assert.match(block, /--vv-height/, `${name} must size to the visible viewport`);
    assert.match(block, /overflow:\s*hidden/, `${name} must not page-scroll`);
  }

  assert.doesNotMatch(
    shellBlock[0],
    /min-height:\s*100dvh/,
    "min-height: 100dvh on the shell is what left a black band under the dock",
  );
  assert.match(css, /\.match-bottom \{[^}]*margin-top:\s*auto/, "the dock stays at the bottom of the HUD");
});

test("the straight payout is a compact, explicit one-of-two choice", () => {
  const screen = readFileSync(new URL("../components/MatchScreen.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(screen, /role=\{choosable \? "radiogroup"/);
  assert.match(screen, /role=\{choosable \? "radio"/);
  assert.match(screen, /aria-checked=\{choosable \? selected/);
  assert.match(screen, /Straight \{run\.start\}–\{run\.top\} · d\{run\.biggest\}/);
  assert.match(screen, /straight-prize-or/);
  assert.doesNotMatch(screen, /straight-choice-detail|straight-prize-radio/);
  assert.doesNotMatch(screen, /Quick cash|Full run/);
  assert.match(css, /\.straight-prize \{[\s\S]{0,180}justify-content:\s*center/);
  assert.match(css, /\.straight-prize-main \{[\s\S]{0,140}justify-content:\s*center/);
  assert.match(css, /\.straight-prize-energy\.straight-prize-on \{[\s\S]{0,140}background:\s*var\(--color-energy\)/);
  assert.match(css, /\.straight-prize-attack\.straight-prize-on \{[\s\S]{0,140}background:\s*var\(--color-attack\)/);
  assert.match(css, /\.match-hud-solo \.roll-dock:has\(\.straight-prizes\)[\s\S]{0,120}314px/);
  assert.match(css, /\.match-hud-solo \.straight-prize \{[\s\S]{0,100}min-height:\s*48px/);
});

test("the d8 keeps more light on its lower facets than the other hulls", () => {
  const die = readFileSync(new URL("../lib/three/die.ts", import.meta.url), "utf8");
  assert.match(die, /const inactiveFacetStrength = kind === 8 \? "0\.65" : "0\.3"/);
});

test("a wide window letterboxes to the same phone column, and a phone stays full-bleed", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const viewport = readFileSync(new URL("../lib/viewport.ts", import.meta.url), "utf8");

  assert.match(layout, /className="app-frame"/);
  assert.match(viewport, /export const PHONE_FRAME_WIDTH = 390/);
  assert.match(css, /--phone-frame-width:\s*390px/);

  const desktop = css.match(
    /@media \(min-width: 641px\) and \(min-height: 641px\) \{[\s\S]*?^\}/m,
  );
  assert.ok(desktop, "desktop letterbox media query is missing");
  assert.match(desktop[0], /\.app-frame \{[\s\S]*?width:\s*var\(--phone-frame-width\)/);
  assert.match(desktop[0], /justify-content:\s*center/);
  assert.match(desktop[0], /\.stage-canvas,[\s\S]*?position:\s*absolute/);
  // Transforming html/body/canvas is the Safari bug that puts dice over menus.
  assert.doesNotMatch(desktop[0], /html[\s\S]{0,80}transform:/);
  assert.doesNotMatch(desktop[0], /\n\s*body \{[\s\S]{0,200}transform:/);
  assert.doesNotMatch(desktop[0], /\.stage-canvas[\s\S]{0,80}transform:/);

  // Compact phone chrome still applies on a real phone, and also inside the
  // letterboxed column so a laptop does not stretch a second layout.
  assert.match(
    css,
    /@media \(max-width: 640px\), \(max-height: 640px\), \(min-width: 641px\) and \(min-height: 641px\)/,
  );

  // The old two-column shipyard/recap was the desktop UI Dave does not want.
  assert.doesNotMatch(css, /@media \(min-width: 46rem\) and \(min-height: 34rem\)/);
  assert.doesNotMatch(
    css,
    /\.yard \{[\s\S]{0,280}grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(0,\s*1\.05fr\)/,
  );

  // The 3×3 fleet map stays the full phone column. #53's short-phone 86%
  // width put gutters beside the grid on ordinary Safari viewports.
  assert.doesNotMatch(css, /\.yard-board \{[^}]*min\(86%/);
  const yardBoard = css.match(/^\.yard-board \{[\s\S]*?^\}/m);
  assert.ok(yardBoard, "yard-board sizing block is missing");
  assert.match(yardBoard[0], /width:\s*min\(100%,\s*27rem\)/);

  // A modal dialog lives in the top layer, so it must size to the column,
  // not the monitor — 100vw on a laptop is 1280px and overflows the frame.
  assert.match(css, /\.weapon-window \{[^}]*width:\s*min\(440px, calc\(var\(--vv-width\) - 24px\)\)/);
  assert.doesNotMatch(css, /\.weapon-window \{[^}]*100vw/);

  assert.match(viewport, /if \(isWideWindow\(view\)\) return true/);
  assert.match(viewport, /root\.style\.setProperty\("--vv-width", `\$\{layoutWidth\(view\)\}px`\)/);
});
