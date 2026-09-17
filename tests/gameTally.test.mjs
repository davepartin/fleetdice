import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tally = readFileSync(new URL("../lib/gameTally.ts", import.meta.url), "utf8");
const rooms = readFileSync(new URL("../lib/rooms.ts", import.meta.url), "utf8");
const solo = readFileSync(new URL("../lib/useMatch.ts", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/HomeScreen.tsx", import.meta.url), "utf8");
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

test("finished games bump a public solo/versus tally, never from localhost", () => {
  assert.match(tally, /"fleetdice\.com"/);
  assert.doesNotMatch(tally, /ministrybag/);
  assert.match(tally, /NEXT_PUBLIC_FIREBASE_EMULATOR/);
  assert.match(tally, /recordSoloFinish/);
  assert.match(tally, /bumpTallyInTransaction/);
  assert.match(solo, /recordSoloFinish\(match\.id\)/);
  assert.match(rooms, /bumpTallyInTransaction\(transaction, "versus"\)/);
  assert.match(home, /watchGameTally/);
  assert.match(home, /solo · .* vs/);
  assert.match(rules, /docId == "tally"/);
  assert.match(rules, /request\.resource\.data\.solo \+ request\.resource\.data\.versus == 1/);
});
