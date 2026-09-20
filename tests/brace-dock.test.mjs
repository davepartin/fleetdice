/**
 * The block screen's math row is HP arithmetic, not a second combat formula.
 *
 * Guards the presentation Dave asked for: Now uses the same HP orange as the
 * top rail, Blocked sits in the sum just before the equals, and "blockable"
 * is a word you can actually read. The settle itself stays in the engine.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const screen = readFileSync(new URL("../components/MatchScreen.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function braceDockSource() {
  const start = screen.indexOf("function BraceDock");
  assert.ok(start > 0, "BraceDock is gone");
  return screen.slice(start);
}

test("NOW uses the same HP orange as the top battle numbers", () => {
  const dock = braceDockSource();
  assert.match(dock, /label="Now"[\s\S]*tone="hp"/);
  assert.match(screen, /tone === "hp" \? "c-hp-glow"/);
  assert.match(css, /\.c-hp-glow \{ color: var\(--color-hp-glow\); \}/);
});

test("Blocked sits in the equation immediately before the equals", () => {
  const dock = braceDockSource();
  const blocked = dock.indexOf('label="Blocked"');
  const after = dock.indexOf('label="After"');
  const equals = dock.lastIndexOf("<EquationOp>=</EquationOp>");
  assert.ok(blocked > 0 && after > blocked, "Blocked must appear before HP after");
  assert.ok(equals > 0 && equals < after && equals > blocked, "the equals sits between Blocked and HP after");
  assert.match(dock, /Your HP after blocking/);
});

test("the displayed sum is the engine settle, not a new formula", () => {
  const dock = braceDockSource();
  assert.match(dock, /damageAfterBlocking\(/);
  assert.match(dock, /incomingHit = you\.incoming \+ you\.directIncoming/);
  assert.match(dock, /shipsStopped = Math\.min\(blocked, you\.incoming\)/);
  assert.match(dock, /after = you\.hp - landing \+ heal/);
});

test("blockable is white, not muted", () => {
  const dock = braceDockSource();
  assert.match(dock, /brace-blockable-label text-base text-white/);
  assert.doesNotMatch(dock, /c-dim text-base"> blockable/);
  assert.match(css, /\.brace-blockable-label/);
});
