"use client";

/**
 * After the volley: the same five total boxes from the roll screen, yours
 * then theirs. The comparison bars and flagship arithmetic live behind
 * More details — the board stays visible until someone asks.
 */

import {
  newWeapons,
  type PlayerState,
  type RoundReport as Report,
  type Tally,
  type WeaponUse,
} from "@/lib/engine";
import { Button, Notice, TallyStrip } from "./ui";
import { EnemyWeaponRow, weaponUseText } from "./FlagshipWeapons";

export type BoxKind = "attack" | "shield" | "direct" | "repair";

const BOX_TONE: Record<BoxKind, string> = {
  attack: "border-[--color-attack]/40 bg-[--color-attack]/[0.16] c-attack",
  shield: "border-[--color-shield]/40 bg-[--color-shield]/[0.16] c-shield",
  direct: "border-[--color-direct]/40 bg-[--color-direct]/[0.16] c-direct",
  repair: "border-[--color-repair]/40 bg-[--color-repair]/[0.16] c-repair",
};

export function Box({ kind, value, big }: { kind: BoxKind; value: number; big?: boolean }) {
  return (
    <span
      className={`t-num inline-flex items-center rounded-md border font-bold leading-none ${BOX_TONE[kind]} ${
        big ? "px-1.5 py-1 text-base" : "px-1 py-0.5 text-sm"
      }`}
    >
      {value}
    </span>
  );
}

export function HpBox({ value, big }: { value: number; big?: boolean }) {
  return (
    <span
      className={`t-num inline-flex items-center rounded-md border border-[--color-hp]/45 bg-[--color-hp]/[0.16] c-hp font-bold leading-none ${
        big ? "px-1.5 py-1 text-base" : "px-1 py-0.5 text-sm"
      }`}
    >
      {value}
    </span>
  );
}

function ShipBlockBox({ value, big }: { value: number; big?: boolean }) {
  const size = big ? "1.9em" : "1.6em";
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path
          d="M32 8 L57 52 L7 52 Z"
          fill="rgba(255,255,255,0.12)"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`t-num relative translate-y-[0.12em] font-bold leading-none text-white ${big ? "text-sm" : "text-xs"}`}>
        {value}
      </span>
    </span>
  );
}

function HpChange({ before, after }: { before: number; after: number }) {
  return (
    <span className="volley-hp">
      <span className="volley-hp-before t-num">{Math.max(0, before)}</span>
      <span className="volley-hp-arrow" aria-hidden="true">
        →
      </span>
      <span className="volley-hp-after t-num c-hp-glow">{Math.max(0, after)}</span>
    </span>
  );
}

function TallyLane({
  label,
  tally,
  hpBefore,
  hpAfter,
}: {
  label: string;
  tally: Tally | null;
  hpBefore: number;
  hpAfter: number;
}) {
  return (
    <div className="round-report-lane">
      <div className="round-report-lane-head">
        <p className="t-eyebrow">{label}</p>
        <HpChange before={hpBefore} after={hpAfter} />
      </div>
      <TallyStrip tally={tally} />
    </div>
  );
}



/**
 * What a weapon did, in a few words.
 *
 * Deliberately *not* a term in the sum: the Attack weapon is already inside the
 * Attack row and Repair inside Repair, so adding it again would make the column
 * lie. It names which row moved, and by how much.
 */
function weaponNote(use: WeaponUse | null | undefined): string | null {
  if (!use) return null;
  if (use.id === "rotate") return `Rotate ${use.from ?? "?"} \u2192 ${use.to ?? "?"}`;
  if (use.id === "shield") return `Super Shield \u00d7\u00bd`;
  if (use.id === "attack") return `Attack +${use.amount}`;
  return `Repair +${use.amount}`;
}

/**
 * One round's arithmetic, read down the column.
 *
 * The old details view put two numbers on a slider and left the player to work
 * out how 47 became 46. This shows the sum itself: what you started with, every
 * term that moved it, and what you ended with — and it closes exactly, because
 * every term is what the engine *used*, not what was rolled. Shields that
 * exceeded the attack stopped only the attack; blocking that exceeded what got
 * through stopped only that. `settlePlayer` is the authority:
 *
 *   incoming = max(0, attack - superShield - shields) + escalation
 *   damage   = max(0, incoming - blocked) + direct
 *   after    = before - damage + repair
 *
 * Rearranged, that is exactly the column below, which is why it adds up.
 */
