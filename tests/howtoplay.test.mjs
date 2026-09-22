/**
 * How to play must stay one long illustrated scroll, using the same dice
 * art as the match and the same numbers as the engine.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { HOW_TO_PLAY, MUTUAL_KILL_EXAMPLE, SHOP_ROWS, mutualKillBreak, signedHp } = G;

test("how to play is one illustrated scroll, not an accordion", () => {
  const src = readFileSync(new URL("../components/HowToPlay.tsx", import.meta.url), "utf8");
  assert.match(src, /HowToPlaySheet/);
  assert.match(src, /HowToPlayBody/);
  assert.match(src, /HelpShipFace/);
  assert.match(src, /HelpFlagFace/);
  assert.match(src, /HullShape/);
  assert.match(src, /from "@\/lib\/reference"/);
  // The prizes are shown as symbol + number, not spelled out in words.
  assert.match(src, /StatIcon/);
  assert.doesNotMatch(src, /setOpenId/);
  assert.doesNotMatch(src, /aria-expanded/);
});

test("the game never says brace, soak or absorb — only shields and blocking", () => {
  // Shields are what the blue odd faces roll; blocking is what a ship does
  // when it steps in front of damage. Those two words carry the whole idea,
  // so no screen is allowed to reach for a third.
  const files = [
    "../components/HowToPlay.tsx",
    "../components/MatchScreen.tsx",
    "../components/RoundReport.tsx",
    "../components/BattleRecap.tsx",
    "../components/ui.tsx",
    "../lib/reference.ts",
    "../lib/tutorialSlides.ts",
    "../components/TutorialSlides.tsx",
    "../components/FlagshipWeapons.tsx",
  ];
  // Comment lines are skipped: this is about words a player can read, and
  // the note explaining the rule has to be able to name the words it bans.
  // Code identifiers keep their original names too — renaming the engine's
  // `brace` action is a far bigger change than the words on screen.
  const banned = /\b(soak(s|ed|ing)?|absorb(s|ed|ing)?)\b/i;
  const isComment = (line) => /^\s*(\/\/|\/\*|\*)/.test(line);
  for (const file of files) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    for (const line of src.split("\n")) {
      if (isComment(line)) continue;
      assert.doesNotMatch(line, banned, `${file}: ${line.trim()}`);
    }
  }
});

test("help faces are painted with the same plates as the 3D dice", () => {
  const src = readFileSync(new URL("../lib/three/faceArt.ts", import.meta.url), "utf8");
  assert.match(src, /export function paintHelpFace/);
  assert.match(src, /paintFace\(ctx, spec, sides, size, "albedo", numeralFont, captionFont/);
  assert.match(src, /HELP_HULL_LAYOUT/);
});

test("each help face is clipped to the hull that first shows that number", () => {
  const help = readFileSync(new URL("../components/HelpArt.tsx", import.meta.url), "utf8");
  const reference = readFileSync(new URL("../lib/reference.ts", import.meta.url), "utf8");
  assert.match(help, /hullForFace/);
  assert.match(help, /addHullPath/);
  assert.match(help, /ctx\.clip\(\)/);
  assert.match(reference, /export function hullForFace/);
  assert.match(reference, /HULLS\.find\(\(sides\) => sides >= value\)/);
});

test("the shipyard teaches d4-first building and one step per ship per round", () => {
  const hullRows = SHOP_ROWS.filter((row) => row.kind === "hull");
  assert.deepEqual(hullRows.map((row) => row.name), ["Buy a d4"]);
  const section = HOW_TO_PLAY.find((entry) => entry.id === "shipyard");
  assert.ok(section);
  const copy = [section.summary, ...section.blocks.filter((block) => block.kind === "text").map((block) => block.text)].join(" ");
  assert.match(copy, /Every new ship starts as a d4/);
  assert.match(copy, /Each ship may grow (?:by )?one (?:hull )?step per round/);
  assert.match(copy, /you may upgrade other ships/i);
});

test("shipyard tiles stay clean and the drawer explains the one-upgrade limit", () => {
  const yard = readFileSync(new URL("../components/Shipyard.tsx", import.meta.url), "utf8");
  const tiles = yard.slice(yard.indexOf("function CellButton"), yard.indexOf("function Drawer"));
  const drawer = yard.slice(yard.indexOf("function Drawer"));
  assert.doesNotMatch(tiles, /upgrade →/);
  assert.match(drawer, /Each die can upgrade once per round/);
  assert.match(drawer, /Already upgraded this round/);
});

test("a win or a loss recaps the last volley with the round-review column", () => {
  const recap = readFileSync(new URL("../components/BattleRecap.tsx", import.meta.url), "utf8");
  assert.match(recap, /fleet-dice-recap-victory/);
  assert.match(recap, /fleet-dice-recap-defeated/);
  const lastRound = recap.slice(recap.indexOf("function LastRound"), recap.indexOf("export function BattleRecap"));
  assert.match(lastRound, /VolleyLedger/);
  assert.match(lastRound, /ledgerSide/);
  assert.doesNotMatch(
    lastRound,
    /StatRow/,
    "the last volley is the round-review column, not the three share-bars",
  );
});

test("How to Play has a Mutual Destruction card that matches mutualKillBreak", () => {
  // The rule changed twice: the Attack rolled, then the damage landed, and now
  // where the two flagships ended up. Every screen has to say the live one,
  // and How to Play has to say it as its own card — not a paragraph inside Winning.
  const reference = readFileSync(new URL("../lib/reference.ts", import.meta.url), "utf8");
  const recap = readFileSync(new URL("../components/BattleRecap.tsx", import.meta.url), "utf8");
  const engine = readFileSync(new URL("../lib/engine.ts", import.meta.url), "utf8");
  const help = readFileSync(new URL("../components/HowToPlay.tsx", import.meta.url), "utf8");

  const section = HOW_TO_PLAY.find((entry) => entry.id === "mutual-destruction");
  assert.ok(section, "HOW_TO_PLAY is missing the mutual-destruction section");
  assert.equal(section.title, "Mutual Destruction");
  const copy = [
    section.summary,
    ...section.blocks.filter((block) => block.kind === "text").map((block) => block.text),
  ].join(" ");

  assert.match(copy, /blown up by less wins/);
  assert.match(copy, /Health keeps counting past zero/);
  assert.match(copy, /MUTUAL DESTRUCTION/);
  assert.match(copy, /Shields/);
  assert.match(copy, /blocking ships/);
  assert.match(copy, /Repair/);
  assert.match(copy, /whole match/);
  assert.doesNotMatch(copy, /heavier attack/i);
  assert.doesNotMatch(copy, /landed more damage that round/);

  // The example pair is the engine's own comparison, not a second opinion.
  assert.ok(
    MUTUAL_KILL_EXAMPLE.closer > MUTUAL_KILL_EXAMPLE.deeper,
    "the help's 'closer' number must actually be closer to zero",
  );
  const decided = mutualKillBreak(
    { hp: MUTUAL_KILL_EXAMPLE.closer, stats: { damageDealt: 0 } },
    { hp: MUTUAL_KILL_EXAMPLE.deeper, stats: { damageDealt: 0 } },
  );
  assert.equal(decided.winner, "host", "the help's closer flagship must be the one mutualKillBreak picks");
  assert.equal(decided.decidedBy, "health");
  assert.match(
    copy,
    new RegExp(
      `${signedHp(MUTUAL_KILL_EXAMPLE.closer)} beats ${signedHp(MUTUAL_KILL_EXAMPLE.deeper)}`,
    ),
  );

  assert.match(reference, /from "@\/lib\/engine"/);
  assert.match(reference, /id: "mutual-destruction"/);
  assert.match(reference, /MUTUAL_KILL_EXAMPLE/);
  assert.doesNotMatch(reference, /heavier attack/i);
  assert.doesNotMatch(reference, /landed more damage that round/);

  assert.doesNotMatch(recap, /heavier Attack/);
  assert.doesNotMatch(recap, /Damage that landed/);
  assert.match(recap, /Mutual/);
  assert.match(recap, /Destruction/);
  assert.match(recap, /blown up by less/);
  assert.match(recap, /Where the flagships ended/);
  assert.match(recap, /MutualArt/);
  assert.match(recap, /fleet-dice-mutual/);
  assert.match(recap, /VolleyLedger/);
  assert.match(recap, /ledgerSide/);

  // The card is actually drawn, with the recap's two numbers, not only stored.
  assert.match(help, /section\("mutual-destruction"\)/);
  assert.match(help, /data-help-section="mutual-destruction"/);
  assert.match(help, /MUTUAL_KILL_EXAMPLE/);
  assert.match(help, /signedHp/);
  assert.match(help, /Where the flagships ended/);
  assert.match(help, /help-mutual-banner/);
  assert.doesNotMatch(help, /heavier attack/i);
  assert.doesNotMatch(
    help,
    /−12|−24|-12|-24/,
    "HowToPlay must not type the example numbers; they come from MUTUAL_KILL_EXAMPLE",
  );

  assert.match(engine, /export function mutualKillBreak/);
  assert.match(engine, /const hostHp = host\.hp;/);
  assert.match(engine, /decidedBy: "health"/);
  assert.match(engine, /winner: hostHp > guestHp \? "host" : "guest"/);
});

test("Winning no longer buries the mutual-kill rule in a leftover paragraph", () => {
  const winning = HOW_TO_PLAY.find((entry) => entry.id === "winning");
  assert.ok(winning);
  const copy = [
    winning.summary,
    ...winning.blocks.filter((block) => block.kind === "text").map((block) => block.text),
  ].join(" ");
  assert.doesNotMatch(copy, /blown up by less/);
  assert.doesNotMatch(copy, /MUTUAL DESTRUCTION/);
});

test("How to Play is generated from the engine and never mentions a Reactor cap", () => {
  const reference = readFileSync(new URL("../lib/reference.ts", import.meta.url), "utf8");
  const engine = readFileSync(new URL("../lib/engine.ts", import.meta.url), "utf8");
  assert.match(reference, /from "@\/lib\/engine"/);
  assert.match(reference, /each 1 raises your income by \$\{bonus\} Energy a round/);
  assert.doesNotMatch(reference, /reactorCap/);
  assert.doesNotMatch(reference, /reactorOverflow/);
  assert.doesNotMatch(reference, /pays a flat/);
  assert.doesNotMatch(reference, /up to \$\{TUNING/);
  assert.doesNotMatch(engine, /reactorCap/);
  assert.doesNotMatch(engine, /reactorOverflow/);
});
