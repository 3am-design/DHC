/* ================================================================
   D. H. Chen Foundation — script.js
   ================================================================ */
'use strict';

/* Always (re)load at the top of the page — stop the browser from restoring
   the previous scroll position on refresh / back-forward navigation. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ----------------------------------------------------------------
   0. Lenis smooth scrolling — inertia-smoothed wheel/touch scroll.
   Native scroll events still fire, so the nav, wave and hero-scene
   listeners all keep working unchanged.
   ---------------------------------------------------------------- */
(function () {
  if (typeof Lenis === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const lenis = new Lenis({
    duration: 1.1,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 2
  });
  window.__lenis = lenis;

  (function raf(time) {
    lenis.raf(time);
    window.requestAnimationFrame(raf);
  })(0);

  /* Lenis manages its own easing — native smooth-behavior must be off */
  document.documentElement.classList.add('lenis-on');
})();

/* ----------------------------------------------------------------
   1. Nav — add scrolled class for background
   ---------------------------------------------------------------- */
(function () {
  const nav = document.getElementById('nav');
  if (!nav) return;
  function tick() {
    nav.classList.toggle('nav--scrolled', window.scrollY > 20);
  }
  window.addEventListener('scroll', tick, { passive: true });
  tick();
})();


/* ----------------------------------------------------------------
   2. Mobile hamburger
   ---------------------------------------------------------------- */
(function () {
  const btn   = document.querySelector('.nav__hamburger');
  const menu  = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  const close = menu.querySelector('.nav__mobile-close');

  /* full-screen overlay: lock the page scroll while it's open */
  function setOpen(open) {
    menu.classList.toggle('nav__mobile-menu--open', open);
    btn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('lock-scroll', open);
    document.body.classList.toggle('menu-open', open);   /* white menu keeps the base orange cursor */
    if (window.__lenis) { open ? window.__lenis.stop() : window.__lenis.start(); }
  }

  /* set the circular-reveal origin to the centre of whatever opened the overlay */
  function setRevealOrigin(target, originEl) {
    const r = originEl.getBoundingClientRect();
    target.style.setProperty('--reveal-x', ((r.left + r.width / 2) / window.innerWidth * 100) + '%');
    target.style.setProperty('--reveal-y', ((r.top + r.height / 2) / window.innerHeight * 100) + '%');
  }

  btn.addEventListener('click', function () {
    const willOpen = !menu.classList.contains('nav__mobile-menu--open');
    if (willOpen) setRevealOrigin(menu, btn);
    setOpen(willOpen);
  });
  if (close) close.addEventListener('click', function () { setOpen(false); });

  /* 1st-level accordion: clicking a section pops its 2nd-level panel open
     (pushing the rest down); opening one collapses any other — only one open
     at a time. Sections without a panel (Connect) are left as plain links. */
  const items = Array.prototype.slice.call(menu.querySelectorAll('.nav__mobile-item'));
  items.forEach(function (item) {
    const link = item.querySelector('.nav__mobile-link');
    const sub  = item.querySelector('.nav__mobile-sub');
    if (!link || !sub) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const wasOpen = item.classList.contains('is-open');
      items.forEach(function (it) {
        it.classList.remove('is-open');
        const l = it.querySelector('.nav__mobile-link');
        if (l) l.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('is-open');
        link.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* any real navigation choice (2nd-level link, Connect, footer links, 中文)
     closes the overlay; the section toggle buttons above do not */
  menu.querySelectorAll('.nav__mobile-sub a, a.nav__mobile-link, .nav__mobile-sublink, .nav__mobile-lang')
    .forEach(function (l) { l.addEventListener('click', function () { setOpen(false); }); });
})();


/* ----------------------------------------------------------------
   2.5 Search overlay — full-screen orange search, opened from either
   the desktop search button or the mobile menu's search button.
   Closes on the × button or Escape; locks page scroll while open.
   ---------------------------------------------------------------- */
(function () {
  const overlay = document.getElementById('search-overlay');
  if (!overlay) return;
  const openers  = document.querySelectorAll('.nav__search-btn, .nav__mobile-search');
  const closeBtn = overlay.querySelector('.search-overlay__close');
  const input    = overlay.querySelector('.search-overlay__input');
  const mobile   = document.getElementById('mobile-menu');
  const burger   = document.querySelector('.nav__hamburger');

  function setOpen(open) {
    overlay.classList.toggle('search-overlay--open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('lock-scroll', open);
    document.body.classList.toggle('search-open', open);   /* orange overlay → white cursor */
    if (window.__lenis) { open ? window.__lenis.stop() : window.__lenis.start(); }
    if (open) window.setTimeout(function () { if (input) input.focus(); }, 80);
  }

  openers.forEach(function (b) {
    b.addEventListener('click', function () {
      /* if the search lives inside the open mobile menu, close that first */
      if (mobile && mobile.classList.contains('nav__mobile-menu--open')) {
        mobile.classList.remove('nav__mobile-menu--open');
        mobile.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('menu-open');       /* drop the white-menu cursor state */
        if (burger) burger.setAttribute('aria-expanded', 'false');
      }
      /* circular reveal radiating from the clicked search button */
      var r = b.getBoundingClientRect();
      overlay.style.setProperty('--reveal-x', ((r.left + r.width / 2) / window.innerWidth * 100) + '%');
      overlay.style.setProperty('--reveal-y', ((r.top + r.height / 2) / window.innerHeight * 100) + '%');
      setOpen(true);
    });
  });
  if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('search-overlay--open')) setOpen(false);
  });
})();


/* ----------------------------------------------------------------
   3. News slider — the active card is centred in the viewport, the
   cards either side tilt ±3° (.is-prev / .is-next), and the slider
   auto-advances every 3 seconds. Dragging pauses the timer.
   ---------------------------------------------------------------- */
(function () {
  const wrap     = document.getElementById('news-carousel-wrap');
  const carousel = document.getElementById('news-carousel');
  if (!wrap || !carousel) return;

  const AUTO_MS  = 5000;   /* auto-advance interval */
  const SLIDE_MS = 1100;   /* slide animation duration */
  const TILT_DEG = 3;      /* tilt of the cards one slot from centre */

  /* Clone the full set on both sides so the slider loops seamlessly —
     it always moves forward and there are always cards on both sides.
     When the scroll position drifts into a cloned set, we silently
     jump back one set-width (identical layout, invisible to the user). */
  const realCards = Array.prototype.slice.call(carousel.querySelectorAll('.news-card'));
  const before = document.createDocumentFragment();
  const after  = document.createDocumentFragment();
  realCards.forEach(function (c) {
    const a = c.cloneNode(true);
    const b = c.cloneNode(true);
    [a, b].forEach(function (cl) {
      cl.setAttribute('aria-hidden', 'true');
      cl.dataset.clone = '1';
    });
    before.appendChild(a);
    after.appendChild(b);
  });
  carousel.insertBefore(before, carousel.firstChild);
  carousel.appendChild(after);

  const cards = Array.prototype.slice.call(carousel.querySelectorAll('.news-card'));
  let currentIdx = 0;          /* index within the visible (clones included) list */

  /* ---- make wrap scrollable ---- */
  wrap.style.overflowX = 'auto';
  wrap.style.webkitOverflowScrolling = 'touch';

  /* hide scrollbar */
  const s = document.createElement('style');
  s.textContent = '#news-carousel-wrap::-webkit-scrollbar{display:none}#news-carousel-wrap{-ms-overflow-style:none;scrollbar-width:none}';
  document.head.appendChild(s);

  function visibleCards() {
    return cards.filter(function (c) { return c.style.display !== 'none'; });
  }

  /* ---- slow eased scroll animation ---- */
  let animId = null;
  function cancelSlide() {
    if (animId) { window.cancelAnimationFrame(animId); animId = null; }
  }
  function animateScrollTo(left, duration, easing, onDone) {
    cancelSlide();
    const from  = wrap.scrollLeft;
    const delta = left - from;
    const t0    = performance.now();
    const ease  = easing === 'in'  ? function (t) { return t * t; }
                : easing === 'out' ? function (t) { return 1 - Math.pow(1 - t, 3); }
                : function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    function step(now) {
      const t = Math.min(1, (now - t0) / duration);
      wrap.scrollLeft = from + delta * ease(t);
      if (t < 1) {
        animId = window.requestAnimationFrame(step);
      } else {
        animId = null;
        if (onDone) {
          onDone();
        } else {
          normalize();        /* jump back into the middle set if needed */
          updateWheel();
        }
      }
    }
    animId = window.requestAnimationFrame(step);
  }

  /* keep the viewport centred within the middle (real) set; returns the
     applied scroll delta so a drag in progress can compensate */
  function normalize() {
    const vis = visibleCards();
    if (vis.length < 3 || vis.length % 3 !== 0) return 0;
    const m = vis.length / 3;
    const W = vis[m].offsetLeft - vis[0].offsetLeft;   /* one set-width */
    if (!W) return 0;
    const pitch  = vis[1].offsetLeft - vis[0].offsetLeft;
    const centre = wrap.scrollLeft + wrap.clientWidth / 2;
    const lower  = vis[m].offsetLeft + vis[m].offsetWidth / 2 - pitch / 2;
    const upper  = lower + W;
    if (centre < lower)  { wrap.scrollLeft += W; return  W; }
    if (centre >= upper) { wrap.scrollLeft -= W; return -W; }
    return 0;
  }

  /* mobile uses native smooth scrolling so it cooperates with CSS
     scroll-snap (the JS rAF animation fought the snap → jumpy auto-rotate) */
  const canNativeSmooth = 'scrollBehavior' in document.documentElement.style;
  function nativeSmooth() {
    return canNativeSmooth && window.matchMedia('(max-width: 767px)').matches;
  }
  let snapSettle = null;
  function centreCard(card, smooth) {
    const left = card.offsetLeft - (wrap.clientWidth - card.offsetWidth) / 2;
    if (!smooth) { wrap.scrollLeft = left; return; }
    if (nativeSmooth()) {
      cancelSlide();
      wrap.scrollTo({ left: left, behavior: 'smooth' });
      if (snapSettle) window.clearTimeout(snapSettle);
      snapSettle = window.setTimeout(function () { normalize(); updateWheel(); }, 650);
    } else {
      animateScrollTo(left, SLIDE_MS);
    }
  }

  /* ---- wheel effect ----
     Cards sit on the rim of a huge circle whose top is the viewport
     centre: the centred card is level, neighbours drop and tilt as if
     the whole strip rotates about the circle's centre.              */
  function updateWheel() {
    const vis = visibleCards();
    if (!vis.length) return;
    const centre = wrap.scrollLeft + wrap.clientWidth / 2;
    const mobile = window.innerWidth <= 767;
    const pitch  = vis.length > 1
      ? vis[1].offsetLeft - vis[0].offsetLeft
      : vis[0].offsetWidth;
    const R = pitch / Math.sin(TILT_DEG * Math.PI / 180);   /* one slot = TILT_DEG° */
    let active = 0, best = Infinity;
    vis.forEach(function (c, i) {
      const dx = c.offsetLeft + c.offsetWidth / 2 - centre;
      if (Math.abs(dx) < best) { best = Math.abs(dx); active = i; }
      if (mobile) { c.style.transform = ''; return; }
      const theta = Math.asin(Math.max(-1, Math.min(1, dx / R)));
      const drop  = R * (1 - Math.cos(theta));
      c.style.transform =
        'translateY(' + drop.toFixed(1) + 'px) rotate(' + (theta * 180 / Math.PI).toFixed(2) + 'deg)';
    });
    currentIdx = active;
  }

  wrap.addEventListener('scroll', function () {
    window.requestAnimationFrame(updateWheel);
  }, { passive: true });
  window.addEventListener('resize', function () {
    window.requestAnimationFrame(updateWheel);
  });

  /* ---- auto-advance: always slides forward; clones make it endless ---- */
  let timer = null;
  function next() {
    const vis = visibleCards();
    if (vis.length < 2) return;
    centreCard(vis[Math.min(currentIdx + 1, vis.length - 1)], true);
  }
  function prev() {
    const vis = visibleCards();
    if (vis.length < 2) return;
    centreCard(vis[Math.max(currentIdx - 1, 0)], true);
  }

  /* small API for the custom cursor's edge-click navigation */
  window.newsSlider = {
    next: function () { next(); startTimer(); },
    prev: function () { prev(); startTimer(); }
  };
  function startTimer() { stopTimer(); timer = window.setInterval(next, AUTO_MS); }
  function stopTimer()  { if (timer) { window.clearInterval(timer); timer = null; } }

  /* ---- initial position: card 2 of the middle (real) set ---- */
  function middleStart(vis) {
    const m = vis.length % 3 === 0 ? vis.length / 3 : 0;
    return Math.min(m + 1, vis.length - 1);
  }
  function init() {
    const vis = visibleCards();
    if (vis.length) centreCard(vis[middleStart(vis)], false);
    updateWheel();
    startTimer();
  }
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  /* tab switch — one continuous "slot machine" spin, ~6 cards total:
     accelerate through 3 cards, swap the set at full speed (the card
     grid is phase-aligned at the swap frame, so nothing jumps), then
     spin through 3 more cards while decelerating onto the target.
     The strip scrolls normally throughout — cards are never cut off.  */
  const SPIN_OUT_MS = 700;    /* accelerating, ends at full speed */
  const SPIN_IN_MS  = 1050;   /* starts at full speed, eases to a stop */
  let switchTimer = null;
  document.querySelectorAll('.news__filter').forEach(function (btn) {
    btn.addEventListener('click', function () {
      stopTimer();
      cancelSlide();
      if (switchTimer) window.clearTimeout(switchTimer);
      normalize();                       /* make sure we're in the middle set */

      const vis = visibleCards();
      if (!vis.length) return;
      const pitch  = vis.length > 1
        ? vis[1].offsetLeft - vis[0].offsetLeft
        : wrap.clientWidth;
      const active = vis[Math.min(currentIdx, vis.length - 1)];
      const aLeft  = active.offsetLeft - (wrap.clientWidth - active.offsetWidth) / 2;
      const ahead  = Math.max(1, Math.min(3, vis.length - 1 - currentIdx));

      /* spin out — end exactly card-centred so the swap frame aligns */
      animateScrollTo(aLeft + ahead * pitch, SPIN_OUT_MS, 'in', function () {});

      /* the filter module swaps the set at 700ms; we take over right after */
      switchTimer = window.setTimeout(function () {
        cancelSlide();
        const nv = visibleCards();
        if (!nv.length) return;
        const ti     = middleStart(nv);
        const target = nv[ti];
        const left   = target.offsetLeft - (wrap.clientWidth - target.offsetWidth) / 2;
        const back   = Math.max(1, Math.min(3, ti));
        wrap.scrollLeft = left - back * pitch;   /* same card-grid phase, new content */
        updateWheel();
        animateScrollTo(left, SPIN_IN_MS, 'out');
        startTimer();
      }, SPIN_OUT_MS + 1);
    });
  });

  /* ---- mouse drag (pauses the auto-advance) ----
     Touch is handled by native horizontal scrolling instead — iOS cancels
     captured pointers the moment it suspects a scroll, which left the slider
     stuck. We gate the pointer-drag to the mouse and manage the timer for
     touch separately below. */
  let dragging = false, startX = 0, scrollAtStart = 0;

  wrap.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') return;   /* let touch scroll natively */
    dragging      = true;
    startX        = e.clientX;
    scrollAtStart = wrap.scrollLeft;
    delete wrap.dataset.dragged;
    wrap.setPointerCapture(e.pointerId);
    stopTimer();
    cancelSlide();
  });

  wrap.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    e.preventDefault();
    if (Math.abs(e.clientX - startX) > 5) wrap.dataset.dragged = '1';
    wrap.scrollLeft = scrollAtStart - (e.clientX - startX) * 1.1;
    /* if we wrapped to the other set mid-drag, shift the drag origin too */
    const d = normalize();
    if (d) scrollAtStart += d;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    /* settle on the nearest card, then resume the timer */
    const vis = visibleCards();
    if (vis[currentIdx]) centreCard(vis[currentIdx], true);
    startTimer();
  }
  wrap.addEventListener('pointerup',     endDrag);
  wrap.addEventListener('pointercancel', endDrag);

  /* ---- touch: native scroll drives the slider; just manage the timer ----
     pause auto-advance while the finger is down (and through momentum), then
     normalise back into the middle set and settle on the nearest card. */
  let touchSettle = null;
  wrap.addEventListener('touchstart', function () {
    stopTimer();
    cancelSlide();
    if (touchSettle) { window.clearTimeout(touchSettle); touchSettle = null; }
    delete wrap.dataset.dragged;
  }, { passive: true });
  wrap.addEventListener('touchmove', function () {
    wrap.dataset.dragged = '1';
  }, { passive: true });
  wrap.addEventListener('touchend', function () {
    /* CSS scroll-snap centres the card natively; we only wait out the
       momentum, keep the loop in the middle set, then resume auto-advance.
       No JS centreCard here — that was the post-release "catch". */
    if (touchSettle) window.clearTimeout(touchSettle);
    touchSettle = window.setTimeout(function () {
      normalize();
      updateWheel();
      startTimer();
    }, 600);
  }, { passive: true });

  /* ---- click: navigate / page ----
     Runs on every device (desktop + touch). A drag/swipe sets data-dragged,
     which suppresses the click. On fine pointers the slider edges page
     prev/next (matching the arrow cursor); anywhere else a card click opens
     the article. On touch there are no edge zones — any tap opens the article. */
  const CLICK_EDGE = 0.22;
  wrap.addEventListener('click', function (e) {
    if (wrap.dataset.dragged) { delete wrap.dataset.dragged; return; }
    /* The drag uses setPointerCapture, which retargets the click to the wrap —
       so e.target is unreliable here. Hit-test by coordinates instead. */
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    /* tags are inert (plain cursor, like the listing) */
    if (hit && hit.closest('.news-card__tag')) return;
    /* edges (fine pointers only) → page prev/next, matching the arrow cursor */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < CLICK_EDGE)     { if (window.newsSlider) window.newsSlider.prev(); return; }
      if (x > 1 - CLICK_EDGE) { if (window.newsSlider) window.newsSlider.next(); return; }
    }
    /* middle → open the article */
    if (hit && hit.closest('.news-card')) window.location.href = 'Articles.html';
  });
})();


