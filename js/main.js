//document.getElementById('intro-overlay').style.display = 'none';
//showCrossroads(); // remove to enable intro video and transition

// ── Theme toggle ──
const root = document.documentElement;
const toggleBtn = document.getElementById('theme-toggle');
const iconMoon = document.getElementById('icon-moon');
const iconSun = document.getElementById('icon-sun');
const heroBg = document.querySelector('#hero .hero-bg');
const heroEl = document.getElementById('hero');

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  localStorage.setItem('ik9-theme', theme);
  const g = theme === 'light' ?
    {
      cls: 'grad-mist',
      light: true
    } :
    {
      cls: 'grad-cedar',
      light: false
    };
  ['grad-cedar', 'grad-bark', 'grad-seaglass', 'grad-mist', 'grad-drift']
  .forEach(c => heroBg.classList.remove(c));
  heroBg.classList.add(g.cls);
  heroEl.classList.toggle('hero-light', g.light);
  iconMoon.style.display = theme === 'dark' ? 'none' : 'block';
  iconSun.style.display = theme === 'light' ? 'none' : 'block';
  toggleBtn.style.color = theme === 'light' ? 'var(--deep-cedar)' : 'var(--mist-white)';
  toggleBtn.style.borderColor = theme === 'light' ? 'rgba(45,58,46,0.35)' : 'rgba(184,212,206,0.5)';
}

toggleBtn.addEventListener('click', () => {
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

applyTheme(localStorage.getItem('ik9-theme') || 'light');

// ── Page navigation ──
function navigateTo(pageId) {
  // hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // show target
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  // update nav active state
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === pageId);
  });

  // update sliding underline
  const activeLink = document.querySelector(`.nav-links a[data-page="${pageId}"]`);
  if (activeLink) moveIndicator(activeLink);

  // if going to hero, re-trigger animations if not done yet
  if (pageId === 'hero') triggerHeroAnimations();
}

// wire up nav links
document.querySelectorAll('.nav-links a[data-page]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.dataset.page);
  });
});

// ── Contact form → Web3Forms (emails each submission; no backend needed) ──
function handleContact(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('.contact-submit');
  const status = form.querySelector('#contact-status');
  const consent = form.querySelector('#consent-check');
  const consentBox = form.querySelector('#consent-box');

  // The form is novalidate, so validate required fields + consent here.
  let firstInvalid = null;
  form.querySelectorAll('input[required], select[required], textarea[required]').forEach((el) => {
    if (el === consent) return;
    const empty = !String(el.value).trim();
    el.classList.toggle('field-invalid', empty);
    if (empty && !firstInvalid) firstInvalid = el;
  });
  const needConsent = !!(consent && !consent.checked);
  if (consentBox) consentBox.classList.toggle('field-invalid', needConsent);
  if (needConsent && !firstInvalid) firstInvalid = consent;

  if (firstInvalid) {
    setContactStatus(status, needConsent
      ? 'Please fill in every required field and tick the consent box.'
      : 'Please fill in every required field.', true);
    if (typeof firstInvalid.focus === 'function') firstInvalid.focus();
    return;
  }

  const original = btn ? btn.textContent : 'Send Message';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  setContactStatus(status, '', false, true);

  fetch('https://api.web3forms.com/submit', { method: 'POST', body: new FormData(form) })
    .then((r) => r.json())
    .then((data) => {
      if (!data || !data.success) throw new Error((data && data.message) || 'Submission failed');
      if (btn) {
        btn.textContent = 'Sent ✓';
        btn.style.background = '#5B6B4A';
        btn.style.color = '#F0EDE8';
      }
      setContactStatus(status, 'Thank you — your message is on its way. Jenn will be in touch soon.', false);
      form.reset();
      if (consentBox) consentBox.classList.remove('checked');
      form.querySelectorAll('.field-invalid').forEach((el) => el.classList.remove('field-invalid'));
    })
    .catch((err) => {
      if (window.console) console.error('[Impackful K9] contact send failed', err);
      if (btn) { btn.disabled = false; btn.textContent = original; }
      setContactStatus(status, 'Sorry — something went wrong. Please email info@impackfulk9.com or try again in a moment.', true);
    });
}

function setContactStatus(el, msg, isError, hide) {
  if (!el) return;
  if (hide) { el.hidden = true; return; }
  el.textContent = msg;
  el.hidden = false;
  el.style.color = isError ? '#b23b3b' : 'var(--sea-glass)';
}

// Reserved hook for future per-service message hints; a safe no-op so the
// inline onchange handler never throws.
function handleServiceChange(select) {
  void select;
}

// ── Intro / transition ──
let transitionDone = false;
const introVideo = document.getElementById('intro-video');

function triggerTransition(fromWhiteout) {
  if (transitionDone) return;
  transitionDone = true;
  const burst = document.getElementById('light-burst');
  const intro = document.getElementById('intro-overlay');

  if (!fromWhiteout && introVideo && !isNaN(introVideo.duration)) {
    try {
      introVideo.currentTime = Math.max(introVideo.currentTime, 7.8);
    } catch (e) {}
  }

  intro.classList.add('whiteout');
  setTimeout(() => {
    try {
      introVideo.pause();
    } catch (e) {}
  }, 60);
  burst.classList.add('active');

  setTimeout(() => {
    intro.style.opacity = '0';
    intro.style.transition = 'opacity 0.5s ease';
  }, 850);

  setTimeout(() => {
    intro.style.display = 'none';
    burst.style.display = 'none';
    showCrossroads();
  }, 2100);
}

