'use strict';

/* ── Helpers ── */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================
   THEME TOGGLE — dark / light, persisted, no flash on load
   (initial theme is also set by a tiny inline script in <head>)
   ================================================================ */
function initTheme() {
  const toggle = $('#themeToggle');
  const html   = document.documentElement;
  const meta   = $('meta[name="theme-color"]');

  const safeGet = () => { try { return localStorage.getItem('theme'); } catch { return null; } };
  const safeSet = (v) => { try { localStorage.setItem('theme', v); } catch { /* ignore */ } };

  const apply = (theme) => {
    html.setAttribute('data-theme', theme);
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0F0F10' : '#F8F8F6');
    if (toggle) {
      toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
      toggle.setAttribute('aria-pressed', String(theme === 'light'));
    }
  };

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  apply(safeGet() || html.getAttribute('data-theme') || (mq.matches ? 'dark' : 'light'));

  // Follow OS changes only if the user hasn't chosen manually
  mq.addEventListener?.('change', (e) => { if (!safeGet()) apply(e.matches ? 'dark' : 'light'); });

  if (!toggle) return;

  toggle.addEventListener('click', (e) => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    safeSet(next);

    // Smooth circular reveal where View Transitions are supported
    if (document.startViewTransition && !reducedMotion) {
      const rect = toggle.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

      const transition = document.startViewTransition(() => apply(next));
      transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 600, easing: 'cubic-bezier(0.4,0,0.2,1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(() => {});
    } else {
      // Fallback: brief colour cross-fade
      html.classList.add('theme-fade');
      apply(next);
      setTimeout(() => html.classList.remove('theme-fade'), 450);
    }

    toggle.classList.add('toggled');
    setTimeout(() => toggle.classList.remove('toggled'), 400);
  });
}

/* ================================================================
   NAV — scroll glass effect, active link, mobile menu
   ================================================================ */
function initNav() {
  const nav       = $('#nav');
  const menuBtn   = $('#menuBtn');
  const mobileNav = $('#mobileNav');
  if (!nav) return;

  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navLinks = $$('.nav__link');
  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) =>
        link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('section[id]').forEach((s) => sectionObs.observe(s));

  if (!menuBtn || !mobileNav) return;

  const setMenu = (open) => {
    menuBtn.classList.toggle('open', open);
    mobileNav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    mobileNav.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };

  menuBtn.addEventListener('click', () => setMenu(!menuBtn.classList.contains('open')));
  $$('.mobile-nav__link').forEach((l) => l.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', () => { if (innerWidth > 768) setMenu(false); }, { passive: true });
}

/* ================================================================
   CURSOR GLOW (hero) — GPU-friendly, stops when settled
   ================================================================ */
function initCursorGlow() {
  const hero = $('.hero');
  const glow = $('#heroGlow');
  if (!hero || !glow) return;
  if (reducedMotion || window.matchMedia('(hover: none)').matches) { glow.remove(); return; }

  let tx = hero.clientWidth * 0.7, ty = hero.clientHeight * 0.4;
  let x = tx, y = ty, raf = null;

  const paint = () => {
    x += (tx - x) * 0.08;
    y += (ty - y) * 0.08;
    glow.style.translate = `${x}px ${y}px`;
    raf = (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) ? requestAnimationFrame(paint) : null;
  };

  paint();
  glow.classList.add('ready');

  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = e.clientX - r.left;
    ty = e.clientY - r.top;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
}

/* ================================================================
   TYPEWRITER (hero headline)
   ================================================================ */
function initTyped() {
  const el = $('#typedText');
  if (!el) return;

  const phrases = [
    'solves real problems.',
    'makes an impact.',
    'people actually use.',
    'leaves an impression.',
    'pushes limits.',
  ];

  if (reducedMotion) { el.textContent = phrases[0]; return; }

  let p = 0, c = 0, deleting = false;

  const tick = () => {
    const current = phrases[p];
    c += deleting ? -1 : 1;
    el.textContent = current.slice(0, c);

    let delay = deleting ? 40 : 70;
    if (!deleting && c === current.length) { delay = 2000; deleting = true; }
    else if (deleting && c === 0)          { deleting = false; p = (p + 1) % phrases.length; delay = 450; }
    setTimeout(tick, delay);
  };
  setTimeout(tick, 900);
}

/* ================================================================
   SCROLL REVEAL — animation-based, safe fallbacks
   Elements are only hidden when <html class="js"> is set, and a
   timeout guarantees nothing can stay invisible.
   ================================================================ */