/* ----------------------------------------------------------------
   4. News filter tabs
   ---------------------------------------------------------------- */
(function () {
  const filters = document.querySelectorAll('.news__filter');
  const cards   = document.querySelectorAll('.news-card');
  if (!filters.length) return;

  var swapTimer = null;

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filters.forEach(function (f) {
        f.classList.remove('news__filter--active');
        f.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('news__filter--active');
      btn.setAttribute('aria-selected', 'true');

      var filter = btn.dataset.filter;
      /* swap mid-gap: the slider strip has flown offscreen by 550ms and
         the new strip doesn't enter until 1050ms */
      if (swapTimer) window.clearTimeout(swapTimer);
      swapTimer = window.setTimeout(function () {
        cards.forEach(function (card) {
          var show = filter === 'all' || card.dataset.category === filter;
          card.style.display = show ? '' : 'none';
        });
      }, 700);
    });
  });
})();


/* ----------------------------------------------------------------
   4.5 Hero 3D photo field — the landing photos fly from deep space
   toward the viewer (ported from the 3am portfolio scene). Planes
   recycle once they pass the camera; opacity eases in at the far
   plane and out near the camera. The static photo set remains as a
   no-JS / reduced-motion fallback.
   ---------------------------------------------------------------- */
(function () {
  const hero  = document.getElementById('hero');
  const scene = document.getElementById('hero-scene');
  if (!hero || !scene) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  hero.classList.add('hero--scene');

  /* the 24 landing photos — shuffled so the planes pick them up in a
     random order on every load instead of a fixed 1..n sequence */
  const SRCS = [119, 120, 121, 123, 124, 125, 126, 162, 163, 164, 165, 166,
                167, 169, 171, 172, 174, 175, 178, 179, 180, 181, 182, 183]
    .map(function (n) { return 'assets/images/Rectangle%20' + n + '.png'; });
  for (let i = SRCS.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = SRCS[i]; SRCS[i] = SRCS[j]; SRCS[j] = t;
  }
  /* counts bumped ~30% on full desktop for a denser field; smaller
     screens and mobile scale back so the hero doesn't get cluttered */
  const VW = window.innerWidth;
  const COUNT = VW <= 767 ? 12 : VW <= 1280 ? 18 : 21;   /* photo planes */
  const DOTS  = VW <= 767 ? 10 : VW <= 1280 ? 15 : 17;   /* orange dots  */
  const TOTAL   = COUNT + DOTS;
  /* the polar spread is tuned for a wide desktop; the same radii on a
     narrow viewport fling every plane off the sides (perspective also
     magnifies them ~3× near the camera), so scale the spread down with
     the viewport width to keep planes crossing the visible area */
  const RSCALE  = Math.min(1, Math.max(0.34, VW / 1440));
  const MOBILE  = VW <= 767;
  /* mobile: nudge the inner radius out so the flight path leaves a clearer
     column down the middle for the headline, and fade planes in over a
     much longer distance so any that pass behind the text are still faint
     there — they only reach full colour as they fan out past the letters */
  const R_INNER = MOBILE ? 1.35 : 1;
  const FADE_IN = MOBILE ? 1500 : 450;
  const Z_START = -4200;
  const Z_END   = 700;

  const particles = [];

  function reset(p, scatter) {
    /* each plane is pinned to a side (p.side: +1 right, -1 left) that's
       handed out alternately at creation, so the left/right counts stay
       balanced instead of randomly leaning one way. The angle is random
       within that half; y is squashed — the hero is wide.            */
    let angle;
    do {
      angle = p.side > 0
        ? (Math.random() - 0.5) * Math.PI          /* right half: cos > 0 */
        : Math.PI / 2 + Math.random() * Math.PI;    /* left half:  cos < 0 */
      /* photos skip the straight-down sector (≈90°±32°) so they don't
         drift through the logo/description at the hero's bottom centre */
    } while (!p.dot && Math.abs(angle - Math.PI / 2) < 0.55);
    const radius = (1100 * R_INNER + Math.random() * 1600) * RSCALE;
    p.x = Math.cos(angle) * radius;
    p.y = Math.sin(angle) * radius * 0.62;
    p.z = scatter ? Z_START + Math.random() * (Z_END - Z_START) : Z_START;
    /* dots run a touch larger so they read even when far away */
    p.s = p.dot ? 0.7 + Math.random() * 0.6
                : 0.55 + Math.random() * 0.6;
    p.v = 3 + Math.random() * 4;
  }

  let nPhoto = 0, nDot = 0;
  for (let i = 0; i < TOTAL; i++) {
    const isDot = i >= COUNT;
    let el;
    if (isDot) {
      el = document.createElement('div');
      el.className = 'hero__plane hero__plane--dot';
    } else {
      el = document.createElement('img');
      el.src = SRCS[i % SRCS.length];
      el.alt = '';
      el.className = 'hero__plane';
    }
    /* alternate sides within each group so left/right stay even */
    const side = (isDot ? nDot++ : nPhoto++) % 2 === 0 ? 1 : -1;
    const p = { el: el, i: i, dot: isDot, side: side };
    reset(p, true);
    particles.push(p);
    scene.appendChild(el);
  }

  let running = true;
  window.addEventListener('scroll', function () {
    /* pause the loop once the hero is off screen */
    running = window.scrollY < hero.offsetHeight;
  }, { passive: true });

  /* group fade multipliers — the landing sequence brings dots in first,
     photos a beat later (targets settable from outside via heroScene).
     Current values start at 0 so nothing flashes before its cue; if the
     landing module is skipped the targets stay 1 and they just fade in. */
  const fade  = { dots: 0, photos: 0 };
  const fadeT = { dots: 1, photos: 1 };
  window.heroScene = fadeT;

  /* when a group gets its cue, queue its planes BEHIND the far plane —
     each one only becomes visible as it crosses the fade-in boundary,
     so they genuinely stream in one by one from nothing */
  const armed = { dots: false, photos: false };
  function arm(kind) {
    armed[kind] = true;
    particles.forEach(function (p) {
      if ((kind === 'dots') === !!p.dot) {
        reset(p, false);
        p.z = Z_START - Math.random() * (p.dot ? 1400 : 2600);
      }
    });
  }

  (function tick() {
    if (running) {
      if (!armed.dots   && fadeT.dots   > 0) arm('dots');
      if (!armed.photos && fadeT.photos > 0) arm('photos');
      fade.dots   += (fadeT.dots   - fade.dots)   * 0.03;
      fade.photos += (fadeT.photos - fade.photos) * 0.03;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.z += p.v;
        if (p.z > Z_END) reset(p, false);

        let o = 1;
        if (p.z < Z_START + FADE_IN)  o = Math.max(0, (p.z - Z_START) / FADE_IN);  /* fade in over distance; clamped for queued planes */
        else if (p.z > Z_END - 300)   o = Math.max(0, (Z_END - p.z) / 300);

        p.el.style.opacity = (o * (p.dot ? fade.dots : fade.photos)).toFixed(3);
        p.el.style.transform =
          'translate(-50%,-50%) translate3d(' + p.x.toFixed(1) + 'px,' +
          p.y.toFixed(1) + 'px,' + p.z.toFixed(1) + 'px) scale(' + p.s + ')';
      }
    }
    window.requestAnimationFrame(tick);
  })();
})();


