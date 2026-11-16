/* ============================================================================
   Impackful K9 — client runtime for the pre-rendered static routes.

   Each route is now its own standalone HTML file (see tools/build-static.js):
   the content + metadata are already in the served HTML. This script adds the
   interactive layer on top, works on ANY single route (everything is guarded,
   unlike the old main.js which assumed the whole site was in one document),
   and turns internal links into client-side fetch-swaps so in-app navigation
   stays instant — updating <title>/meta and firing a GA4 page_view each time.
   ========================================================================== */
(function () {
  'use strict';

  // pageId <-> path. Keep in sync with ROUTES in tools/build-static.js.
  var PATHS = { hero: '/', philosophy: '/about', programs: '/programs', library: '/online-programs', community: '/community', journey: '/journey', contact: '/contact' };
  var PATH_TO_ID = {}; Object.keys(PATHS).forEach(function (id) { PATH_TO_ID[PATHS[id]] = id; });

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  // ── GA4: one page_view per route, with the page's real title ──────────────
  function trackPageView() {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', { page_title: document.title, page_location: location.href, page_path: location.pathname });
  }

  // ── Theme toggle (guards hero elements that only exist on the home page) ──
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('ik9-theme', theme); } catch (e) {}
    var heroBg = $('#hero .hero-bg'), heroEl = $('#hero');
    if (heroBg) { ['grad-cedar', 'grad-bark', 'grad-seaglass', 'grad-mist', 'grad-drift'].forEach(function (c) { heroBg.classList.remove(c); }); heroBg.classList.add(theme === 'light' ? 'grad-mist' : 'grad-cedar'); }
    if (heroEl) heroEl.classList.toggle('hero-light', theme === 'light');
    var moon = $('#icon-moon'), sun = $('#icon-sun'), btn = $('#theme-toggle');
    if (moon) moon.style.display = theme === 'dark' ? 'none' : 'block';
    if (sun) sun.style.display = theme === 'light' ? 'none' : 'block';
    if (btn) { btn.style.color = theme === 'light' ? 'var(--deep-cedar)' : 'var(--mist-white)'; btn.style.borderColor = theme === 'light' ? 'rgba(45,58,46,0.35)' : 'rgba(184,212,206,0.5)'; }
  }
  function initTheme() {
    var btn = $('#theme-toggle');
    if (btn && !btn._bound) { btn._bound = true; btn.addEventListener('click', function () { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }); }
    var saved; try { saved = localStorage.getItem('ik9-theme'); } catch (e) {}
    applyTheme(saved || 'light');
  }

  // ── Mobile nav (nav persists across swaps, so bind once) ──────────────────
  function initNavToggle() {
    var nav = $('#nav'), toggle = $('#nav-toggle');
    if (!nav || !toggle || toggle._bound) return;
    toggle._bound = true;
    function setOpen(open) { nav.classList.toggle('menu-open', open); toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); }
    toggle.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!nav.classList.contains('menu-open')); });
    document.addEventListener('click', function (e) { if (nav.classList.contains('menu-open') && !nav.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    nav._setOpen = setOpen;
  }

  // ── Nav active state + sliding underline ──────────────────────────────────
  function moveIndicator(el) {
    var navList = $('.nav-links'); if (!navList || !el) return;
    var lr = navList.getBoundingClientRect(), er = el.getBoundingClientRect();
    navList.style.setProperty('--ind-left', (er.left - lr.left) + 'px');
    navList.style.setProperty('--ind-width', er.width + 'px');
    navList.classList.add('indicator-ready');
  }
  function updateNavActive(routeId) {
    var navList = $('.nav-links'); if (!navList) return;
    $all('a[data-page]', navList).forEach(function (a) { a.classList.toggle('active', a.dataset.page === routeId); });
    var active = navList.querySelector('a.active');
    if (active) requestAnimationFrame(function () { moveIndicator(active); });
    if (!navList._hover) { navList._hover = true; $all('a', navList).forEach(function (l) { l.addEventListener('mouseenter', function () { moveIndicator(l); }); }); navList.addEventListener('mouseleave', function () { var a = navList.querySelector('a.active'); if (a) moveIndicator(a); }); }
  }

  // ── Scroll reveal (re-run for each swapped-in page) ───────────────────────
  function initReveal(root) {
    var els = $all('[data-scroll]', root);
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('revealed'); }); return; }
    var obs = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('revealed'); obs.unobserve(en.target); } }); }, { threshold: 0.15 });
    els.forEach(function (el) { if (!el.classList.contains('revealed')) obs.observe(el); });
  }

  // ── Stat counter ──────────────────────────────────────────────────────────
  function initStatCounter(root) {
    var el = $('.about-stat-num[data-count]', root); if (!el || el._done) return; el._done = true;
    var start = parseInt(el.getAttribute('data-start') || '2000', 10), end = parseInt(el.getAttribute('data-end') || '3000', 10), cur = start;
    el.textContent = cur.toLocaleString() + '+';
    var obs = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) { var t = setInterval(function () { cur += 1; if (cur >= end) { cur = end; clearInterval(t); } el.textContent = cur.toLocaleString() + '+'; }, 100); obs.disconnect(); } }); }, { threshold: 0.5 });
    obs.observe(el);
  }

  // ── Hero reveal animation (home) ──────────────────────────────────────────
  var heroAnimated = false;
  function triggerHeroAnimations() {
    if (heroAnimated || !$('#h-eyebrow')) return; heroAnimated = true;
    [['#h-eyebrow', 100], ['#h-headline', 300], ['#h-sub', 600], ['#h-cta', 900]].forEach(function (p) { setTimeout(function () { var e = $(p[0]); if (e) e.classList.add('revealed'); }, p[1]); });
  }

  // ── Contact form → Web3Forms (ported verbatim; inline onsubmit calls it) ──
  window.handleContact = function (e) {
    e.preventDefault();
    var form = e.target;
    var btn = form.querySelector('.contact-submit');
    var status = form.querySelector('#contact-status');
    var consent = form.querySelector('#consent-check');
    var consentBox = form.querySelector('#consent-box');
    var firstInvalid = null;
    form.querySelectorAll('input[required], select[required], textarea[required]').forEach(function (el) {
      if (el === consent) return;
      var empty = !String(el.value).trim();
      el.classList.toggle('field-invalid', empty);
      if (empty && !firstInvalid) firstInvalid = el;
    });
    var needConsent = !!(consent && !consent.checked);
    if (consentBox) consentBox.classList.toggle('field-invalid', needConsent);
    if (needConsent && !firstInvalid) firstInvalid = consent;
    if (firstInvalid) {
      window.setContactStatus(status, needConsent ? 'Please fill in every required field and tick the consent box.' : 'Please fill in every required field.', true);
      if (typeof firstInvalid.focus === 'function') firstInvalid.focus();
      return;
    }
    var original = btn ? btn.textContent : 'Send Message';
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    window.setContactStatus(status, '', false, true);
    fetch('https://api.web3forms.com/submit', { method: 'POST', body: new FormData(form) })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.success) throw new Error((data && data.message) || 'Submission failed');
        if (btn) { btn.textContent = 'Sent ✓'; btn.style.background = '#5B6B4A'; btn.style.color = '#F0EDE8'; }
        window.setContactStatus(status, 'Thank you — your message is on its way. Jenn will be in touch soon.', false);
        form.reset();
        if (consentBox) consentBox.classList.remove('checked');
        form.querySelectorAll('.field-invalid').forEach(function (el) { el.classList.remove('field-invalid'); });
      })
      .catch(function (err) {
        if (window.console) console.error('[Impackful K9] contact send failed', err);
        if (btn) { btn.disabled = false; btn.textContent = original; }
        window.setContactStatus(status, 'Sorry — something went wrong. Please email info@impackfulk9.com or try again in a moment.', true);
      });
  };
  window.setContactStatus = function (el, msg, isError, hide) {
    if (!el) return;
    if (hide) { el.hidden = true; return; }
    el.textContent = msg; el.hidden = false;
    el.style.color = isError ? '#b23b3b' : 'var(--sea-glass)';
  };
  window.handleServiceChange = function (select) { void select; };
  function initConsent(root) {
    var row = $('#consent-row', root), box = $('#consent-box', root), chk = $('#consent-check', root);
    if (!row || row._bound) return; row._bound = true;
    row.addEventListener('click', function () { var c = box.classList.toggle('checked'); if (chk) chk.checked = c; });
  }

  // ── Per-page init (runs on cold load AND after every swap) ────────────────
  function initPage(routeId) {
    var root = $('#snap-container') || document;
    initReveal(root);
    initStatCounter(root);
    initConsent(root);
    updateNavActive(routeId);
    if (routeId === 'hero') triggerHeroAnimations();
    var sc = $('#snap-container');
    if (sc && !sc._bound) { sc._bound = true; sc.addEventListener('scroll', function () { var nav = $('#nav'); if (nav) nav.classList.toggle('scrolled', sc.scrollTop > 80); }); }
  }

  // ── Client-side router (fetch-swap) ───────────────────────────────────────
  var swapping = false;
  function go(pathname, after) {
    var hash = (pathname.match(/#(.*)$/) || [])[1];
    pathname = pathname.replace(/#.*$/, '');
    if (PATH_TO_ID[pathname] === undefined) { location.href = pathname; return; }
    if (pathname === location.pathname) { if (hash) scrollToHash(hash); if (after) after(); return; }
    // Journey is a GSAP-heavy immersive route — hard-navigate for a clean init.
    if (pathname === '/journey' || document.body.getAttribute('data-journey') === 'true') { location.href = pathname + (hash ? '#' + hash : ''); return; }
    if (swapping) return; swapping = true;
    fetch(pathname).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newPage = doc.querySelector('#snap-container .page'), cur = $('#snap-container .page');
        if (!newPage || !cur) { location.href = pathname; return; }
        cur.parentNode.replaceChild(document.importNode(newPage, true), cur);
        document.title = doc.title; syncHead(doc);
        history.pushState({ path: pathname }, '', pathname);
        var sc = $('#snap-container'); if (sc) sc.scrollTop = 0;
        var nav = $('#nav'); if (nav && nav._setOpen) nav._setOpen(false);
        initPage(PATH_TO_ID[pathname]);
        trackPageView();
        if (hash) scrollToHash(hash);
        if (after) after();
      })
      .catch(function () { location.href = pathname; })
      .then(function () { swapping = false; });
  }
  function scrollToHash(h) { var el = document.getElementById(h); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
  function syncHead(doc) {
    [['meta[name="description"]', 'content'], ['link[rel="canonical"]', 'href'], ['meta[name="robots"]', 'content'],
     ['meta[property="og:title"]', 'content'], ['meta[property="og:description"]', 'content'], ['meta[property="og:url"]', 'content']]
      .forEach(function (p) { var src = doc.querySelector(p[0]), dst = document.querySelector(p[0]); if (src && !dst) { dst = document.createElement(p[0].indexOf('link') === 0 ? 'link' : 'meta'); document.head.appendChild(dst); if (p[0].indexOf('link') === 0) dst.setAttribute('rel', 'canonical'); else dst.setAttribute(p[0].indexOf('property') > -1 ? 'property' : 'name', src.getAttribute(p[0].indexOf('property') > -1 ? 'property' : 'name')); } if (src && dst) dst.setAttribute(p[1], src.getAttribute(p[1])); });
  }
  // Legacy global hooks still used by a few inline handlers.
  window.navigateTo = function (pageId) { go(PATHS[pageId] || '/'); };
  window.navigateToSection = function (pageId, sectionId) { go((PATHS[pageId] || '/') + '#' + sectionId); };

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null; if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) !== '/') return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (PATH_TO_ID[href.replace(/#.*$/, '')] === undefined) return;
    e.preventDefault(); go(href);
  });
  window.addEventListener('popstate', function () {
    if (PATH_TO_ID[location.pathname] === undefined) { location.reload(); return; }
    swapping = false;
    fetch(location.pathname).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var newPage = doc.querySelector('#snap-container .page'), cur = $('#snap-container .page');
      if (newPage && cur) { cur.parentNode.replaceChild(document.importNode(newPage, true), cur); document.title = doc.title; syncHead(doc); initPage(PATH_TO_ID[location.pathname]); trackPageView(); }
      else location.reload();
    }).catch(function () { location.reload(); });
  });

  // ── Home intro + crossroads (JS-only overlay over already-visible content) ─
  var transitionDone = false;
  function showCrossroads() {
    var cr = $('#crossroads'); if (!cr) return;
    cr.classList.add('visible');
    setTimeout(function () {
      ['.crossroads-eyebrow', '.crossroads-heading', '.crossroads-sub', '.crossroads-paths', '.crossroads-skip'].forEach(function (s) { var el = cr.querySelector(s); if (el) el.classList.add('in'); });
    }, 60);
  }
  function triggerTransition(fromWhiteout, introVideo) {
    if (transitionDone) return; transitionDone = true;
    var burst = $('#light-burst'), intro = $('#intro-overlay');
    if (!fromWhiteout && introVideo && !isNaN(introVideo.duration)) { try { introVideo.currentTime = Math.max(introVideo.currentTime, 7.8); } catch (e) {} }
    if (intro) intro.classList.add('whiteout');
    setTimeout(function () { try { if (introVideo) introVideo.pause(); } catch (e) {} }, 60);
    if (burst) burst.classList.add('active');
    setTimeout(function () { if (intro) { intro.style.opacity = '0'; intro.style.transition = 'opacity 0.5s ease'; } }, 850);
    setTimeout(function () { if (intro) intro.style.display = 'none'; if (burst) burst.style.display = 'none'; showCrossroads(); }, 2100);
  }
  window.enterClassicMode = function () { var cr = $('#crossroads'); if (!cr) return; cr.classList.add('exiting'); setTimeout(function () { cr.style.display = 'none'; var l = $all('.intro-layer'); l.forEach(function (x) { x.setAttribute('hidden', ''); }); triggerHeroAnimations(); }, 400); };
  window.enterJourneyMode = function () { location.href = '/journey'; };
  window.hideCoomingSoon = function () { var cs = $('#coming-soon'); if (cs) cs.classList.remove('visible'); var cr = $('#crossroads'); if (cr) { cr.style.display = 'flex'; cr.classList.remove('exiting'); cr.classList.remove('visible'); setTimeout(function () { cr.classList.add('visible'); }, 20); } };
  function initIntro() {
    var layers = $all('.intro-layer'); if (!layers.length) return;
    layers.forEach(function (l) { l.removeAttribute('hidden'); });
    var intro = $('#intro-overlay'), video = $('#intro-video');
    if (!intro) { showCrossroads(); return; }
    if (video) {
      video.addEventListener('timeupdate', function () { if (!transitionDone && video.currentTime >= 7.8) triggerTransition(true, video); });
      video.addEventListener('ended', function () { if (!transitionDone) triggerTransition(true, video); });
      var p = video.play && video.play(); if (p && p.catch) p.catch(function () {});
    }
    setTimeout(function () { if (!transitionDone) triggerTransition(false, video); }, 9500);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    var routeId = document.body.getAttribute('data-route');
    initTheme();
    initNavToggle();
    initPage(routeId);
    if (document.body.getAttribute('data-home') === 'true') initIntro();
    if (document.body.getAttribute('data-journey') === 'true' && typeof window.openJourneyMode === 'function') { try { window.openJourneyMode(); } catch (e) {} }
    trackPageView(); // initial page_view, once
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
