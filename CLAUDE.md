# Working on Fleet Dice

This file is how to work here without undoing decisions that were reached with
measurements. Read `BALANCE.md` before you touch any number, and `PLAN.md` for
the direction and what is still open. `FIREBASE.md` matters before you go near
two-player play.

*The game is called **Fleet Dice**. The repo is `fleetdice` and the Firestore
collections are still `fd3*` — the 3 was the development name and survives only
where renaming would break live data on players' phones.*

The owner is not a developer. He thinks in how the game feels. Prefer plain
words, and prefer showing him something he can open on a phone over explaining
an approach.

## Where it lives

<https://fleetdice.com> — the owner's own domain, registered at GoDaddy, where
four A and four AAAA records point at GitHub Pages. Published by
`.github/workflows/deploy.yml` on every push to `main`. There is **one copy of
the game**, in this repo, and nothing is copied anywhere else.

| address | what it is |
| --- | --- |
| `fleetdice.com` | the game |
| `www.fleetdice.com` | GitHub's own redirect to the apex (a `www` CNAME at GoDaddy) |
| `fleetdice.ministrybag.com` | a redirect; the game's address until 17 September 2026 |
| `ministrybag.com/fleetdice` | a redirect, four small files in `davepartin/ministrybag1` |
| `davepartin.github.io/fleetdice/` | GitHub's own redirect to the custom domain |

**`public/CNAME` is load-bearing.** It carries the domain into the build
artifact; without it in the build, Pages drops the custom domain on the next
deploy, the site moves back to `davepartin.github.io/fleetdice/`, and every
asset path breaks because `basePath` is empty.

It briefly worked another way — the whole built site committed into a
`fleetdice/` folder in the ministry repo, kept in step by a `publish:ministrybag`
script. That meant two copies of one website to keep in step and about 5MB added
to that repo's history on every deploy. **Do not put a copy back there**; the
game has its own address so there does not have to be one.

`SITE_URL` is a build-time variable because Open Graph has to name an absolute
image URL. The workflow sets `https://fleetdice.com`.

## How the code is laid out

`lib/engine.ts` is the rules, with no React and no browser — the app, the
opponent and the simulations all call the same functions. `lib/ai.ts` is the
opponent's brain and doubles as the yardstick for every measurement.
`lib/reference.ts` generates every word and number the How to Play screen shows,
from the engine, so help can never drift from rules. `lib/three/` is the 3D:
`polyhedron.ts` builds the solids and the per-face UV atlas, `die.ts` is one
die and its throw, `board.ts` and `deckArt.ts` are the deck, `stage.ts` is the
renderer and post chain, `arena.ts` places two boards and moves the camera,
`vfx.ts` is impacts and beams. `lib/rooms.ts` is Firestore. Screens are in
`components/`, routes in `app/`.

The three-by-three board is cells 0–8 with the flagship fixed at cell 4. Ships
live in *slots* 0–7. `cellForSlot` and `slotForCell` convert. Getting these
confused is the easiest bug to write in this codebase.

**Solo and versus take the same board changes.** `components/MatchScreen.tsx`
is the battle for both `/solo/` and `/versus/` (`app/match/page.tsx`). A rules,
HUD, dice, or phone-layout fix that only lands in one mode is unfinished. If a
lock or tap lives in `lib/useMatch.ts`, update `useSoloMatch` and `useRoomMatch`
together. Cancel game is the exception: it is a versus room action, not a board
change.

The sim harness bundles the TypeScript with esbuild into `.simbuild/` first, so
it always measures the same code the browser runs. Never hand-write a second
copy of the rules for a simulation.

## The one thing that will bite you

**There is one Firebase project (`space-tribes`) and one set of security
rules.** Deploying `firestore.rules` replaces the rules for that whole project —
which is live Fleet Dice. A fragment, a typo, or a file that does not contain
the `fd3*` blocks will break two-player play immediately and silently.
`FIREBASE.md` has the detail. Deploying the website does not deploy the rules.

Fleet Dice 1 and 2 are retired (2 September 2026 — the `spacetribe-dice` repo is
archived and its Pages site is off). Their leftover collections (`codes`,
`matches`, `liveBattles`, `battleResults`) are for the **owner to delete**; do
not delete them from an agent, and do not put those match blocks back.