/* ----------------------------------------------------------------
   5. Wave line — pin the decorative line so it always starts at the
   end of the Pillars section and ends 109px (245px on mobile) above
   the page bottom, whatever the viewport. The SVG stretches
   (preserveAspectRatio="none"), which also keeps the path geometry
   stable for the future scroll-draw animation.
   ---------------------------------------------------------------- */
(function () {
  const wave    = document.querySelector('.footer__wave');
  const pillars = document.getElementById('pillars');
  const footer  = document.getElementById('footer');
  if (!wave || !pillars || !footer) return;

  function placeWave() {
    /* lift the start point above the pillars boundary so the first curve
       weaves through the approach cards, like the design */
    const lead = window.innerWidth <= 767 ? 60 : 350;
    const top = pillars.getBoundingClientRect().bottom
              - footer.getBoundingClientRect().top
              - lead;
    wave.style.top    = Math.round(top) + 'px';
    wave.style.height = 'auto';          /* stretch between top & bottom */
  }

  window.addEventListener('load', placeWave);
  window.addEventListener('resize', placeWave);
  placeWave();
})();


/* ----------------------------------------------------------------
   5.5 Scroll-drawn lines — the arc (pillars) and the wave (footer)
   draw themselves in as you scroll, the stroke tip leading the way
   down the page. Reduced-motion users get the full lines statically.
   ---------------------------------------------------------------- */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const items = [
    { path: document.getElementById('arc-path'),  dot: document.getElementById('arc-dot') },
    { path: document.getElementById('wave-path'), dot: null }
  ].filter(function (it) { return it.path; });
  if (!items.length) return;

  items.forEach(function (it) {
    it.svg = it.path.closest('svg');
    it.len = it.path.getTotalLength();
    it.path.style.strokeDasharray  = it.len + ' ' + it.len;
    it.path.style.strokeDashoffset = it.len;
  });

  let queued = false;
  function update() {
    queued = false;
    const vh = window.innerHeight;
    /* the wave's tail sits below the last scrollable position — over the
       final 600px of scroll, ramp any unfinished line to 100% so it
       completes itself as the footer comes into view */
    const maxScroll = document.documentElement.scrollHeight - vh;
    const fromEnd   = maxScroll - window.scrollY;
    const endBoost  = 1 - Math.min(1, Math.max(0, fromEnd / 600));

    items.forEach(function (it) {
      const r = it.svg.getBoundingClientRect();
      /* 0 → tip appears as the line enters the lower viewport,
         1 → fully drawn just before its end scrolls past         */
      let p = (vh * 0.9 - r.top) / (r.height + vh * 0.35);
      p = Math.max(0, Math.min(1, Math.max(p, endBoost)));
      it.path.style.strokeDashoffset = (it.len * (1 - p)).toFixed(1);
      if (it.dot) it.dot.style.opacity = p > 0.005 ? '1' : '0';
    });
  }
  function request() {
    if (!queued) { queued = true; window.requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
})();


