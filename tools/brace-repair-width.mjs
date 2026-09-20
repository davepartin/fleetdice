/**
 * Does the five-term brace equation actually fit, or does the dock's
 * `overflow: hidden` silently eat it?
 *
 * With repair at zero the equation is four terms — HP now − Damage + Blocked
 * = HP after — and fits at any width. The fifth term only appears when this
 * volley's tally rolled repair: HP now − Damage + Repair + Blocked = HP after.
 * That is the row that has to be measured, not eyeballed from a screenshot —
 * `.brace-dock-body` clips horizontal overflow, so a row a few pixels too
 * wide does not wrap or scroll, it just vanishes past the edge.
 *
 * Forces repair > 0 by injecting a solo save straight into the brace phase
 * with a non-zero `tally.heal`, the same fixture shape `tests/repair.test.mjs`
 * uses, then reads `scrollWidth` vs `clientWidth` on the real rendered
 * `.brace-equation` at the three phone shapes that motivated the mobile rule.
 *
 *   node brace-repair-width.mjs        (needs pnpm dev on :3000)
 */
import { chromium } from "playwright";
import { bundlePath } from "../sim/bundle.mjs";

const G = await import(bundlePath);
const { newMatch, newPlayer, newBrain } = G;

const BASE = process.env.BASE || "http://localhost:3000";
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "390x620", width: 390, height: 620 },
  { name: "360x780", width: 360, height: 780 },
];

/**
 * A commander mid-Block-screen with Now − Damage + Repair = After all live.
 *
 * `digits` controls the magnitude of every term, so the same fixture can
 * probe from small, realistic numbers (TUNING.hp starts at 60; even a long
 * match's repair/escalation growth stays two or three digits) up through
 * values no real match reaches, to find where the row actually breaks
 * rather than stopping at the first size that happened not to overflow.
 */
function fixture(digits = 3) {
  const s = newMatch("brace-repair-fixture", "0000", "you", "You", "solo");
  s.players.guest = newPlayer("enemy", "Enemy", "ready");
  s.status = "active";
  const p = s.players.host;
  p.phase = "brace";
  const unit = 10 ** (digits - 1);
  p.hp = 8 * unit;
  p.incoming = 6 * unit;
  p.directIncoming = 1 * unit;
  p.braceShips = [];
  const heal = 5 * unit;
  p.tally = {
    attack: 0, defense: 0, energy: 0, direct: 0, heal,
    lines: [], run: null, face: 1,
    flagBonus: { attack: 0, defense: 0, energy: 0, heal: 0, direct: 0 },
  };
  return s;
}

// The realistic case (2-3 digits, TUNING.hp = 60) plus a sweep past it, to
// find where the row actually breaks rather than stopping at the first size
// that happened not to overflow.
const DIGIT_CASES = [2, 3, 4, 5, 6];

const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});
const errors = [];
let failed = false;
const rows = [];
try {
  for (const vp of VIEWPORTS) {
    for (const digits of DIGIT_CASES) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      page.on("console", (m) => { if (m.type() === "error") errors.push(`[${vp.name} d${digits}] ${m.text()}`); });
      page.on("pageerror", (e) => errors.push(`[${vp.name} d${digits}] ${String(e)}`));

      await page.addInitScript((save) => {
        localStorage.setItem("fd3.solo.battle.v1", JSON.stringify(save));
      }, { schema: 1, savedAt: Date.now(), state: fixture(digits), brain: newBrain("balanced", "low") });

      await page.goto(`${BASE}/solo/?q=low`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Carry on/ }).click();
      await page.locator(".brace-equation").waitFor({ state: "visible", timeout: 8000 });

      const measured = await page.evaluate(() => {
        // .brace-summary is the flex-nowrap row that actually clips: it holds
        // both the Blocked box and .brace-equation side by side, and it is the
        // one the CSS comments describe as sized "to keep five terms on one"
        // line. .brace-equation alone can have spare room while its parent
        // still cuts it off — measure the parent, not just the child.
        const summary = document.querySelector(".brace-summary");
        const eq = document.querySelector(".brace-equation");
        const dock = document.querySelector(".brace-dock-body");
        const text = summary ? summary.textContent.replace(/\s+/g, " ").trim() : null;
        return {
          summaryScrollWidth: summary ? summary.scrollWidth : null,
          summaryClientWidth: summary ? summary.clientWidth : null,
          eqScrollWidth: eq ? eq.scrollWidth : null,
          eqClientWidth: eq ? eq.clientWidth : null,
          dockScrollWidth: dock ? dock.scrollWidth : null,
          dockClientWidth: dock ? dock.clientWidth : null,
          text,
        };
      });

      const summaryOverflow = measured.summaryScrollWidth !== null && measured.summaryScrollWidth > measured.summaryClientWidth + 1;
      const eqOverflow = measured.eqScrollWidth !== null && measured.eqScrollWidth > measured.eqClientWidth + 1;
      const dockOverflow = measured.dockScrollWidth !== null && measured.dockScrollWidth > measured.dockClientWidth + 1;
      const overflow = summaryOverflow || eqOverflow || dockOverflow;
      // Now − Damage + Repair + Blocked = After: five numeric terms and a
      // non-zero Repair term is what the mobile rule exists for. Confirm the
      // fixture actually produced that row rather than the plain four-term one.
      const hasFiveTerms =
        /HP now.*Damage.*Repair.*Blocked.*HP after/i.test(measured.text ?? "") &&
        /Repair/.test(measured.text ?? "");

      rows.push({ vp: vp.name, digits, text: measured.text, overflow, hasFiveTerms,
        summary: `${measured.summaryScrollWidth}/${measured.summaryClientWidth}`,
        eq: `${measured.eqScrollWidth}/${measured.eqClientWidth}`,
        dock: `${measured.dockScrollWidth}/${measured.dockClientWidth}` });

      if (!hasFiveTerms) failed = true;
      await ctx.close();
    }
  }

  console.log(`\n${"viewport".padEnd(10)}${"digits".padEnd(8)}${"summary scroll/client".padEnd(24)}${"eq scroll/client".padEnd(20)}${"dock scroll/client".padEnd(20)}overflow`);
  for (const r of rows) {
    console.log(`${r.vp.padEnd(10)}${String(r.digits).padEnd(8)}${r.summary.padEnd(24)}${r.eq.padEnd(20)}${r.dock.padEnd(20)}${r.overflow ? "YES" : "no"}`);
    if (!r.hasFiveTerms) console.log(`  ^ FAIL — fixture did not render the five-term equation: "${r.text}"`);
  }

  console.log(`\n  console errors: ${errors.length}`);
  for (const e of errors.slice(0, 4)) console.log(`    ${e.slice(0, 150)}`);
  if (errors.length) failed = true;
} finally {
  await browser.close();
}
console.log(`\n  ${failed ? "FAIL (fixture problem, not necessarily a layout bug — see rows above)" : "measurement complete"}\n`);
process.exit(failed ? 1 : 0);