function initReveal() {
  const html = document.documentElement;

  // Auto-mark grid children and give them staggered delays
  $$('.skills__grid, .about__highlights, .edu-card__achievements').forEach((grid) => {
    $$(':scope > *', grid).forEach((child, i) => {
      child.classList.add('reveal');
      child.style.setProperty('--d', `${Math.min(i, 8) * 70}ms`);
    });
  });
  $$('.hero .reveal').forEach((el, i) => el.style.setProperty('--d', `${120 + i * 110}ms`));

  const all = $$('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  const show = (el) => el.classList.add('visible');

  if (reducedMotion || !('IntersectionObserver' in window)) {
    all.forEach(show);
    return;
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      show(entry.target);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  all.forEach((el) => obs.observe(el));

  // Safety net: never leave content hidden
  setTimeout(() => all.forEach(show), 4000);
  html.classList.add('reveal-ready');
}

/* ================================================================
   PARALLAX — hero shapes (uses `translate`, composes with float anim)
   ================================================================ */
function initParallax() {
  if (reducedMotion) return;
  const s1 = $('.hero__shape--1');
  const s2 = $('.hero__shape--2');
  if (!s1 || !s2) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = Math.min(window.scrollY, innerHeight * 1.5);
      s1.style.translate = `0 ${y * 0.15}px`;
      s2.style.translate = `0 ${y * -0.1}px`;
      ticking = false;
    });
  }, { passive: true });
}

/* ================================================================
   COUNTERS (only runs if [data-count] elements exist)
   ================================================================ */
function initCounters() {
  const counters = $$('[data-count]');
  if (!counters.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const end = parseInt(el.dataset.count, 10);
      const dur = 1500;
      const t0 = performance.now();
      const run = (now) => {
        const t = Math.min((now - t0) / dur, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach((el) => obs.observe(el));
}

/* ================================================================
   CONTACT FORM — validation + async submit
   ================================================================ */
function initContactForm() {
  const form   = $('#contactForm');
  const status = $('#formStatus');
  if (!form) return;

  const btn = form.querySelector('[type="submit"]');
  const idleLabel = btn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      $$('.form__input', form).forEach((i) =>
        i.classList.toggle('invalid', !i.checkValidity()));
      status.textContent = 'Please fill in all fields correctly.';
      form.querySelector(':invalid')?.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';
    status.textContent = '';

    // TODO: replace with a real fetch() to your backend / form service
    await new Promise((r) => setTimeout(r, 1200));

    status.textContent = "✓ Message sent! I'll get back to you soon.";
    form.reset();
    btn.disabled = false;
    btn.textContent = idleLabel;
    setTimeout(() => { status.textContent = ''; }, 7000);
  });

  $$('.form__input', form).forEach((input) => {
    input.addEventListener('blur', () =>
      input.classList.toggle('invalid', !input.checkValidity() && input.value !== ''));
    input.addEventListener('input', () => {
      if (input.checkValidity()) input.classList.remove('invalid');
    });
  });
}

/* ================================================================
   SMOOTH SCROLL for hash anchors
   ================================================================ */
function initSmoothScroll() {
  $$('a[href^="#"]').forEach((anchor) => {
    const hash = anchor.getAttribute('href');
    if (hash === '#') return;
    anchor.addEventListener('click', (e) => {
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 72;
      const top = hash === '#hero' ? 0 : target.getBoundingClientRect().top + window.scrollY - navH + 1;
      window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  });
}

/* ================================================================
   BACK TO TOP — handled by smooth scroll (#hero), kept for safety
   ================================================================ */
function initBackToTop() {
  $('.footer__top')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  });
}

/* ================================================================
   TILT — subtle 3D tilt on cards (cheap, rAF-throttled)
   ================================================================ */
function initTilt() {
  if (reducedMotion || window.matchMedia('(hover: none)').matches) return;

  $$('.project-featured, .edu-card').forEach((card) => {
    let raf = null;

    card.addEventListener('mousemove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width  - 0.5) * 6;
        const y = ((e.clientY - r.top)  / r.height - 0.5) * 6;
        card.style.setProperty('--rx', `${-y}deg`);
        card.style.setProperty('--ry', `${x}deg`);
        raf = null;
      });
    }, { passive: true });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* ================================================================
   PHOTO FALLBACK — show initials if photo.png is missing
   ================================================================ */
function initPhotoFallback() {
  const img = $('.about__photo img');
  if (!img) return;
  const fallback = () => {
    const box = img.parentElement;
    img.remove();
    if (!$('.about__photo-placeholder', box)) {
      const span = document.createElement('span');
      span.className = 'about__photo-placeholder';
      span.textContent = 'RP';
      box.appendChild(span);
    }
  };
  if (img.complete && img.naturalWidth === 0) fallback();
  else img.addEventListener('error', fallback, { once: true });
}

/* ================================================================
   BOOT — each init is isolated so one failure can't break the rest
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  [
    initTheme, initNav, initCursorGlow, initTyped, initReveal, initParallax,
    initCounters, initContactForm, initSmoothScroll, initBackToTop, initTilt,
    initPhotoFallback,
  ].forEach((fn) => {
    try { fn(); } catch (err) { console.error(`${fn.name} failed:`, err); }
  });
});