/* The listing background line is a static decorative sweep behind the cards
   (no scroll-draw) — see .listing__line in style.css. */


/* ----------------------------------------------------------------
   6. Custom cursor — orange dot with a lerped follow.
   Morphs over links/buttons, and over the news slider it becomes a
   big "DISCOVER" circle; near the slider's edges it turns into an
   arrow circle and a click there navigates prev/next.
   Only enabled for fine pointers (mouse/trackpad), never touch.
   ---------------------------------------------------------------- */
(function () {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const cursor = document.getElementById('cursor');
  if (!cursor) return;

  document.body.classList.add('has-custom-cursor');

  /* the page is zoomed to 90% below 1800px — pointer coordinates are in
     real viewport px while the fixed cursor lives in the zoomed canvas,
     so divide everything by the effective zoom */
  let zoom = 1;
  function readZoom() {
    zoom = parseFloat(window.getComputedStyle(document.body).zoom) || 1;
  }
  readZoom();
  window.addEventListener('resize', readZoom);

  let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
  let cx = tx, cy = ty;
  let magnet = null;           /* element the cursor is snapped onto */

  /* hidden until the pointer first moves — otherwise on (re)load it would
     appear at screen-centre and visibly fly to the mouse */
  let primed = false;
  cursor.classList.add('cursor--hidden');

  document.addEventListener('mousemove', function (e) {
    tx = e.clientX; ty = e.clientY;
    if (!primed) {
      /* snap straight to the pointer the first time, so it never flies in */
      primed = true;
      cx = tx / zoom; cy = ty / zoom;
    }
    cursor.classList.remove('cursor--hidden');
  });
  document.documentElement.addEventListener('mouseleave', function () {
    cursor.classList.add('cursor--hidden');
  });

  (function follow() {
    let gx = tx / zoom, gy = ty / zoom;
    if (magnet) {
      /* stick to the centre of the hovered control */
      const r = magnet.getBoundingClientRect();
      gx = (r.left + r.width / 2) / zoom;
      gy = (r.top + r.height / 2) / zoom;
    }
    const k = magnet ? 0.3 : 0.2;
    cx += (gx - cx) * k;
    cy += (gy - cy) * k;
    cursor.style.transform =
      'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0) translate(-50%,-50%)';
    window.requestAnimationFrame(follow);
  })();

  /* magnetic wrap on buttons + menu links */
  function engage(el) {
    magnet = el;
    const r = el.getBoundingClientRect();
    const w = r.width / zoom, h = r.height / zoom;
    cursor.classList.add('cursor--magnet');
    /* hug the target tightly — ~2px gap (the ring is border-box with a 2.5px
       border, so +9 on each dimension leaves about 2px of clearance).
       Plain-text nav links have no padded box of their own, so give them a
       roomier wrap instead of hugging the glyphs. */
    const navLink = el.matches && el.matches('.nav__link, .nav__lang');
    /* the nav search button gets a 20% bigger ring on hover — but not in the
       shrunk sticky state */
    const navEl = document.getElementById('nav');
    const boost = (el.matches && el.matches('.nav__search-btn') &&
                   !(navEl && navEl.classList.contains('nav--scrolled'))) ? 1.2 : 1;
    if (!navLink && Math.abs(w - h) < 12) {
      /* near-square targets (e.g. the search icon) get a perfect circle */
      const s = Math.round((Math.max(w, h) + 9) * boost);
      cursor.style.width  = s + 'px';
      cursor.style.height = s + 'px';
    } else {
      cursor.style.width  = Math.round((w + (navLink ? 24 : 9)) * boost) + 'px';
      cursor.style.height = Math.round((h + (navLink ? 16 : 9)) * boost) + 'px';
    }
  }
  function release() {
    magnet = null;
    cursor.classList.remove('cursor--magnet');
    cursor.style.width  = '';
    cursor.style.height = '';
  }
  document.querySelectorAll('.btn-circle, button, .nav__link, .nav__lang').forEach(function (el) {
    /* listing filters / breadcrumb use a plain colour hover — no magnet wrap;
       the mobile menu + search overlay use an underline-draw hover instead of
       the cursor frame */
    if (el.closest('.listing__filters') || el.closest('.listing__crumb') ||
        el.closest('.nav__mobile-menu') || el.closest('.search-overlay')) return;
    el.addEventListener('mouseenter', function () { engage(el); });
    el.addEventListener('mouseleave', release);
  });

  /* listing story cards: big "DISCOVER" circle over the card body, but a
     plain (clickable) cursor over the individual tags */
  document.querySelectorAll('.story-card').forEach(function (card) {
    card.addEventListener('mouseenter', function () { cursor.classList.add('cursor--discover'); });
    card.addEventListener('mouseleave', function () { cursor.classList.remove('cursor--discover'); });
    card.querySelectorAll('.story-card__tag').forEach(function (tag) {
      tag.addEventListener('mouseenter', function () { cursor.classList.remove('cursor--discover'); });
      tag.addEventListener('mouseleave', function () { cursor.classList.add('cursor--discover'); });
    });
  });

  /* news slider: DISCOVER in the middle, arrows at the edges */
  const wrap = document.getElementById('news-carousel-wrap');
  if (wrap) {
    const EDGE = 0.22;   /* fraction of the wrap width that counts as an edge */

    function zone(e) {
      const r = wrap.getBoundingClientRect();
      return (e.clientX - r.left) / r.width;
    }
    function setMode(e) {
      cursor.classList.remove('cursor--discover', 'cursor--prev', 'cursor--next');
      /* over a tag → plain cursor (tags are their own thing, like the listing) */
      if (e.target.closest('.news-card__tag')) return;
      /* edges → prev/next arrows, middle → DISCOVER */
      const x = zone(e);
      if      (x < EDGE)     cursor.classList.add('cursor--prev');
      else if (x > 1 - EDGE) cursor.classList.add('cursor--next');
      else                   cursor.classList.add('cursor--discover');
    }
    wrap.addEventListener('mousemove', setMode);
    wrap.addEventListener('mouseenter', setMode);
    wrap.addEventListener('mouseleave', function () {
      cursor.classList.remove('cursor--discover', 'cursor--prev', 'cursor--next');
    });

    /* click handling (edge paging + card navigation) lives in the carousel
       module so it also works on touch; here we only drive the cursor visual */
  }
})();


