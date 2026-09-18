"use client";

/**
 * The first-flight tutorial: one picture, a few lines, one button.
 *
 * Every picture is drawn with the game's own parts — `HelpShipFace` paints a
 * real die face, `HullShape` is the same silhouette set the board uses — so
 * what a new commander learns here is what they will see when they play. The
 * only thing that is fake is that nothing is being decided: each slide is a
 * still, and the button always goes forward.
 *
 * Copy and board states live in `lib/tutorialSlides.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpFlagFace, HelpShipFace, HelpHullPlate } from "./HelpArt";
import { HullShape } from "./HullShape";
import { Button } from "./ui";
import { FACE_ROWS } from "@/lib/reference";
import { TUTORIAL_SLIDES, type SlideCell, type SlideVisual } from "@/lib/tutorialSlides";
import { audio } from "@/lib/audio";

function BoardPicture({ cells }: { cells: SlideCell[] }) {
  return (
    <div className="tut-board" aria-hidden>
      {cells.map((cell, index) => (
        <div
          key={index}
          className={`tut-cell ${cell.kind === "locked" ? "tut-cell-locked" : ""} ${
            "lit" in cell && cell.lit ? "tut-cell-lit" : ""
          } ${"marked" in cell && cell.marked ? "tut-cell-marked" : ""}`}
        >
          {cell.kind === "die" && <HelpShipFace value={cell.value} size={68} hull={cell.hull} />}
          {cell.kind === "flag" && <HelpFlagFace face={cell.value ?? 1} size={68} />}
          {cell.kind === "idle" && (
            <span className="tut-idle">
              <HullShape sides={cell.hull} tone="ghost" />
            </span>
          )}
          {cell.kind === "blocking" && <HelpHullPlate sides={cell.hull} size={68} />}
          {cell.kind === "locked" && <span className="tut-locked" />}
        </div>
      ))}
    </div>
  );
}

function FacesPicture({ values }: { values: number[] }) {
  return (
    <div className="tut-faces">
      {values.map((value) => {
        const row = FACE_ROWS.find((entry) => entry.value === value);
        return (
          <div key={value} className="tut-face">
            <HelpShipFace value={value} size={66} />
            <p className="t-num tut-face-title">{row?.fightText}</p>
            <p className="tut-face-note">{row?.markText}</p>
          </div>
        );
      })}
    </div>
  );
}

function StraightPicture({ values }: { values: number[] }) {
  return (
    <div className="tut-straight">
      {values.map((value) => (
        <HelpShipFace key={value} value={value} size={56} />
      ))}
    </div>
  );
}

/** The round review, cut to the three lines a first-timer needs. */
function ReviewPicture({
  before,
  attack,
  shields,
  after,
}: {
  before: number;
  attack: number;
  shields: number;
  after: number;
}) {
  return (
    <div className="tut-review">
      <div className="tut-review-row">
        <span className="t-num c-hp">{before}</span>
        <span className="tut-review-label">Started with</span>
      </div>
      <div className="tut-review-row">
        <span className="t-num c-attack">−{attack}</span>
        <span className="tut-review-label">Their Attack</span>
      </div>
      <div className="tut-review-row">
        <span className="t-num c-shield">+{shields}</span>
        <span className="tut-review-label">Your Shields</span>
      </div>
      <div className="tut-review-row tut-review-total">
        <span className="t-num c-hp">{after}</span>
        <span className="tut-review-label">Left with</span>
      </div>
    </div>
  );
}

function ShopPicture({
  label,
  cost,
  detail,
  cells,
}: {
  label: string;
  cost: number;
  detail: string;
  cells?: SlideCell[];
}) {
  return (
    <div className="tut-shop-stack">
      {cells && <BoardPicture cells={cells} />}
      <div className="tut-shop">
        <div className="tut-shop-row">
          <span className="tut-shop-label">{label}</span>
          <span className="t-num tut-shop-cost">
            <svg className="tut-bolt" viewBox="0 0 16 20" aria-hidden="true">
              <path d="M9.1 0 1.8 11.1h4.7L5.6 20l8.6-12.3H9.4L9.1 0Z" fill="currentColor" />
            </svg>
            {cost}
          </span>
        </div>
        <p className="tut-shop-detail">{detail}</p>
      </div>
    </div>
  );
}

