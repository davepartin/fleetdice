"use client";

/**
 * A public running total of finished games, for the small line at the
 * bottom of the home page.
 *
 * Versus increments inside the same Firestore transaction that publishes
 * a result, so two phones cannot double-count one match. Solo increments
 * from this browser, once per match id. Local play and the emulator do
 * not write — they would pollute the live number.
 */

import {
  doc,
  increment,
  onSnapshot,
  setDoc,
  type Transaction,
  type Unsubscribe,
} from "firebase/firestore";
import { ensurePlayerIdentity, firestore } from "./firebase";

export const STATS = "fd3Stats";
export const TALLY_ID = "tally";

export type GameTally = { solo: number; versus: number };

const COUNTED_KEY = "fd3.countedGames.v1";

export function countingWritesEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR) return false;
  const host = window.location.hostname;
  return host === "fleetdice.ministrybag.com" || host.endsWith(".ministrybag.com");
}

function tallyDoc() {
  if (!firestore) return null;
  return doc(firestore, STATS, TALLY_ID);
}

function countedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(COUNTED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function markCounted(matchId: string): boolean {
  const ids = countedIds();
  if (ids.has(matchId)) return false;
  ids.add(matchId);
  try {
    localStorage.setItem(COUNTED_KEY, JSON.stringify([...ids].slice(-400)));
  } catch {
    return true;
  }
  return true;
}

export function bumpTallyInTransaction(transaction: Transaction, mode: "solo" | "versus"): void {
  if (!firestore) return;
  transaction.set(
    doc(firestore, STATS, TALLY_ID),
    {
      solo: increment(mode === "solo" ? 1 : 0),
      versus: increment(mode === "versus" ? 1 : 0),
    },
    { merge: true },
  );
}

/** Solo only. Versus is counted inside the finish transaction in rooms.ts. */
export function recordSoloFinish(matchId: string): void {
  if (!countingWritesEnabled()) return;
  if (!matchId || !firestore) return;
  if (!markCounted(matchId)) return;
  void (async () => {
    try {
      await ensurePlayerIdentity();
      const ref = tallyDoc();
      if (!ref) return;
      await setDoc(
        ref,
        { solo: increment(1), versus: increment(0) },
        { merge: true },
      );
    } catch {
      // Never block a finished match on a counter.
    }
  })();
}

export function watchGameTally(
  onTally: (tally: GameTally) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = tallyDoc();
  if (!ref) {
    onTally({ solo: 0, versus: 0 });
    return () => undefined;
  }
  return onSnapshot(
    ref,
    (snap) => {
      const data = snap.data() as { solo?: unknown; versus?: unknown } | undefined;
      onTally({
        solo: typeof data?.solo === "number" ? data.solo : 0,
        versus: typeof data?.versus === "number" ? data.versus : 0,
      });
    },
    (error) => onError?.(error),
  );
}