/* ----------------------------------------------------------------
   7. Landing sequence —
   logo splash (centre) → fade → headline + orange dots →
   photos + bottom text → menu drops in from the top.
   Skipped entirely for reduced-motion / no-JS.
   ---------------------------------------------------------------- */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  /* homepage only — inner pages (no hero) don't get the logo splash */
  if (!document.getElementById('hero')) return;

  /* splash built by script so no-JS visitors never get blocked */
  const pre = document.createElement('div');
  pre.className = 'preloader';
  pre.innerHTML = '<img src="assets/icons/logo-nav.png" alt="D. H. Chen Foundation" />';
  document.body.appendChild(pre);

  document.documentElement.classList.add('lock-scroll');
  if (window.__lenis) window.__lenis.stop();
  document.body.classList.add('lp-nav', 'lp-h1', 'lp-h2');
  if (window.heroScene) { window.heroScene.dots = 0; window.heroScene.photos = 0; }
  window.scrollTo(0, 0);

  window.setTimeout(function () { pre.classList.add('logo-out'); }, 1100);

  window.setTimeout(function () {
    pre.classList.add('out');
    document.documentElement.classList.remove('lock-scroll');
    if (window.__lenis) window.__lenis.start();
  }, 1600);

  /* headline in */
  window.setTimeout(function () {
    document.body.classList.remove('lp-h1');
  }, 1700);

  /* while the headline is still settling, the logomark flows in and
     the description + scroll cue cascade off it (CSS delays) */
  window.setTimeout(function () {
    document.body.classList.remove('lp-h2');
  }, 2150);

  /* orange dots stream in a beat after the headline has landed, so the
     text reads first and the dots don't feel rushed on top of it */
  window.setTimeout(function () {
    if (window.heroScene) window.heroScene.dots = 1;
  }, 2250);

  /* photos + menu join as the text tail finishes — overlapping beats */
  window.setTimeout(function () { document.body.classList.remove('lp-nav'); }, 2650);
  window.setTimeout(function () {
    if (window.heroScene) window.heroScene.photos = 1;
  }, 2700);

  window.setTimeout(function () { pre.remove(); }, 2400);
})();


