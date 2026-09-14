/**
 * The real screen the player can see.
 *
 * Phones lie about their size. Android display scaling, the Chrome address
 * bar, a pinch-zoom, and turning the phone on its side all change a different
 * number. Layout that trusts `window.innerWidth` alone will fit one phone and
 * clip another. Everything that frames the board should ask here instead.
 *
 * Wide laptop/desktop windows are a special case: the CSS letterboxes the
 * game into a phone-width column, so the numbers we hand the HUD and the
 * renderer are that column, not the monitor.
 */

export type VisibleViewport = {
  /** Layout pixels the HUD and canvas should be sized to (browser zoom undone). */
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  /** Browser pinch scale. 1 means no page zoom. */
  scale: number;
};

/** Playable column on a wide window. Real phones keep their own width. */
export const PHONE_FRAME_WIDTH = 390;

/** Short side at or below this is a phone (or a phone on its side). */
export const PHONE_LAYOUT_MAX = 640;

export function visibleViewport(): VisibleViewport {
  if (typeof window === "undefined") {
    return { width: PHONE_FRAME_WIDTH, height: 844, offsetLeft: 0, offsetTop: 0, scale: 1 };
  }
  const view = window.visualViewport;
  const scale = view?.scale || 1;
  // CSS pixels of the visible screen. Do not multiply by scale and then
  // un-scale with a CSS transform — Safari will draw the WebGL canvas over
  // the menus, leaving only the floating dice.
  return {
    width: view?.width ?? window.innerWidth,
    height: view?.height ?? window.innerHeight,
    offsetLeft: view?.offsetLeft ?? 0,
    offsetTop: view?.offsetTop ?? 0,
    scale,
  };
}

/** True when both sides are bigger than a phone, so CSS letterboxes. */
export function isWideWindow(view?: Pick<VisibleViewport, "width" | "height">): boolean {
  const size = view ?? visibleViewport();
  return size.width > PHONE_LAYOUT_MAX && size.height > PHONE_LAYOUT_MAX;
}

/** True when the playable column is phone-sized — a real phone, or a letterboxed desktop. */
export function isPhoneLayout(): boolean {
  if (typeof window === "undefined") return true;
  const view = visibleViewport();
  if (isWideWindow(view)) return true;
  return Math.min(view.width, view.height) <= PHONE_LAYOUT_MAX;
}

/** Width the HUD, canvas and dialogs should pretend the screen is. */
export function layoutWidth(view: Pick<VisibleViewport, "width" | "height"> = visibleViewport()): number {
  return isWideWindow(view) ? PHONE_FRAME_WIDTH : view.width;
}

/** Write the visible screen onto :root and notify the renderer. */
export function syncViewportCss(root: HTMLElement = document.documentElement): VisibleViewport {
  const view = visibleViewport();
  root.style.setProperty("--vv-width", `${layoutWidth(view)}px`);
  root.style.setProperty("--vv-height", `${view.height}px`);
  root.classList.toggle("fd-phone-frame", isWideWindow(view));
  return view;
}
