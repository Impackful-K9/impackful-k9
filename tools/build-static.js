#!/usr/bin/env node
/* ============================================================================
   Static site generator for Impackful K9  (vanilla Node, no dependencies)

   Why this exists: the site was a single index.html that fetched page
   fragments with JS, so sub-routes 404'd on a cold request and metadata was
   only set after the app ran. This script PRE-RENDERS one standalone HTML
   file per route, each with its own <title>/description/canonical and its
   real content already in the served body (non-empty with JS off).

   Single source of truth: the content still lives in sections/*.html. Run
   this script to regenerate the route files. Vercel just serves the output —
   there is no build step at deploy time.

     node tools/build-static.js

   To add a route: add an entry to ROUTES. To add a redirect: add to REDIRECTS.
   To stop indexing a route: set index:false (drops it from the sitemap and
   adds <meta name="robots" content="noindex">).
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SECTIONS = path.join(ROOT, 'sections');
const CANON = 'https://www.impackfulk9.com'; // canonical host (no trailing slash)
const GA_ID = 'G-V0L3D8C6TW';
const OG_IMAGE = CANON + '/images/hero.webp';

// ── Route table ──────────────────────────────────────────────────────────
// path: served URL (NO trailing slash; '/' for home — see TRAILING SLASH note)
// file: the route's HTML lives at <path>/index.html (or index.html for '/')
// section: the sections/*.html fragment that holds this page's content
// pageId: the id used inside the fragment (page-<pageId>) and by in-app links
const ROUTES = [
  { pageId: 'hero',       path: '/',                section: 'page-hero.html',       home: true,
    title: 'Dog Training in Metro Vancouver | Impackful K9',
    description: 'Calm, confident dogs through real-world training across Metro Vancouver. Private programs for reactivity, recall, leash manners and puppies.',
    index: true },
  { pageId: 'philosophy', path: '/about',           section: 'page-philosophy.html',
    title: 'About Jenn — Dog Trainer, Metro Vancouver | Impackful K9',
    description: 'Meet Jenn, the trainer behind Impackful K9. Real-world methods for real-world dogs, serving Metro Vancouver.',
    index: true },
  { pageId: 'programs',   path: '/programs',         section: 'page-programs.html',
    title: 'Training Programs & Packages | Impackful K9',
    description: 'Private training packages for reactivity, off-leash recall, loose-leash walking and puppy foundations. Serving Metro Vancouver.',
    index: true },
  { pageId: 'library',    path: '/online-programs',  section: 'page-library.html',
    title: 'Online Dog Training Courses | Impackful K9',
    description: "Can't make it in person? Online courses and resources you can work through from home.",
    index: true },
  { pageId: 'community',  path: '/community',        section: 'page-community.html',
    title: 'Community & Mindful Meetups | Impackful K9',
    description: 'Join the Impackful K9 community — mindful meetups and real-world group training across Metro Vancouver.',
    index: true },
  { pageId: 'journey',    path: '/journey',          section: 'page-journey.html',    journey: true,
    title: 'Find Your Training Path | Impackful K9',
    description: 'Answer a few questions about your dog and get a personalized Impackful K9 training recommendation.',
    index: true },
  { pageId: 'contact',    path: '/contact',          section: 'page-contact.html',
    title: 'Book a Session | Impackful K9',
    description: "Now accepting new clients into our private training programs. Tell us about your dog and we'll be in touch.",
    index: true },
];

// ── Redirects (301). Easy to extend: add { from, to } rows. ────────────────
// The old Wix site served /, /about, /gallery, /online-programs, /contact.
// Only /gallery changed path (it was the programs page). The rest are identical
// paths and need no redirect. Add any new Wix "URL Redirect Manager" entries here.
const REDIRECTS = [
  { from: '/gallery', to: '/programs' },
];

// ── TRAILING SLASH ─────────────────────────────────────────────────────────
// Chosen form: NO trailing slash (e.g. /contact, not /contact/). Canonical
// tags, sitemap entries and internal links all use this form; vercel.json sets
// trailingSlash:false so /contact/ 301s to /contact.
const pathById = Object.fromEntries(ROUTES.map(r => [r.pageId, r.path]));

function read(file) { return fs.readFileSync(path.join(SECTIONS, file), 'utf8'); }

// ── Image optimization: WebP refs, <img> attrs, lazy CSS backgrounds ───────
// image-manifest.json (written by tools/optimize-images.js) maps each original
// reference to its WebP path + output dimensions.
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));
const REF2WEBP = {};                                   // /images/x.png -> /images/x.webp
const DIMS = { '/images/logo.png': { w: 149, h: 152 }, '/images/green-logo.png': { w: 149, h: 152 } };
for (const [orig, info] of Object.entries(MANIFEST)) { REF2WEBP[orig] = info.webp; DIMS[info.webp] = { w: info.w, h: info.h }; }

// Meaningful alt text, keyed by original ref (mapped onto the WebP src below).
const ALT = {
  '/images/logo.png': 'Impackful K9 logo', '/images/green-logo.png': 'Impackful K9 logo',
  '/images/hero.png': 'A dog and its owner together on a forest trail',
  '/images/mobile-hero.PNG': 'A dog and its owner together on a forest trail',
  '/images/image9.png': 'A relaxed dog spending time outdoors with its owner',
  '/images/image22.png': 'A calm, focused dog during real-world training',
  '/images/library-hero.png': 'A dog owner following an online training lesson at home',
  '/images/beach/community-1.png': 'A dog and its owner enjoying the beach together',
  '/images/landscapes/contact-1.png': 'A trainer working with a dog outdoors',
  '/images/jenn/contact-1.png': "Jenn, Impackful K9's trainer, with a dog",
  '/images/jenn/program-1.png': 'Jenn working with a dog at an Impackful K9 event',
};
const ALT_BY_SRC = {};
for (const [orig, alt] of Object.entries(ALT)) ALT_BY_SRC[REF2WEBP[orig] || orig] = alt;
// Always-eager (above the fold): nav logos + the home hero.
const EAGER = new Set(['/images/logo.png', '/images/green-logo.png', REF2WEBP['/images/hero.png'], REF2WEBP['/images/mobile-hero.PNG']]);
const LOGOS = new Set(['/images/logo.png', '/images/green-logo.png']);

function webpRewrite(html) {
  for (const [orig, webp] of Object.entries(REF2WEBP)) if (html.indexOf(orig) !== -1) html = html.split(orig).join(webp);
  return html;
}
function addAttr(tag, name, value) {
  if (new RegExp('\\s' + name + '=').test(tag)) return tag;
  return tag.replace(/\s*\/?>$/, m => ' ' + name + '="' + value + '"' + m);
}
function processImgs(html) {
  let firstContentImgSeen = false;
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const sm = tag.match(/\ssrc="([^"]+)"/); if (!sm) return tag;
    const src = sm[1];
    if (ALT_BY_SRC[src]) tag = /\salt="/.test(tag) ? tag.replace(/\salt="[^"]*"/, ' alt="' + ALT_BY_SRC[src] + '"') : addAttr(tag, 'alt', ALT_BY_SRC[src]);
    else if (!/\salt="/.test(tag)) tag = addAttr(tag, 'alt', '');
    const d = DIMS[src]; if (d) { tag = addAttr(tag, 'width', d.w); tag = addAttr(tag, 'height', d.h); }
    // eager: logos, the home hero, and the first content image on the page
    // (its above-the-fold hero). Everything else lazy-loads.
    let eager = EAGER.has(src);
    if (!eager && !LOGOS.has(src) && !firstContentImgSeen) { eager = true; firstContentImgSeen = true; }
    if (!eager) tag = addAttr(tag, 'loading', 'lazy');
    return tag;
  });
}
// For heavy routes: defer CSS background-images to an IntersectionObserver
// (app.js) by moving the url into data-bg. These load as tiles near the viewport.
function bgLazy(html) {
  return html.replace(/style="([^"]*background-image[^"]*)"/g, (m, style) => {
    const um = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)\s*;?/);
    if (!um) return m;
    let rest = style.replace(/background-image:\s*url\(['"]?[^'")]+['"]?\)\s*;?/, '').replace(/;\s*;/g, ';').trim().replace(/^;|;$/g, '').trim();
    return 'data-bg="' + um[1] + '"' + (rest ? ' style="' + rest + '"' : '');
  });
}
function optimizeImages(html, route) {
  html = webpRewrite(html);
  html = processImgs(html);
  if (route.pageId === 'community' || route.pageId === 'journey') html = bgLazy(html);
  return html;
}

// Rewrite in-app navigation (href="#" + onclick="navigateTo(...)", and nav
// links keyed by data-page) into REAL hrefs, so links work with JS off and are
// crawlable. app.js still intercepts clicks for the client-side swap.
function rewriteLinks(html) {
  // href="#" ... onclick="navigateTo('id'); return false;"  (either order)
  html = html.replace(
    /href="#"((?:(?!href=)[^>])*?)\sonclick="navigateTo\('([a-z]+)'\);\s*return false;"/g,
    (m, mid, id) => `href="${pathById[id] || '#'}"${mid}`);
  html = html.replace(
    /onclick="navigateTo\('([a-z]+)'\);\s*return false;"((?:(?!href=)[^>])*?)\shref="#"/g,
    (m, id, mid) => `href="${pathById[id] || '#'}"${mid}`);
  // navigateToSection('page','section')  ->  /path#section
  html = html.replace(
    /href="#"((?:(?!href=)[^>])*?)\sonclick="navigateToSection\('([a-z]+)',\s*'([^']+)'\);\s*return false;"/g,
    (m, mid, id, sec) => `href="${(pathById[id] || '#')}#${sec}"${mid}`);
  // nav links carrying data-page but still href="#"
  html = html.replace(
    /href="#"([^>]*?\bdata-page="([a-z]+)")/g,
    (m, rest, id) => `href="${pathById[id] || '#'}"${rest}`);
  return html;
}

// Pull the <style>…</style> and the page <div> out of a fragment, force the
// page div active (so it is visible with JS off), and append the footer inside
// it so the footer scrolls with the page.
function pageBlock(route, footerHtml) {
  let frag = read(route.section);
  // ensure the route's page div is active
  frag = frag.replace(
    new RegExp(`(<div class="page)("?\\s+id="page-${route.pageId}")`),
    (m, a, b) => /active/.test(m) ? m : `${a} active${b}`);
  // The journey deck is display:none until JS adds .journey-active; mark it
  // active in the served HTML so /journey is not blank with JS off.
  if (route.journey) frag = frag.replace('<div id="page-journey">', '<div id="page-journey" class="journey-active">');
  // also handles class="page active" already present (hero) — unchanged
  // append footer just before the fragment's final </div>
  const lastClose = frag.lastIndexOf('</div>');
  if (lastClose !== -1) {
    frag = frag.slice(0, lastClose) + footerHtml + '\n' + frag.slice(lastClose);
  } else {
    frag += footerHtml;
  }
  return rewriteLinks(frag);
}

function head(route) {
  const url = CANON + route.path;
  const robots = route.index ? '' : '\n  <meta name="robots" content="noindex,follow">';
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${route.title}</title>
  <meta name="description" content="${route.description}">
  <link rel="canonical" href="${url}">${robots}

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Impackful K9">
  <meta property="og:title" content="${route.title}">
  <meta property="og:description" content="${route.description}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">

  <!-- Google Analytics (GA4). send_page_view:false — app.js fires one
       page_view per route change (initial load included). -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}', { send_page_view: false });
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="stylesheet" href="/css/journey.css">
</head>`;
}

function buildPage(route) {
  const nav = rewriteLinks(read('nav.html'));
  const footer = rewriteLinks(read('footer.html'));
  const content = pageBlock(route, footer);

  // Home keeps the intro + crossroads, but as a JS-only overlay: the markup is
  // `hidden` in the served HTML so content shows with JS off; app.js reveals
  // and plays it. (Content renders, intro overlays — never a gate.)
  let introMarkup = '';
  if (route.home) {
    const parts = ['light-burst.html', 'intro-overlay.html', 'crossroads.html', 'coming-soon.html'];
    introMarkup = parts.map(f => `<div class="intro-layer" hidden>${rewriteLinks(read(f))}</div>`).join('\n  ') + '\n  ';
  }

  // Journey is the interactive quiz; its page lives outside the snap container
  // and needs journey.js + GSAP. We load it and app.js opens it on this route.
  const journeyScript = route.journey ? `\n  <script src="/js/journey.js"></script>` : '';

  const bodyFlags = `data-route="${route.pageId}"${route.home ? ' data-home="true"' : ''}${route.journey ? ' data-journey="true"' : ''}`;

  const page = `${head(route)}
<body ${bodyFlags}>
  ${introMarkup}<div id="main-site" class="visible">
    ${nav}
    <div class="snap-container" id="snap-container">
      ${content}
    </div>
  </div>
  <script src="/js/app.js"></script>${journeyScript}
</body>
</html>
`;
  return optimizeImages(page, route);
}

// ── Write route files ──────────────────────────────────────────────────────
let written = [];
for (const route of ROUTES) {
  const outDir = route.path === '/' ? ROOT : path.join(ROOT, route.path.replace(/^\//, ''));
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'index.html');
  fs.writeFileSync(outFile, buildPage(route));
  written.push(path.relative(ROOT, outFile));
}

// ── sitemap.xml (indexed routes only) ──────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.filter(r => r.index).map(r => `  <url>
    <loc>${CANON}${r.path}</loc>
    <lastmod>${today}</lastmod>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
written.push('sitemap.xml');

// ── robots.txt ─────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${CANON}/sitemap.xml\n`);
written.push('robots.txt');

// ── vercel.json (no catch-all rewrite now — real files exist; keep 301s) ────
const vercel = {
  trailingSlash: false,
  cleanUrls: true,
  redirects: REDIRECTS.map(r => ({ source: r.from, destination: r.to, permanent: true })),
};
fs.writeFileSync(path.join(ROOT, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n');
written.push('vercel.json');

console.log('Generated:\n' + written.map(f => '  ' + f).join('\n'));
