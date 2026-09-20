/**
 * Paint the home-screen icon: the same d4 face 1 How to Play shows.
 *
 * This is not a second logo. `paintHelpFace` + `faceSpec(1)` + the d4 hull
 * clip is exactly `HelpShipFace value={1}` — blue triangle, a 1, two
 * lightning bolts. The only extra is the void fill behind it, so iOS's
 * rounded mask has a solid space colour instead of transparency.
 */

import { addHullPath } from "@/components/HullShape";
import { faceSpec, paintHelpFace } from "@/lib/three/faceArt";

/** `--color-void` in app/globals.css; same hex as viewport themeColor. */
export const ICON_VOID = "#04060d";

/**
 * Inset so the triangle's base corners sit inside an iOS squircle. The hull
 * path already leaves air at the top; this is just enough extra that the
 * mask does not shave the two base points.
 */
const PAD = 0.08;

export function drawAppIcon(
  ctx: CanvasRenderingContext2D,
  size: number,
  numeralFont: string,
  captionFont: string,
): void {
  ctx.fillStyle = ICON_VOID;
  ctx.fillRect(0, 0, size, size);

  const pad = size * PAD;
  const dieSize = size - pad * 2;
  const spec = faceSpec(1);

  ctx.save();
  ctx.translate(pad, pad);
  addHullPath(ctx, 4, dieSize);
  ctx.clip();
  paintHelpFace(ctx, spec, 4, dieSize, numeralFont, captionFont);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = Math.max(1.2, dieSize * 0.028);
  addHullPath(ctx, 4, dieSize);
  ctx.stroke();
  ctx.restore();
}