The project is on Firebase's **Blaze** plan, so the free tier's
~55-matches-a-day ceiling is gone. Real cost is pennies: a hundred matches a day
is about five.

## How to work with the owner

1. **Measure before you believe.** Almost every design instinct on this project
   has been wrong at least once.
2. **A measurement is only as good as the thing producing it.** The first
   balance pass drew a confident conclusion from 10,042 rounds played by an
   opponent whose shopping logic was broken. If a finding surprises you, check
   what produced it before you act on it.
3. **Tell him when he's wrong, and show your working.** He would rather hear
   "that measured at 84% and would break the game" than have you build it
   politely. He will also tell *you* when you are wrong, and has already been
   right about something important.
4. **Plain words.** If you use a term, make sure it names something in the game
   today.
5. **One assistant at a time in this folder.** On 16 September two agents were
   given the same job in the same clone; they stashed and popped over each
   other's work and neither control was trustworthy.

## Running it

```bash
pnpm dev                 # localhost:3000, live reload — use this, not a build
pnpm test                # 113 tests, ~2s
pnpm build               # static export to out/ (what GitHub Pages serves)
pnpm lint
```

Versus needs Firebase. Prefer the emulator — testing against the real project
puts junk rooms on the live board. (A real two-device match *was* played on
1 September, deliberately and once, to close the last unknown; the room cleaned
itself up on the win.)

```bash
firebase emulators:start --only firestore,auth --project space-tribes
pnpm build:emulator      # a build pointed at them
pnpm serve               # the static build on :4321
pnpm test:versus         # two browser clients, connection pulled mid-match
node sim/versus-flow-emulator.mjs   # one plays on while the other sits still
```

This needs a Java runtime and the Firebase CLI, neither of which ships with
macOS. Installed on the owner's Mac as `~/.local/opt/jdk-21.*` (a plain Temurin
tarball, no Homebrew, no sudo — delete the folder to remove it) and
`firebase-tools` globally via npm. Export the JDK before starting:
`export PATH="$HOME/.local/opt/jdk-21.0.12.1+1/Contents/Home/bin:$PATH"`.

Use `firebase emulators:start` directly rather than `pnpm emulators`: the pnpm
script runs a dependency check that fails on an unbuilt native module in
`firebase-tools`. And `pnpm build:emulator` overwrites `out/` with a build
pointed at 127.0.0.1 — run `pnpm build` afterwards so the deployable build is
not left pointing at a local emulator.

Balance and AI:

```bash
node sim/sweep.mjs difficulty 1500       # the tier ladder
node sim/difficulty-source.mjs 1200      # WHY a tier is strong, knob by knob
node sim/swarm-vs-ai.mjs 300 expert      # a strategy against the game's best
node sim/straights.mjs 200               # what tiers build when left alone
node sim/d10.mjs 150                     # what each tier buys, and with what
node sim/d10-policy.mjs 800 low          # is a hull step worth its Energy
node sim/lab.mjs hulls 800               # which hull goes in the cell you opened
```

## House rules

**`lib/engine.ts` is the only source of truth.** Pure, no DOM, no React.
`TUNING` holds every balance number. The simulations and the app run the same
engine, which is why a number measured in `sim/` means something about the game
a person plays.

**Never hardcode a number the engine knows.** `lib/reference.ts` and every help
string interpolate from `TUNING` and from the face functions (`repairOf`,
`energyOf`, `attackOf`…). A balance change must not be able to leave a sentence
on screen lying. This has been violated twice and caught both times; assume it
will be violated again.

**Two words, and only two.** *Shields* are blue odd faces cancelling Attack.
*Blocking* is a ship stepping in front of damage and sitting out a round. The
words *brace*, *soak* and *absorb* must never reach the screen — a test in
`tests/howtoplay.test.mjs` fails if they do. (`brace` survives as an internal
action name in the engine; renaming that is a much bigger change than the words
a player reads.)

Faces roll **"Attack N"** or **"Shield N"** — never "hits" or "blocks".

**One mark, one meaning.** A ship spending a round out is drawn by
`paintHullPlate` as a flat plate: its hull silhouette, its size, a red bar
through it. The same mark appears the instant you tap a ship to block. Do not
add a second way to say this.

**Hull shapes are fixed.** d4 triangle, d6 square, d8 diamond, d10 pentagon,
from `addHullPath` in `components/HullShape.tsx`. Everything — fleet icons, help
screen, board plates — uses that one path set. A die's real 3D silhouette is not
the shape the game uses for it.

