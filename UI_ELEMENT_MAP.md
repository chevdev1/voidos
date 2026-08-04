# UI Element Map — VOID.OS / ExoMind

Stack: React 19 + Vite + Tailwind CSS v4 + Framer Motion (`framer-motion` v12) + Lenis (`lenis` v1).
Reference material ingested before implementation: Anthropic's `frontend-design` skill (restraint, one bold move, hierarchy-through-typography) and Emil Kowalski's `emil-design-eng` skill (spring configs, easing curves, transform-only animation, 300ms UI ceiling).

**This is now the single, merged project.** The original static repo (`site-clone/`) is retired — everything from it (the galaxy canvas, the market chart, tokenomics, the sector terminal) lives here now, restyled and layered with the new motion system, not as a separate demo.

---

## 0. What "merge" actually meant

The static site's real centerpiece is a ~950-line hand-tuned canvas engine: a procedurally generated galaxy of 50,000 "grain" sectors across 4 spiral arms, with orbit/pan/zoom, hit-testing, a minimap, filter chips, a live-updating candlestick chart, and a sector-detail drawer. Rewriting that in idiomatic React would mean re-deriving hundreds of lines of tuned math for no visual gain, so instead:

- **`src/legacy/voidEngine.js`** — the engine, ported close to verbatim, wrapped in `initVoidEngine()` which returns a `destroy()` teardown (cancels the rAF loop, clears the two `setInterval` tickers, disconnects both `ResizeObserver`s, removes the `window`-level drag listeners). Mounted once from a `useEffect` in `App.jsx`.
- **`src/legacy/void.css`** — the original's hand-tuned CSS for the hero/cosmos/market/tokenomics/terminal widgets, ported alongside it (pixel values here are load-bearing — the canvas math assumes them).
- **`main.jsx` no longer wraps `<App/>` in `<StrictMode>`** — StrictMode's dev-only double-invoke would mount the engine twice (double rAF loops, doubled counters) before the first copy's cleanup runs. Doesn't affect the production build; commented in place.
- Everything **new** (Nav, the Concept bento, FAQ, Footer, and the motion layer on top of the legacy sections) is regular React + Tailwind + Framer Motion, same system documented below.

---

## 1. Global systems

### `lib/SmoothScroll.jsx` — smooth scroll provider
Lenis driven off Framer Motion's own `frame.update` loop (not a second `requestAnimationFrame`), so scroll-linked motion never falls a frame behind. Exposed via `useLenis()`, used by `Nav` and `Hero` for `lenis.scrollTo('#market', …)` instead of native anchor jumps.

### `src/index.css` — design tokens
Tailwind v4 `@theme` block: `--color-void`, `--color-lime`, `--color-ink`, `--color-muted`, etc. — auto-expanded by Tailwind into `bg-lime`, `border-lime/40`, and so on. Used by the *new* sections (Nav, Concept, FAQ, Footer). The legacy sections use their own `--lime`/`--muted`/`--line` variables from `void.css` — same values, kept separate so the ported canvas code (which references `var(--lime)` etc. directly in a few DOM-driven spots) doesn't depend on Tailwind's token layer.

---

## 2. Motion primitives

### `components/MagneticButton.jsx`
Cursor-following spring (`useMotionValue` + `useSpring`, `stiffness: 150, damping: 15`) on the button shell, a weaker spring on the inner label for a layered feel, plus a lime glow that fades in on hover. `whileTap={{ scale: 0.96 }}` for press feedback. **Used once** — the Hero's "What is this?" CTA — deliberately not applied to "Claim a sector" (the actual money button stays a plain, trustworthy `.btn-lime` pill; the playful treatment goes on the explanatory link, not the transaction).

