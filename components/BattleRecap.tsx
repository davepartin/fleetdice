"use client";

/**
 * The battle recap.
 *
 * The screen a match ends on: both fleets, board for board, and the totals
 * from the whole game laid out side by side. Players talk about the games
 * they played — this is the screen worth a screenshot when they do.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { DieValue, PlayerState } from "@/lib/engine";
import { shipInSlot, slotForCell, weaponsOf } from "@/lib/engine";
import { WeaponStatusList } from "./FlagshipWeapons";
import { ledgerSide, VolleyLedger } from "./RoundReport";
import { NOUN } from "@/lib/reference";
import { HelpFlagFace, HelpHullPlate, HelpShipFace } from "./HelpArt";
import { href } from "@/lib/paths";
import { Button, Ticker } from "./ui";

/** Pixels still below the fold before the "more" caret hides. */
const MORE_BELOW_PX = 16;

const CELLS = Array.from({ length: 9 }, (_, cell) => cell);

/**
 * Both fleets going up. One still of two cube flagships detonating, with
 * the dice flying off as shrapnel — a phone-width banner, not two copies
 * of the defeat painting. Ordinary wins still use the victory painting.
 */
function MutualArt() {
  return (
    <div className="recap-mutual-art" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={href("/art/fleet-dice-mutual.jpg")}
        alt=""
        width={1280}
        height={720}
        decoding="async"
      />
    </div>
  );
}

/** The 3×3 fleet, exactly as the shipyard draws it, at the size a screenshot needs. */
/**
 * The board as it stood at the end, with the last roll still on it.
 *
 * The dice a match ends on are the most interesting dice in it, and they were
 * being thrown away: the recap drew empty hull silhouettes. `player.dice` still
 * holds the final roll here — nothing clears it until a new round is prepared,
 * and `publicMatchView` only hides an opponent's dice while a match is still
 * active — so the faces are drawn on their own hulls, in formation.
 *
 * If there are no dice (a room cancelled before anyone rolled), it falls back
 * to the silhouette rather than showing an empty board.
 */
/** Face art is a canvas, so it needs a pixel size rather than a percentage. */
const RECAP_FACE_PX = 40;

