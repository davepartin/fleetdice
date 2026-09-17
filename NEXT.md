# Where this stopped, and what is left

Updated 2 September 2026, after two sessions of playing the game on a phone and
fixing what that turned up. If you hand this project to an assistant again, give
it `CLAUDE.md` and `HANDOFF.md` first; this file is the running list of what is
loose.

---

## What works right now

- **Solo plays start to finish.** Shipyard, roll, reroll, straights, formations,
  bracing, the round report, victory and defeat. Verified by a script that
  plays the real game in a real browser and screenshots every screen.
- **The rules are tested.** 113 tests, including "every ledger row sums to its
  total" checked on every round of a real match, "a match always ends", the
  reroll cap, repair landing in the same breath as damage, and a set of guards
  that fail if a fix regresses.
- **The numbers are measured.** `sim/` plays thousands of matches. See
  `BALANCE.md`.
- **The 3D is real.** Actual polyhedra, not pictures of dice — including a
  correctly proportioned pentagonal trapezohedron for the d10.
- **The help screen cannot go stale.** It is generated from the engine.

## Two-player, which used to be the big unknown

**It works, and it has been played.** Two browser clients against a local
Firebase emulator (5/5 and 6/6 on the two harnesses), and then a whole match on
two real devices against real Firebase — room code, join, shipyard, blocking,
the flagship token, a straight, and a victory screen.

That test earned its keep immediately: it found a bug no local run could have.
The round report read the *opponent's* live tally when it was built, and a
commander who finished blocking first would walk on to the shipyard, which
clears that tally — so the slower player's report said "0 attack, 0 shields"
with hit points that were right. It needed one human slower than a machine.
Fixed, and `tests/versus-flow.test.mjs` fails if it comes back.

Worth keeping in mind when testing it: two tabs on one machine, driven by the
same script at the same speed, will not find that class of bug.

---

## Known rough edges

- **Sound has never been heard.** Every cue is generated in the browser and none
  of it has been listened to by a human. Levels and pitches are guesses. This is
  now the largest untested thing in the project.
- **The hero dice are still mostly behind the buttons.** They were lifted 40px
  and it helped, but the gap between the key art and the first card is only
  about 50px tall on a 390×844 screen, and the cluster is taller than that.
  `HERO_LIFT` in `components/HeroStage.tsx` moves them; one world unit is 22px.
- **Audio, victory and defeat used to share this bullet.** Victory and defeat
  are done: the flagship breaks, the dice scatter, the camera pushes in, and the
  recap waits ~5.9 seconds before it slides up.
- **The straight tier chooser only appears when the run is longer than five.**
  That is correct, but it means most players will never see it, and may not know
  it exists.
- **`tools/dbg.mjs`** is a scratch probe. Delete it whenever.
- **`_to_delete/`** in your fleetdice3 folder holds the zips used to move the
  code onto your Mac. Safe to throw away — the sandbox is not allowed to delete
  files on your machine, so it left them there instead.

---

## Balance questions still open

*Several of the entries below are superseded — `BALANCE.md` is the authority and
has the measurements. Kept here because the reasoning is still worth reading.*

- **The Enemy under-buys bays, and it is not what it looks like.** *Measured
  and settled.* The brain reaches the shipyard with 4.4 Energy, can afford a bay
  on 20% of visits, and buys one two thirds of the time it can. It was never
  undervaluing bays; it could not save for one. A `patience` knob that let it
  save works exactly as designed and is worth nothing — six paired runs, all
  about 50%. Do not rebuild it. See `BALANCE.md`.
- **The Enemy now hunts live lines.** It spots a row or column that is one face
  away, spends spare Energy sending the odd die back, and parks a new hull on
  the bay that already has ships on its line. Formation and Wolfpack shop for
  that; Capital still upgrades instead. Play Solo → Formation to see it.
  Measured at Medium, Formation, 80 matches: a column paid in 11% of rounds,
  and 72% of commanders saw at least one. The roll screen now also tells *you*
  when you are one face away, using the same prize the engine pays.
- **Difficulty is Low / Medium / Hard / Expert**, and the rungs are real now.
  *Superseded:* the ladder is `energyWeight` per tier — how highly a tier values
  Energy when choosing dice, which is also what `nearFormation` prices a row
  with. Medium over Low 72.0%, Hard over Medium 63.4%, Expert over Hard 58.4%.
  Low is deliberately unchanged so a first game plays as it always did. The
  older paragraph below describes the previous scheme. Expert is not a cheater: same dice, same prizes, no peeking.
  It thinks as well as Hard, then starts with a tougher flagship (more health
  and a little Energy) that you can see on the bar. Extra health without a
  brain still dies in a long fight, so the two are stacked. Blocking looks at
  the volley that already arrived; a wounded flagship stops buying levels.
  A small measurement (24 matches a pairing, noisy): Expert beat Hard about
  seven times in ten. Hard beat Low about three times in four. Medium and
  Hard are close when they start with the same flagship — that is why Expert
  gets the extra health.
