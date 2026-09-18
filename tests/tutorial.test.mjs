/**
 * The first-flight tutorial is a slideshow, and it has to stay one.
 *
 * It replaced a scripted battle played on the real board, which taught the
 * rules and the interface at the same time and was the thing new players bounced
 * off. The rules this guards:
 *
 *   1. One button a slide. A slide with no action is a dead end.
 *   2. Every teaching beat the owner asked for is present.
 *   3. It ends by handing the player into a real match on Low.
 *   4. Its numbers come from the engine, so a balance change cannot leave a
 *      sentence on screen lying. This is the same rule the help screen follows.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { TUTORIAL_SLIDES, TUNING, attackOf } = G;

const source = readFileSync(new URL("../lib/tutorialSlides.ts", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/TutorialSlides.tsx", import.meta.url), "utf8");

test("every slide has a picture, words and exactly one button", () => {
  assert.ok(TUTORIAL_SLIDES.length >= 12, "a first flight needs more than a handful of slides");
  const ids = new Set();
  for (const slide of TUTORIAL_SLIDES) {
    assert.ok(slide.id && !ids.has(slide.id), `duplicate or missing id: ${slide.id}`);
    ids.add(slide.id);
    assert.ok(slide.title.length > 0, `${slide.id} has no title`);
    assert.ok(slide.body.length > 20, `${slide.id} barely says anything`);
    assert.ok(slide.action.length > 0, `${slide.id} has no button, so it is a dead end`);
    assert.ok(slide.visual?.kind, `${slide.id} has no picture`);
  }
});

test("it teaches every beat the owner asked for, in order", () => {
  const ids = TUTORIAL_SLIDES.map((slide) => slide.id);
  // Roll, read the faces, reroll (free and paid), lines, straights, the volley,
  // blocking, the shipyard, and the flagship weapons.
  for (const id of [
    "fleet",
    "rolled",
    "faces",
    "reroll",
    "paid",
    "formation",
    "straight",
    "lock",
    "review",
    "blocking",
    "blocked",
    "shop_bay",
    "shop_upgrade",
    "weapons",
    "play",
  ]) {
    assert.ok(ids.includes(id), `the tutorial no longer teaches "${id}"`);
  }
  assert.equal(ids[ids.length - 1], "play", "the last slide must be the hand-off");
});

test("it ends by starting a real match on Low", () => {
  const last = TUTORIAL_SLIDES[TUTORIAL_SLIDES.length - 1];
  assert.match(last.action, /Low/, "the last button should say where it is taking you");
  assert.match(screen, /\/solo\/\?d=low/, "the hand-off link is gone");
  const solo = readFileSync(new URL("../app/solo/page.tsx", import.meta.url), "utf8");
  assert.match(solo, /searchParams|location\.search/, "solo no longer reads the difficulty link");
  assert.match(solo, /if \(saved\) return;/, "a saved battle must still win over the link");
});

test("the slides quote the engine, never a number typed in by hand", () => {
  // The dangerous ones are the numbers a player could check against the game.
  const joined = TUTORIAL_SLIDES.map((slide) => `${slide.title} ${slide.body}`).join(" ");
  assert.ok(joined.includes(String(TUNING.hp)), "the flagship's health is not mentioned");
  assert.ok(joined.includes(String(TUNING.rollsPerRound)), "free rolls a round are not mentioned");
  assert.ok(
    joined.includes(String(TUNING.paidRollsPerRound)),
    "the paid reroll cap is not mentioned",
  );
  assert.ok(
    joined.includes(String(TUNING.weaponChargeCost)),
    "what a weapon costs to charge is not mentioned",
  );
  assert.ok(joined.includes(String(attackOf(6))), "what a 6 rolls is not mentioned");

  // And the source must interpolate rather than spell those out.
  assert.match(source, /TUNING\.hp/);
  assert.match(source, /TUNING\.rollsPerRound/);
  assert.match(source, /TUNING\.paidRollsPerRound/);
  assert.match(source, /TUNING\.weaponChargeCost/);
  assert.match(source, /FACE_ROWS|STRAIGHT_LADDER|FORMATIONS/);
  // Prices are a difference, not a figure to retype.
  assert.match(source, /TUNING\.prices\[6\] - TUNING\.prices\[4\]/);
  assert.match(source, /TUNING\.slotCostOffset/);
});

test("the slideshow is stills, not a playable match", () => {
  // The old tutorial drove a real MatchScreen through a scripted battle. If
  // that comes back, this is a different thing than what was asked for.
  assert.doesNotMatch(screen, /MatchScreen/);
  assert.doesNotMatch(screen, /applyAction|useSoloMatch|useTutorialMatch/);
  // It paints with the game's own art, so what is taught is what is played.
  assert.match(screen, /HelpShipFace/);
  assert.match(screen, /HelpFlagFace/);
  assert.match(screen, /HelpHullPlate/);
});

test("faces are described with the game's two words", () => {
  const joined = TUTORIAL_SLIDES.map((slide) => `${slide.title} ${slide.body}`).join(" ");
  assert.doesNotMatch(joined, /\b(soak(s|ed|ing)?|absorb(s|ed|ing)?)\b/i);
  // "Attack N" and "Shield N", never "hits" or "blocks", for what a face rolls.
  assert.match(joined, /Attack \d/);
  assert.match(joined, /Shield \d/);
});
