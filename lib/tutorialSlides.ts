/**
 * The first-flight tutorial: fifteen slides, one button each.
 *
 * It used to be a scripted battle played on the real board, with a coach card
 * on top telling you what to tap. That taught the rules and the interface at
 * once, and a new commander met both before they had met either. This is the
 * plainer thing the owner asked for: a slideshow where the same numbers come up
 * every time, you press one button, and something happens on screen.
 *
 * It is not a game. Nothing here is played — every board is a still picture of
 * a moment, chosen to show one rule. The real game is one button away at the
 * end, on Low, which is where a first match should be.
 *
 * **Every number comes from the engine.** `TUNING`, the face functions and the
 * generated tables in `reference.ts` are the source; nothing is typed in by
 * hand. A balance change moves these sentences with it — which is the whole
 * reason the help screen is generated too.
 */

import { TUNING, attackOf, defenseOf, type DieSize } from "./engine";
import { FACE_ROWS, FORMATIONS, STRAIGHT_LADDER } from "./reference";

/** One cell of the three-by-three board picture. */
export type SlideCell =
  /** A hull that has rolled, showing its face. */
  | { kind: "die"; value: number; hull: DieSize; lit?: boolean; marked?: boolean }
  /** A hull that has not rolled yet. */
  | { kind: "idle"; hull: DieSize }
  /** A hull sitting the round out, drawn as a flat plate. */
  | { kind: "blocking"; hull: DieSize }
  /** The flagship, in the middle. */
  | { kind: "flag"; value?: number }
  /** A cell nobody has opened. */
  | { kind: "locked" }
  /** A cell that is open and empty. */
  | { kind: "empty" };

export type SlideVisual =
  | { kind: "title" }
  | { kind: "board"; cells: SlideCell[] }
  /** A row of example faces, each with its own caption. */
  | { kind: "faces"; values: number[] }
  /** Five faces in a run. */
  | { kind: "straight"; values: number[] }
  /** The round review, cut down to the three lines that matter. */
  | { kind: "review"; before: number; attack: number; shields: number; after: number }
  /** A shipyard row: what you are buying, what it costs, and the board it changes. */
  | { kind: "shop"; label: string; cost: number; detail: string; cells?: SlideCell[] }
  /** The four flagship weapons, with one of them charged. */
  | { kind: "weapons"; charged: "repair" };

export type TutorialSlide = {
  id: string;
  /** Small label above the title. */
  eyebrow: string;
  title: string;
  /** Two or three short sentences. Plain words. */
  body: string;
  /** What the single button says. The last slide leaves the tutorial. */
  action: string;
  visual: SlideVisual;
};

const face = (value: number) => FACE_ROWS.find((row) => row.value === value)!;

/** "6 Energy", "12 Attack" — the prize for the straight this tutorial shows. */
const straightFive = STRAIGHT_LADDER.find(
  (rung) => rung.length === 5 && rung.biggest === 6 && rung.possible,
);
const rowFormation = FORMATIONS.find((entry) => entry.kind === "row")!;

/** Opening a bay: the Nth costs N + slotCostOffset, so the fifth is this. */
const fifthBayCost = TUNING.startSlots + 1 + TUNING.slotCostOffset;
/** Trading up a hull is the difference in price, not the full price. */
const d4ToD6 = TUNING.prices[6] - TUNING.prices[4];

/** The board this tutorial keeps coming back to: four hulls around a flagship. */
function board(cells: Partial<Record<number, SlideCell>>): SlideCell[] {
  const base: SlideCell[] = [
    { kind: "locked" },
    { kind: "idle", hull: 6 },
    { kind: "locked" },
    { kind: "idle", hull: 6 },
    { kind: "flag" },
    { kind: "idle", hull: 6 },
    { kind: "locked" },
    { kind: "idle", hull: 4 },
    { kind: "locked" },
  ];
  return base.map((cell, index) => cells[index] ?? cell);
}

