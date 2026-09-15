"use client";

/**
 * After the volley: the same five total boxes from the roll screen, yours
 * then theirs. The comparison bars and flagship arithmetic live behind
 * More details — the board stays visible until someone asks.
 */

import { newWeapons, type PlayerState, type RoundReport as Report, type Tally } from "@/lib/engine";
import { Button, Notice, TallyStrip } from "./ui";
import { StatRow } from "./BattleRecap";
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

        <div className="volley-stats">
          <div className="recap-stats-head">
            <div className="round-report-who volley-who">
              <span className="t-eyebrow">You</span>
              <HpChange before={report.hpBefore} after={report.hpAfter} />
            </div>
            <div className="round-report-who volley-who">
              <span className="t-eyebrow">{enemyName}</span>
              <HpChange before={theirBefore} after={theirAfter} />
            </div>
          </div>
          <StatRow label="Attack" you={yours.attack} them={theirs?.attack ?? 0} color="attack" />
          <StatRow label="Shields" you={yours.defense} them={theirs?.defense ?? 0} color="shield" />
          <StatRow label="Direct" you={yours.direct} them={theirs?.direct ?? 0} color="direct" />
          <StatRow label="Repair" you={yours.heal} them={theirs?.heal ?? 0} color="repair" />
          <StatRow label="Energy" you={yours.energy} them={theirs?.energy ?? 0} color="energy" />
        </div>

        <div className="volley-landed">
          <p className="t-eyebrow">On your flagship</p>
          <p className="battle-line flex flex-wrap items-center gap-1">
            <HpBox value={report.hpBefore} />
            <span className="c-dim">−</span>
            <Box kind="attack" value={theirs?.attack ?? 0} />
            {superShieldStopped > 0 && (
              <>
                <span className="c-dim">+</span>
                <span title="Super Shield">
                  <Box kind="shield" value={superShieldStopped} /> <small className="c-shield">Super</small>
                </span>
              </>
            )}
            {shieldsStopped > 0 && (
              <>
                <span className="c-dim">+</span>
                <Box kind="shield" value={shieldsStopped} />
              </>
            )}
            {report.blocked > 0 && (
              <>
                <span className="c-dim">+</span>
                <ShipBlockBox value={report.blocked} />
              </>
            )}
            {report.escalation > 0 && (
              <>
                <span className="c-dim">−</span>
                <Box kind="attack" value={report.escalation} />
              </>
            )}
            {report.direct > 0 && (
              <>
                <span className="c-dim">−</span>
                <Box kind="direct" value={report.direct} />
              </>
            )}
            {report.repair > 0 && (
              <>
                <span className="c-dim">+</span>
                <Box kind="repair" value={report.repair} />
              </>
            )}
            <span className="c-dim">=</span>
            <HpBox value={Math.max(0, report.hpAfter)} big />
          </p>
          {nothingToBlock && (
            <p className="report-noblock">
              No blocking — your{" "}
              <b className="c-shield">{superShieldStopped > 0 ? "Super Shield and Shields" : `Shields ${report.tally.defense}`}</b>{" "}
              stopped their <b className="c-attack">Attack {theirs?.attack ?? 0}</b>.
            </p>
          )}
          {report.weapon && <p className="round-report-used">{`You used ${weaponUseText(report.weapon)}`}</p>}
          {report.enemyWeapon && (
            <p className="round-report-used">{`${enemyName} used ${weaponUseText(report.enemyWeapon)}`}</p>
          )}
        </div>

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