export function FleetBoard({
  player,
  dice,
  facePx = RECAP_FACE_PX,
}: {
  player: PlayerState;
  /** The roll to paint. Defaults to the player's live dice. */
  dice?: DieValue[];
  facePx?: number;
}) {
  const roll = dice ?? player.dice;
  const faces = new Map(roll.filter((die) => !die.flag).map((die) => [die.id, die.value]));
  const flagDie = roll.find((die) => die.flag);
  return (
    <div className="recap-board" role="group" aria-label="Final fleet">
      {CELLS.map((cell) => {
        if (cell === 4) {
          return (
            <div key={cell} className="recap-cell recap-cell-flag">
              {flagDie ? (
                <span className="recap-cell-face">
                  <HelpFlagFace face={flagDie.value} size={facePx} />
                </span>
              ) : (
                <span className="recap-cell-flag-star" aria-hidden="true">★</span>
              )}
              <span className="recap-cell-flag-level t-num">L{player.flag.level}</span>
            </div>
          );
        }
        const slot = slotForCell(cell)!;
        const ship = player.open[slot] ? shipInSlot(player, slot) : undefined;
        const face = ship ? faces.get(ship.id) : undefined;
        return (
          <div key={cell} className={`recap-cell ${ship ? "recap-cell-ship" : "recap-cell-empty"}`}>
            {ship && (
              <>
                {face === undefined ? (
                  // No die on the final roll means this hull was sitting the
                  // round out, so it gets the out-plate rather than a bare
                  // silhouette that leaves you wondering where its number went.
                  <span className="recap-cell-face">
                    <HelpHullPlate sides={ship.sides} size={facePx} />
                  </span>
                ) : (
                  <span className="recap-cell-face">
                    {/* The ship's own hull, not the smallest one showing this
                      * number: a 4 on a d10 is still a pentagon. */}
                    <HelpShipFace value={face} hull={ship.sides} size={facePx} />
                  </span>
                )}
                <span className="recap-cell-hull-label t-num">d{ship.sides}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FleetPanel({
  player,
  name,
  you,
}: {
  player: PlayerState;
  name: string;
  you: boolean;
}) {
  return (
    <div className={`panel ${you ? "panel-you" : "panel-enemy"} recap-fleet`}>
      <div className="recap-fleet-head">
        <p className="recap-fleet-name">{name}</p>
        <p className="recap-fleet-hp t-num">
          <Ticker value={Math.max(0, player.hp)} />
          <span className="recap-fleet-hp-unit"> HP</span>
        </p>
      </div>
      <FleetBoard player={player} />
    </div>
  );
}

/** One line of the totals: your number, a share bar, their number — the
 *  same colour carrying all three, so the row reads before it's parsed.
 *  The bar is two thin lines stacked, not one: yours grows from the left
 *  on top, theirs grows from the right underneath, both the row's colour —
 *  a single bar could only ever show one side actually scored anything.
 *  Each line ends in a bright dot at its growing tip, so a bar too thin to
 *  see still shows up as a dot — the only way "1" reads differently from
 *  "0" when the other side ran up a much bigger number. */
export function StatRow({
  label,
  you,
  them,
  color,
}: {
  label: string;
  you: number;
  them: number;
  color: string;
}) {
  const total = you + them;
  // Neither side scoring at all is a real, visible answer — an empty bar,
  // not a coin-flip 50/50 that would claim both sides did something.
  const yourShare = total > 0 ? (you / total) * 100 : 0;
  const theirShare = total > 0 ? (them / total) * 100 : 0;
  const tone = { color: `var(--color-${color})` };
  const fill = { background: `var(--color-${color})` };
  // The tip's glow reads its colour off `color` (for `currentColor` in its
  // box-shadow), not `background` — a plain background wouldn't tint it.
  const tip = { background: `var(--color-${color})`, color: `var(--color-${color})` };
  return (
    <div className="recap-row">
      <span className="recap-row-value recap-row-value-you t-num" style={tone}>
        <Ticker value={you} />
      </span>
      <div className="recap-row-mid">
        <span className="recap-row-label">{label}</span>
        <div className="recap-row-bar">
          <div className="recap-row-track">
            <span className="recap-row-bar-fill" style={{ width: `${yourShare}%`, ...fill }}>
              {you > 0 && <span className="recap-row-bar-tip" style={tip} />}
            </span>
          </div>
          <div className="recap-row-track recap-row-track-them">
            <span className="recap-row-bar-fill" style={{ width: `${theirShare}%`, ...fill }}>
              {them > 0 && <span className="recap-row-bar-tip" style={tip} />}
            </span>
          </div>
        </div>
      </div>
      <span className="recap-row-value recap-row-value-them t-num" style={tone}>
        <Ticker value={them} />
      </span>
    </div>
  );
}

/**
 * The volley that ended it. Same column as Round Review: started with,
 * every term that moved health, left with. A win or a loss is still
 * "what just happened" — the three share-bars used to hide Shields that
 * stopped the attack, blocking, Repair, and the weapon. A mutual kill puts
 * the two final numbers on top of that same sum, because those two numbers
 * are what decided it.
 */
function LastRound({
  you,
  them,
  enemyName,
}: {
  you: PlayerState;
  them: PlayerState;
  enemyName: string;
}) {
  const yourReport = you.report;
  const theirReport = them.report;
  if (!yourReport || !theirReport) return null;

  const yourAttack = yourReport.tally.attack;
  const theirAttack = theirReport.tally.attack;
  const yourSide = ledgerSide(yourReport, theirAttack);
  const theirSide = ledgerSide(theirReport, yourAttack);

  const bothFell = you.hp <= 0 && them.hp <= 0;
  // Both flagships are under zero here, and the engine keeps the true figure.
  // Least far below wins: it is the whole match in one number — every Attack
  // that got through, minus every Shield, blocking ship and point of Repair.
  const depthTied = you.hp === them.hp;
  const youWereShallower = you.hp > them.hp;
  const youHadMatch = you.stats.damageDealt > them.stats.damageDealt;
  const matchTied = you.stats.damageDealt === them.stats.damageDealt;

  return (
    <div className={`panel recap-stats recap-last-volley${bothFell ? " recap-mutual-volley" : ""}`}>
      <p className="t-eyebrow recap-lastround-title">Round {yourReport.round} — the final volley</p>
      {bothFell && (
        <div className="recap-deciding">
          <p className="t-eyebrow recap-deciding-label">Where the flagships ended</p>
          <div className="recap-deciding-score">
            <span className={`recap-deciding-num recap-deciding-you t-display t-num text-3xl${youWereShallower ? " is-ahead" : ""}`}>
              <Ticker value={you.hp} />
            </span>
            <span className="recap-deciding-vs">vs</span>
            <span className={`recap-deciding-num recap-deciding-them t-display t-num text-3xl${!depthTied && !youWereShallower ? " is-ahead" : ""}`}>
              <Ticker value={them.hp} />
            </span>
          </div>
          <div className="recap-deciding-names">
            <span>You</span>
            <span>{enemyName}</span>
          </div>
          <p className="t-display recap-deciding-call">
            {depthTied
              ? "Blown up by exactly as much"
              : youWereShallower
                ? "You were blown up by less"
                : `${enemyName} was blown up by less`}
          </p>
        </div>
      )}
      {yourSide && (
        <VolleyLedger
          you={yourSide}
          them={theirSide}
          enemyName={enemyName}
          yourWeapon={yourReport.weapon}
          enemyWeapon={theirReport.weapon}
        />
      )}
      {bothFell && depthTied && (
        <p className="recap-mutual-fallback">
          {matchTied
            ? "Dead even all the way down — a draw."
            : `Both flagships ended on the same number. ${youHadMatch ? "You" : enemyName} dealt more damage across the whole match, ${Math.max(you.stats.damageDealt, them.stats.damageDealt)} to ${Math.min(you.stats.damageDealt, them.stats.damageDealt)}, and that decided it.`}
        </p>
      )}
    </div>
  );
}

export function BattleRecap({
  won,
  draw,
  cancelledBy,
  youCancelled,
  you,
  them,
  enemyName,
  difficultyLabel,
  onExit,
  onRestart,
}: {
  won: boolean;
  draw: boolean;
  cancelledBy?: string | null;
  youCancelled?: boolean;
  you: PlayerState;
  them: PlayerState | null;
  enemyName: string;
  /**
   * Solo wins name the AI tier the player chose (Low, Medium, Hard, Expert).
   * Versus leaves this unset so a human opponent keeps their own name.
   * Losses and mutual kills still use `enemyName`.
   */
  difficultyLabel?: string;
  onExit(): void;
  onRestart?(): void;
}) {
  const cancelled = Boolean(cancelledBy);
  const outcome = cancelled ? "cancelled" : draw ? "draw" : won ? "won" : "lost";
  const bothFell = Boolean(them && you.hp <= 0 && them.hp <= 0) && !cancelled;
  const beatName = difficultyLabel || enemyName;

  const title = cancelled
    ? youCancelled
      ? `You ended the ${NOUN.game}`
      : `${cancelledBy} ended the ${NOUN.game}`
    : bothFell
      ? draw
        ? "A draw"
        : won
          ? "You win"
          : `${enemyName} wins`
      : draw
        ? "A draw"
        : won
          ? `You beat ${beatName}`
          : `${enemyName} wins`;

  // Why the screen says MUTUAL DESTRUCTION at all. Who won, and on what
  // number, is the panel underneath — this line only has to explain the wreck.
  const mutualWhy = bothFell
    ? draw
      ? "Both flagships fell in the same volley, dead even all the way down."
      : "Both flagships fell in the same volley."
    : null;

  // Same measured hint as Round Review: only point down while something
  // is actually below the fold. Victory art loading can grow the scroll
  // after the first paint, so this re-checks on resize and image load.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const checkMore = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > MORE_BELOW_PX);
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkMore();
    const ro = new ResizeObserver(checkMore);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    window.addEventListener("resize", checkMore);
    const imgs = [...el.querySelectorAll("img")];
    imgs.forEach((img) => img.addEventListener("load", checkMore));
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", checkMore);
      imgs.forEach((img) => img.removeEventListener("load", checkMore));
    };
  }, [checkMore, bothFell, outcome]);

  return (
    <div className="recap">
      <div className="recap-body">
        <div className="recap-scroll fade-edges" ref={scrollRef} onScroll={checkMore}>
        {/* Ordinary wins and losses keep the painted flagship. A mutual
            kill is both fleets going up, so that poster would lie — one
            still of two exploding flagships instead, then the huge words. */}
        {bothFell ? (
          <MutualArt />
        ) : (
          (outcome === "won" || outcome === "lost") && (
            <div className={`recap-art recap-art-${outcome}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={href(outcome === "won"
                  ? "/art/fleet-dice-recap-victory.jpg"
                  : "/art/fleet-dice-recap-defeated.jpg")}
                alt=""
                width={1672}
                height={941}
                decoding="async"
              />
              <span className="recap-outcome-word" aria-hidden="true">
                {outcome === "won" ? "Victory" : "Defeated"}
              </span>
            </div>
          )
        )}
        <div className={`recap-head${bothFell ? " recap-head-mutual" : ""}`}>
          {bothFell ? (
            <p className="recap-mutual-banner">
              <span>Mutual</span>
              <span>Destruction</span>
            </p>
          ) : (
            outcome !== "won" &&
            outcome !== "lost" && (
              <p className="t-eyebrow">{cancelled ? "Game cancelled" : "Battle recap"}</p>
            )
          )}
          <h2 className={`t-display text-3xl recap-title-${outcome}`}>{title}</h2>
          {mutualWhy && <p className="recap-mutual-why">{mutualWhy}</p>}
        </div>

        {them && <LastRound you={you} them={them} enemyName={enemyName} />}

        <div className="panel recap-stats">
          <p className="t-eyebrow">Flagship weapons</p>
          <WeaponStatusList stock={weaponsOf(you)} name="You" />
          {them && <WeaponStatusList stock={weaponsOf(them)} name={enemyName} />}
        </div>

        <div className="recap-fleets">
          <FleetPanel player={you} name="You" you />
          {them && <FleetPanel player={them} name={enemyName} you={false} />}
        </div>

        {them ? (
          <div className="panel recap-stats">
            <div className="recap-stats-head">
              <span className="t-eyebrow">You</span>
              <span className="t-eyebrow">{enemyName}</span>
            </div>
            <StatRow label="Hit points" you={Math.max(0, you.hp)} them={Math.max(0, them.hp)} color="hp" />
            <StatRow label="Flagship level" you={you.flag.level} them={them.flag.level} color="flag-glow" />
            <StatRow
              label="Total attack"
              you={you.stats.damageDealt}
              them={them.stats.damageDealt}
              color="attack"
            />
            <StatRow
              label="Shields blocked"
              you={you.stats.shieldsBlocked}
              them={them.stats.shieldsBlocked}
              color="shield"
            />
            <StatRow
              label="Direct hits"
              you={you.stats.directDealt}
              them={them.stats.directDealt}
              color="direct"
            />
            <StatRow label="Repaired" you={you.stats.repaired} them={them.stats.repaired} color="repair" />
            <StatRow label="Straights" you={you.stats.straights} them={them.stats.straights} color="run" />
            <StatRow label="Rows, three across" you={you.stats.rows} them={them.stats.rows} color="energy" />
            <StatRow label="Columns, three down" you={you.stats.cols} them={them.stats.cols} color="attack" />
            <StatRow
              label="Energy spent rerolling"
              you={you.stats.rerollEnergy}
              them={them.stats.rerollEnergy}
              color="energy"
            />
          </div>
        ) : (
          <div className="panel recap-stats">
            <StatRow label="Total attack" you={you.stats.damageDealt} them={0} color="attack" />
            <StatRow label="Shields blocked" you={you.stats.shieldsBlocked} them={0} color="shield" />
            <StatRow label="Direct hits" you={you.stats.directDealt} them={0} color="direct" />
            <StatRow label="Repaired" you={you.stats.repaired} them={0} color="repair" />
            <StatRow label="Straights" you={you.stats.straights} them={0} color="run" />
            <StatRow label="Energy spent rerolling" you={you.stats.rerollEnergy} them={0} color="energy" />
          </div>
        )}
        </div>
        <div
          className={`recap-more-below${moreBelow ? " is-shown" : ""}`}
          data-recap-more-below={moreBelow ? "shown" : "hidden"}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div className="recap-foot">
        <Button tone="ghost" size="lg" full onClick={onExit}>
          Back to {NOUN.home}
        </Button>
        {onRestart && !cancelled && (
          <Button tone="primary" size="lg" full onClick={onRestart}>
            Again
          </Button>
        )}
      </div>
    </div>
  );
}
