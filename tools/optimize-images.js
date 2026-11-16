#!/usr/bin/env node
/* ============================================================================
   Image optimizer for Impackful K9  (sharp; dev dependency, no deploy build)

   Photographs were shipped as multi-MB PNGs at print resolution. This script
   converts every REFERENCED photo to WebP (q80) at a width CEILING per tier —
   never upscaling — and moves the originals (plus all UNUSED photos) into
   images/_originals/ so they stay in git but are not deployed (.vercelignore).
   Logos/icons keep PNG (transparency). Writes tools/image-manifest.json with
   output dimensions for the generator (explicit width/height on <img>).

     node tools/optimize-images.js     # re-runnable from _originals/

   Width ceilings (never enlarge):
     1920  hero / full-bleed backgrounds
     1080  mobile-hero
     1000  content & card images (default)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const IMAGES = path.join(ROOT, 'images');
const ORIG = path.join(IMAGES, '_originals');

const KEEP_PNG = new Set(['logo.png', 'green-logo.png']); // transparency → stay PNG
const FULLBLEED = new Set(['hero.png', 'crossroads-bg.png', 'cta-bg.png']); // 1920
const WIDTH_1080 = new Set(['mobile-hero.png']); // explicit per spec

function tierWidth(baseLower) {
  if (FULLBLEED.has(baseLower)) return 1920;
  if (WIDTH_1080.has(baseLower)) return 1080;
  return 1000; // content/card default
}

// ── referenced images (scan the content fragments the generator inlines) ──
function referenced() {
  const files = fs.readdirSync(path.join(ROOT, 'sections')).filter(f => f.endsWith('.html'));
  const re = /(?:src\s*=\s*|url\(\s*)["']?(\/?images\/[^"')\s]+\.(?:png|jpe?g|PNG|JPE?G))/g;
  const set = new Set();
  for (const f of files) {
    const txt = fs.readFileSync(path.join(ROOT, 'sections', f), 'utf8');
    let m; while ((m = re.exec(txt))) set.add(m[1].replace(/^\//, ''));
  }
  return [...set];
}

function moveToOriginals(relFromImages) { // relFromImages e.g. "landscapes/x.png"
  const src = path.join(IMAGES, relFromImages);
  const dest = path.join(ORIG, relFromImages);
  if (fs.existsSync(dest)) return dest;          // already moved (re-run)
  if (!fs.existsSync(src)) return null;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(src, dest);
  return dest;
}

async function run() {
  const refs = referenced();
  const manifest = {};
  let before = 0, after = 0, converted = 0, missing = [];

  for (const ref of refs) {                       // ref like "images/foo.png"
    const rel = ref.replace(/^images\//, '');     // "foo.png" or "sub/foo.png"
    const base = path.basename(rel).toLowerCase();
    if (KEEP_PNG.has(base)) continue;             // logos stay as-is

    const origPath = moveToOriginals(rel);
    if (!origPath) { missing.push(ref); continue; }

    const outRel = rel.replace(/\.(png|jpe?g)$/i, '.webp');
    const outPath = path.join(IMAGES, outRel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const w = tierWidth(base);
    const info = await sharp(origPath)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outPath);

    const b = fs.statSync(origPath).size, a = info.size;
    before += b; after += a; converted++;
    manifest['/' + ref] = { webp: '/images/' + outRel, w: info.width, h: info.height };
    console.log(`  ${(b/1024).toFixed(0).padStart(6)}K -> ${(a/1024).toFixed(0).padStart(5)}K  ${info.width}x${info.height}  ${outRel}`);
  }

  // Phase 2: move UNUSED photos (any remaining raster original under images/,
  // excluding _originals, the kept logos, and generated .webp) into _originals.
  let movedUnused = 0, unusedBytes = 0;
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (p === ORIG) continue;
      const st = fs.statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (!/\.(png|jpe?g)$/i.test(name)) continue;
      if (KEEP_PNG.has(name.toLowerCase())) continue;
      const rel = path.relative(IMAGES, p);
      unusedBytes += st.size; movedUnused++;
      moveToOriginals(rel);
    }
  };
  walk(IMAGES);

  fs.writeFileSync(path.join(ROOT, 'tools', 'image-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\nConverted ${converted} referenced photos: ${(before/1024/1024).toFixed(1)} MB -> ${(after/1024/1024).toFixed(2)} MB`);
  console.log(`Moved ${movedUnused} unused photos (${(unusedBytes/1024/1024).toFixed(1)} MB) to images/_originals/`);
  if (missing.length) console.log('Missing (referenced but absent): ' + missing.join(', '));
  console.log('Manifest: tools/image-manifest.json');
}
run().catch(e => { console.error(e); process.exit(1); });