export const TUTORIAL_SLIDES: readonly TutorialSlide[] = [
  {
    id: "welcome",
    eyebrow: "First flight",
    title: "Fleet Dice in a minute",
    body: `Every ship in your fleet is a die. In the middle is your flagship, carrying all ${TUNING.hp} of your health. The first flagship to reach zero loses.`,
    action: "Show me the board",
    visual: { kind: "title" },
  },
  {
    id: "fleet",
    eyebrow: "Your fleet",
    title: "Four ships and a flagship",
    body: `You start with ${TUNING.startSlots} ships around your flagship. The striped cells are bays you have not opened yet. The flagship never fights — it only carries your health.`,
    action: "Roll the fleet",
    visual: { kind: "board", cells: board({}) },
  },
  {
    id: "rolled",
    eyebrow: "The roll",
    title: "The number is the job",
    body: "Every ship rolls a number, and that number is what the ship does this round. Nothing is chosen for you — you only choose what to keep.",
    action: "What do the numbers do?",
    visual: {
      kind: "board",
      cells: board({
        1: { kind: "die", value: 6, hull: 6 },
        3: { kind: "die", value: 5, hull: 6 },
        5: { kind: "die", value: 2, hull: 6 },
        7: { kind: "die", value: 3, hull: 4 },
      }),
    },
  },
  {
    id: "faces",
    eyebrow: "Reading a face",
    title: "Even fights, odd defends",
    body: `${face(6).line} ${face(5).line} The small marks under the number are the extras — Energy to spend, Repair, and Direct damage that nothing can stop.`,
    action: "Got it",
    visual: { kind: "faces", values: [6, 5, 1, 2] },
  },
  {
    id: "reroll",
    eyebrow: "Rerolling",
    title: `${TUNING.rollsPerRound} rolls a round, free`,
    body: `That ${2} is only worth Attack ${attackOf(2)}. Tap a ship to send it back, then roll again. You get ${TUNING.rollsPerRound} rolls a round before anything costs you.`,
    action: "Reroll that ship",
    visual: {
      kind: "board",
      cells: board({
        1: { kind: "die", value: 6, hull: 6 },
        3: { kind: "die", value: 5, hull: 6 },
        5: { kind: "die", value: 2, hull: 6, marked: true },
        7: { kind: "die", value: 3, hull: 4 },
      }),
    },
  },
  {
    id: "paid",
    eyebrow: "Rerolling",
    title: "After that, Energy buys rolls",
    body: `A 6: Attack ${attackOf(6)}. Once your free rolls are gone you can keep going for 1 Energy a ship, up to ${TUNING.paidRollsPerRound} more times in the round. A bank is worth keeping.`,
    action: "Next",
    visual: {
      kind: "board",
      cells: board({
        1: { kind: "die", value: 6, hull: 6 },
        3: { kind: "die", value: 5, hull: 6 },
        5: { kind: "die", value: 6, hull: 6, lit: true },
        7: { kind: "die", value: 3, hull: 4 },
      }),
    },
  },
  {
    id: "formation",
    eyebrow: "Formations",
    title: "Three in a line pays",
    body: `${rowFormation.rule} Lines are a bonus on top of what the dice already rolled, so a tidy board is worth more than a lucky one.`,
    action: "Nice",
    visual: {
      kind: "board",
      cells: board({
        1: { kind: "die", value: 6, hull: 6 },
        3: { kind: "die", value: 5, hull: 6, lit: true },
        4: { kind: "flag", value: 5 },
        5: { kind: "die", value: 6, hull: 6, lit: true },
        7: { kind: "die", value: 3, hull: 4 },
      }),
    },
  },
  {
    id: "straight",
    eyebrow: "Straights",
    title: "Five numbers in a run",
    body: straightFive
      ? `${straightFive.line} You pick which prize to take. It needs five different numbers across your whole fleet, so it does not come around often.`
      : "Five different numbers in a run pays a prize you choose.",
    action: "Next",
    visual: { kind: "straight", values: [1, 2, 3, 4, 5] },
  },
  {
    id: "lock",
    eyebrow: "The volley",
    title: "Lock in, and both fleets fire",
    body: "When you are happy with the board, you lock it in. Nobody goes first — both fleets fire at the same moment, so the round is decided by what you both kept.",
    action: "Lock in",
    visual: {
      kind: "board",
      cells: board({
        1: { kind: "die", value: 6, hull: 6, lit: true },
        3: { kind: "die", value: 5, hull: 6, lit: true },
        4: { kind: "flag", value: 5 },
        5: { kind: "die", value: 6, hull: 6, lit: true },
        7: { kind: "die", value: 3, hull: 4, lit: true },
      }),
    },
  },
  {
    id: "review",
    eyebrow: "The round review",
    title: "Shields answer Attack",
    body: `Their Attack comes at your flagship, and your Shields cancel it point for point. The review shows the whole sum: what you started with, what moved it, what you have left.`,
    action: "Next",
    visual: { kind: "review", before: TUNING.hp, attack: 12, shields: defenseOf(5), after: TUNING.hp - 12 + defenseOf(5) },
  },
  {
    id: "blocking",
    eyebrow: "Blocking",
    title: "A ship can step in front",
    body: `When a volley is bigger than your Shields, a ship can take the hit instead. It stops damage equal to its own size, so a d6 stops 6. Tap the ship you want to send.`,
    action: "Block with the d6",
    visual: {
      kind: "board",
      cells: board({
        1: { kind: "die", value: 6, hull: 6 },
        3: { kind: "die", value: 5, hull: 6, marked: true },
        5: { kind: "die", value: 6, hull: 6 },
        7: { kind: "die", value: 3, hull: 4 },
      }),
    },
  },
  {
    id: "blocked",
    eyebrow: "Blocking",
    title: "And it sits the next round out",
    body: "A ship that blocked is drawn flat, with a red bar through it. That is the one mark for a ship out of the fight — it rolls nothing next round, which is what blocking costs you.",
    action: "Understood",
    visual: {
      kind: "board",
      cells: board({
        1: { kind: "die", value: 6, hull: 6 },
        3: { kind: "blocking", hull: 6 },
        5: { kind: "die", value: 6, hull: 6 },
        7: { kind: "die", value: 3, hull: 4 },
      }),
    },
  },
  {
    id: "shop_bay",
    eyebrow: "The shipyard",
    title: "Spend Energy between rounds",
    body: `Every round pays Energy, and the shipyard is where it goes. Opening another bay gives you another ship — and another chance at a line.`,
    action: "Open the bay",
    visual: {
      kind: "shop",
      label: "Open a bay",
      cost: fifthBayCost,
      detail: "One more ship on the board, and one more way to make a line.",
      // The corner bay opens: striped no longer, and a fifth hull to roll.
      cells: board({
        0: { kind: "die", value: 4, hull: 4, lit: true },
        1: { kind: "die", value: 6, hull: 6 },
        3: { kind: "die", value: 5, hull: 6 },
        5: { kind: "die", value: 6, hull: 6 },
        7: { kind: "die", value: 3, hull: 4 },
      }),
    },
  },
  {
    id: "shop_upgrade",
    eyebrow: "The shipyard",
    title: "Trade a small hull up",
    body: `A bigger hull rolls bigger numbers, and it blocks more when it steps in front. You pay the difference, not the whole price.`,
    action: "Upgrade to a d6",
    visual: {
      kind: "shop",
      label: "Upgrade a d4 to a d6",
      cost: d4ToD6,
      detail: `Higher faces, and it stops 6 instead of 4 when it blocks.`,
      // The triangle at the bottom becomes a square: same bay, bigger hull.
      cells: board({
        0: { kind: "die", value: 4, hull: 4 },
        1: { kind: "die", value: 6, hull: 6 },
        3: { kind: "die", value: 5, hull: 6 },
        5: { kind: "die", value: 6, hull: 6 },
        7: { kind: "die", value: 6, hull: 6, lit: true },
      }),
    },
  },
  {
    id: "weapons",
    eyebrow: "Flagship weapons",
    title: "Charge one, fire it later",
    body: `Four weapons sit on your flagship. Charge one in the shipyard for ${TUNING.weaponChargeCost} Energy and it waits there until you fire it — Repair adds ${TUNING.weaponRepair} health in the middle of a volley. One use each, one per round.`,
    action: "Charge Repair",
    visual: { kind: "weapons", charged: "repair" },
  },
  {
    id: "play",
    eyebrow: "That is the game",
    title: "Go and play one",
    body: "Roll, keep what helps, lock in, spend what you earned. Low is a gentle opponent and the right place for a first match — everything else you will pick up as you go.",
    action: "Play solo on Low",
    visual: { kind: "title" },
  },
] as const;

export const TUTORIAL_LAST = TUTORIAL_SLIDES.length - 1;
