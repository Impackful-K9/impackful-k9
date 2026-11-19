(function() {

  const GSAP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
  const ST_URL   = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js';
  let gsapLoaded = false;

  // Deck controller singleton (built once, reset on each open)
  let deckApi = null;
  // Answers collected across the 5 questions
  const answers = {};

  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    document.head.appendChild(s);
  }

  function loadAll(cb) {
    if (gsapLoaded) { cb(); return; }
    loadScript(GSAP_URL, () => {
      loadScript(ST_URL, () => {
        gsap.registerPlugin(ScrollTrigger);
        gsapLoaded = true;
        cb();
      });
    });
  }

  // ── OPEN ──
  window.openJourneyMode = function() {
    const page = document.getElementById('page-journey');
    if (!page) return;
    page.classList.add('journey-active');
    document.body.style.overflow = 'hidden';
    loadAll(initJourney);

    document.getElementById('j-close').onclick = function() {
      ScrollTrigger.getAll().forEach(t => t.kill());
      page.classList.remove('journey-active');
      document.body.style.overflow = '';
      page.scrollTop = 0;
    };
  };

  // ── INIT ──
  function initJourney() {
    const page = document.getElementById('page-journey');

    // Use page as scroller
    ScrollTrigger.defaults({ scroller: page });

    initHero(page);

    // Build the deck once; reset its state on every open.
    if (!deckApi) deckApi = createDeck(page);
    deckApi.reset();
  }

  // ── HERO ──
  function initHero(page) {
    const bg = document.getElementById('j-bg');
    const fg = document.getElementById('j-fg');

    // ── Background breathe ──
    gsap.to(bg, {
      scale: 1.08,
      x: 12,
      y: 8,
      duration: 12,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    });

    // ── Foreground float ──
    gsap.to(fg, {
      y: -12,
      duration: 4,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    });

    // ── Mouse parallax ──
    document.getElementById('j-hero').addEventListener('mousemove', function(e) {
      const r = this.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      gsap.to(fg, { x: dx * 14, y: -12 + dy * -6, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(bg, { x: dx * -18, y: dy * -10, duration: 1.2, ease: 'power2.out', overwrite: 'auto' });
    });

    // ── Eyebrow entrance ──
    gsap.to('#j-eyebrow', { opacity: 1, duration: 0.7, ease: 'power2.out', delay: 0.3 });
    gsap.to('#j-hint',    { opacity: 1, duration: 0.6, ease: 'power2.out', delay: 0.8 });

    // ── Build typewriter chars ──
    const sentence = "Answer 5 questions and\nreceive your personalized\ntraining plan.";
    const title = document.getElementById('j-title');
    title.innerHTML = '';
    const chars = [];

    sentence.split('').forEach(ch => {
      if (ch === '\n') {
        const br = document.createElement('br');
        title.appendChild(br);
        return;
      }
      const span = document.createElement('span');
      span.className = 'j-char';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      title.appendChild(span);
      chars.push(span);
    });

    // Set all chars invisible to start
    gsap.set(chars, { opacity: 0, filter: 'blur(6px)', y: 14 });

    // Immediate reveal (plays on open, no scrolling needed)
    gsap.to(chars, {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      duration: 0.4,
      ease: 'power1.out',
      stagger: 0.05,
      delay: 0.4
    });
  }

  // ── DECK — PAGES 2–18 ──
  // A fixed, full-viewport card stack. Wheel / swipe / arrow keys pop the
  // next page up from behind with a back.out(1.4) "stacked card" motion.
  // Built once (singleton) and re-armed with reset() on every open.
  function createDeck(page) {
    const deck   = document.getElementById('j-deck');
    const pages  = Array.prototype.slice.call(deck.querySelectorAll('.j-page'));
    const total  = pages.length; // 17 pages (2 → 18)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const progressWrap = document.getElementById('j-progress');
    const progressFill = document.getElementById('j-progress-fill');
    const stepWrap     = document.getElementById('j-step');
    const stepNow      = document.getElementById('j-step-now');

    let index     = -1;   // -1 = hero (Page 1); 0..total-1 = deck pages
    let animating = false;
    let zTop      = 20;   // running z so the moving card is always on top
    let gesture   = false;
    let settleT   = null;
    let touchY    = null;
    let motionStop = null; // teardown fn for the active page's background motion

    function isActive() { return page.classList.contains('journey-active'); }

    // ── progress bar + step counter ──
    function updateChrome() {
      if (index < 0) {
        progressWrap.classList.remove('visible');
        stepWrap.classList.remove('visible');
        progressFill.style.height = '0%';
        return;
      }
      progressWrap.classList.add('visible');
      stepWrap.classList.add('visible');
      progressFill.style.height = ((index + 1) / total * 100) + '%';
      stepNow.textContent = String(index + 2).padStart(2, '0'); // page number 02–18
    }

    // ── per-page content reveal + subtle Ken-Burns ──
    function revealPage(p) {
      const items = p.querySelectorAll('.j-reveal');
      gsap.killTweensOf(items);
      gsap.set(items, { opacity: 0, y: 26 });
      gsap.to(items, {
        opacity: 1,
        y: 0,
        duration: reduce ? 0.3 : 0.7,
        ease: 'power3.out',
        stagger: reduce ? 0.03 : 0.11,
        delay: reduce ? 0.05 : 0.26
      });
    }

    // ── background motion ──
    // Drift (a slow, continuous zoom) runs on EVERY page — no input needed.
    // Parallax (a depth nudge that follows the cursor) runs on question
    // pages only. Drift tweens scale; parallax tweens x/y — separate
    // transform properties, so the two compose instead of fighting.
    function startMotion(p) {
      if (reduce) return;
      const bg = p.querySelector('.j-page-bg');
      if (!bg) return;

      // Drift — always on
      gsap.fromTo(bg, { scale: 1.06 },
        { scale: 1.18, duration: 22, ease: 'sine.inOut', repeat: -1, yoyo: true, overwrite: 'auto' });

      // Parallax — question pages only
      const parallax = p.dataset.type === 'question';
      let raf = null, dx = 0, dy = 0;
      function apply() {
        raf = null;
        gsap.to(bg, { x: dx * -26, y: dy * -18, duration: 1.1, ease: 'power2.out', overwrite: 'auto' });
      }
      function onMove(e) {
        const r = p.getBoundingClientRect();
        dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        if (!raf) raf = requestAnimationFrame(apply);
      }
      if (parallax) p.addEventListener('mousemove', onMove);

      motionStop = function () {
        if (parallax) p.removeEventListener('mousemove', onMove);
        if (raf) cancelAnimationFrame(raf);
        gsap.killTweensOf(bg);
        gsap.set(bg, { x: 0, y: 0 });
        motionStop = null;
      };
    }

    // Stop the previous page's motion, then start the active page's.
    function syncMotion() {
      if (motionStop) motionStop();
      const cur = pages[index];
      if (cur) startMotion(cur);
    }

    function afterSettle(i) {
      const p = pages[i];
      if (p && p.dataset.type === 'capture') {
        const first = p.querySelector('.j-input');
        if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
      }
    }

    // ── the stacked card pop ──
    function goTo(nextIndex, dir) {
      if (animating) return;
      if (nextIndex < -1 || nextIndex >= total) return;
      animating = true;

      // Freeze the outgoing page's drift/parallax during the transition.
      if (motionStop) motionStop();

      // Entering the deck locks the hero's native scroll.
      if (nextIndex >= 0) page.style.overflow = 'hidden';

      const popDur  = reduce ? 0.45 : 0.92;
      const popEase = reduce ? 'power2.out' : 'back.out(1.4)';

      if (dir === 'next') {
        const incoming = pages[nextIndex];
        zTop += 1;
        incoming.style.zIndex = String(zTop);
        // y:0 neutralizes the px value GSAP parses from the CSS transform
        // default (translate3d(0,100%,0)); without it a 100vh residual is
        // left behind and the card never reaches the top of the viewport.
        gsap.set(incoming, { y: 0, yPercent: 100, scale: 0.94 });
        revealPage(incoming);
        gsap.to(incoming, {
          yPercent: 0,
          scale: 1,
          duration: popDur,
          ease: popEase,
          onComplete: function () {
            index = nextIndex;
            animating = false;
            updateChrome();
            syncMotion();
            afterSettle(index);
          }
        });
      } else { // prev — slide current card back down to reveal the one beneath
        const outgoing = pages[index];
        gsap.to(outgoing, {
          yPercent: 100,
          scale: 0.96,
          duration: reduce ? 0.4 : 0.7,
          ease: 'power3.in',
          onComplete: function () {
            index = nextIndex;
            animating = false;
            if (index < 0) page.style.overflow = ''; // back at hero → native scroll
            updateChrome();
            syncMotion();
          }
        });
      }
    }

    function advance() {
      if (index < 0) { goTo(0, 'next'); return; }          // hero → Page 2
      const cur = pages[index];
      if (cur.dataset.type === 'question' && cur.dataset.answered !== 'true') {
        nudge(cur);                                         // must pick an answer first
        return;
      }
      if (cur.dataset.type === 'capture') return;           // final page — submit only
      if (index < total - 1) goTo(index + 1, 'next');
    }

    function back() {
      if (index <= -1 || animating) return;
      goTo(index - 1, 'prev');
    }

    function nudge(p) {
      const opts = p.querySelector('.j-options');
      if (opts) gsap.fromTo(opts, { x: -7 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    }

    // ── input: wheel ──
    page.addEventListener('wheel', function (e) {
      if (!isActive()) return;

      if (index < 0) {
        // Hero: leave native scroll (and the typewriter ScrollTrigger) alone
        // until we're at the very bottom and still scrolling down.
        const atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 4;
        if (e.deltaY > 0 && atBottom && !animating) {
          e.preventDefault();
          goTo(0, 'next');
        }
        return;
      }

      // Deck: own the wheel; collapse each trackpad gesture into one step.
      e.preventDefault();
      if (settleT) clearTimeout(settleT);
      settleT = setTimeout(function () { gesture = false; }, 150);
      if (gesture || animating) return;
      if (Math.abs(e.deltaY) < 10) return;
      gesture = true;
      if (e.deltaY > 0) advance();
      else back();
    }, { passive: false });

    // ── input: touch swipe ──
    page.addEventListener('touchstart', function (e) {
      if (!isActive()) return;
      touchY = e.touches[0].clientY;
    }, { passive: true });

    page.addEventListener('touchend', function (e) {
      if (!isActive() || touchY == null) return;
      const dy = e.changedTouches[0].clientY - touchY;
      touchY = null;
      if (Math.abs(dy) < 46) return;

      if (index < 0) {
        const atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 4;
        if (dy < 0 && atBottom) goTo(0, 'next');
        return;
      }
      if (dy < 0) advance();  // swipe up → next
      else back();            // swipe down → prev
    }, { passive: true });

    // ── input: keyboard ──
    document.addEventListener('keydown', function (e) {
      if (!isActive() || index < 0) return;                 // hero keeps native arrows
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        back();
      }
    });

    // ── questions: pick a pill → reveal Continue ──
    pages.forEach(function (p) {
      if (p.dataset.type !== 'question') return;
      const pills = p.querySelectorAll('.j-pill');
      const cont  = p.querySelector('.j-continue');
      pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
          pills.forEach(function (x) { x.classList.remove('selected'); });
          pill.classList.add('selected');
          p.dataset.answered = 'true';
          answers['q' + p.dataset.q] = pill.getAttribute('data-value') || pill.textContent.trim();
          if (cont && !cont.classList.contains('shown')) {
            cont.classList.add('shown');
            gsap.fromTo(cont, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
          }
        });
      });
      if (cont) cont.addEventListener('click', function () { advance(); });
    });

    // ── email capture (Page 18) ──
    // No result is shown on screen — the personalized plan is emailed.
    const form    = document.getElementById('j-form');
    const success = document.getElementById('j-form-success');
    if (form) {
      const nameEl  = form.querySelector('#j-name');
      const emailEl = form.querySelector('#j-email');
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      [nameEl, emailEl].forEach(function (el) {
        el.addEventListener('input', function () { el.classList.remove('invalid'); });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const name  = nameEl.value.trim();
        const email = emailEl.value.trim();
        let ok = true;
        if (!name) { nameEl.classList.add('invalid'); ok = false; }
        if (!EMAIL_RE.test(email)) { emailEl.classList.add('invalid'); ok = false; }
        if (!ok) {
          gsap.fromTo(form, { x: -7 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
          return;
        }

        // Build a readable Question -> Answer summary straight from the deck,
        // then email it (with the visitor's name + email) via Web3Forms.
        // No backend needed — works on static hosting like Vercel.
        var qaLines = [];
        pages.forEach(function (p) {
          if (p.dataset.type !== 'question') return;
          var qEl = p.querySelector('.j-q-title');
          var q = (qEl ? qEl.textContent : ('Question ' + p.dataset.q)).replace(/\s+/g, ' ').trim();
          var sel = p.querySelector('.j-pill.selected');
          var a = sel ? sel.textContent.replace(/\s+/g, ' ').trim() : '(no answer)';
          qaLines.push(p.dataset.q + '. ' + q + '\n   -> ' + a);
        });
        var message = 'Name: ' + name + '\nEmail: ' + email +
          '\n\nJourney answers:\n\n' + qaLines.join('\n\n');

        fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            access_key: 'd69d3f4d-44be-49f7-b7c2-90961e7a9183',
            subject: 'New Journey quiz submission — Impackful K9',
            from_name: 'Impackful K9 Journey',
            name: name,
            email: email,
            message: message
          })
        }).catch(function (err) {
          if (window.console) console.error('[Impackful K9] Journey send failed', err);
        });

        form.setAttribute('hidden', '');
        form.style.display = 'none';
        if (success) {
          success.removeAttribute('hidden');
          gsap.fromTo(success, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
        }
        progressFill.style.height = '100%';
      });
    }

    // ── reset — fresh journey on every open ──
    function reset() {
      index = -1;
      animating = false;
      zTop = 20;
      gesture = false;
      page.style.overflow = '';
      if (motionStop) motionStop();

      gsap.set(pages, { y: 0, yPercent: 100, scale: 1 });
      pages.forEach(function (p) {
        p.style.zIndex = '';
        // Clear any leftover background drift / parallax offsets
        var bgi = p.querySelector('.j-page-bg'); if (bgi) gsap.set(bgi, { x: 0, y: 0, scale: 1 });
        if (p.dataset.type === 'question') {
          delete p.dataset.answered;
          p.querySelectorAll('.j-pill').forEach(function (x) { x.classList.remove('selected'); });
          const c = p.querySelector('.j-continue');
          if (c) { c.classList.remove('shown'); gsap.set(c, { opacity: 0, y: 0 }); }
        }
      });

      Object.keys(answers).forEach(function (k) { delete answers[k]; });

      if (form) {
        form.reset();
        form.removeAttribute('hidden');
        form.style.display = '';
        form.querySelectorAll('.j-input').forEach(function (i) { i.classList.remove('invalid'); });
      }
      if (success) { success.setAttribute('hidden', ''); gsap.set(success, { opacity: 1, y: 0 }); }

      updateChrome();
    }

    return { reset: reset };
  }

})();