/* ----------------------------------------------------------------
   8. Scroll reveal — content floats up from below as it scrolls into
   view, with a slight stagger inside each group (e.g. the three
   Challenge circles land one after another).
   ---------------------------------------------------------------- */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  /* [selector, delay-ms] — delays create the in-group sequencing */
  const ITEMS = [
    ['.intro__label', 0], ['.intro__foundation-headline', 100],
    ['.intro__bullets', 200], ['.intro__video', 250],

    ['.challenge__label', 0], ['.challenge__headline', 100],
    ['.challenge__body', 200], ['.challenge__btn', 300],
    ['.challenge__circle--1', 100], ['.challenge__circle--2', 280],
    ['.challenge__circle--3', 460],

    ['.pillars__heading', 0],
    ['.pillar-card--issues', 0], ['.pillar-card--sector', 150],

    ['.approach > .label', 0],
    ['.approach-card--1', 0], ['.approach-card--2', 130],
    ['.approach-card--3', 260], ['.approach-card--4', 330],
    ['.approach-card--5', 460],
    ['.approach__cta', 0],

    ['.news__heading', 0], ['.news__filters', 130],
    ['.news__carousel-wrap', 220], ['.news__cta', 0],

    ['.footer__logo', 0], ['.footer__col', 120], ['.footer__legal-nav', 240],

    /* inner-page (listing) — only present on Listing.html
       (cards are NOT revealed here: the late trigger left lower rows blank
       on load — they're shown immediately instead) */
    ['.listing__title', 0], ['.listing__filters', 120]
  ];

  const targets = [];
  ITEMS.forEach(function (item) {
    document.querySelectorAll(item[0]).forEach(function (el) {
      el.classList.add('reveal');
      if (item[1]) el.style.transitionDelay = item[1] + 'ms';
      targets.push(el);
    });
  });

  function land(el) {
    el.classList.add('is-in');
    obs.unobserve(el);
    /* clear the stagger delay once landed so later hovers stay snappy */
    window.setTimeout(function () { el.style.transitionDelay = ''; }, 2000);
  }

  const obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      land(el);
      /* reveal the "Read more" CTA together with the news cards — it sits below
         the tall carousel, so on its own it would only trigger after scrolling
         well past the cards (user couldn't see it while viewing the news) */
      if (el.classList.contains('news__carousel-wrap')) {
        const cta = document.querySelector('.news__cta');
        if (cta && !cta.classList.contains('is-in')) land(cta);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -22% 0px' });   /* fire later — well into view */

  targets.forEach(function (el) { obs.observe(el); });

  /* Safety net: the observer fires 22% early (rootMargin), so elements that
     settle in the bottom of the viewport at the page end — the footer columns
     — would never trigger and stay hidden. Reveal any stragglers near the end. */
  function flushAtBottom() {
    const atEnd = window.scrollY + window.innerHeight >=
                  document.documentElement.scrollHeight - 120;
    if (!atEnd) return;
    targets.forEach(function (el) {
      if (el.classList.contains('is-in')) return;
      el.classList.add('is-in');
      obs.unobserve(el);
      window.setTimeout(function () { el.style.transitionDelay = ''; }, 2000);
    });
  }
  window.addEventListener('scroll', flushAtBottom, { passive: true });
  window.addEventListener('resize', flushAtBottom);
  flushAtBottom();
})();


/* ----------------------------------------------------------------
   8.6 Draw-on-scroll — the pillar illustrations and the Challenge circle
   rings draw themselves in as they scroll into view, all with the same
   hand-drawn stroke effect:
     · hands (stroke art) + circle rings → stroke-dashoffset draw
     · flower (filled art) → fetched + inlined, each shape's outline traces
       on, then the colour fills in
   Reduced-motion / no-IO users get the final static state.
   ---------------------------------------------------------------- */
(function () {
  if (!('IntersectionObserver' in window)) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* inject an SVG ring into every challenge circle (replaces the CSS border) */
  const rings = [];
  document.querySelectorAll('.challenge__circle').forEach(function (c) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'challenge__circle-ring');
    svg.setAttribute('viewBox', '0 0 100 100');
    /* keep the aspect ratio so the ring stays a true circle (not an oval) */
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    const ring = document.createElementNS(SVGNS, 'circle');
    ring.setAttribute('cx', '50');
    ring.setAttribute('cy', '50');
    ring.setAttribute('r', '49.5');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#ff6900');
    /* plain scaling stroke draws reliably as a full circle (non-scaling-stroke
       broke the dash → partial arcs). Width is set per-circle below so it
       renders a constant ~1px at every circle size. */
    svg.appendChild(ring);
    c.insertBefore(svg, c.firstChild);
    c.classList.add('has-ring');
    rings.push(ring);
  });

  /* keep the ring line ~1px regardless of the circle's rendered size:
     stroke-width (in the 100-unit viewBox) = 100 / circle-width-in-px */
  function sizeRings() {
    rings.forEach(function (r) {
      const w = r.ownerSVGElement && r.ownerSVGElement.parentNode.offsetWidth;
      if (w) r.style.strokeWidth = (100 / w).toFixed(3);
    });
  }
  sizeRings();
  window.addEventListener('load', sizeRings);
  window.addEventListener('resize', sizeRings);

  if (reduce) return;   /* leave everything in its final drawn state */

  /* prime stroke paths: full-length dash, fully offset (hidden) */
  function prime(el) {
    try {
      const len = el.getTotalLength();
      el.style.strokeDasharray  = len;
      el.style.strokeDashoffset = len;
    } catch (e) {}
  }
  document.querySelectorAll('[data-draw="stroke"] path').forEach(prime);
  rings.forEach(prime);

  const obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.dataset.draw === 'stroke' || el.dataset.draw === 'sketch') {
        /* stagger the strokes so they draw one after another */
        const sketch = el.dataset.draw === 'sketch';
        const step = sketch ? 12 : 180;
        Array.prototype.slice.call(el.querySelectorAll('path')).forEach(function (p, i) {
          p.style.transitionDelay = sketch
            ? (i * step) + 'ms, ' + (i * step + 1300) + 'ms, ' + (i * step + 2100) + 'ms'  /* draw, fill, then drop the tracing stroke */
            : (i * step) + 'ms';
          p.style.strokeDashoffset = '0';
          if (sketch) { p.style.fillOpacity = '1'; p.style.strokeOpacity = '0'; }
        });
      } else if (el.classList.contains('challenge__circle')) {
        const ring = el.querySelector('.challenge__circle-ring circle');
        if (ring) ring.style.strokeDashoffset = '0';
      }
      obs.unobserve(el);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -18% 0px' });   /* start drawing later */

  document.querySelectorAll('[data-draw="stroke"], .challenge__circle')
    .forEach(function (el) { obs.observe(el); });

  /* Flower: it's filled line-art, so fetch + inline it, trace each shape's
     outline (stroke = its own fill colour), then fade the fill in. */
  const flowerImg = document.querySelector('[data-draw="flower"]');
  if (flowerImg) {
    fetch(flowerImg.getAttribute('src'))
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        const tmp = document.createElement('div');
        tmp.innerHTML = txt.trim();
        const svg = tmp.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('data-draw', 'sketch');
        svg.setAttribute('aria-hidden', 'true');
        flowerImg.replaceWith(svg);
        Array.prototype.slice.call(svg.querySelectorAll('path')).forEach(function (p) {
          p.style.stroke = p.getAttribute('fill') || 'currentColor';
          p.style.fillOpacity = '0';
          prime(p);
        });
        obs.observe(svg);
      })
      .catch(function () { /* fetch blocked (e.g. file://) → static image stays */ });
  }
})();


