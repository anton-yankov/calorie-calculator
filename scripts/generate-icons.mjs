// Renders the PWA/home-screen PNG icons from src/app/icon.svg.
// Rerun after changing the icon: node scripts/generate-icons.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("..", import.meta.url);
const svg = await readFile(new URL("src/app/icon.svg", root), "utf8");

// iOS and maskable Android icons get masked to a shape by the OS, so they
// need square corners and full-bleed background instead of the SVG's own
// rounded rect.
const fullBleed = svg.replace('rx="14"', 'rx="0"');

// Maskable safe zone is the central ~80% — shrink the artwork (not the
// background) so a circular mask doesn't clip the gauge.
const maskable = fullBleed
  .replace(/(<rect[^>]*\/>)/, '$1<g transform="translate(32 32) scale(0.78) translate(-32 -32)">')
  .replace("</svg>", "</g></svg>");

const jobs = [
  [svg, 192, "public/icon-192.png"],
  [svg, 512, "public/icon-512.png"],
  [maskable, 512, "public/icon-maskable-512.png"],
  [fullBleed, 180, "src/app/apple-icon.png"],
];

for (const [source, size, out] of jobs) {
  // The SVG is 64px; density scales the rasterization so we never upscale.
  await sharp(Buffer.from(source), { density: (72 * size) / 64 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(out, root)));
  console.log(`${out} (${size}x${size})`);
}
