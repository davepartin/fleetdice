"use client";

/**
 * The front door.
 *
 * One tap to play alone, one tap to start a game with a friend, and one box for
 * the four numbers on their screen. Everything else is below the fold.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HeroStage } from "./HeroStage";
import { Button, Chip, Notice, Panel, Rule, Sheet, Spinner } from "./ui";
import { HowToPlaySheet } from "./HowToPlay";
import { HULL_PATHS } from "./HullShape";
import { commanderName, ensurePlayerIdentity, firebaseConfigured, rememberCommanderName } from "@/lib/firebase";
import {
  cancelRoom,
  loadRememberedRoomCards,
  watchLiveBattles,
  watchRecentResults,
  type BattleResultRow,
  type LiveBattleRow,
  type RememberedRoomCard,
} from "@/lib/rooms";
import { watchGameTally, type GameTally } from "@/lib/gameTally";
import { basePath, href } from "@/lib/paths";
import { NOUN } from "@/lib/reference";

export function HomeScreen() {
  const [name, setName] = useState("Commander");
  const [code, setCode] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<RememberedRoomCard[]>([]);
  const [battles, setBattles] = useState<LiveBattleRow[]>([]);
  const [results, setResults] = useState<BattleResultRow[]>([]);
  const [tally, setTally] = useState<GameTally | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<RememberedRoomCard | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setName(commanderName());
    if (firebaseConfigured) ensurePlayerIdentity().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    let alive = true;
    loadRememberedRoomCards()
      .then((rows) => alive && setCards(rows))
      .catch(() => undefined);
    const stopBattles = watchLiveBattles(
      (rows) => alive && setBattles(rows),
      () => undefined,
    );
    const stopResults = watchRecentResults(
      (rows) => alive && setResults(rows.slice(0, 8)),
      () => undefined,
    );
    const stopTally = watchGameTally(
      (row) => alive && setTally(row),
      () => undefined,
    );
    return () => {
      alive = false;
      stopBattles();
      stopResults();
      stopTally();
    };
  }, []);

  const saveName = useCallback((value: string) => {
    setName(value);
    rememberCommanderName(value);
  }, []);

  const join = useCallback(() => {
    const cleaned = code.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length !== 4) {
      setError("Type all four numbers from your friend's screen.");
      return;
    }
    setJoining(true);
    window.location.href = `${basePath}/join/?code=${cleaned}`;
  }, [code]);

  const confirmCancel = useCallback(async () => {
    const card = pendingCancel;
    if (!card) return;
    setClosing(true);
    setError(null);
    try {
      await cancelRoom(card.id);
      setCards((rows) => rows.filter((row) => row.id !== card.id));
      setPendingCancel(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setClosing(false);
    }
  }, [pendingCancel]);

  return (
    <>
      <HeroStage />
      <div className="hud">
        <div className="scroll-y fade-edges flex-1">
          <div className="mx-auto flex w-full max-w-[30rem] flex-col gap-4 px-4 pb-10 pt-8">
            {/* The wordmark is the key art. It already carries the name and
                the promise — "Build the fleet. Break the flagship." — so a
                heading and a tagline underneath would only say it twice. Its
                bottom edge is faded out so the painted starfield hands over to
                the real dice turning behind the page rather than sitting on
                top of them in a box. */}
            <header className="anim-rise home-key-art">
              {/* A plain <img> on purpose. `images.unoptimized` is set for the
                  static export, so next/image has no optimiser to offer here —
                  and with it on, next/image emits the src without the base
                  path, which is a broken image on GitHub Pages. `href()` is
                  the helper that knows where this app is mounted. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={href("/art/fleet-dice-key-art.jpg")}
                alt="Fleet Dice — build the fleet, break the flagship"
                width={1440}
                height={810}
                decoding="async"
                fetchPriority="high"
              />
              <h1 className="sr-only">Fleet Dice</h1>
            </header>

            {/* Kept above the ways to play, as it was: someone who has never
                played should not have to scroll past three ways to start a
                match to find the rules. One quiet line is enough to do that. */}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="home-help-link t-eyebrow"
            >
              How to play
            </button>

            {/* The two ways to play */}
            <div className="flex flex-col gap-2.5">
              <Link href="/tutorial/" className="block">
                <Panel className="home-mode home-mode--tutorial anim-rise flex items-center gap-4 p-4">
                  <ModeIcon kind="tutorial" />
                  <span className="min-w-0 flex-1">
                    <span className="t-display block text-xl text-white">Tutorial</span>
                    <span className="mt-0.5 block text-sm leading-snug c-dim">
                      New here? Start with this.
                    </span>
                  </span>
                  <span className="home-mode-go" aria-hidden>
                    ›
                  </span>
                </Panel>
              </Link>

              <Link href="/solo/" className="block">
                <Panel className="home-mode home-mode--solo anim-rise flex items-center gap-4 p-4">
                  <ModeIcon kind="solo" />
                  <span className="min-w-0 flex-1">
                    <span className="t-display block text-xl text-white">Play solo</span>
                    <span className="mt-0.5 block text-sm leading-snug c-dim">
                      Against the ship&apos;s computer.
                    </span>
                  </span>
                  <span className="home-mode-go" aria-hidden>
                    ›
                  </span>
                </Panel>
              </Link>

              <Link href="/versus/" className="block">
                <Panel className="home-mode home-mode--versus anim-rise flex items-center gap-4 p-4">
                  <ModeIcon kind="versus" />
                  <span className="min-w-0 flex-1">
                    <span className="t-display block text-xl text-white">Play a friend</span>
                    <span className="mt-0.5 block text-sm leading-snug c-dim">
                      Four digits and a link.
                    </span>
                  </span>
                  <span className="home-mode-go" aria-hidden>
                    ›
                  </span>
                </Panel>
              </Link>
            </div>

            {/* Name and code together: both are only about playing someone
                else, and as two separate panels they pushed the board and the
                results off the first screen. */}
            <Panel className="p-4">
              <label className="t-eyebrow mb-1.5 block" htmlFor="commander">
                Your name
              </label>
              <input
                id="commander"
                value={name}
                maxLength={20}
                onChange={(event) => saveName(event.target.value)}
                className="t-num mb-3 w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-base text-white outline-none focus:border-white/40"
              />
              <p className="t-eyebrow mb-2">Got a code from a friend?</p>
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={code}
                  placeholder="0000"
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 4));
                    setError(null);
                  }}
                  onKeyDown={(event) => event.key === "Enter" && join()}
                  aria-label="Four digit game code"
                  className="t-num min-w-0 flex-1 rounded-xl border border-white/12 bg-black/40 px-3 py-3 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-white/40"
                />
                <Button tone="ghost" onClick={join} disabled={joining || code.length !== 4}>
                  {joining ? "…" : "Join"}
                </Button>
              </div>
              {error && (
                <Notice tone="warn" className="mt-2">
                  {error}
                </Notice>
              )}
            </Panel>

            {/* Your games in progress */}
            {cards.length > 0 && (
              <Panel className="p-4">
                <p className="t-eyebrow mb-2">Your {NOUN.games}</p>
                <div className="flex flex-col gap-2">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                    >
                      <Link
                        href={`/match/?id=${card.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.07]"
                      >
                        <span className="t-num rounded-lg bg-white/8 px-2 py-1 text-sm">{card.code}</span>
                        <span className="min-w-0 flex-1 text-sm">
                          <b className="text-white">
                            {card.enemyName ? `vs ${card.enemyName}` : "Waiting for a friend"}
                          </b>
                          <span className="block text-xs c-dim">
                            {card.status === "waiting" ? "Not started" : `Round ${card.round}`}
                          </span>
                        </span>
                        <span className="c-dim" aria-hidden>
                          ›
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="min-h-[44px] shrink-0 border-l border-white/10 px-3 text-xs font-bold uppercase tracking-wide c-attack-glow"
                        onClick={() => {
                          setError(null);
                          setPendingCancel(card);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Now on the field */}
            {firebaseConfigured && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowBoard((value) => !value)}
                  className="flex w-full items-center justify-between gap-2 px-1 py-2"
                >
                  <span className="t-eyebrow">
                    Now on the field
                    {battles.length > 0 && (
                      <span className="c-repair"> · {battles.length}</span>
                    )}
                  </span>
                  <span className={`c-dim transition-transform ${showBoard ? "rotate-180" : ""}`} aria-hidden>
                    ▾
                  </span>
                </button>
                {showBoard && (
                  <Panel className="p-4">
                    {battles.length === 0 ? (
                      <p className="text-sm c-dim">No {NOUN.games} running right now. Start one.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {battles.map((row) => (
                          <li key={row.id} className="flex items-center gap-2 text-sm">
                            <Chip tone={row.status === "active" ? "attack" : "neutral"}>
                              {row.status === "active" ? `Round ${row.round}` : "Waiting"}
                            </Chip>
                            <span className="truncate c-dim-bright">
                              {row.hostName}
                              {row.guestName ? ` vs ${row.guestName}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {results.length > 0 && (
                      <>
                        <Rule className="my-3" />
                        <p className="t-eyebrow mb-2">Recent results</p>
                        <ul className="flex flex-col gap-1">
                          {results.map((row) => (
                            <li key={row.id} className="text-sm c-dim">
                              <b className="c-repair">{row.winnerName}</b> beat {row.loserName}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </Panel>
                )}
              </div>
            )}

            {!firebaseConfigured && (
              <Notice tone="warn">
                Two-player games are switched off because this build has no Firebase settings. Solo
                works fine.
              </Notice>
            )}

            {tally && (
              <p className="home-tally t-eyebrow text-center" aria-live="polite">
                {tally.solo + tally.versus} {NOUN.games} played
                <span className="home-tally-break">
                  {tally.solo} solo · {tally.versus} vs
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <HowToPlaySheet open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Sheet
        open={Boolean(pendingCancel)}
        onClose={() => !closing && setPendingCancel(null)}
        title={`Cancel this ${NOUN.game}?`}
        footer={
          <div className="flex flex-col gap-2">
            <Button tone="ghost" full disabled={closing} onClick={() => setPendingCancel(null)}>
              Keep it
            </Button>
            <Button tone="primary" full disabled={closing} onClick={() => void confirmCancel()}>
              {closing ? "Ending…" : `Cancel ${NOUN.game}`}
            </Button>
          </div>
        }
      >
        <p className="text-base leading-relaxed c-dim-bright">
          This ends{" "}
          {pendingCancel?.enemyName ? `the ${NOUN.game} vs ${pendingCancel.enemyName}` : `this ${NOUN.game}`} for
          both of you. The four-digit code dies.
        </p>
      </Sheet>
      {joining && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <Spinner label="Finding that room…" />
        </div>
      )}
    </>
  );
}

/**
 * The three ways in, drawn with the same hull silhouettes the dice have on the
 * board (`HULL_PATHS`) rather than icons from some other game. Solo is one die;
 * Play a friend is two. Each one glows in its row's colour — gold to learn,
 * shield blue against the computer, attack red against a person — which is the
 * same colour the row's border and arrow carry, so a row reads as one thing.
 *
 * Outlines, not solid shapes: a filled square at 32px reads as a box, and the
 * dice on the board are lit edges over a dark hull.
 */
function ModeIcon({ kind }: { kind: "solo" | "versus" | "tutorial" }) {
  return (
    <span className="home-mode-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl border" aria-hidden>
      <svg viewBox="0 0 64 64" className="h-8 w-8" fill="none" stroke="currentColor">
        {kind === "tutorial" ? (
          <>
            <path d={HULL_PATHS[6]} strokeWidth="3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1" />
            <text
              x="32"
              y="33.5"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="25"
              fontWeight="700"
              fill="currentColor"
              stroke="none"
            >
              ?
            </text>
          </>
        ) : kind === "solo" ? (
          /* One die, the d4 triangle, showing a 1: one commander. */
          <>
            <path d={HULL_PATHS[4]} strokeWidth="3.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
            <text
              x="32"
              y="36"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="22"
              fontWeight="700"
              fill="currentColor"
              stroke="none"
            >
              1
            </text>
          </>
        ) : (
          /* Two dice, two commanders: your blue d4 as 1, theirs a red d6 as 2.
             These two keep their own colours rather than the row's, because the
             point of the mark is that there are two sides. */
          <>
            <g
              transform="translate(-8 12) scale(0.7)"
              stroke="var(--color-shield)"
              fill="var(--color-shield)"
            >
              <path d={HULL_PATHS[4]} strokeWidth="5" strokeLinejoin="round" fillOpacity="0.14" />
              <text
                x="32"
                y="36"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="24"
                fontWeight="700"
                stroke="none"
              >
                1
              </text>
            </g>
            <g
              transform="translate(27 8) scale(0.7)"
              stroke="var(--color-attack)"
              fill="var(--color-attack)"
            >
              <path d={HULL_PATHS[6]} strokeWidth="5" strokeLinejoin="round" fillOpacity="0.14" />
              <text
                x="32"
                y="33"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="24"
                fontWeight="700"
                stroke="none"
              >
                2
              </text>
            </g>
          </>
        )}
      </svg>
    </span>
  );
}
