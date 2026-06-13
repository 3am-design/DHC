/* ================================================================
   D. H. Chen Foundation — script.js
   ================================================================ */
'use strict';

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
    if (window.__lenis) { open ? window.__lenis.stop() : window.__lenis.start(); }
  }

  btn.addEventListener('click', function () {
    setOpen(!menu.classList.contains('nav__mobile-menu--open'));
  });
  if (close) close.addEventListener('click', function () { setOpen(false); });

  /* any nav choice (links, 中文) closes the overlay */
  menu.querySelectorAll('.nav__mobile-link, .nav__mobile-sublink, .nav__mobile-lang')
    .forEach(function (l) { l.addEventListener('click', function () { setOpen(false); }); });
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

  function centreCard(card, smooth) {
    const left = card.offsetLeft - (wrap.clientWidth - card.offsetWidth) / 2;
    if (smooth) animateScrollTo(left, SLIDE_MS);
    else        wrap.scrollLeft = left;
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

  const SRCS = [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) {
    return 'assets/images/hero-photo-' + n + '.png';
  });
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

  document.addEventListener('mousemove', function (e) {
    tx = e.clientX; ty = e.clientY;
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
    if (Math.abs(w - h) < 12) {
      /* near-square targets (e.g. the search icon) get a perfect circle */
      const s = Math.round(Math.max(w, h) + 18);
      cursor.style.width  = s + 'px';
      cursor.style.height = s + 'px';
    } else {
      cursor.style.width  = Math.round(w + 24) + 'px';
      cursor.style.height = Math.round(h + 18) + 'px';
    }
  }
  function release() {
    magnet = null;
    cursor.classList.remove('cursor--magnet');
    cursor.style.width  = '';
    cursor.style.height = '';
  }
  document.querySelectorAll('.btn-circle, button, .nav__link, .nav__lang').forEach(function (el) {
    el.addEventListener('mouseenter', function () { engage(el); });
    el.addEventListener('mouseleave', release);
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
      const x = zone(e);
      cursor.classList.remove('cursor--discover', 'cursor--prev', 'cursor--next');
      if      (x < EDGE)     cursor.classList.add('cursor--prev');
      else if (x > 1 - EDGE) cursor.classList.add('cursor--next');
      else                   cursor.classList.add('cursor--discover');
    }
    wrap.addEventListener('mousemove', setMode);
    wrap.addEventListener('mouseenter', setMode);
    wrap.addEventListener('mouseleave', function () {
      cursor.classList.remove('cursor--discover', 'cursor--prev', 'cursor--next');
    });

    wrap.addEventListener('click', function (e) {
      if (wrap.dataset.dragged) { delete wrap.dataset.dragged; return; }
      if (!window.newsSlider) return;
      const x = zone(e);
      if      (x < EDGE)     window.newsSlider.prev();
      else if (x > 1 - EDGE) window.newsSlider.next();
    });
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

    ['.footer__logo', 0], ['.footer__col', 120], ['.footer__legal-nav', 240]
  ];

  const targets = [];
  ITEMS.forEach(function (item) {
    document.querySelectorAll(item[0]).forEach(function (el) {
      el.classList.add('reveal');
      if (item[1]) el.style.transitionDelay = item[1] + 'ms';
      targets.push(el);
    });
  });

  const obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-in');
      obs.unobserve(el);
      /* clear the stagger delay once landed so later hovers stay snappy */
      window.setTimeout(function () { el.style.transitionDelay = ''; }, 2000);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -130px 0px' });

  targets.forEach(function (el) { obs.observe(el); });
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