/* ----------------------------------------------------------------
   8.5 Layout grid overlay — press "G" to toggle the design grid
   (6 cols / 50px margins / 40px gutter; light orange). A dev aid for
   checking alignment. Ignored while typing in a field.
   ---------------------------------------------------------------- */
(function () {
  let grid = null;
  function build() {
    grid = document.createElement('div');
    grid.id = 'layout-grid';
    grid.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('div');
    inner.className = 'layout-grid__inner';
    for (let i = 0; i < 6; i++) {
      const col = document.createElement('div');
      col.className = 'layout-grid__col';
      inner.appendChild(col);
    }
    grid.appendChild(inner);
    document.body.appendChild(grid);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'g' && e.key !== 'G') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    if (!grid) build();
    grid.classList.toggle('layout-grid--on');
  });
})();


/* ----------------------------------------------------------------
   8.8 Approach bubbles/dots — subtle cursor parallax on top of the CSS
   idle float. Each element drifts toward the cursor by its own amount and
   direction (set from a stable per-index pseudo-random), so the motion
   reads as natural rather than uniform. Desktop pointers only.
   ---------------------------------------------------------------- */
(function () {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes = document.querySelectorAll('.approach__bubbles .pillar-bubble, .approach__bubbles .approach-dot');
  if (!nodes.length) return;

  const items = [];
  nodes.forEach(function (el, i) {
    /* stable 0..1 pseudo-random per element */
    const s = Math.sin((i + 1) * 53.17) * 1000;
    const r = s - Math.floor(s);
    const isDot = el.classList.contains('approach-dot');
    const base  = isDot ? 13 : 8;            /* dots drift a touch more */
    items.push({
      el: el,
      fx: (base + r * 11) * (r > 0.5 ? 1 : -1),       /* magnitude + direction */
      fy: (base + (1 - r) * 9) * (i % 2 ? -1 : 1),
      cx: 0, cy: 0
    });
  });

  let tx = 0, ty = 0;   /* cursor, normalised −1..1 from viewport centre */
  window.addEventListener('mousemove', function (e) {
    tx = (e.clientX / window.innerWidth  - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  (function loop() {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      it.cx += (tx * it.fx - it.cx) * 0.05;   /* eased follow */
      it.cy += (ty * it.fy - it.cy) * 0.05;
      it.el.style.transform = 'translate3d(' + it.cx.toFixed(2) + 'px,' + it.cy.toFixed(2) + 'px,0)';
    }
    window.requestAnimationFrame(loop);
  })();
})();


/* ----------------------------------------------------------------
   9. Broken image fallback — show a tinted placeholder
   ---------------------------------------------------------------- */
(function () {
  document.querySelectorAll('img').forEach(function (img) {
    img.addEventListener('error', function () {
      img.style.opacity = '0';
      var parent = img.parentElement;
      if (parent && !parent.dataset.ph) {
        parent.dataset.ph = '1';
        parent.style.background = 'rgba(0,0,0,.06)';
      }
    });
  });
})();


/* ----------------------------------------------------------------
   10. Dropdowns — generic toggle for [data-dropdown] (listing filters
   + breadcrumb). Click toggles; clicking another closes the rest;
   click-outside / Escape closes all. (No-op on pages without any.)
   ---------------------------------------------------------------- */
(function () {
  const drops = Array.prototype.slice.call(document.querySelectorAll('[data-dropdown]'));
  if (!drops.length) return;

  function closeAll(except) {
    drops.forEach(function (d) {
      if (d === except) return;
      d.classList.remove('is-open');
      const t = d.querySelector('button[aria-expanded]');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  drops.forEach(function (d) {
    const toggle = d.querySelector('button');
    if (!toggle) return;
    /* the toggle's editable label (filters wrap it in a <span>; the breadcrumb
       has a bare text node before the chevron) */
    const labelSpan = toggle.querySelector('span');
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      const open = d.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      closeAll(open ? d : null);
    });
    /* picking an option writes it back onto the toggle, then closes */
    d.querySelectorAll('[role="menuitem"]').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const text = item.textContent.trim();
        if (labelSpan) labelSpan.textContent = text;
        else if (toggle.firstChild) toggle.firstChild.nodeValue = text + ' ';
        d.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  });

  document.addEventListener('click', function () { closeAll(null); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(null); });
})();


/* ----------------------------------------------------------------
   11. Share — OS-native share sheet via the Web Share API, with a
   clipboard fallback for browsers without navigator.share (most
   desktops). (No-op on pages without a [data-send-title] button.)
   ---------------------------------------------------------------- */
(function () {
  const buttons = Array.prototype.slice.call(document.querySelectorAll('.article__send'));
  if (!buttons.length) return;

  buttons.forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const data = {
        title: btn.dataset.sendTitle || document.title,
        text:  btn.dataset.sendText  || '',
        url:   window.location.href
      };
      try {
        if (navigator.share) {
          await navigator.share(data);          /* iOS / Android / Safari / Edge: OS sheet */
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(data.url);   /* desktop fallback */
          btn.classList.add('article__send--copied');
          setTimeout(function () { btn.classList.remove('article__send--copied'); }, 1600);
        }
      } catch (err) {
        /* user dismissed the share sheet — ignore */
      }
    });
  });
})();


/* ----------------------------------------------------------------
   12. Listing story cards — clicking a card opens the article
   (tags are inert). No carousel here, so e.target is reliable.
   No-op on pages without any story cards.
   ---------------------------------------------------------------- */
(function () {
  const cards = Array.prototype.slice.call(document.querySelectorAll('.story-card'));
  if (!cards.length) return;
  cards.forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.target.closest('.story-card__tag')) return;   /* tags inert */
      window.location.href = 'Articles.html';
    });
  });
})();