type LedgerTone = "hp" | "attack" | "shield" | "direct" | "repair" | "block" | "escalation";

type LedgerRow = {
  key: string;
  label: string;
  tone: LedgerTone;
  /** "-" takes health away, "+" gives it back. */
  sign: "+" | "-";
  /** Your value and theirs; null where that side has nothing to show yet. */
  you: number | null;
  them: number | null;
  /** True where the number came off your own dice, in that column. */
  youIsYours: boolean;
  themIsYours: boolean;
};

export type LedgerSide = {
  hpBefore: number;
  hpAfter: number;
  attack: number;
  superShield: number;
  shields: number;
  escalation: number;
  direct: number;
  repair: number;
  blocked: number;
};

/** What a settle actually used, pulled out of one player's report. */
export function ledgerSide(report: Report | null | undefined, attackAgainst: number): LedgerSide | null {
  if (!report) return null;
  const superShield = report.superShieldStopped ?? 0;
  // What the shields stopped, never more than the attack that arrived.
  const shields = Math.max(0, attackAgainst - superShield + report.escalation - report.incoming);
  return {
    hpBefore: report.hpBefore,
    hpAfter: report.hpAfter,
    attack: attackAgainst,
    superShield,
    shields,
    escalation: report.escalation,
    direct: report.direct,
    repair: report.repair,
    blocked: report.blocked,
  };
}

function LedgerCell({
  value,
  tone,
  sign,
  mine,
}: {
  value: number | null;
  tone: LedgerTone;
  sign: "+" | "-";
  mine: boolean;
}) {
  if (value === null) return <span className="volley-ledger-cell volley-ledger-empty">·</span>;
  // Nothing happened on this side: a plain 0, with no sign and no box. A "−0"
  // reads as a term that moved health, and a box around it claims dice did
  // something they did not.
  if (value === 0) {
    return (
      <span className="volley-ledger-cell volley-ledger-zero">
        <span className="t-num">0</span>
      </span>
    );
  }
  return (
    <span className={`volley-ledger-cell volley-ledger-${tone} ${mine ? "volley-ledger-mine" : ""}`}>
      <span className="t-num">
        {sign === "-" ? "\u2212" : "+"}
        {value}
      </span>
    </span>
  );
}

