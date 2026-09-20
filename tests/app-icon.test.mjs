/**
 * The home-screen icon is the game's own d4 showing 1, not a letter F.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function pngSize(buf) {
  assert.equal(buf.toString("ascii", 1, 4), "PNG", "file is not a PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("the icon is painted with the same help face as How to Play", () => {
  const src = readFileSync(resolve(root, "tools/app-icon-draw.ts"), "utf8");
  assert.match(src, /paintHelpFace/);
  assert.match(src, /faceSpec\(1\)/);
  assert.match(src, /addHullPath\(ctx, 4/);
  assert.match(src, /#04060d/);
  assert.doesNotMatch(src, /Math\.random/);
});

test("iOS and PWA icons are the lightning-bolt d4 at the sizes phones ask for", () => {
  const files = [
    ["public/apple-touch-icon.png", 180],
    ["public/apple-touch-icon-precomposed.png", 180],
    ["app/apple-icon.png", 180],
    ["app/icon.png", 192],
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
    ["docs/app-icon-preview.png", 960],
  ];
  for (const [rel, size] of files) {
    const path = resolve(root, rel);
    assert.ok(existsSync(path), `${rel} is missing`);
    const { width, height } = pngSize(readFileSync(path));
    assert.equal(width, size, `${rel} width`);
    assert.equal(height, rel.endsWith("preview.png") ? 540 : size, `${rel} height`);
  }
  assert.ok(existsSync(resolve(root, "app/favicon.ico")), "app/favicon.ico is missing");
});

test("layout and manifest point at the die, not a generated letter", () => {
  const layout = readFileSync(resolve(root, "app/layout.tsx"), "utf8");
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(layout, /icon-192\.png/);
  assert.match(layout, /icon-512\.png/);
  assert.match(layout, /manifest\.webmanifest/);

  const manifest = readFileSync(resolve(root, "app/manifest.ts"), "utf8");
  assert.match(manifest, /icon-192\.png/);
  assert.match(manifest, /icon-512\.png/);
  assert.match(manifest, /#04060d/);
  assert.match(manifest, /force-static/, "static export needs a static manifest");
});

test("the playtest-screenshot ignore still keeps the icon preview", () => {
  const ignore = readFileSync(resolve(root, ".gitignore"), "utf8");
  assert.match(ignore, /^docs\/\*\.png$/m);
  assert.match(ignore, /^!docs\/app-icon-preview\.png$/m);
});