/* ----------------------------------------------------------------
   13. Desktop mega-menu — hovering Work / Impact / About opens its
   panel; hovering Connect / logo / actions (or leaving the nav)
   closes it. Hover devices only; no-op on pages without the markup.
   ---------------------------------------------------------------- */
(function () {
  const nav  = document.getElementById('nav');
  const mega = document.getElementById('nav-mega');
  if (!nav || !mega) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const links   = Array.prototype.slice.call(nav.querySelectorAll('.nav__menu .nav__link'));
  const panels  = Array.prototype.slice.call(mega.querySelectorAll('.nav__mega-panel'));
  let closeTimer = null;

  /* ---- draw-in illustrations -------------------------------------------
     Inline each panel's SVG so its strokes can be animated, then redraw it
     every time the panel opens (same hand-drawn effect as the pillars):
       · stroke art  → just draw the stroke (dashoffset len → 0)
       · filled art  → trace each shape's outline, then fade the fill in    */
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const drawables = {};   /* panel-key → svg (once inlined) */

  function prime(p) {
    try { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; }
    catch (e) {}
  }
  /* getTotalLength() needs the node visible (returns 0 in a display:none
     subtree), so the dash priming is done lazily the first time a panel opens */
  function primeSvg(svg) {
    Array.prototype.slice.call(svg.querySelectorAll('path')).forEach(prime);
    svg.dataset.primed = '1';
  }
  function arm(svg) {                                  /* reset to the undrawn state */
    const filled = svg.dataset.kind === 'filled';
    Array.prototype.slice.call(svg.querySelectorAll('path')).forEach(function (p) {
      p.style.transition = 'none';
      p.style.strokeDashoffset = p.style.strokeDasharray;
      if (filled) { p.style.fillOpacity = '0'; p.style.strokeOpacity = '1'; }
    });
    void svg.getBoundingClientRect();                  /* flush, so the reset isn't animated */
    Array.prototype.slice.call(svg.querySelectorAll('path')).forEach(function (p) {
      p.style.transition = ''; p.style.transitionDelay = '';
    });
  }
  function draw(svg) {
    if (!svg) return;
    const filled = svg.dataset.kind === 'filled';
    const paths = Array.prototype.slice.call(svg.querySelectorAll('path'));
    const step = +svg.dataset.step || 150;
    paths.forEach(function (p, i) {
      const d = i * step;
      /* filled: trace the outline, ink the fill in while the line is still
         down (+1.3s), then drop the tracing stroke (+2.1s) — an overlapping
         handoff (no dead pause), same as the pillar "flower" / Issues art */
      p.style.transitionDelay = filled ? (d + 'ms, ' + (d + 1300) + 'ms, ' + (d + 2100) + 'ms') : (d + 'ms');
      p.style.strokeDashoffset = '0';
      if (filled) { p.style.fillOpacity = '1'; p.style.strokeOpacity = '0'; }
    });
  }
  /* called when a panel opens (now visible): prime the dashes the first time,
     re-arm on later opens, then kick off the draw on the next frame */
  function startDraw(svg) {
    requestAnimationFrame(function () {
      if (!svg.dataset.primed) primeSvg(svg);   /* measure + dash now that it's visible */
      arm(svg);                                  /* reset to undrawn instantly (no transition) */
      requestAnimationFrame(function () { draw(svg); });
    });
  }

  panels.forEach(function (panel) {
    const img = panel.querySelector('img.nav__mega-art');
    if (!img) return;
    fetch(img.getAttribute('src'))
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        const tmp = document.createElement('div');
        tmp.innerHTML = txt.trim();
        const svg = tmp.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('class', 'nav__mega-art');
        svg.setAttribute('aria-hidden', 'true');

        /* attach to the live DOM FIRST — getTotalLength()/getComputedStyle()
           return 0/empty on a detached node, which would leave the art
           undrawn-but-visible */
        img.replaceWith(svg);
        drawables[panel.dataset.megaPanel] = svg;
        if (reduce) return;                            /* leave it fully drawn */

        /* Every panel draws like the pillar "flower" / Issues-focused art:
           each shape traces its own outline (stroke = its own fill colour),
           then the fill inks in while the trace is still down. Fill can come
           from a <style> class (Work uses .st0), so read the computed value. */
        const paths = Array.prototype.slice.call(svg.querySelectorAll('path'));
        function fillOf(p) {
          const f = getComputedStyle(p).fill;
          return (f && f !== 'none' && f !== 'rgba(0, 0, 0, 0)') ? f : '';
        }
        const filled = paths.some(fillOf);
        svg.dataset.kind = filled ? 'filled' : 'stroke';
        /* spread the stagger over a ~0.7s window so busy art (Work, 50+ shapes)
           still draws quickly; few clean paths (Impact/About) keep the 150ms beat */
        svg.dataset.step = paths.length > 12
          ? String(Math.max(8, Math.round(700 / paths.length)))
          : '150';

        if (filled) {                                  /* trace: stroke = fill colour, hide fill */
          paths.forEach(function (p) {
            const f = fillOf(p);
            if (f) { p.style.stroke = f; p.style.fillOpacity = '0'; }
            if (!p.getAttribute('stroke-width')) p.style.strokeWidth = '1';   /* fine trace line (Work) */
          });
        } else {                                       /* stroke art (Impact): thin the line */
          paths.forEach(function (p) {
            if (!p.getAttribute('stroke-width')) p.style.strokeWidth = '0.7';
          });
        }
        /* priming + first draw happen lazily on open (see startDraw) */
        if (panel.classList.contains('is-active')) startDraw(svg);
      })
      .catch(function () { /* file:// or fetch blocked → static image stays */ });
  });

  function open(key) {
    clearTimeout(closeTimer);
    const wasActive = nav.classList.contains('nav--mega-open') &&
                      mega.querySelector('.nav__mega-panel.is-active[data-mega-panel="' + key + '"]');
    nav.classList.add('nav--mega-open');
    mega.setAttribute('aria-hidden', 'false');
    panels.forEach(function (p) { p.classList.toggle('is-active', p.dataset.megaPanel === key); });
    links.forEach(function (l) { l.classList.toggle('nav__link--mega-active', l.dataset.mega === key); });
    if (!wasActive && !reduce && drawables[key]) startDraw(drawables[key]);
  }
  function close() {
    nav.classList.remove('nav--mega-open');
    mega.setAttribute('aria-hidden', 'true');
    panels.forEach(function (p) { p.classList.remove('is-active'); });
    links.forEach(function (l) { l.classList.remove('nav__link--mega-active'); });
  }

  /* a section link opens its panel; any other nav link closes the menu */
  links.forEach(function (l) {
    l.addEventListener('mouseenter', function () {
      if (l.dataset.mega) open(l.dataset.mega); else close();
    });
  });
  /* hovering the logo or the right-side actions closes it too */
  nav.querySelectorAll('.nav__logo, .nav__actions').forEach(function (el) {
    el.addEventListener('mouseenter', close);
  });

  /* leaving the whole nav (bar + open panel) closes, with a small grace
     period so crossing the gap from a link to the panel doesn't flicker */
  nav.addEventListener('mouseenter', function () { clearTimeout(closeTimer); });
  nav.addEventListener('mouseleave', function () {
    clearTimeout(closeTimer);
    closeTimer = window.setTimeout(close, 120);
  });
})();