### `components/ScrambleText.jsx`
Terminal-decrypt character reveal. `trigger="view"` fires once via `IntersectionObserver` (nav-adjacent labels, section eyebrows, the hero's "SCROLL FOR LORE" cue); `trigger="hover"` re-scrambles every hover, used only on the five top-nav links. Kept to a handful of load-bearing spots per the ingested skill docs' warning that repeating the same trick everywhere reads as templated.

---

## 3. Sections, in page order

### `components/Nav.jsx`
Fixed header, fades/slides in once (`y:-100→0`, custom ease-out). Real branding now: **VOID.OS** wordmark + logo, links to Map/Concept/Market/Token/FAQ (all via `lenis.scrollTo`), X + Telegram icon links, and a "Buy $EXO" pill that scrolls to `#market`. Nav links use hover-`ScrambleText`.

### `components/Hero.jsx` (`id="top"`, full-bleed — sits outside the centered `<main>` so the cosmos panel can still fill the viewport edge-to-edge, matching the original)
- Left column (`.hero-left`, legacy CSS): live-probe pulse badge, "VOID`.OS`" headline, lede, **CA row** — copy-to-clipboard is now real React state (`useState` + a ✓ flash) instead of vanilla DOM, since it's simple enough not to belong in the legacy engine. CTA row: `Claim a sector ↗` (plain lime pill → `#market`), **`MagneticButton` "What is this?"** (new, → `#concept`), `Follow` / `Telegram` ghost pills.
- All of the above wrapped in staggered Framer Motion entrances (`opacity`+`y`, ~120ms offsets).
- Right column: the **cosmos galaxy canvas** (`#cosmosFrame`) — drag to orbit 360°, shift-drag to pan, scroll to zoom, click a "grain" to open the sector terminal, minimap, filter chips (empty/claimed/fed/core/heat/yours), zoom/orbit/spin controls, live "burned forever" $EXO counter. Entirely engine-driven; the React component only renders the shell and fades the panel in once on mount.

### `components/ConceptSection.jsx` (`id="concept"`) — the Lore
**This replaces both the old thin `#about` "Thesis" cards *and* the old standalone `#core` "28% sealed" section** — those covered the same four ideas (Claim/Transmit/Core/Voice) in a few lines each; the new bento grid covers them in real depth with no duplication. Asymmetric 6-col grid, `whileInView` stagger reveal, slow independent float loops per card, HUD corner-bracket hover. Nav's flow (Map → Concept → Market → Token → FAQ) treats this as the merged replacement, so no nav link points at a separate `#core` anymore.

### `components/MarketSection.jsx` (`id="market"`)
Real content preserved from the original: 4 live stat tiles (price/market cap/liquidity/24h, ticking via the legacy engine's `setInterval`) and the candlestick chart canvas with timeframe buttons (1m/15m/1h/1D). New: the stat tiles and chart panel fade/slide in via `whileInView` with a staggered container — a one-time reveal layered on top of numbers that are *already* live-updating, so no redundant count-up animation here (that would fight the live ticker).

### `components/TokenomicsSection.jsx` (`id="token"`)
The 4 static stat tiles (1B supply / $EXO / 50k sectors / 0/0 tax) — these numbers don't tick, so this is where a genuine "make static feel alive" animation earns its keep: each tile pops in with a slight overshoot spring (`scale: 0.85→1`, `stiffness: 260, damping: 20`), staggered 80ms apart.

### `components/FAQSection.jsx` (`id="faq"`) — new
Single-open accordion, `AnimatePresence` + animated `height: 0 → 'auto'`, custom ease-out, `+` icon rotates 45° on open. Placeholder copy avoids unverifiable claims (audit question explicitly says "add your report link here, treat unaudited contracts as high-risk" rather than asserting a fake audit).

### `components/SectorTerminal.jsx` (`id="term"`, fixed overlay, rendered at the end of `App.jsx`)
The slide-in drawer that shows a clicked sector's stats. Pure shell — `voidEngine.js` writes its contents via `getElementById` exactly as the original did.

### `components/Footer.jsx`
Brutalist link list (X / GitHub / Documentation / DexScreener), oversized type, arrow-glyph hover spring. Carries the original's tagline ("you buy the pull, not the permanence.") under the wordmark, plus the same non-advice disclaimer as before. **Links still point to `#`** — swap in real URLs before shipping.

---

## 4. Before this ships

1. Swap Footer link `href="#"` placeholders for real X / GitHub / Docs / DexScreener URLs, and the Hero's `Follow` / `Telegram` ghost links likewise.
2. Replace the four FAQ placeholder answers with real copy, especially the audit-status one.
3. The CA box still shows the original's dummy address (`0xEXO…VOID…DEAD`) — wire it to the real deployed contract when there is one.
4. I verified this with `npm run build` (clean) and by hitting the dev server over HTTP — I don't have a browser in this environment, so the interactive galaxy (drag/zoom/click-to-open-terminal), the chart ticking, and the accordion/reveal animations haven't been visually confirmed. Worth a real click-through before calling it done.
