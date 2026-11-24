/**
 * Draws the app icons from one SVG so they stay in step: the emblem panel (black, white edge, two
 * cut corners, as .shape in globals.css) around a small family-tree glyph, two ingredients joining
 * into what they build.
 *
 *   src/app/icon.svg             favicon (Next file convention)
 *   src/app/apple-icon.png       180 px, full bleed (iOS adds its own rounding)
 *   public/icons/icon-192.png    manifest, purpose "any"
 *   public/icons/icon-512.png    manifest, purpose "any"
 *   public/icons/maskable-512.png manifest, purpose "maskable": full bleed, glyph inside the safe zone
 *
 * Run with `node scripts/make-icons.mjs` after changing the drawing. sharp is a dev dependency.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BLACK = '#0c0c0e';
const WHITE = '#f3f3f5';

/** Two nodes on the left feed one node on the right, joined like the family tree's connectors. */
const GLYPH = `
  <rect x="128" y="144" width="72" height="72" fill="${WHITE}"/>
  <rect x="128" y="296" width="72" height="72" fill="${WHITE}"/>
  <path d="M200 180 H244 V332 H200 M244 256 H290" fill="none" stroke="${WHITE}" stroke-width="16" stroke-linecap="square"/>
  <polygon points="314,206 384,206 384,282 360,306 290,306 290,230" fill="${WHITE}"/>`;

/** The .shape polygon: top-left and bottom-right corners cut. */
const chamfer = (inset, cut) => {
  const a = inset;
  const b = 512 - inset;
  return `${a + cut},${a} ${b},${a} ${b},${b - cut} ${b - cut},${b} ${a},${b} ${a},${a + cut}`;
};

const EDGE = 12;
const CUT = 80;

const panelIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <polygon points="${chamfer(16, CUT)}" fill="${WHITE}"/>
  <polygon points="${chamfer(16 + EDGE, CUT - EDGE * 0.586)}" fill="${BLACK}"/>${GLYPH}
</svg>
`;

const fullBleedIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BLACK}"/>${GLYPH}
</svg>
`;

async function png(svg, size, file) {
  const out = join(root, file);
  await mkdir(dirname(out), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
  console.log(`wrote ${file}`);
}

await writeFile(join(root, 'src/app/icon.svg'), panelIcon);
console.log('wrote src/app/icon.svg');
await png(panelIcon, 192, 'public/icons/icon-192.png');
await png(panelIcon, 512, 'public/icons/icon-512.png');
await png(fullBleedIcon, 512, 'public/icons/maskable-512.png');
await png(fullBleedIcon, 180, 'src/app/apple-icon.png');