- **Straights.** *Partly answered.* They were rare partly because nothing was
  hunting them: Expert now lands 2.82 a commander against 1.75 before. The How
  to Play chart may now be about the right size rather than oversized. At four
  cells they fire in about 10% of rounds, rising as you buy cells, because a straight needs five different
  numbers and four ships plus a flagship is exactly five dice. That feels right
  on paper — a run should get easier as your fleet grows — but it has not been
  played.
- **Flagship levels are bought about once every two matches** even after the
  price came down from 10/16 to 5/8. That may still be too rare.
- **The measuring lesson from this session.** A number is only as good as the
  brain that produced it. The first balance pass measured 10,042 rounds against
  an opponent whose shopping logic was broken, and drew a confident conclusion
  from it. If a finding surprises you, check what produced it before you act.

## What to do next

1. **Play, and write down what felt off.** Not what looked wrong — what *felt*
   wrong. Every good change in the last two sessions came from exactly that: the
   reroll cap, the enemy formation rails, the round report bug, the difficulty
   ladder, the reroll button. None came from reading code.
2. **Listen to the audio.** It is the last part of this game no human has ever
   experienced, and it is entirely guesses.
3. **`lib/ai.ts` if you want more difficulty.** `sim/ladder.mjs` measures every
   rung in one command, and `sim/weights.mjs` sweeps the knob that moved them.

## Future ideas — not started, owner decides when

Ideas the owner wants kept, not work to pick up unprompted. Nothing here is on
`AAA-PLAN.md`'s list; when one is chosen, it goes there as a numbered item with
a DONE test first.

### Dice skins, then maybe whole themes (16 September 2026)

A friend who played it said he is having as much fun with Fleet Dice as with any
other game. The owner thinks a choice of dice skin would be fun for players, and
possibly something to sell for about a dollar each.

**Why it is cheap to run.** Faces are painted once, at load, into a texture per
hull (`lib/three/faceArt.ts`, from the `HIT`, `BLOCK` and flagship palettes),
and the finish is a handful of material settings in `lib/three/die.ts`. A skin
is another set of those choices. Switching repaints once; a match runs at the
same speed on any skin. Engraved lines can catch light through one extra normal
map per hull — a small cost, but measure frame rate before and after.

Five candidates, with the current dice kept as the default (**Classic**):

1. **Gunmetal** — dark brushed steel, bevelled rims that catch light, colour set
   into an inset panel on each face (the way the flagship already is).
2. **Neon** — near-black glassy dice, glowing edge lines and symbols.
3. **Carbon Fiber** — matte woven black with glossy colour faces.
4. **Nebula** — deep translucent resin with purple and teal swirls and faint stars.
5. **Salvage** — scratched hull plating and worn hazard stripes, matching the
   locked bays.

Gunmetal, Carbon Fiber and Salvage are almost entirely painted texture — the
easiest. Neon and Nebula lean on bloom and translucency; check them on an older
phone, where the low quality tier already turns bloom off.

**Rules every skin keeps** (see `CLAUDE.md` and `AAA-PLAN.md`):

- Colour keeps its meaning. Red is Attack and blue is Shields in every skin; a
  skin changes shade and material, never what a colour says.
- Hull shapes stay fixed — d4 triangle, d6 square, d8 diamond, d10 pentagon.
- The number reads at a glance first. Surface detail stays faint on the face and
  heavier on the rim.
- Cosmetic only. In versus each player sees their own skin, so it cannot touch
  fairness, and it must never reach `lib/engine.ts`.

**A theme** goes a step further: the lighting and space background
(`lib/three/stage.ts`) and the panel and button colours (the tokens in
`app/globals.css`). Worth doing only after one skin shows people use the choice.

**A sensible first version:** one extra skin (Gunmetal) and a toggle in
Settings, saved on the device. Selling skins is a separate, later decision — it
needs a payment provider, a way to restore a purchase on a new phone (which
means an account, likely the Firebase Auth versus already uses), and the app
store or web payment rules for wherever the game is sold.

**Grok's mock-up** (a tilted camera, dice stacked in towers, a glossy reflecting
table, a large ship behind the board) was reviewed the same day. Keep the
bevelled metal edges, inset colour panels, faint panel lines and glowing
symbols. Leave out the tilted camera and stacking (numbers get harder to read),
real reflections (every die drawn twice) and the ship (it pulls the eye off the
numbers).
