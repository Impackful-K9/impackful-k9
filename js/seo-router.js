/* ───────────────────────────────────────────────────────────────────────────
   SEO ROUTER
   The site renders pages by toggling a `.active` class on `.page` divs
   (see navigateTo in main.js). That never touched the URL, so sub-pages had
   no address, 404'd on direct load, and shared one <title>.

   This layer sits *around* the existing navigation — it does not change how
   pages render. It:
     1. gives each page a real path and keeps <title>/description/canonical/OG
        in sync with it,
     2. pushes the URL with the History API as you navigate (and handles
        back/forward),
     3. reports a GA4 page_view per page change (initial load included, once).

   Loaded after main.js (see index.html), so navigateTo / enterClassicMode /
   enterJourneyMode already exist and can be wrapped.
   ──────────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  var SITE = 'https://www.impackfulk9.com';

  // pageId (the argument navigateTo already uses) -> URL + metadata
  var PAGES = {
    hero: {
      path: '/',
      title: 'Dog Training in Metro Vancouver | Impackful K9',
      description: 'Calm, confident dogs through real-world training across Metro Vancouver. Private programs for reactivity, recall, leash manners and puppies.'
    },
    philosophy: {
      path: '/about',
      title: 'About Jenn — Dog Trainer, Metro Vancouver | Impackful K9',
      description: 'Meet Jenn, the trainer behind Impackful K9. Real-world methods for real-world dogs, serving Metro Vancouver.'
    },
    programs: {
      path: '/programs',
      title: 'Training Programs & Packages | Impackful K9',
      description: 'Private training packages for reactivity, off-leash recall, loose-leash walking and puppy foundations. Serving Metro Vancouver.'
    },
    library: {
      path: '/online-programs',
      title: 'Online Dog Training Courses | Impackful K9',
      description: "Can't make it in person? Online courses and resources you can work through from home."
    },
    community: {
      path: '/community',
      title: 'Community & Mindful Meetups | Impackful K9',
      description: 'Join the Impackful K9 community — mindful meetups and real-world group training across Metro Vancouver.'
    },
    journey: {
      path: '/journey',
      title: 'Find Your Training Path | Impackful K9',
      description: 'Answer a few questions about your dog and get a personalized Impackful K9 training recommendation.'
    },
    contact: {
      path: '/contact',
      title: 'Book a Session | Impackful K9',
      description: "Now accepting new clients into our private training programs. Tell us about your dog and we'll be in touch."
    }
  };

  // path -> pageId (reverse lookup for direct loads and back/forward)
  var PATH_TO_ID = {};
  Object.keys(PAGES).forEach(function (id) { PATH_TO_ID[PAGES[id].path] = id; });

  function idForPath(path) {
    path = (path || '/').replace(/[?#].*$/, '');          // drop query/hash
    if (path.length > 1) path = path.replace(/\/+$/, '');  // drop trailing slash
    return PATH_TO_ID[path] || 'hero';                     // unknown -> home
  }

  // --- <head> helpers -------------------------------------------------------
  function upsertMeta(key, value, attr) {
    attr = attr || 'name';
    var el = document.head.querySelector('meta[' + attr + '="' + key + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  function setCanonical(url) {
    var el = document.head.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute('href', url);
  }

  // Write all per-page metadata for a given pageId. Returns the data GA needs.
  function applyMeta(id) {
    var p = PAGES[id] || PAGES.hero;
    var url = SITE + p.path;
    document.title = p.title;
    upsertMeta('description', p.description);
    setCanonical(url);
    upsertMeta('og:title', p.title, 'property');
    upsertMeta('og:description', p.description, 'property');
    upsertMeta('og:url', url, 'property');
    return { title: p.title, location: url, path: p.path };
  }

  // --- GA4 ------------------------------------------------------------------
  // gtag() queues to dataLayer even before the library finishes loading, so
  // this is safe to call immediately. Config uses send_page_view:false, so the
  // only page_views are the ones fired here — one per real page change.
  function trackPageView(meta) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_title: meta.title,
      page_location: meta.location,
      page_path: meta.path
    });
  }

  var currentId = null; // pageId the URL/metadata currently reflect

  // Sync URL + metadata + analytics to a pageId. `push` adds a history entry.
  function syncTo(id, push) {
    if (!PAGES[id]) return;              // unknown id: don't touch the URL
    var meta = applyMeta(id);
    if (id === currentId) return;        // same page: no dup push / page_view
    if (push && location.pathname !== PAGES[id].path) {
      history.pushState({ pageId: id }, '', PAGES[id].path);
    }
    trackPageView(meta);
    currentId = id;
  }

  // --- wrap navigateTo: render as before, then sync the address bar ---------
  var renderPage = window.navigateTo;   // original (class-toggle) implementation
  window.navigateTo = function (pageId) {
    if (typeof renderPage === 'function') renderPage(pageId);
    syncTo(pageId, true);
  };

  // --- back / forward -------------------------------------------------------
  window.addEventListener('popstate', function () {
    var id = idForPath(location.pathname);
    if (typeof renderPage === 'function') renderPage(id);
    currentId = null;                    // force re-track for the restored page
    syncTo(id, false);                   // update view without pushing again
  });

  // --- initial load ---------------------------------------------------------
  // Set the correct per-URL metadata immediately — before the intro plays and
  // regardless of it — and fire exactly one initial page_view.
  var entryId = idForPath(location.pathname);
  trackPageView(applyMeta(entryId));
  currentId = entryId;

  // "Always play intro first": the intro + crossroads still run on every load.
  // When the visitor chooses "Classic Mode", land them on the page their URL
  // asked for instead of the default hero. The URL already matches a deep link,
  // so renderPage() is enough — no extra push or page_view.
  var runClassic = window.enterClassicMode;
  if (typeof runClassic === 'function') {
    window.enterClassicMode = function () {
      runClassic();
      if (entryId && entryId !== 'hero' && entryId !== 'journey' &&
          typeof renderPage === 'function') {
        renderPage(entryId);
        applyMeta(entryId);
        currentId = entryId;
      }
    };
  }

  // Keep the /journey URL in sync when the interactive journey is entered.
  var runJourney = window.enterJourneyMode;
  if (typeof runJourney === 'function') {
    window.enterJourneyMode = function () {
      runJourney();
      syncTo('journey', true);
    };
  }
})();
