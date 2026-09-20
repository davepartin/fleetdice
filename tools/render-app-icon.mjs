/**
 * Paint the home-screen / favicon / PWA icons from the game's own die art.
 *
 *   node tools/render-app-icon.mjs
 *
 * Bundles tools/app-icon-draw.ts (which calls paintHelpFace + faceSpec(1)
 * on a d4) and runs it in Chromium so the numeral font and canvas path
 * match How to Play. Writes the PNGs the site serves; commit the result.
 */

import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const buildDir = resolve(root, ".iconbuild");
const bundlePath = resolve(buildDir, "app-icon-draw.js");

await mkdir(buildDir, { recursive: true });

await build({
  entryPoints: [resolve(here, "app-icon-draw.ts")],
  bundle: true,
  format: "iife",
  globalName: "AppIcon",
  platform: "browser",
  target: "es2022",
  outfile: bundlePath,
  logLevel: "warning",
  alias: { "@": root },
});

const numeralWoff = await readFile(resolve(root, "public/fonts/archivoblack-latin-900-normal.woff2"));
const displayWoff = await readFile(resolve(root, "public/fonts/oxanium-latin-800-normal.woff2"));
const labelWoff = await readFile(resolve(root, "public/fonts/inter-latin-600-normal.woff2"));
const drawJs = await readFile(bundlePath, "utf8");

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: "Archivo Black";
    src: url("data:font/woff2;base64,${numeralWoff.toString("base64")}") format("woff2");
    font-weight: 900;
    font-style: normal;
  }
  @font-face {
    font-family: "Oxanium";
    src: url("data:font/woff2;base64,${displayWoff.toString("base64")}") format("woff2");
    font-weight: 800;
    font-style: normal;
  }
  @font-face {
    font-family: "Inter";
    src: url("data:font/woff2;base64,${labelWoff.toString("base64")}") format("woff2");
    font-weight: 600;
    font-style: normal;
  }
  html, body { margin: 0; background: #04060d; }
  #preview {
    position: relative;
    width: 960px;
    height: 540px;
    background: #04060d;
  }
  #preview canvas { display: block; }
  #preview .label {
    position: absolute;
    top: 462px;
    width: 360px;
    text-align: center;
    color: #f4f1e8;
    font: 600 22px Inter, system-ui, sans-serif;
  }
  #preview .ship { left: 80px; }
  #preview .phone { left: 520px; }
</style>
<canvas id="c"></canvas>
<div id="preview">
  <canvas id="preview-art" width="960" height="540"></canvas>
  <div class="label ship">What we ship</div>
  <div class="label phone">On an iPhone</div>
</div>
<script>${drawJs}</script>
<script>
  window.renderIcon = async function renderIcon(size) {
    await document.fonts.load("900 64px \\"Archivo Black\\"");
    await document.fonts.load("800 64px Oxanium");
    await document.fonts.ready;
    const canvas = document.getElementById("c");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    AppIcon.drawAppIcon(ctx, size, "\\"Archivo Black\\", \\"Arial Black\\", sans-serif", "Oxanium, sans-serif");
    return canvas.toDataURL("image/png");
  };
  window.paintPreview = async function paintPreview() {
    await document.fonts.load("900 64px \\"Archivo Black\\"");
    await document.fonts.load("600 22px Inter");
    await document.fonts.ready;
    const canvas = document.getElementById("preview-art");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#04060d";
    ctx.fillRect(0, 0, 960, 540);

    const tile = 360;
    const tmp = document.createElement("canvas");
    tmp.width = tile;
    tmp.height = tile;
    const tctx = tmp.getContext("2d");
    AppIcon.drawAppIcon(tctx, tile, "\\"Archivo Black\\", \\"Arial Black\\", sans-serif", "Oxanium, sans-serif");

    const left = 80;
    const top = 90;
    ctx.drawImage(tmp, left, top, tile, tile);

    const right = 520;
    const radius = tile * 0.2237;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(right, top, tile, tile, radius);
    ctx.clip();
    ctx.drawImage(tmp, right, top, tile, tile);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(right, top, tile, tile, radius);
    ctx.stroke();
  };
</script>`;

function fromDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(",");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

/** ICO that wraps a 32×32 PNG — enough for the tab favicon. */
function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  page.on("pageerror", (error) => {
    console.error(error);
  });
  await page.setContent(html, { waitUntil: "load" });

  const png = async (size) => fromDataUrl(await page.evaluate((n) => window.renderIcon(n), size));

  const icon512 = await png(512);
  const icon192 = await png(192);
  const icon180 = await png(180);
  const icon32 = await png(32);
  await page.evaluate(() => window.paintPreview());
  const preview = await page.locator("#preview").screenshot({ type: "png" });

  await mkdir(resolve(root, "public/icons"), { recursive: true });
  await mkdir(resolve(root, "docs"), { recursive: true });
  await mkdir(resolve(root, "app"), { recursive: true });

  await writeFile(resolve(root, "public/icons/icon-512.png"), icon512);
  await writeFile(resolve(root, "public/icons/icon-192.png"), icon192);
  await writeFile(resolve(root, "public/apple-touch-icon.png"), icon180);
  await copyFile(resolve(root, "public/apple-touch-icon.png"), resolve(root, "public/apple-touch-icon-precomposed.png"));
  await writeFile(resolve(root, "app/apple-icon.png"), icon180);
  await writeFile(resolve(root, "app/icon.png"), icon192);
  await writeFile(resolve(root, "app/favicon.ico"), pngToIco(icon32));
  await writeFile(resolve(root, "docs/app-icon-preview.png"), preview);

  console.log("wrote");
  console.log("  public/icons/icon-512.png");
  console.log("  public/icons/icon-192.png");
  console.log("  public/apple-touch-icon.png");
  console.log("  public/apple-touch-icon-precomposed.png");
  console.log("  app/apple-icon.png");
  console.log("  app/icon.png");
  console.log("  app/favicon.ico");
  console.log("  docs/app-icon-preview.png");
} finally {
  await browser.close();
}