function VolleyLedger({
  you,
  them,
  enemyName,
  yourWeapon,
  enemyWeapon,
}: {
  you: LedgerSide;
  them: LedgerSide | null;
  enemyName: string;
  yourWeapon?: WeaponUse | null;
  enemyWeapon?: WeaponUse | null;
}) {
  const yourNote = weaponNote(yourWeapon);
  const enemyNote = weaponNote(enemyWeapon);
  // Your dice make your Shields, Repair and blocking, and their Attack and
  // Direct — so the boxed cells sit in both columns. That is the point of the
  // box: it follows your dice across, whichever side of the sum they land on.
  const rows: LedgerRow[] = [
    {
      key: "attack",
      label: "Attack",
      tone: "attack",
      sign: "-",
      you: you.attack,
      them: them?.attack ?? null,
      youIsYours: false,
      themIsYours: true,
    },
    {
      key: "super",
      label: "Super Shield",
      tone: "shield",
      sign: "+",
      you: you.superShield,
      them: them?.superShield ?? null,
      youIsYours: true,
      themIsYours: false,
    },
    {
      key: "shields",
      label: "Shields",
      tone: "shield",
      sign: "+",
      you: you.shields,
      them: them?.shields ?? null,
      youIsYours: true,
      themIsYours: false,
    },
    {
      key: "escalation",
      label: "Escalation",
      tone: "escalation",
      sign: "-",
      you: you.escalation,
      them: them?.escalation ?? null,
      youIsYours: false,
      themIsYours: false,
    },
    {
      key: "direct",
      label: "Direct",
      tone: "direct",
      sign: "-",
      you: you.direct,
      them: them?.direct ?? null,
      youIsYours: false,
      themIsYours: true,
    },
    {
      key: "repair",
      label: "Repair",
      tone: "repair",
      sign: "+",
      you: you.repair,
      them: them?.repair ?? null,
      youIsYours: true,
      themIsYours: false,
    },
    {
      key: "blocked",
      label: "Blocking",
      tone: "block",
      sign: "+",
      you: you.blocked,
      them: them?.blocked ?? null,
      youIsYours: true,
      themIsYours: false,
    },
  ];
  // A row of two zeroes says nothing; a row where either side moved stays.
  const shown = rows.filter((row) => (row.you ?? 0) !== 0 || (row.them ?? 0) !== 0);

  return (
    <div className="volley-ledger">
      <div className="volley-ledger-row volley-ledger-head">
        <span className="t-eyebrow">You</span>
        <span className="t-eyebrow volley-ledger-label">Round</span>
        <span className="t-eyebrow">{enemyName}</span>
      </div>

      <div className="volley-ledger-row volley-ledger-start">
        <span className="volley-ledger-cell volley-ledger-hp">
          <span className="t-num">{Math.max(0, you.hpBefore)}</span>
        </span>
        <span className="volley-ledger-label">Started with</span>
        <span className="volley-ledger-cell volley-ledger-hp">
          <span className="t-num">{them ? Math.max(0, them.hpBefore) : "\u00b7"}</span>
        </span>
      </div>

      {(yourNote || enemyNote) && (
        <div className="volley-ledger-row volley-ledger-weapon">
          <span className="volley-ledger-note">{yourNote ?? "\u00b7"}</span>
          <span className="volley-ledger-label">Weapon</span>
          <span className="volley-ledger-note">{enemyNote ?? "\u00b7"}</span>
        </div>
      )}

      {shown.map((row) => (
        <div key={row.key} className="volley-ledger-row">
          <LedgerCell value={row.you} tone={row.tone} sign={row.sign} mine={row.youIsYours} />
          <span className="volley-ledger-label">{row.label}</span>
          <LedgerCell value={row.them} tone={row.tone} sign={row.sign} mine={row.themIsYours} />
        </div>
      ))}

      <div className="volley-ledger-row volley-ledger-total">
        <span className="volley-ledger-cell volley-ledger-hp volley-ledger-hp-final">
          <span className="t-num">{Math.max(0, you.hpAfter)}</span>
        </span>
        <span className="volley-ledger-label">Left with</span>
        <span className="volley-ledger-cell volley-ledger-hp volley-ledger-hp-final">
          <span className="t-num">{them ? Math.max(0, them.hpAfter) : "\u00b7"}</span>
        </span>
      </div>

      <p className="volley-ledger-key">
        A box marks what your own dice did.
        {(yourNote || enemyNote) && " A weapon shows where it changed the sum, and is already counted in that row."}
      </p>
    </div>
  );
}