## Verifying work

**`pnpm build` poisons the `pnpm dev` cache.** Running a production build
while the dev server is up leaves Turbopack serving stale CSS from `.next` —
edits to `app/globals.css` simply do not appear, and restarting the dev server
does not clear it. The fix is `rm -rf .next` and restart. This cost several
rounds of debugging a change that was already correct in the file: the source
said one thing, `getComputedStyle` said another, and neither was lying.

**Measure; do not eyeball a screenshot.** Use real DOM numbers — `scrollWidth`
vs `clientWidth`, bounding boxes. Several bugs this session were invisible in a
screenshot and obvious in a measurement, and at least one was "fixed" twice
because a screenshot looked plausible.

**The dice are WebGL and unreachable from the DOM.** `window.__fd3` is the hatch
(`{arena, tap(id), debug()}`); `die.stats()` reports enough to prove an
animation is running.

**Playwright, in this repo:** scripts live in `tools/` and resolve
modules. Pass the GL args —
`{args:["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist","--disable-gpu-sandbox"]}`
— but **do not set `executablePath`**: `/opt/pw-browsers/chromium` was a path on
a previous machine and does not exist on the owner's Mac, where Playwright's own
bundled Chromium works. `tools/cap-playtest.mjs` is a short worked example: it drives
solo from the tier picker, follows whatever "next" button each screen offers
rather than hardcoding the sequence, and reads button state from the DOM.
Energy is the gold number with the lightning bolt on the shipyard screen (`[data-energy-bank]`) — the `+16` beside
each flagship is **not** Energy, both sides show it, and misreading it cost this
session two runs.
Check 390×844, 390×620 and 360×780 — the dock clips horizontal overflow, so a
too-wide row disappears silently rather than scrolling.

**A strategy simulation needs a real opponent as a control.** A hand-written
"opposing strategy" will be worse than it looks and will hand you a confident
wrong answer. See `sim/swarm-vs-capital.mjs`, which measures 90% for one side
and carries a warning pointing at `sim/swarm-vs-ai.mjs`, where the same strategy
loses. Either file alone misleads.

**One bag of dice, not two.** Every coin flip that decides how a match goes —
including the ones inside `lib/ai.ts` that make the weaker tiers take a worse
line on purpose — comes from the engine's seeded RNG via `random()`. Never call
`Math.random()` in `lib/engine.ts` or `lib/ai.ts`; `tests/rng.test.mjs` fails if
you do, and also replays a whole match on each tier to prove the seed still
holds. (Audio, `lib/three/` and room codes are exempt — they do not touch
rules. So is `engine.ts:353`, the one `Math.random` that *is* the default bag
when nothing has called `setRng`.) This is what makes a paired A/B possible:
run the same matches under two values of a `TUNING` number and the luck
cancels, so a three-point effect is visible where independent runs would bury
it in ±3.5 points of noise.

## Settled with numbers — do not re-litigate without new measurements

