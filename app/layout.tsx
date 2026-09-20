import type { Metadata } from "next";
import localFont from "next/font/local";
import { ViewportSync } from "@/components/ViewportSync";
import "./globals.css";

/**
 * Fonts ship with the site rather than coming from Google, so the game loads
 * on a plane, in a school wifi, or anywhere a font CDN is blocked.
 */
const display = localFont({
  src: [
    { path: "../public/fonts/oxanium-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/oxanium-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/oxanium-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/oxanium-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display",
  display: "block",
  fallback: ["system-ui", "sans-serif"],
});

const body = localFont({
  src: [
    { path: "../public/fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

/**
 * Dice numerals only — never referenced by any CSS rule that touches real
 * page text. A numeral is read at ~40px, tilted away from the eye, on a
 * saturated field: it needs the plainest, heaviest, most closed shapes
 * available, which is exactly what a display face like Oxanium gives up at
 * that size.
 */
const numeral = localFont({
  src: [{ path: "../public/fonts/archivoblack-latin-900-normal.woff2", weight: "900", style: "normal" }],
  variable: "--font-numeral-face",
  display: "block",
  fallback: ["Arial Black", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Fleet Dice",
  description:
    "Build the fleet. Break the flagship. A two-player dice battle you can play in any browser.",
  applicationName: "Fleet Dice",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Fleet Dice" },
  // Saved to the home screen this is the d4 showing 1 — the same face How to
  // Play paints — not a letter F. apple-touch-icon.png is the filename iOS
  // fetches on its own; the 192 and 512 cover Android / "Add to Home screen".
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  // A shared link should show the ship, not a blank card. The image has to be
  // an absolute URL, and this game is served from two hosts, so the host comes
  // from `SITE_URL` at build time and the path from `BASE_PATH`.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://davepartin.github.io"),
  openGraph: {
    title: "Fleet Dice",
    description: "Build the fleet. Break the flagship.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`,
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/art/fleet-dice-key-art.jpg`,
        width: 1440,
        height: 810,
        alt: "Fleet Dice — build the fleet, break the flagship",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fleet Dice",
    description: "Build the fleet. Break the flagship.",
    images: [`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/art/fleet-dice-key-art.jpg`],
  },
};

export { viewport } from "./viewport";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${numeral.variable}`}>
      <body>
        <ViewportSync />
        {/* On a phone this is the whole screen. On a laptop CSS centres it
            as a phone-width column — one layout, not a second desktop UI. */}
        <div className="app-frame">{children}</div>
      </body>
    </html>
  );
}
