import type { MetadataRoute } from "next";

/**
 * What a phone uses when the site is installed. Icons are the same d4
 * face 1 as apple-touch-icon — one look, every install path.
 *
 * `force-static` is required: this site is a static export for GitHub Pages,
 * and Next will not emit a manifest route without it.
 */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fleet Dice",
    short_name: "Fleet Dice",
    description: "Build the fleet. Break the flagship.",
    start_url: "/",
    display: "standalone",
    background_color: "#04060d",
    theme_color: "#04060d",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