// ── Crossroads ──
function showCrossroads() {
  const cr = document.getElementById('crossroads');
  cr.classList.add('visible');
  setTimeout(() => {
    const eyebrow = cr.querySelector('.crossroads-eyebrow');
    const heading = cr.querySelector('.crossroads-heading');
    if (eyebrow) eyebrow.classList.add('in');
    if (heading) heading.classList.add('in');
    cr.querySelector('.crossroads-sub').classList.add('in');
    cr.querySelector('.crossroads-paths').classList.add('in');
    const skip = cr.querySelector('.crossroads-skip');
    if (skip) skip.classList.add('in');
  }, 60);
}

function enterClassicMode() {
  const cr = document.getElementById('crossroads');
  const main = document.getElementById('main-site');
  cr.classList.add('exiting');
  setTimeout(() => {
    cr.style.display = 'none';
    main.style.display = 'block';
    setTimeout(() => {
      main.classList.add('visible');
      triggerHeroAnimations();
    }, 60);
  }, 400);
}

function enterJourneyMode() {
  if (typeof openJourneyMode === 'function') {
    openJourneyMode();
  }
}

function hideCoomingSoon() {
  const cs = document.getElementById('coming-soon');
  const cr = document.getElementById('crossroads');
  cs.classList.remove('visible');
  cr.style.display = 'flex';
  cr.classList.remove('exiting');
  cr.classList.remove('visible');
  setTimeout(() => cr.classList.add('visible'), 20);
}

// ── Hero animations ──
let heroAnimated = false;

function triggerHeroAnimations() {
  if (heroAnimated) return;
  heroAnimated = true;
  setTimeout(() => document.getElementById('h-eyebrow').classList.add('revealed'), 100);
  setTimeout(() => document.getElementById('h-headline').classList.add('revealed'), 300);
  setTimeout(() => document.getElementById('h-sub').classList.add('revealed'), 600);
  setTimeout(() => document.getElementById('h-cta').classList.add('revealed'), 900);
}

// ── Video timing ──
const WHITEOUT_TIME = 7.8;
introVideo.addEventListener('timeupdate', () => {
  if (!transitionDone && introVideo.currentTime >= WHITEOUT_TIME) triggerTransition(true);
});
introVideo.addEventListener('ended', () => {
  if (!transitionDone) triggerTransition(true);
});
setTimeout(() => {
  if (!transitionDone) triggerTransition(false);
}, 9500);

// ── Nav scroll (fade on scroll within active page) ──
document.getElementById('snap-container').addEventListener('scroll', () => {
  const scrolled = document.getElementById('snap-container').scrollTop > 80;
  document.getElementById('nav').classList.toggle('scrolled', scrolled);
});

// ── Nav sliding underline ──
const navList = document.querySelector('.nav-links');

function moveIndicator(el) {
  if (!navList || !el) return;
  const listRect = navList.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  navList.style.setProperty('--ind-left', (elRect.left - listRect.left) + 'px');
  navList.style.setProperty('--ind-width', elRect.width + 'px');
  navList.classList.add('indicator-ready');
}

const firstActive = navList ? navList.querySelector('a.active') : null;
if (firstActive) requestAnimationFrame(() => moveIndicator(firstActive));

if (navList) {
  navList.querySelectorAll('a').forEach(link => {
    link.addEventListener('mouseenter', () => moveIndicator(link));
  });
  navList.addEventListener('mouseleave', () => {
    const active = navList.querySelector('a.active');
    if (active) moveIndicator(active);
    else navList.classList.remove('indicator-ready');
  });
}

// ── Consent checkbox ──
const consentRow   = document.getElementById('consent-row');
const consentBox   = document.getElementById('consent-box');
const consentCheck = document.getElementById('consent-check');

if (consentRow) {
  consentRow.addEventListener('click', () => {
    const isChecked = consentBox.classList.toggle('checked');
    consentCheck.checked = isChecked;
  });
}

// ── Scroll reveal ──
const scrollEls = document.querySelectorAll('[data-scroll]');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

scrollEls.forEach(el => observer.observe(el));

// ─── STAT COUNTER ───
/*function initStatCounter() {
  const el = document.querySelector('.about-stat-num[data-count]');
  if (!el) return;

  const start = parseInt(el.getAttribute('data-start') || '2000');
  const end = parseInt(el.getAttribute('data-end') || '3000');
  const duration = parseInt(el.getAttribute('data-duration') || '2000');
  const step = 1;

  let current = start;
  el.textContent = current.toLocaleString() + '+';

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const timer = setInterval(() => {
          current += step;
          if (current >= end) {
            current = end;
            clearInterval(timer);
          }
          el.textContent = current.toLocaleString() + '+';
        }, 100);
        observer.disconnect();
      }
    });
  }, { threshold: 0.5 });

  observer.observe(el);
}
initStatCounter();*/

function navigateToSection(page, sectionId) {
  navigateTo(page);
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, 400);
}

// ── Mobile nav (hamburger dropdown) ──
(function initNavToggle() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  if (!nav || !toggle) return;

  function setOpen(open) {
    nav.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!nav.classList.contains('menu-open'));
  });

  // Close the menu once a destination is chosen.
  nav.querySelectorAll('.nav-links a').forEach((a) => {
    a.addEventListener('click', () => setOpen(false));
  });

  // Close on outside tap or Escape.
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('menu-open') && !nav.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
})();