export function RoundReportCard({
  report,
  them,
  enemyName,
  waitingForOpponent = false,
  details = false,
  onShowDetails,
  onHideDetails,
  onContinue,
  busy,
}: {
  report: Report;
  them?: PlayerState | null;
  enemyName: string;
  waitingForOpponent?: boolean;
  details?: boolean;
  onShowDetails?(): void;
  onHideDetails?(): void;
  onContinue(): void;
  busy?: boolean;
}) {
  const yours = report.tally;
  const theirs: Tally | null = report.enemyTally;
  const survived = report.hpAfter > 0;
  const superShieldStopped = report.superShieldStopped ?? 0;
  const shieldsStopped = Math.max(
    0,
    (theirs?.attack ?? 0) - superShieldStopped + report.escalation - report.incoming,
  );
  const nothingToBlock = report.incoming === 0 && (theirs?.attack ?? 0) > 0;
  const theirAfter = Math.max(0, them?.report?.hpAfter ?? them?.hp ?? 0);
  const theirBefore = them?.report?.hpBefore ?? theirAfter;

  // Your column comes from your own report; theirs from theirs, which exists
  // as soon as they have blocked. Until then that column shows only its start.
  const yourSide = ledgerSide(report, theirs?.attack ?? 0)!;
  const theirSide = ledgerSide(them?.report ?? null, yours.attack);

  const continueLabel = !survived ? "See the result" : "To the shipyard";

  if (!details) {
    return (
      <div className="round-report round-report-summary">
        <div className="round-report-top">
          <header className="round-report-summary-head">
            <p className="t-eyebrow">Round {report.round}</p>
            <button type="button" className="round-report-more" onClick={onShowDetails}>
              More details
            </button>
          </header>
          <TallyLane label="You" tally={yours} hpBefore={report.hpBefore} hpAfter={report.hpAfter} />
          <TallyLane label={enemyName} tally={theirs} hpBefore={theirBefore} hpAfter={theirAfter} />
          {report.weapon && <p className="round-report-used">{`You used ${weaponUseText(report.weapon)}`}</p>}
          {report.enemyWeapon && (
            <p className="round-report-used">{`${enemyName} used ${weaponUseText(report.enemyWeapon)}`}</p>
          )}
          {!survived && <Notice tone="warn">Your flagship is gone.</Notice>}
          {waitingForOpponent && survived && (
            <p className="round-report-wait" role="status">
              {enemyName} is still choosing which ships block. Carry on — the next volley waits for
              you both.
            </p>
          )}
        </div>
        <div className="round-report-actions">
          <Button tone="primary" size="lg" full onClick={onContinue} disabled={busy}>
            {continueLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="round-report volley-report-card">
      <div className="round-report-top">
        <header className="volley-head">
          <div>
            <p className="t-eyebrow">Round {report.round}</p>
            <h2 className="t-display volley-title">Volley</h2>
          </div>
          <div className="volley-earned" aria-label={`+${report.energyEarned} Energy`}>
            <svg className="volley-earned-bolt" viewBox="0 0 16 20" aria-hidden="true">
              <path d="M9.1 0 1.8 11.1h4.7L5.6 20l8.6-12.3H9.4L9.1 0Z" fill="currentColor" />
            </svg>
            <span className="t-num c-energy volley-banked">+{report.energyEarned}</span>
          </div>
        </header>

        {/* The round as one sum, read downwards. The sliders that used to sit
            here compared two numbers but never showed how 47 became 46; the
            end-of-match recap still has them, where totalling the whole game
            is the job. */}
        <VolleyLedger
          you={yourSide}
          them={theirSide}
          enemyName={enemyName}
          yourWeapon={report.weapon}
          enemyWeapon={report.enemyWeapon}
        />

        <p className="volley-ledger-energy">
          <span className="t-eyebrow">Energy this round</span>
          <span className="t-num c-energy">You +{yours.energy}</span>
          <span className="t-num c-energy">
            {enemyName} +{theirs?.energy ?? 0}
          </span>
        </p>

        {nothingToBlock && (
          <p className="report-noblock">
            No blocking — your{" "}
            <b className="c-shield">
              {superShieldStopped > 0 ? "Super Shield and Shields" : `Shields ${report.tally.defense}`}
            </b>{" "}
            stopped their <b className="c-attack">Attack {theirs?.attack ?? 0}</b>.
          </p>
        )}
        {report.weapon && <p className="round-report-used">{`You used ${weaponUseText(report.weapon)}`}</p>}
        {report.enemyWeapon && (
          <p className="round-report-used">{`${enemyName} used ${weaponUseText(report.enemyWeapon)}`}</p>
        )}

        <div className="volley-weapons">
          <EnemyWeaponRow stock={report.weapons ?? newWeapons()} name="You" />
          <EnemyWeaponRow stock={report.enemyWeapons ?? newWeapons()} name={enemyName} />
        </div>

        {!survived && <Notice tone="warn">Your flagship is gone.</Notice>}

        {waitingForOpponent && survived && (
          <p className="round-report-wait" role="status">
            {enemyName} is still choosing which ships block. Carry on — the next volley waits for
            you both.
          </p>
        )}
      </div>

      <div className="round-report-actions">
        <Button tone="ghost" size="md" full onClick={onHideDetails}>
          Back
        </Button>
        <Button tone="primary" size="lg" full onClick={onContinue} disabled={busy}>
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
