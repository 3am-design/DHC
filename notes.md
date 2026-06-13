# D. H. Chen Foundation — Build Notes
Figma reference: Desktop `OPT1_01_Home_01_Desktop` · Mobile `OPT1_01_Home_01_Mobile`
Last updated: assets downloaded, layout fine-tuned.

---

## Asset Status — All Downloaded ✓

All assets were downloaded directly from the Figma MCP API and saved locally.
No manual export from Figma is required.

### Icons & SVGs — `/assets/icons/`
| File | Source node | Status |
|------|------------|--------|
| `logo-nav.svg`       | Layer_2 (nav, desktop)        | ✓ Downloaded |
| `logo-hero.svg`      | Logo1 (hero logomark)         | ✓ Downloaded |
| `logo-footer.svg`    | Logo (footer)                 | ✓ Downloaded |
| `icon-arrow.svg`     | right-arrow 1 / Group         | ✓ Downloaded |
| `icon-play.svg`      | play node                     | ✓ Downloaded |
| `icon-check.svg`     | checked 1                     | ✓ Downloaded |
| `icon-self.svg`      | me 2                          | ✓ Downloaded |
| `icon-community.svg` | Vector (challenge circle 2)   | ✓ Downloaded |
| `icon-crowd.svg`     | crowd 1                       | ✓ Downloaded |
| `icon-search.svg`    | loupe 1 / Group5              | ✓ Downloaded |
| `icon-hamburger.svg` | menu (mobile nav)             | ✓ Downloaded |
| `icon-linkedin.svg`  | 10.Linkedin                   | ✓ Downloaded |
| `icon-instagram.svg` | instagram 1                   | ✓ Downloaded |
| `line-arc.svg`       | Line / Vector1 (pillar arc)   | ✓ Downloaded |
| `line-wave.svg`      | Vector2 (footer wave)         | ✓ Downloaded |

### Images — `/assets/images/`
| File | Source node | Status |
|------|------------|--------|
| `hero-photo-1.png` | Rectangle119 | ✓ Downloaded |
| `hero-photo-2.png` | Rectangle120 | ✓ Downloaded |
| `hero-photo-3.png` | Rectangle121 | ✓ Downloaded |
| `hero-photo-4.png` | Rectangle122 | ✓ Downloaded |
| `hero-photo-5.png` | Rectangle123 | ✓ Downloaded |
| `hero-photo-6.png` | Rectangle124 | ✓ Downloaded |
| `hero-photo-7.png` | Rectangle125 | ✓ Downloaded |
| `hero-photo-8.png` | Rectangle126 | ✓ Downloaded |
| `video-thumbnail.png` | Rectangle144 | ✓ Downloaded |
| `news-1.png`       | Rectangle150 | ✓ Downloaded |
| `news-2.png`       | Rectangle151 | ✓ Downloaded |
| `news-3.png`       | Rectangle152 | ✓ Downloaded |
| `bubble-1.png`     | Ellipse26    | ✓ Downloaded |
| `bubble-2.png`     | Ellipse27    | ✓ Downloaded |
| `bubble-3.png`     | Ellipse28    | ✓ Downloaded |
| `bubble-4.png`     | Ellipse31    | ✓ Downloaded |
| `bubble-5.png`     | Ellipse32    | ✓ Downloaded |
| `circle-challenge.svg` | Ellipse22 | ✓ Downloaded |
| `illustration-issues.svg` | Illustration (botanical) | ✓ Downloaded |
| `illustration-sector.svg` | Layer_1 (sector graphic) | ✓ Downloaded |

---

## Layout Verification (JS audit at 1728px viewport)

| Check | Result |
|-------|--------|
| Hero height | 1000px ✓ |
| Hero headline top | 373px ✓ (matches Figma exactly) |
| Hero logo + description | bottom: 110px ✓ |
| Foundation grid | 35% / 65% two-column ✓ |
| Heading inside right column | ✓ |
| Challenge grid | 38% / 62% two-column ✓ |
| Challenge circles to the right of text | ✓ |
| Approach cards no overflow | ✓ |
| Approach card stagger (offsetTop) | card1 +86px, card2 +234px, card3 +0 ✓ |
| Carousel centred on card 2 | scrollLeft 540px = target ✓ |
| Footer four-column grid | ✓ |

Section height deltas vs Figma (at 1728px viewport — some wrapping expected):
- Hero: **0px** ✓
- Intro: +73px (text wraps more at narrower viewport — expected)
- Pillars: +44px (same reason)
- News: −19px ✓

---

## Fonts

| Design font | Web substitute | Weights loaded |
|-------------|---------------|----------------|
| Baskerville Regular | `Libre Baskerville` (Google Fonts) | 400 |
| Fira Sans Light | `Fira Sans` (Google Fonts) | 300 |
| Fira Sans Regular | `Fira Sans` | 400 |
| Fira Sans Medium | `Fira Sans` | 500 |

If the brand requires exact licensed Baskerville or a custom Foundation typeface,
replace the `<link>` in `index.html` with a `@font-face` block and place files in `assets/fonts/`.

---

## Design Decisions & Assumptions

1. **Figma asset URLs are temporary** (7-day TTL). All assets were downloaded within the window and are now stored locally in `/assets/`. If assets need refreshing, re-run the Figma MCP export.

2. **Hero photos** use percentage-based `inset` positioning matching the Figma 1920×1000 canvas. On smaller screens 4 of the 8 photos are hidden to keep the headline readable.

3. **Decorative blobs** (radial gradient glows) are CSS `radial-gradient` divs — no image needed.

4. **Challenge circles** overflow the right edge of their container (matching Figma). The parent uses `overflow: hidden` to clip.

5. **News carousel** uses native horizontal scroll with `scroll-snap-type`. JS sets the initial `scrollLeft` so card 2 (centre card) is always visible on load. Drag/pointer support included.

6. **Approach cards** use CSS Grid `1fr` columns so they scale with the viewport. Vertical stagger is applied via `margin-top` (86px / 234px / 0px for the top row), matching Figma's absolute positions proportionally.

7. **Footer overlap** — In Figma the news section and footer share vertical space (both start at 4454px). In HTML they are sequential. The `footer__gradient` div creates the same white fade-in effect without absolute positioning.

8. **Video thumbnail** is a static image with play button overlay. To wire up video: add `data-video-url="https://..."` to `.intro__play-btn` and handle the click in `script.js`.

9. **Language toggle (中文)** is a plain `<a>` link — wire up to routing when ready.

---

## File Structure

```
dhcf-website/
├── index.html       (504 lines — semantic HTML, 6 sections)
├── style.css        (~700 lines — CSS vars, grid, all breakpoints)
├── script.js        (nav scroll, hamburger, carousel, filters, img fallback)
├── notes.md         (this file)
└── assets/
    ├── fonts/       (empty — using Google Fonts CDN)
    ├── icons/       (15 SVG files — logos, icons, line art)
    └── images/      (20 image files — photos, illustrations, bubbles)
```

## Local preview

A Python HTTP server was used during development:
```bash
cd dhcf-website
python3 -m http.server 8765
# open http://localhost:8765/
```