const WEAPON_MARKS: { id: string; label: string; mark: string; tone: string }[] = [
  { id: "rotate", label: "Rotate", mark: "↻", tone: "energy" },
  { id: "shield", label: "Super Shield", mark: "⬢", tone: "shield" },
  { id: "attack", label: "Attack", mark: "✹", tone: "attack" },
  { id: "repair", label: "Repair", mark: "✚", tone: "repair" },
];

function WeaponsPicture({ charged }: { charged: string }) {
  return (
    <div className="tut-weapons">
      {WEAPON_MARKS.map((weapon) => (
        <div
          key={weapon.id}
          className={`tut-weapon tut-weapon-${weapon.tone} ${
            weapon.id === charged ? "tut-weapon-charged" : ""
          }`}
        >
          <span className="tut-weapon-mark">{weapon.mark}</span>
          <span className="tut-weapon-label">{weapon.label}</span>
          {weapon.id === charged && <span className="tut-weapon-state">Charged</span>}
        </div>
      ))}
    </div>
  );
}

function TitlePicture() {
  return (
    <div className="tut-title-art" aria-hidden>
      <HelpFlagFace face={1} size={78} />
      <div className="tut-title-fleet">
        <HelpShipFace value={6} size={46} />
        <HelpShipFace value={5} size={46} />
        <HelpShipFace value={3} size={46} />
      </div>
    </div>
  );
}

function Picture({ visual }: { visual: SlideVisual }) {
  switch (visual.kind) {
    case "board":
      return <BoardPicture cells={visual.cells} />;
    case "faces":
      return <FacesPicture values={visual.values} />;
    case "straight":
      return <StraightPicture values={visual.values} />;
    case "review":
      return (
        <ReviewPicture
          before={visual.before}
          attack={visual.attack}
          shields={visual.shields}
          after={visual.after}
        />
      );
    case "shop":
      return (
        <ShopPicture
          label={visual.label}
          cost={visual.cost}
          detail={visual.detail}
          cells={visual.cells}
        />
      );
    case "weapons":
      return <WeaponsPicture charged={visual.charged} />;
    default:
      return <TitlePicture />;
  }
}

export function TutorialSlides() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = TUTORIAL_SLIDES[index]!;
  const last = index === TUTORIAL_SLIDES.length - 1;

  const next = useCallback(() => {
    if (last) {
      // Straight into a real match on the gentlest tier, which is the whole
      // point of the tutorial.
      router.push("/solo/?d=low");
      return;
    }
    audio.play("button");
    setIndex((current) => Math.min(current + 1, TUTORIAL_SLIDES.length - 1));
  }, [last, router]);

  const back = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  // The one button is also the space bar and the right arrow, for anyone
  // reading this on a laptop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") next();
      if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back]);

  return (
    <div className="app-frame tut-frame">
      <div className="tut-shell">
        <header className="tut-head">
          <button type="button" className="tut-exit" onClick={() => router.push("/")}>
            Leave
          </button>
          <div className="tut-dots" aria-label={`Step ${index + 1} of ${TUTORIAL_SLIDES.length}`}>
            {TUTORIAL_SLIDES.map((entry, dot) => (
              <span
                key={entry.id}
                className={`tut-dot ${dot === index ? "tut-dot-on" : ""} ${
                  dot < index ? "tut-dot-done" : ""
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            className="tut-exit"
            onClick={back}
            disabled={index === 0}
            aria-label="Previous step"
          >
            Back
          </button>
        </header>

        <div className="tut-picture" key={slide.id}>
          <Picture visual={slide.visual} />
        </div>

        <div className="tut-copy">
          <p className="t-eyebrow">{slide.eyebrow}</p>
          <h1 className="t-display tut-title">{slide.title}</h1>
          <p className="tut-body">{slide.body}</p>
        </div>

        <div className="tut-action">
          <Button tone="primary" size="lg" full onClick={next}>
            {slide.action}
          </Button>
        </div>
      </div>
    </div>
  );
}