- **`energyWeight` per tier is the difficulty ladder.** Low 1.45 (the old value,
  so a beginner's game is unchanged), Medium 2.4, Hard 3.4, Expert 4.2. It is
  what `nearFormation` prices a row with — `lineAcrossEnergy x weight` against a
  column's flat `lineDownAttack` — so below 2 the brain chases columns and only
  columns. Worth 74.3% against the old brain, and it widened every rung:
  Medium/Low 72.0%, Hard/Medium 63.4%, Expert/Hard 58.4%. The curve peaks near
  four and falls away by fifteen. BALANCE.md's old guess that it should be
  *lower* is measured wrong.
- **A standing Energy income is the lever that padding was not.** `startBaseEnergy`
  adds to `baseEnergy`, so it pays every round instead of once, and the reroll
  cap does not touch it — which is exactly why `startEnergyBonus` is worth
  nothing now and this is worth a great deal. Against Hard, 900 matches a
  condition on paired seeds: +0 is 59.6%, +1 is 71.8%, +2 is 81.1%, +3 is 87.9%.
  Expert on +2 beats the old Expert 77.0%. Shipped as Hard +1 and Expert +2,
  because Expert +2 alone made an 82.5% cliff over an untouched Hard; the ladder
  now reads Medium/Low 72.2%, Hard/Medium 76.8%, Expert/Hard 68.8%. Both tiers
  say it in their `blurb` — `applyDifficultyStart`'s rule is "honest and
  visible", and income the player cannot see reads as the game cheating.

- **Making the brain save up for a bay is worth nothing.** Six paired runs, all
  ~50%. It buys more bays and ends with more ships and wins no more often. The
  brain was never undervaluing bays — instrumented, it reaches the shipyard with
  4.4 Energy and simply cannot afford one. Do not rebuild `patience`.

- **Direct is unblockable, and that is what gives Repair a job.** Shields answer
  Attack, ship blocking answers what gets past Shields, Repair answers Direct —
  and nothing else does. Letting hulls block Direct measured *safe* (a commander
  blocking with everything every round still loses, 5.0% vs 6.8%, because a
  blocked hull stops dealing damage) and was declined anyway, because it leaves
  Repair with nothing of its own. `settlePlayer` is `before - damage + repair`
  in one step, so repair can save a flagship the damage alone would destroy,
  and `inescapableDeath` counts it too. `tests/repair.test.mjs` fails if either
  moves.

- **Versus never holds a commander up except at the volley.** Freezing one side
  and racing the other reaches `block -> report -> shop -> roll -> locked in`
  in 796 of 796 situations, a full round ahead — the theoretical maximum, since
  round 3 cannot precede round 2's volley. Confirmed through the real network
  and UI by `sim/versus-flow-emulator.mjs` (6/6). Guarded by
  `tests/versus-flow.test.mjs`, which fails if any control is disabled on the
  other commander's phase; `waitingOnEnemy` may only mean "you locked in and
  they have not".

- **Paid rerolls are capped at three a round** (`paidRollsPerRound`), each still
  1 Energy per die. The old rule never got dearer, so a bank bought rounds: an
  Expert handed +60⚡ went from an even match to 57.2%. Capping the count fixes
  it (47.1% ±3.5 at +60⚡) and leaves the ordinary game exactly where it was
  (50.0%, same 5.1⚡ a match). Raising the *price* instead measured worse — a
  flat price makes the wide reroll cheaper, which is the reroll being abused.
  Two is no better than three and costs a choice.
- **A blocking ship absorbs damage equal to its die size** (`blocked +=
  ship.sides`), so a d10 blocks 10 and a d4 blocks 4. Direct damage is added
  *after* blocking and cannot be blocked at all.

- **Expert reads the other fleet and carries +10 starting health.** The read
  alone did not carry the tier: 47.8% ±4.0 against Hard through Energy and
  blocking, then 47.6% ±3.7 with shipyard buys priced in too. Both coin flips.
  The read stays because it makes Expert *play* differently — racing when ahead,
  digging in when behind — and the health is what makes the rung mean something.
  Ladder at 700 matches a pairing: Medium over Low 59.9%, Hard over Medium
  52.7%, Expert over Hard 54.9% ±3.7.
- **`samples` is a dead knob.** 120 versus 40 is 51.4% ±3.3 — thinking harder
  buys nothing. Hard and Expert burn three times the CPU per decision for it.
- **The all-d4 swarm is strong and fair.** ~11 lines a match against Expert's
  2.5, and it still loses 72.7%. Lines are a bonus, not a win condition.
- **Repair resolves in the same step as damage** (`before - damage + repair`),
  so it can save a flagship that damage alone would destroy, and healing past
  the maximum raises it. Zero is dead.
- **The block screen is skipped for a reason** when shields ate the whole attack
  and only Direct is left — about one damaging round in six. The report says so.

## Open, unmeasured

- **The d10 is fairly priced; the tier pattern is a spending pattern.** No AI
  has ever bought a d10 fresh (0 in 960 commanders), so `prices[10]` only bites
  as the d8 step, `13 - 9 = 4`. Taking that step wins 52–54% on all four tiers,
  and for a person a cell + d10 beats a cell + d4 + the change 56.0% ±3.4. Weak
  tiers hold d10s because they spend 30.6⚡ on the upgrade ladder against
  Expert's 16.7 and less on cells — the d10 is where a surplus spent climbing
  ends up. Changing `prices[10]` moves the shop price and the step together.
- **Straights barely happen** — 1.76 per match at Expert level, needing five
  consecutive numbers from a ~5-dice fleet, for a prominent chunk of How to Play.
