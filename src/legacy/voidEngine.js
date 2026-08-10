/**
 * This is the original VOID.OS canvas engine (galaxy map + market chart +
 * burned-supply ticker + sector terminal wiring), ported close to verbatim
 * from the static site. It's a large, tuned, imperative canvas simulation —
 * rewriting it as idiomatic React would mean re-deriving hundreds of lines
 * of hand-tuned math for zero visual benefit, so instead it's wrapped as a
 * single mount function that returns a `destroy()` teardown.
 *
 * All DOM access is by id, matching the ids rendered in Hero/CosmosPanel/
 * MarketSection/SectorTerminal — those ids exist by the time this runs
 * because it's invoked from an effect in App.jsx, after the full tree has
 * committed to the DOM.
 */
import { mindClaimSync, mindClaimVerify, mindMapOwnerships, loadOwnerships, loadUser, mindSession } from '../lib/mindClient.js'
import { isClaimLiveClient, claimOnChain } from '../lib/rhWallets.js'
import { getLotKind } from '../../shared/lotLore.js'
import { applyLotBookToConstels, formatUsd } from '../../shared/lotPricing.js'
import { MAP_ARMS, TOTAL_MAP_LOTS, lotDefMeta } from '../../shared/mapLayout.js'

export function initVoidEngine() {
  'use strict';
  const disposers = [];
  const onCleanup = (fn) => disposers.push(fn);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const fmt = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  document.getElementById('termX').onclick = () =>
    document.getElementById('term').classList.remove('open');

  function openTerm(d) {
    document.getElementById('termTitle').textContent = d.title;
    document.getElementById('termSub').textContent = d.sub;
    document.getElementById('tStatus').textContent = d.status;
    document.getElementById('tRing').textContent = d.ring;
    const tierEl = document.getElementById('tTier');
    if (tierEl) tierEl.textContent = d.tier || '—';
    document.getElementById('tPrice').textContent = d.price;
    document.getElementById('tSize').textContent = d.size;
    document.getElementById('tGrav').textContent = d.grav;
    document.getElementById('tNote').textContent = d.note;
    document.getElementById('term').classList.add('open');
    if (typeof window.__voidSyncTermButtons === 'function') window.__voidSyncTermButtons();
  }

  /** Weighted grain mass — most mid/micro, rare megas you can actually see. */
  function rollGrainMass() {
    const r = Math.random();
    if (r < 0.035) return { size: ri(480, 980), tier: 'MEGA', viz: rnd(4.4, 6.5) };
    if (r < 0.14) return { size: ri(240, 479), tier: 'LARGE', viz: rnd(3.0, 4.2) };
    if (r < 0.55) return { size: ri(110, 239), tier: 'MID', viz: rnd(1.9, 2.9) };
    return { size: ri(32, 109), tier: 'MICRO', viz: rnd(1.15, 1.85) };
  }
  /* Per-grain USD is assigned later from the $1M lot book (applyLotBookToConstels). */
  function ringName(dist, maxR) {
    const t = dist / maxR;
    if (t < 0.18) return 'core ring';
    if (t < 0.38) return 'inner arm';
    if (t < 0.62) return 'mid spiral';
    if (t < 0.82) return 'outer belt';
    return 'far rim';
  }

  /* ================= COSMOS ================= */
  (function () {
    const frame = document.getElementById('cosmosFrame');
    const canvas = document.getElementById('cosmos');
    const tip = document.getElementById('tip');
    const zoomLabel = document.getElementById('zoomLabel');
    const ctx = canvas.getContext('2d', { alpha: false });
    // No offscreen bloom buffer / additive composite pass — a full-canvas
    // drawImage with a 'lighter' blend every frame was the single priciest
    // operation in the old draw loop for a purely decorative glow.
    let W = 0,
      H = 0,
      DPR = 1;
    let scale = 1.05;
    const MIN_S = 0.22,
      MAX_S = 18;
    let panX = 0,
      panY = 0,
      targetScale = scale,
      targetPanX = 0,
      targetPanY = 0;
    let atHomeView = true; // auto-fit galaxy to frame while at home zoom
    let dragging = false,
      moved = false,
      lx = 0,
      ly = 0,
      mx = null,
      my = null;
    let autoSpin = true,
      rot = 0;
    let viewYaw = 0.22,
      viewPitch = 0.82; // flatter MW angle — stays optically centered
    let orbitMode = true,
      orbiting = false;
    const t0 = performance.now();
    const filters = { empty: true, claimed: true, fed: true, core: true, heat: false, yours: true };
    const yoursSet = new Set();
    const selectedSet = new Set();
    const selectedConstels = new Set(); // multi-select whole constellations
    let lastTermSector = null;
    let lastTermConstel = null;
    let arenaMode = false;
    let heatMode = false;
    let panelMode = null; // 'standings' | 'what' | 'personality' | null

    /* ONE mega-galaxy — fills the frame */
    const GAL = {
      x: 0,
      y: 0,
      s: 4.6,
      name: 'ExoMind',
      kind: 'spiral',
      arms: MAP_ARMS,
      twist: 5.2,
      tilt: 1.05,
      roll: 0.15,
      bright: 1.35,
    };

    const LIME = [204, 255, 0];
    const EMPTY_LIST = []; // shared, never mutated — avoids a fresh [] every frame when comets are skipped
    const NAME_A = [
      'VOID', 'LIME', 'ASH', 'NYX', 'HOLLOW', 'RIM', 'CORE', 'GHOST', 'EDGE', 'BURN', 'SILENT', 'FAR', 'DRIFT',
      'ECHO', 'SIGIL', 'MERIDIAN', 'PULSE', 'VEIL', 'CROWN', 'KEY', 'SPINE', 'WING', 'BELT', 'CHOIR', 'TAIL',
      'NODE', 'ARC', 'LANE', 'RIB', 'HALO', 'FLUX', 'SEED', 'QUILL', 'MIRROR', 'TORCH', 'RELIC', 'CIPHER',
      'ORBIT', 'PRISM', 'VEIN', 'AETHER', 'NOVA', 'DUST', 'IRON', 'SOLAR', 'LUNAR', 'EMBER', 'FROST', 'GLINT',
      'SHADE', 'WRAITH', 'OMEGA', 'ALPHA', 'ZETA', 'ION', 'AXIOM', 'NEXUS', 'HELIX', 'QUASAR', 'PULSE',
    ];
    const NAME_B = [
      'CROWN', 'KEY', 'ARC', 'SPINE', 'VEIL', 'PULSE', 'MERIDIAN', 'WING', 'BELT', 'SIGIL', 'CHOIR', 'NODE',
      'LANE', 'TAIL', 'ECHO', 'RIB', 'HALO', 'DRIFT', 'SEED', 'QUILL', 'MIRROR', 'TORCH', 'RELIC', 'CIPHER',
      'ORBIT', 'PRISM', 'VEIN', 'FIELD', 'GATE', 'WELL', 'NEST', 'RING', 'FORK', 'SPIRE', 'BRIDGE', 'CLUSTER',
      'FOLD', 'REACH', 'DELTA', 'THRONE',
    ];
    function limeShade(i) {
      const t = (i % 20) / 19;
      return [Math.floor(100 + t * 155), Math.floor(150 + t * 105), Math.floor(15 + t * 55)];
    }
    /* dense constellation grid — TOTAL_MAP_LOTS across the disk */
    const CONSTEL_DEFS = [];
    {
      for (let n = 0; n < TOTAL_MAP_LOTS; n++) {
        const meta = lotDefMeta(n);
        const name = NAME_A[n % NAME_A.length] + ' ' + NAME_B[(n * 5 + meta.arm * 2) % NAME_B.length];
        CONSTEL_DEFS.push({
          id: meta.id,
          name: (name + ' ' + (n + 1)).toUpperCase(),
          col: limeShade(n + meta.arm * 2),
          arm: meta.arm,
          u: meta.u,
          spread: meta.spread,
          figure: meta.figure,
        });
      }
    }

    function colLerp(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    /* milky-way lime: hot core → bright arms → faint olive rim */
    function starColor(u) {
      u = clamp(u, 0, 1);
      if (u < 0.08) return colLerp([255, 255, 245], [255, 245, 180], u / 0.08);
      if (u < 0.28) return colLerp([240, 255, 140], [204, 255, 0], (u - 0.08) / 0.2);
      if (u < 0.55) return colLerp([204, 255, 0], [160, 210, 40], (u - 0.28) / 0.27);
      if (u < 0.8) return colLerp([130, 170, 50], [90, 120, 40], (u - 0.55) / 0.25);
      return colLerp([70, 95, 30], [40, 55, 20], (u - 0.8) / 0.2);
    }
    function rgba(c, a) {
      return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    }

    function buildMegaGalaxy(m) {
      const R = 210 * m.s;
      const constels = CONSTEL_DEFS.map((d) => {
        const a0 = (d.arm / m.arms) * Math.PI * 2 + d.u * m.twist;
        const r = d.u * R;
        return { ...d, r, a0, x: r * Math.cos(a0), y: r * Math.sin(a0), grains: [], hover: 0 };
      });

      const points = [];
      // Cut from 6200 → 4200 base points (further thinned by the zoom/
      // quality LOD stride at render time). Density is faked back in via
      // a slightly larger brightness/size range below, per the request to
      // trade raw particle count for rendered size rather than fill-rate.
      for (let i = 0; i < 4200; i++) {
        const arm = ri(0, m.arms - 1);
        let r,
          a0,
          dust = 0,
          mode = Math.random();
        if (mode < 0.14) {
          r = Math.pow(Math.random(), 0.85) * R * 0.22;
          a0 = rnd(0, Math.PI * 2);
        } else if (mode < 0.78) {
          r = Math.pow(Math.random(), 0.48) * R;
          a0 = (arm / m.arms) * Math.PI * 2 + (r / R) * m.twist + rnd(-0.12, 0.12) * (1.05 - r / R);
          dust = Math.sin(a0 * m.arms - (r / R) * m.twist * 2.2) > 0.72 ? 1 : 0;
        } else {
          r = rnd(R * 0.35, R * 1.05);
          a0 = rnd(0, Math.PI * 2);
        }
        const u = clamp(r / R, 0, 1);
        points.push({
          r: Math.max(1.5, r),
          a0,
          u,
          dust,
          arm,
          br: rnd(0.32, 2.3) * (1.35 - u * 0.55) * m.bright * (mode < 0.14 ? 1.4 : 1),
          ph: rnd(0, 6.28),
          sp: rnd(0.2, 1.2),
          hot: Math.random() < 0.04 || u < 0.06,
        });
      }

      // Precompute a color-bucket index per star (color only ever depends
      // on the star's fixed radial position `u`, never on time), then sort
      // the array so each bucket occupies one contiguous range. This costs
      // nothing at render time — it runs once, here, at galaxy build — and
      // lets the 'medium'/'low' quality path below iterate one bucket's
      // range into a single path and issue ONE fill() call for potentially
      // hundreds of stars, instead of one fillStyle assignment + one fill
      // per star. 12 buckets (not the 3-4 of a literal "batch by color"
      // take) because this galaxy's color is a continuous hot-core →
      // lime-arm → dim-rim gradient, not a handful of discrete colors —
      // 3-4 buckets would band visibly; 12 doesn't, on stars this small.
      const STAR_BUCKETS = 12;
      for (const p of points) p.bucket = clamp(Math.floor(p.u * STAR_BUCKETS), 0, STAR_BUCKETS - 1);
      points.sort((a, b) => a.bucket - b.bucket);
      const starBucketRanges = [];
      const starBucketRGB = [];
      const starBucketAlphaScale = [];
      {
        let idx = 0;
        for (let bi = 0; bi < STAR_BUCKETS; bi++) {
          const start = idx;
          while (idx < points.length && points[idx].bucket === bi) idx++;
          starBucketRanges.push([start, idx]);
          const uMid = (bi + 0.5) / STAR_BUCKETS;
          starBucketRGB.push(starColor(uMid));
          // Mirrors the per-star brightness falloff (1.35 - u*0.55) used
          // in the individual-star path, since batched mode can't keep
          // each star's own p.br variation once they're drawn as one path.
          starBucketAlphaScale.push(0.12 + 0.34 * (1 - uMid));
        }
      }

      const nebulae = [];
      for (let i = 0; i < 56; i++) {
        const arm = ri(0, m.arms - 1);
        const u = rnd(0.12, 0.92);
        const a0 = (arm / m.arms) * Math.PI * 2 + u * m.twist + rnd(-0.18, 0.18);
        const r = u * R;
        nebulae.push({
          r,
          a0,
          u,
          arm,
          rad: rnd(28, 70),
          stretch: rnd(1.6, 3.2),
          ang: a0 + Math.PI / 2,
          col: u < 0.25 ? [255, 245, 180] : u < 0.55 ? [204, 255, 0] : [130, 175, 40],
          a: rnd(0.04, 0.11),
          ph: rnd(0, 6.28),
          sp: rnd(0.15, 0.5),
        });
      }
      for (let i = 0; i < 12; i++) {
        nebulae.push({
          r: rnd(R * 0.04, R * 0.22),
          a0: rnd(0, Math.PI * 2),
          u: rnd(0.05, 0.2),
          arm: 0,
          rad: rnd(40, 90),
          stretch: rnd(1.1, 1.8),
          ang: rnd(0, Math.PI),
          col: [255, 250, 200],
          a: rnd(0.06, 0.14),
          ph: rnd(0, 6),
          sp: rnd(0.2, 0.6),
        });
      }

      const comets = [];
      for (let i = 0; i < 10; i++) {
        comets.push({
          a0: rnd(0, Math.PI * 2),
          r: rnd(R * 0.25, R * 1.15),
          spd: rnd(0.35, 1.1) * (Math.random() < 0.5 ? 1 : -1),
          len: rnd(55, 120),
          thick: rnd(1.2, 2.4),
          tilt: rnd(-0.4, 0.4),
          ph: rnd(0, 10),
        });
      }

      function hashStr(s) {
        let h = 2166136261;
        const str = String(s || '');
        for (let i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return h >>> 0;
      }
      function mulberry32(seed) {
        let a = seed >>> 0;
        return () => {
          a |= 0;
          a = (a + 0x6d2b79f5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      function rollSeededMass(rng) {
        const r = rng();
        if (r < 0.035) return { size: 480 + Math.floor(rng() * 500), tier: 'MEGA', viz: 4.4 + rng() * 2.1 };
        if (r < 0.14) return { size: 240 + Math.floor(rng() * 239), tier: 'LARGE', viz: 3.0 + rng() * 1.2 };
        if (r < 0.55) return { size: 110 + Math.floor(rng() * 129), tier: 'MID', viz: 1.9 + rng() * 1.0 };
        return { size: 32 + Math.floor(rng() * 77), tier: 'MICRO', viz: 1.15 + rng() * 0.7 };
      }

      // One small star cluster per lot — every lot is claimable; no O(n²) packing.
      const sectors = [];
      for (const c of constels) {
        const rng = mulberry32(hashStr(c.id) ^ 0x91a2b3c4);
        const nStars = 3; // tight mini-figures — less web clutter
        for (let i = 0; i < nStars; i++) {
          const mass = rollSeededMass(rng);
          const ang = rng() * Math.PI * 2;
          const rad = (0.0035 + rng() * 0.012) * R * (0.7 + c.spread * 0.6);
          const x = c.x + Math.cos(ang) * rad;
          const y = c.y + Math.sin(ang) * rad;
          const r = Math.max(1.5, Math.hypot(x, y));
          const a0 = Math.atan2(y, x);
          const sec = {
            id: 1000 + sectors.length,
            r,
            a0,
            off: (rng() - 0.5) * 10,
            u: clamp(r / R, 0, 1),
            radius: mass.viz,
            viz: mass.viz,
            size: mass.size,
            tier: mass.tier,
            kind: 'empty',
            usd: 0,
            ring: ringName(r, R),
            grav: (100 * (1 - r / R)).toFixed(0) + '%',
            hover: 0,
            gx: m.x,
            gy: m.y,
            gName: m.name,
            maxR: R,
            constel: c.id,
            cName: c.name,
            cCol: c.col,
          };
          sectors.push(sec);
          c.grains.push(sec);
        }
        let sx = 0,
          sy = 0;
        for (const s of c.grains) {
          sx += s.r * Math.cos(s.a0);
          sy += s.r * Math.sin(s.a0);
        }
        c.x = sx / c.grains.length;
        c.y = sy / c.grains.length;
        c.r = Math.hypot(c.x, c.y);
        c.a0 = Math.atan2(c.y, c.x);
      }

      applyLotBookToConstels(constels);

      return {
        m,
        R,
        points,
        comets,
        nebulae,
        sectors,
        constels,
        spin: 1.05,
        starBucketRanges,
        starBucketRGB,
        starBucketAlphaScale,
      };
    }

    const galaxies = [buildMegaGalaxy(GAL)];
    const g0 = galaxies[0];
    const constelById = new Map(g0.constels.map((c) => [String(c.id), c]));
    // Start map empty — claimed/fed come only from real ledger + public reserved
    for (const s of g0.sectors) s.kind = 'empty';

    /** Constellation ids you trained (fed). */
    const trainedLots = new Set();

    function countOwnedConstels() {
      let n = 0;
      for (const c of g0.constels) if (constelOwned(c)) n++;
      return n;
    }

    function countReservedOthers() {
      let n = 0;
      for (const [cid] of takenMap) {
        const c = constelById.get(String(cid));
        if (c && !constelOwned(c)) n++;
      }
      return n;
    }

    /** Live system stats from Turso ledger + local owns (not decorative seed). */
    function realSystemStats() {
      const totalLots = mapTotals.total || g0.constels.length || TOTAL_MAP_LOTS;
      const reservedAll = mapTotals.claimed || takenMap.size;
      const yoursLots = countOwnedConstels();
      const trained = trainedLots.size;
      const others = Math.max(0, reservedAll - yoursLots);
      const free = Math.max(0, totalLots - reservedAll);
      const sellablePct = 100 - 28;
      const soldOfSellable = totalLots
        ? ((reservedAll / totalLots) * sellablePct).toFixed(1)
        : '0.0';
      const wallet = loadUser()?.wallet || null;
      return {
        totalLots,
        reservedAll,
        yoursLots,
        trained,
        others,
        free,
        sellablePct,
        soldOfSellable,
        wallet,
        leaders: mapLeaders,
      };
    }
    function detectStartQuality() {
      try {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low';
        const saveData = navigator.connection && navigator.connection.saveData;
        if (saveData) return 'low';
        const mem = navigator.deviceMemory; // Chrome-ish; undefined elsewhere
        if (mem != null && mem <= 4) return 'low';
        const cores = navigator.hardwareConcurrency || 8;
        const coarse = matchMedia('(pointer: coarse)').matches;
        if (cores <= 4 || coarse || (mem != null && mem <= 6)) return 'medium';
      } catch (_) {
        /* ignore */
      }
      return 'high';
    }
    let quality = detectStartQuality(); // 'high' | 'medium' | 'low'
    let frameMs = 16.7;
    let goodStreak = 0,
      badStreak = 0;
    let lastSampleT = performance.now();
    const hudEl = frame.querySelector('.cosmos-hud');
    let lastTipId = null;
    let lastHudHidden = null;
    function applyQualityClass() {
      frame.classList.remove('q-high', 'q-medium', 'q-low');
      frame.classList.add('q-' + quality);
    }
    applyQualityClass();
    function setQuality(next) {
      if (next === quality) return;
      quality = next;
      applyQualityClass();
      resize();
    }
    function sampleFrameTime(now) {
      const dt = now - lastSampleT;
      lastSampleT = now;
      frameMs = frameMs * 0.9 + dt * 0.1; // EMA smooths one-off hitches (GC pause, tab switch)
      if (frameMs > 22) {
        // sustained < ~45fps
        badStreak++;
        goodStreak = 0;
      } else if (frameMs < 15) {
        // sustained > ~65fps
        goodStreak++;
        badStreak = 0;
      } else {
        badStreak = 0;
        goodStreak = 0;
      }
      // Downgrade faster (~0.75s at 60Hz) so mid PCs don't cook before adapting
      if (badStreak > 45 && quality !== 'low') {
        setQuality(quality === 'high' ? 'medium' : 'low');
        badStreak = 0;
      } else if (goodStreak > 240 && quality !== 'high') {
        setQuality(quality === 'low' ? 'medium' : 'high');
        goodStreak = 0;
      }
    }

    const bgStars = Array.from({ length: 240 }, () => ({
      x: rnd(-1500, 1500),
      y: rnd(-1100, 1100),
      r: rnd(0.3, 1.9),
      a: Math.random(),
      spike: Math.random() < 0.035,
    }));

    // DPR cap and internal render resolution both shrink under sustained
    // load. 'high' is unchanged for capable devices; 'medium'/'low' render
    // to a genuinely smaller backing buffer (not just capped DPR) and let
    // the browser upscale it via the canvas's CSS size, which stays at the
    // container's full size the whole time — same "render small, display
    // big" trick as a low-res game framebuffer.
    function dprCapForQuality() {
      return quality === 'high' ? 1.5 : 1;
    }
    function renderScaleForQuality() {
      if (quality === 'high') return 1;
      if (quality === 'medium') return 0.85;
      return 0.7;
    }
    function fitHomeScale() {
      if (!W || !H || !g0) return 0.85;
      const span = g0.R * 2.1;
      let phone = false;
      try {
        phone = matchMedia('(max-width:960px)').matches;
      } catch (_) {
        /* ignore */
      }
      // Phone hero: fill the frame so the galaxy is actually readable
      const pad = arenaMode ? 0.92 : phone ? 0.88 : 0.74;
      const cap = arenaMode ? 2.4 : phone ? 1.35 : 1.0;
      return clamp(Math.min((W * pad) / span, (H * pad) / span), MIN_S, cap);
    }

    function applyHomeView(snap) {
      const hs = fitHomeScale();
      targetScale = hs;
      if (snap) scale = hs;
      targetPanX = 0;
      panX = snap ? 0 : panX;
      viewYaw = 0.22;
      viewPitch = 0.82;
      const lift = Math.sin(viewPitch) * g0.R * hs * 0.22;
      targetPanY = lift;
      if (snap) panY = lift;
      atHomeView = true;
    }

    function resize() {
      const r = frame.getBoundingClientRect();
      W = r.width;
      H = r.height;
      DPR = Math.min(devicePixelRatio || 1, dprCapForQuality());
      const renderScale = renderScaleForQuality();
      canvas.width = W * DPR * renderScale;
      canvas.height = H * DPR * renderScale;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR * renderScale, 0, 0, DPR * renderScale, 0, 0);
      // Keep the whole galaxy readable on phone / short viewports
      if (atHomeView && !dragging) applyHomeView(true);
    }
    const cosmosResizeObserver = new ResizeObserver(resize);
    cosmosResizeObserver.observe(frame);
    onCleanup(() => cosmosResizeObserver.disconnect());
    resize();

    function viewLabel() {
      if (scale < 0.5) return 'EXOMIND';
      if (scale < 1) return 'GALAXY';
      if (scale < 2) return 'ARMS';
      if (scale < 4) return 'CONSTELLATIONS';
      if (scale < 7) return 'CLUSTERS';
      if (scale < 11) return 'GRAINS';
      return 'GRAIN · x' + scale.toFixed(1);
    }

    let mapFilter = null; // null=all | 'empty'|'claimed'|'fed'|'yours' (exclusive like mindless)

    function sectorVisible(s) {
      if (!mapFilter) return true;
      const mine = yoursSet.has(s.id);
      if (mapFilter === 'yours') return mine;
      if (mapFilter === 'empty') return !mine && s.kind === 'empty';
      if (mapFilter === 'fed') return !mine && s.kind === 'fed';
      if (mapFilter === 'claimed') return !mine && (s.kind === 'claimed' || s.kind === 'fed');
      return true;
    }

    function constelVisible(c) {
      if (!mapFilter) return true;
      return c.grains.some((s) => sectorVisible(s));
    }

    // yaw/pitch are identical for every point/sector/nebula/constellation
    // within a single frame (there's only ever one galaxy, g0) — this used
    // to call Math.cos/Math.sin on them *inside* projectLocal, which runs
    // thousands of times a frame (up to ~4200 star points + up to 2800
    // sectors, twice over when hovering). draw() now computes the four
    // trig values once per frame; this function just reads them.
    let frameCosYaw = 1,
      frameSinYaw = 0,
      frameCosPitch = Math.cos(viewPitch),
      frameSinPitch = Math.sin(viewPitch);
    function projectLocal(lx, ly, lz, g) {
      const x = lx * frameCosYaw - ly * frameSinYaw;
      const y = lx * frameSinYaw + ly * frameCosYaw;
      const z = lz;
      const y2 = y * frameCosPitch - z * frameSinPitch;
      const z2 = y * frameSinPitch + z * frameCosPitch;
      const persp = 1 / (1 + z2 * 0.00135);
      return { x: g.m.x + x * persp, y: g.m.y + y2 * persp, z: z2, persp, depth: z2 };
    }
    function polarLocal(r, a, off) {
      return [r * Math.cos(a) + Math.cos(a + 1.1) * (off || 0), r * Math.sin(a) + Math.sin(a + 1.1) * (off || 0) * 0.5];
    }
    function pitchLift() {
      return Math.sin(viewPitch) * g0.R * scale * 0.22;
    }
    function w2s(x, y) {
      return [W / 2 + panX + x * scale, H / 2 + panY + y * scale - pitchLift()];
    }
    function s2w(sx, sy) {
      return [(sx - W / 2 - panX) / scale, (sy - H / 2 - panY + pitchLift()) / scale];
    }
    function localXY(e) {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function inside(e) {
      const r = canvas.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }

    function sectorProj(s, g) {
      const [lx, ly] = polarLocal(s.r, s.a0, s.off);
      return projectLocal(lx, ly, (s.u - 0.5) * 18, g);
    }
    function pointProj(p, g, t) {
      const wob = Math.sin(t * p.sp + p.ph) * 1.5;
      const [lx, ly] = polarLocal(p.r + wob, p.a0, 0);
      return projectLocal(lx, ly, (p.u - 0.45) * 18 + (p.dust ? -8 : 0) + Math.sin(t * 0.35 + p.ph) * 2.5, g);
    }
    function constelWorld(c, g) {
      const [lx, ly] = polarLocal(c.r, c.a0, 0);
      return projectLocal(lx, ly, 0, g);
    }
    function focusOn(wx, wy, want) {
      atHomeView = false;
      targetScale = clamp(want, MIN_S, MAX_S);
      targetPanX = -wx * targetScale;
      // w2s subtracts pitchLift(scale) — without the same lift here the
      // focused point lands above screen center and the view "jumps up".
      const lift = Math.sin(viewPitch) * g0.R * targetScale * 0.22;
      targetPanY = -wy * targetScale + lift;
    }

    function constelOwned(c) {
      return c.grains.length > 0 && c.grains.every((s) => yoursSet.has(s.id));
    }

    /** Public reserved lots: constel_id → { wallet, name } */
    const takenMap = new Map();
    let mapLeaders = [];
    let mapTotals = { claimed: 0, available: TOTAL_MAP_LOTS, total: TOTAL_MAP_LOTS };

    function shortWallet(w) {
      const s = String(w || '').trim();
      if (!s) return 'unlinked';
      if (s.length < 12) return s;
      return s.slice(0, 6) + '…' + s.slice(-4);
    }

    function constelTakenInfo(c) {
      if (!c) return null;
      return takenMap.get(String(c.id)) || null;
    }

    function constelReserved(c) {
      if (!c || constelOwned(c)) return false;
      return takenMap.has(String(c.id));
    }

    function applyTakenVisuals() {
      if (!g0?.constels) return;
      for (const [cid] of takenMap) {
        const c = g0.constels.find((x) => String(x.id) === String(cid));
        if (!c) continue;
        const mine = c.grains.length > 0 && c.grains.every((s) => yoursSet.has(s.id));
        if (mine) continue;
        for (const s of c.grains) {
          if (yoursSet.has(s.id)) continue;
          if (s.kind === 'empty') s.kind = 'claimed';
        }
      }
      refreshCounts();
    }

    function hydrateTakenFromPublic(data) {
      takenMap.clear();
      mapLeaders = Array.isArray(data?.leaders) ? data.leaders : [];
      mapTotals = data?.totals || mapTotals;
      for (const o of data?.lots || []) {
        const id = String(o.constel_id || o.id || '');
        if (!id) continue;
        takenMap.set(id, {
          wallet: o.wallet || null,
          name: o.constel_name || id,
          claimed_at: o.claimed_at || null,
        });
      }
      applyTakenVisuals();
    }

    window.__voidHydrateTaken = hydrateTakenFromPublic;

    async function refreshMapOwnerships() {
      try {
        const data = await mindMapOwnerships({ force: true });
        hydrateTakenFromPublic(data);
      } catch {
        /* ignore offline */
      }
    }

    function syncTermButtons() {
      const addBtn = document.getElementById('termAdd');
      const addConstelBtn = document.getElementById('termAddConstel');
      const buyBtn = document.getElementById('termBuy');
      // Purchase unit = constellation only
      if (addBtn) addBtn.hidden = true;
      if (addConstelBtn) {
        addConstelBtn.hidden = !lastTermConstel;
        if (lastTermConstel) {
          const owned = constelOwned(lastTermConstel);
          const reserved = constelReserved(lastTermConstel);
          const inStack = selectedConstels.has(lastTermConstel.id);
          addConstelBtn.textContent = owned
            ? '✓ already yours'
            : reserved
              ? 'RESERVED — cannot stack'
              : inStack
                ? '✓ in stack — tap again to remove'
                : '+ add constellation to stack';
          addConstelBtn.disabled = owned || reserved;
        }
      }
      if (buyBtn) {
        const hasWallet = Boolean(loadUser()?.wallet);
        const live = isClaimLiveClient();
        const reserved = lastTermConstel && constelReserved(lastTermConstel);
        const taken = lastTermConstel ? constelTakenInfo(lastTermConstel) : null;
        buyBtn.textContent = lastTermConstel
          ? constelOwned(lastTermConstel)
            ? 'already yours'
            : reserved
              ? 'RESERVED · ' + shortWallet(taken?.wallet)
              : !hasWallet
                ? 'connect wallet to claim'
                : live
                  ? 'claim on Robinhood Chain'
                  : 'claim constellation · test'
          : 'connect wallet to claim';
        buyBtn.disabled =
          !lastTermConstel ||
          constelOwned(lastTermConstel) ||
          Boolean(reserved);
      }
    }
    window.__voidSyncTermButtons = syncTermButtons;

    function refreshCartDock() {
      const dock = document.getElementById('cartDock');
      const list = document.getElementById('cartList');
      const title = document.getElementById('cartTitle');
      const massEl = document.getElementById('cartMass');
      const burnEl = document.getElementById('cartBurn');
      if (!dock || !list) return;

      // Stack = constellations only (any leftover grain picks dropped)
      selectedSet.clear();
      const items = [];
      let mass = 0,
        burn = 0;
      for (const cid of selectedConstels) {
        const c = g0.constels.find((x) => x.id === cid);
        if (!c || constelOwned(c) || constelReserved(c)) continue;
        for (const s of c.grains) {
          items.push(s);
          mass += s.size;
          burn += s.usd;
        }
      }

      if (!selectedConstels.size) {
        dock.hidden = true;
        list.innerHTML = '';
        syncTermButtons();
        return;
      }
      dock.hidden = false;
      list.innerHTML = [...selectedConstels]
        .map((cid) => {
          const c = g0.constels.find((x) => x.id === cid);
          if (!c) return '';
          const cm = c.grains.reduce((a, s) => a + s.size, 0);
          const cb = c.grains.reduce((a, s) => a + s.usd, 0);
          return `<button type="button" class="cart-chip constel" data-cid="${c.id}" title="remove">✧ ${c.name} · ${c.grains.length}g · ${formatUsd(cb)}</button>`;
        })
        .join('');
      if (title) title.textContent = `STACK · ${selectedConstels.size} constellations`;
      if (massEl) massEl.textContent = fmt(mass);
      if (burnEl) burnEl.textContent = formatUsd(burn);
      list.querySelectorAll('.cart-chip[data-cid]').forEach((btn) => {
        btn.onclick = () => {
          selectedConstels.delete(btn.dataset.cid);
          refreshCartDock();
        };
      });
      syncTermButtons();
    }

    function addConstelToStack(c) {
      if (!c || constelOwned(c) || constelReserved(c)) return false;
      if (selectedConstels.has(c.id)) return false;
      selectedConstels.add(c.id);
      refreshCartDock();
      return true;
    }

    function toggleConstel(c) {
      if (!c || constelOwned(c) || constelReserved(c)) return;
      if (selectedConstels.has(c.id)) selectedConstels.delete(c.id);
      else selectedConstels.add(c.id);
      refreshCartDock();
    }

    function syncClaimedLots(lots) {
      if (!lots?.length) return;
      mindClaimSync(lots)
        .then(() => refreshMapOwnerships())
        .catch(() => {});
    }

    function requireWalletForClaim() {
      const wallet = loadUser()?.wallet;
      if (wallet) return wallet;
      toast('connect Robinhood wallet to claim · open CABINET');
      try {
        window.location.assign('/cabinet');
      } catch {
        /* ignore */
      }
      return null;
    }

    async function executeClaim(items, toastMsg) {
      if (!items?.length) return false;
      if (!requireWalletForClaim()) return false;

      const previewLots = (() => {
        const touched = new Set();
        for (const s of items) if (s.constel) touched.add(s.constel);
        return [...touched]
          .map((cid) => g0.constels.find((x) => x.id === cid))
          .filter(Boolean)
          .map((c) => ({ id: c.id, name: c.name }));
      })();

      const blockedList = previewLots.filter((l) => {
        const c = g0.constels.find((x) => x.id === l.id);
        return c && constelReserved(c);
      });
      if (blockedList.length) {
        const info = takenMap.get(String(blockedList[0].id));
        toast(
          blockedList.length > 1
            ? 'stack blocked · ' +
                blockedList.length +
                ' lots already RESERVED (e.g. ' +
                shortWallet(info?.wallet) +
                ')'
            : 'RESERVED · ' + shortWallet(info?.wallet) + ' already owns this lot',
        );
        await refreshMapOwnerships();
        return false;
      }

      if (isClaimLiveClient()) {
        try {
          toast('confirm claim tx in Robinhood…');
          const { hash } = await claimOnChain(previewLots.map((l) => l.id));
          await mindClaimVerify({ txHash: hash, lots: previewLots });
          claimSectors(items, { skipSync: true });
          await refreshMapOwnerships();
          toast((toastMsg || 'claimed') + ' · on-chain');
          return true;
        } catch (e) {
          const msg = e?.message || String(e);
          if (e?.status === 409 || e?.data?.code === 'LOT_RESERVED') {
            toast('RESERVED · already taken');
            await refreshMapOwnerships();
          } else if (/reject|cancel|denied/i.test(msg)) toast('claim cancelled');
          else toast(msg.slice(0, 120) || 'claim failed');
          return false;
        }
      }

      try {
        await mindClaimSync(previewLots);
        claimSectors(items, { skipSync: true });
        await refreshMapOwnerships();
        toast((toastMsg || 'claimed') + ' · yours alone');
        return true;
      } catch (e) {
        if (e?.status === 409 || e?.data?.code === 'LOT_RESERVED') {
          toast('RESERVED · already taken by another wallet');
          await refreshMapOwnerships();
          return false;
        }
        // Offline: still mark local
        claimSectors(items, { skipSync: true });
        toast((toastMsg || 'claimed') + ' · local');
        return true;
      }
    }

    function toast(msg) {
      const el = document.getElementById('voidToast') || (() => {
        const n = document.createElement('div')
        n.id = 'voidToast'
        n.className = 'void-toast'
        document.body.appendChild(n)
        return n
      })()
      el.textContent = msg
      el.classList.add('show')
      clearTimeout(el._t)
      el._t = setTimeout(() => el.classList.remove('show'), 2800)
    }

    function claimSectors(list, opts = {}) {
      const touched = new Set();
      for (const s of list) {
        yoursSet.add(s.id);
        selectedSet.delete(s.id);
        if (s.kind === 'empty') s.kind = 'claimed';
        if (s.constel) touched.add(s.constel);
      }
      for (const cid of [...selectedConstels]) {
        const c = g0.constels.find((x) => x.id === cid);
        if (!c) continue;
        const allYours = c.grains.every((s) => yoursSet.has(s.id));
        if (allYours) selectedConstels.delete(cid);
      }
      const yc = document.getElementById('yoursCnt');
      if (yc) yc.textContent = String(countOwnedConstels());
      refreshCounts();
      refreshCartDock();

      if (opts.skipSync) return;
      const lots = [...touched]
        .map((cid) => g0.constels.find((x) => x.id === cid))
        .filter((c) => c && constelOwned(c))
        .map((c) => ({ id: c.id, name: c.name }));
      syncClaimedLots(lots);
    }

    /** Apply server / localStorage ownership list onto the live map. */
    function hydrateOwnsFromLedger(list) {
      if (!g0?.constels || !Array.isArray(list)) return;
      for (const o of list) {
        const cid = String(o.constel_id || o.id || '');
        if (!cid) continue;
        const c = g0.constels.find((x) => String(x.id) === cid);
        if (!c) continue;
        const trained =
          Boolean(o.trained) ||
          Boolean(o.trained_at) ||
          String(o.status || '').toLowerCase() === 'fed';
        if (trained) trainedLots.add(cid);
        for (const s of c.grains) {
          yoursSet.add(s.id);
          if (trained) s.kind = 'fed';
          else s.kind = 'claimed';
        }
      }
      const yc = document.getElementById('yoursCnt');
      if (yc) yc.textContent = String(countOwnedConstels());
      refreshCounts();
      refreshCartDock();
    }

    function trainLotOnMap(constelId) {
      const cid = String(constelId || '');
      if (!cid || !g0?.constels) return false;
      const c = g0.constels.find((x) => String(x.id) === cid);
      if (!c) return false;
      trainedLots.add(cid);
      for (const s of c.grains) {
        yoursSet.add(s.id);
        s.kind = 'fed';
      }
      const yc = document.getElementById('yoursCnt');
      if (yc) yc.textContent = String(countOwnedConstels());
      refreshCounts();
      refreshCartDock();
      return true;
    }

    window.__voidHydrateOwns = hydrateOwnsFromLedger;
    window.__voidTrainLot = trainLotOnMap;
    onCleanup(() => {
      if (window.__voidHydrateOwns === hydrateOwnsFromLedger) delete window.__voidHydrateOwns;
      if (window.__voidTrainLot === trainLotOnMap) delete window.__voidTrainLot;
      if (window.__voidHydrateTaken === hydrateTakenFromPublic) delete window.__voidHydrateTaken;
    });

    function focusLotFromStorage() {
      try {
        const cid = sessionStorage.getItem('void_focus_lot')
        if (!cid || !g0?.constels) return
        sessionStorage.removeItem('void_focus_lot')
        const c = g0.constels.find((x) => String(x.id) === String(cid))
        if (!c) return
        const p = constelWorld(c, g0)
        focusOn(p.x, p.y, 3.2)
        openConstelTerm(c)
      } catch (_) {
        /* ignore */
      }
    }

    // Pull durable ownerships on boot (cache + server) + public reserved map
    hydrateOwnsFromLedger(loadOwnerships())
    refreshMapOwnerships()
    const takenPoll = setInterval(() => {
      mindMapOwnerships().then(hydrateTakenFromPublic).catch(() => {})
    }, 45000)
    onCleanup(() => clearInterval(takenPoll))
    mindSession()
      .then((data) => {
        if (data?.ownerships) hydrateOwnsFromLedger(data.ownerships)
      })
      .catch(() => {})
      .finally(() => {
        requestAnimationFrame(() => focusLotFromStorage())
      })


    function stackGrainList() {
      const grainIds = new Set();
      for (const cid of selectedConstels) {
        const c = g0.constels.find((x) => x.id === cid);
        if (!c || constelOwned(c) || constelReserved(c)) continue;
        for (const s of c.grains) grainIds.add(s.id);
      }
      return [...grainIds].map((id) => g0.sectors.find((s) => s.id === id)).filter(Boolean);
    }

    function refreshCounts() {
      const st = realSystemStats();
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(v);
      };
      // Legend = constellation lots from live system (not decorative seed)
      set('cntEmpty', st.free);
      set('cntClaimed', st.others);
      set('cntFed', st.trained);
      set('yoursCnt', st.yoursLots);
      const meta = document.getElementById('mindMetaLine');
      const burnEl = document.getElementById('mindMetaBurn');
      if (meta) {
        meta.textContent =
          `${st.totalLots} lots · ${st.reservedAll} reserved · ${st.yoursLots} yours · ${st.free} free · ${st.soldOfSellable}% of sellable claimed`;
      }
      if (burnEl) {
        burnEl.textContent = st.wallet
          ? `wallet ${st.wallet.slice(0, 6)}…${st.wallet.slice(-4)} · live ledger`
          : 'connect wallet · live ledger';
      }
    }

    function pickConstel(wx, wy) {
      // Prefer constellation that owns the nearest grain, else nearest center
      const grain = pickSector(wx, wy);
      if (grain) {
        const c = constelById.get(String(grain.s.constel));
        if (c) return { c, p: constelWorld(c, g0) };
      }
      let best = null,
        bd = 1e9;
      const hitR = g0.R * (scale < 2 ? 0.045 : scale < 5 ? 0.03 : 0.022);
      // Dense map: prefer nearby lots only — sample when zoomed out
      const pickStep = scale < 1.4 ? 6 : scale < 3 ? 2 : 1;
      for (let i = 0; i < g0.constels.length; i += pickStep) {
        const c = g0.constels[i];
        const p = constelWorld(c, g0);
        const d = Math.hypot(wx - p.x, wy - p.y);
        if (d < hitR && d < bd) {
          bd = d;
          best = { c, p };
        }
      }
      return best;
    }

    function openConstelTerm(c) {
      lastTermConstel = c;
      lastTermSector = c.grains[0] || null;
      const mass = c.grains.reduce((a, s) => a + s.size, 0);
      const burn = c.grains.reduce((a, s) => a + s.usd, 0);
      const yours = c.grains.filter((s) => yoursSet.has(s.id)).length;
      const owned = yours === c.grains.length && c.grains.length > 0;
      const reserved = !owned && constelReserved(c);
      const taken = constelTakenInfo(c);
      const kind = getLotKind(typeof c.figure === 'number' ? c.figure : c.id);
      openTerm({
        title: 'CONSTEL · ' + c.name,
        sub: c.id + ' · ' + kind.label + ' · ' + c.grains.length + ' stars',
        status: owned ? 'yours' : reserved ? 'RESERVED' : yours ? 'partial' : 'unclaimed',
        ring: reserved
          ? 'owner · ' + shortWallet(taken?.wallet)
          : 'kind · ' + kind.label,
        tier: kind.tag + ' · ' + kind.rarity,
        price: reserved
          ? 'RESERVED · one owner only'
          : isClaimLiveClient()
            ? formatUsd(burn) + ' · burn $EXO on Robinhood Chain'
            : formatUsd(burn) + ' · test claim (connect wallet · no real $EXO yet)',
        size: fmt(mass) + ' cells',
        grav: owned
          ? yours + '/' + c.grains.length + ' owned'
          : reserved
            ? 'taken · ' + shortWallet(taken?.wallet)
            : yours + '/' + c.grains.length + ' owned',
        note: owned
          ? 'Yours alone. Open CABINET to rotate this ' +
            kind.label +
            ' and read full lot info.'
          : reserved
            ? 'Already reserved by ' +
              shortWallet(taken?.wallet) +
              '. One constellation = one wallet. Open standings for top holders.'
            : kind.blurb +
              ' One buyer only — after claim this lot is reserved for everyone else.',
      });
      syncTermButtons();
    }

    let pendingTouch = null
    function onPointerDown(e) {
      if (e.target !== canvas && !(e.target instanceof Element && canvas.contains(e.target))) {
        // allow UI chips/buttons on the frame to work without map capture
        if (
          e.target instanceof Element &&
          e.target.closest?.(
            '.vc, .filters, .minimap, .cosmos-bar, .mind-bar, .mind-meta, .mind-panel, button',
          )
        )
          return
      }
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1 && e.button !== 2) return
      if (e.pointerType === 'touch' && e.isPrimary === false) return

      // On phone: don't lock the map on first contact — wait to see if the
      // user is scrolling the page (vertical) or exploring (horizontal / hold).
      if (e.pointerType === 'touch' && !mapActive) {
        pendingTouch = { x: e.clientX, y: e.clientY, id: e.pointerId }
        return
      }

      beginMapDrag(e)
    }
    function beginMapDrag(e) {
      setMapActive(true)
      dragging = true
      moved = false
      lx = e.clientX
      ly = e.clientY
      orbiting =
        e.pointerType === 'touch'
          ? true
          : e.button !== 1 && !e.shiftKey && (orbitMode || e.altKey || e.button === 2)
      if (e.shiftKey || e.button === 1) orbiting = false
      canvas.classList.add('grab')
      try {
        canvas.setPointerCapture?.(e.pointerId)
      } catch (_) {
        /* ignore */
      }
    }
    function onContextMenu(e) {
      e.preventDefault()
    }
    // Click-to-explore: hover alone must not trap the wheel (page scroll stays
    // usable over the big hero). After a pointer down on the map, wheel zooms
    // until the pointer leaves — or zoom-out past min scale releases to page.
    let mapActive = false
    const cosmosHint = document.getElementById('cosmosHint')
    const isCoarse = matchMedia('(pointer: coarse), (hover: none)').matches
    function setMapActive(on) {
      mapActive = on
      if (on) frame.dataset.mapActive = '1'
      else delete frame.dataset.mapActive
      frame.classList.toggle('map-active', on)
      const exploreBtn = document.getElementById('cosmosExploreBtn')
      if (exploreBtn) {
        exploreBtn.classList.toggle('on', on)
        exploreBtn.textContent = on ? 'Exploring' : 'Explore'
      }
      if (cosmosHint) {
        if (arenaMode) {
          cosmosHint.textContent = 'FULL MAP · tap constellations · stack many · claim all'
        } else if (isCoarse) {
          cosmosHint.textContent = on
            ? 'drag orbit · pinch zoom · tap constellation · scroll outside'
            : 'tap map to explore · then drag / pinch'
        } else {
          cosmosHint.textContent = on
            ? 'exploring · tap constellations to stack · leave to scroll'
            : 'click to explore · Open full map'
        }
      }
    }
    function onFramePointerLeave(e) {
      // Don't kill explore mode on touch, or while the fullscreen map popup is open.
      if (e.pointerType === 'touch' || arenaMode) return
      setMapActive(false)
    }
    function onPointerMove(e) {
      if (pendingTouch && e.pointerId === pendingTouch.id) {
        const dx = e.clientX - pendingTouch.x
        const dy = e.clientY - pendingTouch.y
        const adx = Math.abs(dx)
        const ady = Math.abs(dy)
        if (ady > 12 && ady > adx * 1.15) {
          // Vertical scroll — abandon map capture, let the page move.
          pendingTouch = null
          return
        }
        if (adx > 10 || ady > 10) {
          pendingTouch = null
          beginMapDrag(e)
        }
        return
      }

      if (inside(e)) {
        const [sx, sy] = localXY(e)
        const p = s2w(sx, sy)
        mx = p[0]
        my = p[1]
      } else if (e.pointerType !== 'touch') {
        mx = null
        my = null
        tip.classList.remove('show')
      }
      if (!dragging) return
      if (!mapActive && e.pointerType === 'touch') return
      const dx = e.clientX - lx
      const dy = e.clientY - ly
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      if (orbiting) {
        viewYaw += dx * (e.pointerType === 'touch' ? 0.014 : 0.01)
        viewPitch += dy * (e.pointerType === 'touch' ? 0.014 : 0.01)
      } else {
        panX += dx
        panY += dy
        targetPanX = panX
        targetPanY = panY
      }
      lx = e.clientX
      ly = e.clientY
      if (mapActive && e.cancelable && e.pointerType === 'touch') e.preventDefault()
    }
    function handleMapTap(wx, wy, e) {
      // Buy unit = constellation. Click star OR cluster → that constellation.
      const chit = pickConstel(wx, wy);
      if (chit) {
        toggleConstel(chit.c); // multi-select: add / remove, as many as you want
        openConstelTerm(chit.c);
        focusOn(chit.p.x, chit.p.y, clamp(Math.max(scale, 2.0), 1.8, 4.5));
        return;
      }
      if (e.pointerType !== 'touch') focusOn(0, 0, Math.max(scale, 0.65));
    }
    function onPointerUp(e) {
      if (pendingTouch && e.pointerId === pendingTouch.id) {
        pendingTouch = null
        setMapActive(true)
        const [sx, sy] = localXY(e)
        const [wx, wy] = s2w(sx, sy)
        handleMapTap(wx, wy, e)
        return
      }
      if (!dragging) return
      if (!moved && inside(e)) {
        const [sx, sy] = localXY(e)
        const [wx, wy] = s2w(sx, sy)
        handleMapTap(wx, wy, e)
      }
      dragging = false
      canvas.classList.remove('grab')
      try {
        canvas.releasePointerCapture?.(e.pointerId)
      } catch (_) {
        /* ignore */
      }
    }

    // Pinch-to-zoom (touch)
    let pinchStartDist = 0
    let pinchStartScale = scale
    function touchDist(t) {
      const a = t[0]
      const b = t[1]
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
    function onTouchStart(e) {
      if (e.touches.length === 2) {
        setMapActive(true)
        atHomeView = false
        dragging = false
        pinchStartDist = touchDist(e.touches)
        pinchStartScale = scale
        e.preventDefault()
      }
    }
    function onTouchMove(e) {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        const d = touchDist(e.touches)
        const next = clamp(pinchStartScale * (d / pinchStartDist), MIN_S, MAX_S)
        scale = next
        targetScale = next
        e.preventDefault()
      } else if (mapActive && e.touches.length === 1) {
        e.preventDefault()
      }
    }
    function onTouchEnd(e) {
      if (e.touches.length < 2) pinchStartDist = 0
    }

    function onWheel(e) {
      const over =
        inside(e) || (e.target instanceof Element && e.target.closest?.('#cosmosFrame'))
      if (!over) return

      const forceZoom = e.ctrlKey || e.metaKey
      if (!mapActive && !forceZoom) return

      if (mapActive && !forceZoom && e.deltaY > 0 && scale <= MIN_S + 0.001) {
        setMapActive(false)
        return
      }

      e.preventDefault()
      e.stopPropagation()
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation()
      if (!mapActive) setMapActive(true)
      atHomeView = false

      const [sx, sy] = localXY(e)
      const before = s2w(sx, sy)
      const zin = scale < 1 ? 1.14 : scale < 3 ? 1.18 : scale < 7 ? 1.22 : 1.28
      const zout = scale < 1 ? 0.88 : scale < 3 ? 0.87 : 0.84
      const next = clamp(scale * (e.deltaY < 0 ? zin : zout), MIN_S, MAX_S)
      scale = next
      targetScale = next
      const after = s2w(sx, sy)
      panX += (after[0] - before[0]) * scale
      panY += (after[1] - before[1]) * scale
      targetPanX = panX
      targetPanY = panY
    }

    function onWindowWheelCapture(e) {
      onWheel(e)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('contextmenu', onContextMenu)
    frame.addEventListener('pointerleave', onFramePointerLeave)
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    frame.addEventListener('touchstart', onTouchStart, { passive: false })
    frame.addEventListener('touchmove', onTouchMove, { passive: false })
    frame.addEventListener('touchend', onTouchEnd)
    frame.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('wheel', onWindowWheelCapture, { passive: false, capture: true })
    onCleanup(() => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('contextmenu', onContextMenu)
      frame.removeEventListener('pointerleave', onFramePointerLeave)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      frame.removeEventListener('touchstart', onTouchStart)
      frame.removeEventListener('touchmove', onTouchMove)
      frame.removeEventListener('touchend', onTouchEnd)
      frame.removeEventListener('wheel', onWheel, { capture: true })
      window.removeEventListener('wheel', onWindowWheelCapture, { capture: true })
      delete frame.dataset.mapActive
    })

    document.getElementById('zoomIn').onclick = () => {
      setMapActive(true);
      atHomeView = false;
      targetScale = clamp(scale * 1.35, MIN_S, MAX_S);
      targetPanX = panX * (targetScale / scale);
      targetPanY = panY * (targetScale / scale);
    };
    document.getElementById('zoomOut').onclick = () => {
      setMapActive(true);
      atHomeView = false;
      targetScale = clamp(scale / 1.35, MIN_S, MAX_S);
      targetPanX = panX * (targetScale / scale);
      targetPanY = panY * (targetScale / scale);
      if (targetScale <= fitHomeScale() * 1.08) applyHomeView(false);
    };
    const exploreBtn = document.getElementById('cosmosExploreBtn');
    if (exploreBtn) {
      exploreBtn.onclick = () => {
        setMapActive(!mapActive);
        exploreBtn.classList.toggle('on', mapActive);
        exploreBtn.textContent = mapActive ? 'Exploring' : 'Explore';
      };
    }
    document.getElementById('homeBtn').onclick = () => {
      applyHomeView(false);
    };
    document.getElementById('orbitBtn').onclick = function () {
      orbitMode = !orbitMode;
      this.classList.toggle('on', orbitMode);
    };
    document.getElementById('spinBtn').onclick = function () {
      autoSpin = !autoSpin;
      this.classList.toggle('on', autoSpin);
    };

    const termAdd = document.getElementById('termAdd');
    if (termAdd) termAdd.hidden = true;
    const termAddConstel = document.getElementById('termAddConstel');
    if (termAddConstel) {
      termAddConstel.onclick = () => {
        if (!lastTermConstel) return;
        toggleConstel(lastTermConstel);
        openConstelTerm(lastTermConstel);
      };
    }
    document.getElementById('termBuy').onclick = async () => {
      if (!lastTermConstel || constelOwned(lastTermConstel)) return;
      const items = lastTermConstel.grains.slice();
      const name = lastTermConstel.name;
      const kindLabel = getLotKind(lastTermConstel.figure ?? lastTermConstel.id).label;
      const ok = await executeClaim(
        items,
        'claimed · ' + name + ' · ' + kindLabel + ' · open CABINET to rotate',
      );
      if (!ok) return;
      selectedConstels.delete(lastTermConstel.id);
      refreshCartDock();
      openConstelTerm(lastTermConstel);
    };
    const cartClear = document.getElementById('cartClear');
    if (cartClear) {
      cartClear.onclick = () => {
        selectedSet.clear();
        selectedConstels.clear();
        refreshCartDock();
      };
    }
    const cartClaim = document.getElementById('cartClaim');
    if (cartClaim) {
      cartClaim.onclick = async () => {
        const nConst = selectedConstels.size;
        if (!nConst) return;
        const names = [...selectedConstels]
          .map((cid) => g0.constels.find((x) => x.id === cid)?.name)
          .filter(Boolean);
        const items = stackGrainList();
        if (!items.length) return;
        const burn = items.reduce((a, s) => a + s.usd, 0);
        const ok = await executeClaim(
          items,
          'claimed · ' +
            nConst +
            ' lot' +
            (nConst > 1 ? 's' : '') +
            ' · ' +
            names.slice(0, 4).join(', ') +
            (names.length > 4 ? '…' : '') +
            ' · ' +
            formatUsd(burn),
        );
        if (!ok) return;
        selectedConstels.clear();
        refreshCartDock();
      };
    }

    function enterArena() {
      const pop = document.getElementById('map');
      const stage = document.getElementById('arenaStage');
      const placeholder = document.getElementById('arenaPlaceholder');
      const slot = document.getElementById('heroCosmosSlot');
      if (!stage || !frame) {
        window.__voidCosmosPendingEnter = true;
        return;
      }
      if (frame.parentElement !== stage) stage.appendChild(frame);
      if (placeholder) placeholder.hidden = true;
      if (slot) slot.classList.add('cosmos-away');
      if (pop) {
        pop.hidden = false;
        pop.classList.add('open');
      }
      document.body.classList.add('arena-live');
      document.body.classList.remove('mind-dock-open');
      const dockToggle = document.getElementById('mindDockToggle');
      if (dockToggle) {
        dockToggle.setAttribute('aria-expanded', 'false');
        dockToggle.textContent = 'tools';
      }
      arenaMode = true;
      frame.classList.add('in-arena');
      // Popup is a dedicated play surface — capture gestures immediately.
      setMapActive(true);
      atHomeView = true;
      requestAnimationFrame(() => {
        resize();
        applyHomeView(true);
        requestAnimationFrame(resize);
      });
    }
    function exitArena() {
      const pop = document.getElementById('map');
      const slot = document.getElementById('heroCosmosSlot');
      const placeholder = document.getElementById('arenaPlaceholder');
      if (!slot || !frame) return;
      if (frame.parentElement !== slot) slot.appendChild(frame);
      slot.classList.remove('cosmos-away');
      if (placeholder) placeholder.hidden = false;
      if (pop) {
        pop.classList.remove('open');
        pop.hidden = true;
      }
      document.body.classList.remove('arena-live');
      document.body.classList.remove('mind-dock-open');
      arenaMode = false;
      frame.classList.remove('in-arena');
      setMapActive(false);
      atHomeView = true;
      if (location.hash === '#map') {
        history.replaceState(null, '', location.pathname + location.search);
      }
      requestAnimationFrame(() => {
        resize();
        applyHomeView(true);
        requestAnimationFrame(resize);
      });
    }
    window.__voidCosmos = {
      enterArena,
      exitArena,
      openMap: enterArena,
      closeMap: exitArena,
      relocateTo(parent) {
        if (parent && frame) {
          parent.appendChild(frame);
          resize();
        }
      },
    };
    if (window.__voidCosmosPendingEnter) {
      window.__voidCosmosPendingEnter = false;
      enterArena();
    }
    onCleanup(() => {
      if (window.__voidCosmos) delete window.__voidCosmos;
    });
    document.getElementById('searchBtn').onclick = () => {
      const q = prompt('find constellation name or star #');
      if (!q) return;
      const id = parseInt(q, 10);
      if (!isNaN(id)) {
        const found = g0.sectors.find((x) => x.id === id);
        if (!found) {
          toast('star #' + q + ' not found');
          return;
        }
        const c = g0.constels.find((x) => x.id === found.constel);
        if (c) {
          toggleConstel(c);
          openConstelTerm(c);
          focusOn(constelWorld(c, g0).x, constelWorld(c, g0).y, 3.2);
        }
        return;
      }
      const cq = q.trim().toUpperCase();
      const c = g0.constels.find((x) => x.name.includes(cq) || x.id.includes(q.toLowerCase()));
      if (!c) {
        toast('constellation not found');
        return;
      }
      toggleConstel(c);
      openConstelTerm(c);
      focusOn(constelWorld(c, g0).x, constelWorld(c, g0).y, 3.2);
    };

    function syncLegendActive() {
      document.querySelectorAll('#mindLegend .mind-leg').forEach((leg) => {
        const f = leg.dataset.f;
        const on = mapFilter === f;
        leg.classList.toggle('on', on);
        leg.classList.toggle('off', mapFilter != null && !on);
      });
    }

    function setMapFilter(f) {
      // Exclusive like mindless: click same again → show all
      mapFilter = mapFilter === f ? null : f;
      filters.empty = !mapFilter || mapFilter === 'empty';
      filters.claimed = !mapFilter || mapFilter === 'claimed';
      filters.fed = !mapFilter || mapFilter === 'fed';
      filters.yours = !mapFilter || mapFilter === 'yours';
      syncLegendActive();
    }

    async function openMindPanel(act) {
      const panel = document.getElementById('mindPanel');
      const title = document.getElementById('mindPanelTitle');
      const body = document.getElementById('mindPanelBody');
      if (!panel || !title || !body) return;

      // Pull fresh public ledger before showing system panels
      if (act === 'standings' || act === 'market' || act === 'what' || act === 'personality') {
        body.innerHTML = '<p class="mp-cap">loading live ledger…</p>';
        panel.hidden = false;
        await refreshMapOwnerships();
        refreshCounts();
      }

      const st = realSystemStats();

      if (act === 'standings') {
        title.textContent = 'who owns the most';
        const leaders = st.leaders || [];
        body.innerHTML =
          `<p class="mp-cap">live from Turso · ${st.reservedAll} / ${st.totalLots} lots reserved · ${st.soldOfSellable}% of sellable · one lot = one wallet</p>` +
          (leaders.length
            ? leaders
                .slice(0, 10)
                .map(
                  (r, i) =>
                    `<div class="mp-row"><b>#${i + 1}</b> <span>${shortWallet(r.wallet)}</span> <em>${r.count} lot${r.count === 1 ? '' : 's'}</em></div>`,
                )
                .join('')
            : '<p class="mp-note">no wallet-linked claims yet — connect Robinhood and claim a lot.</p>') +
          (takenMap.size
            ? '<p class="mp-cap" style="margin-top:12px">reserved lots</p>' +
              [...takenMap.entries()]
                .slice(-12)
                .reverse()
                .map(
                  ([cid, info]) =>
                    `<button type="button" class="mp-row" data-cid="${cid}"><b>✧</b> <span>${info.name || cid}</span> <em>${shortWallet(info.wallet)}</em></button>`,
                )
                .join('')
            : '');
        body.querySelectorAll('.mp-row[data-cid]').forEach((btn) => {
          btn.onclick = () => {
            const c = g0.constels.find((x) => x.id === btn.dataset.cid);
            if (!c) return;
            openConstelTerm(c);
            focusOn(constelWorld(c, g0).x, constelWorld(c, g0).y, 3.2);
            panel.hidden = true;
          };
        });
      } else if (act === 'market') {
        title.textContent = 'lots for sale';
        const lots = g0.constels
          .filter((c) => !constelOwned(c) && !constelReserved(c))
          .map((c) => {
            const burn = c.grains.reduce((a, s) => a + s.usd, 0);
            const mass = c.grains.reduce((a, s) => a + s.size, 0);
            return { c, burn, mass };
          })
          .sort((a, b) => a.burn - b.burn)
          .slice(0, 12);
        body.innerHTML =
          `<p class="mp-cap">live free lots · ${st.free} available · ${st.reservedAll} already reserved</p>` +
          (lots.length
            ? lots
                .map(
                  (r) =>
                    `<button type="button" class="mp-row" data-cid="${r.c.id}"><b>✧ ${r.c.name}</b> <span>${r.c.grains.length}★</span> <em>${formatUsd(r.burn)} · ${fmt(r.mass)}c</em></button>`,
                )
                .join('')
            : '<p class="mp-note">no open lots left on this map.</p>');
        body.querySelectorAll('.mp-row[data-cid]').forEach((btn) => {
          btn.onclick = () => {
            const c = g0.constels.find((x) => x.id === btn.dataset.cid);
            if (!c) return;
            addConstelToStack(c);
            openConstelTerm(c);
            focusOn(constelWorld(c, g0).x, constelWorld(c, g0).y, 3.2);
            panel.hidden = true;
          };
        });
      } else if (act === 'what') {
        title.textContent = 'what you have turned me into';
        const yourNames = g0.constels
          .filter((c) => constelOwned(c))
          .slice(0, 8)
          .map((c) => c.name);
        body.innerHTML = `
          <p class="mp-cap">your live holdings · wallet ${st.wallet ? shortWallet(st.wallet) : 'not linked'}</p>
          <div class="mp-stat"><span>your lots</span><b>${st.yoursLots}</b></div>
          <div class="mp-stat"><span>trained</span><b>${st.trained}</b></div>
          <div class="mp-stat"><span>in stack</span><b>${selectedConstels.size}</b></div>
          <div class="mp-stat"><span>map reserved (all)</span><b>${st.reservedAll} / ${st.totalLots}</b></div>
          <p class="mp-note">${
            yourNames.length
              ? 'yours: ' + yourNames.join(', ') + (st.yoursLots > yourNames.length ? '…' : '')
              : 'no lots yet — claim on the map after connecting Robinhood.'
          }</p>`;
      } else if (act === 'personality') {
        title.textContent = 'what the personality is made of';
        body.innerHTML = `
          <p class="mp-cap">live map composition · ExoMind ledger</p>
          <div class="mp-stat"><span>immutable core</span><b>28%</b></div>
          <div class="mp-stat"><span>claimed of sellable</span><b>${st.soldOfSellable}%</b></div>
          <div class="mp-stat"><span>lots reserved</span><b>${st.reservedAll} / ${st.totalLots}</b></div>
          <div class="mp-stat"><span>still free</span><b>${st.free}</b></div>
          <div class="mp-stat"><span>other wallets</span><b>${st.others}</b></div>
          <div class="mp-stat"><span>your share</span><b>${st.yoursLots}</b></div>
          <p class="mp-note">28% sealed forever. The rest is claimable — one constellation, one wallet. Numbers come from the live ownership API.</p>`;
      }

      panel.hidden = false;
      panelMode = act;
      document.querySelectorAll('#mindActions .mind-btn').forEach((b) => {
        if (b.dataset.act !== 'heat') b.classList.toggle('on', b.dataset.act === act);
      });
    }

    function closeMindPanel() {
      const panel = document.getElementById('mindPanel');
      if (panel) panel.hidden = true;
      panelMode = null;
      document.querySelectorAll('#mindActions .mind-btn').forEach((b) => {
        if (b.dataset.act !== 'heat') b.classList.remove('on');
      });
    }

    function wireMindBar() {
      const legend = document.getElementById('mindLegend');
      if (legend) {
        legend.addEventListener('click', (e) => {
          const leg = e.target.closest('.mind-leg');
          if (!leg) return;
          const f = leg.dataset.f;
          if (!f) return;
          setMapFilter(f);
        });
      }
      const actions = document.getElementById('mindActions');
      if (actions) {
        actions.addEventListener('click', (e) => {
          const btn = e.target.closest('.mind-btn');
          if (!btn) return;
          const act = btn.dataset.act;
          if (act === 'heat') {
            heatMode = !heatMode;
            filters.heat = heatMode;
            btn.classList.toggle('on', heatMode);
            return;
          }
          if (act === 'ask') {
            closeMindPanel();
            window.__openMindChat?.();
            return;
          }
          if (panelMode === act) {
            closeMindPanel();
            return;
          }
          openMindPanel(act);
        });
      }
      document.getElementById('actAskCompact')?.addEventListener('click', () => {
        closeMindPanel();
        window.__openMindChat?.();
      });
      const dockToggle = document.getElementById('mindDockToggle');
      if (dockToggle) {
        dockToggle.addEventListener('click', () => {
          const open = document.body.classList.toggle('mind-dock-open');
          dockToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          dockToggle.textContent = open ? 'hide tools' : 'tools';
        });
      }
      document.getElementById('mindPanelX')?.addEventListener('click', closeMindPanel);
      document.getElementById('mindPanel')?.addEventListener('click', (e) => {
        if (e.target.id === 'mindPanel') closeMindPanel();
      });
      syncLegendActive();
    }
    wireMindBar();
    refreshCounts();

    document.getElementById('filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.fchip');
      if (!chip) return;
      const f = chip.dataset.f;
      if (f === 'heat') {
        heatMode = !heatMode;
        filters.heat = heatMode;
        chip.classList.toggle('on', heatMode);
        document.getElementById('actHeat')?.classList.toggle('on', heatMode);
        return;
      }
      if (f === 'empty' || f === 'claimed' || f === 'fed' || f === 'yours') setMapFilter(f);
    });

    const countsIntervalId = setInterval(refreshCounts, 2200);
    onCleanup(() => clearInterval(countsIntervalId));
    const mini = document.getElementById('mini');
    const mctx = mini.getContext('2d');
    const WORLD = 2200;
    mini.addEventListener('click', (e) => {
      const r = mini.getBoundingClientRect();
      const wx = ((e.clientX - r.left) / r.width - 0.5) * WORLD;
      const wy = ((e.clientY - r.top) / r.height - 0.5) * WORLD * 0.75;
      focusOn(wx, wy, Math.max(scale, 1.6));
    });

    function drawMini() {
      const mw = mini.width,
        mh = mini.height;
      mctx.fillStyle = '#030508';
      mctx.fillRect(0, 0, mw, mh);
      const sx = mw / WORLD,
        sy = mh / (WORLD * 0.75);
      let shown = 0;
      const miniStep = Math.max(1, Math.floor(g0.constels.length / 400));
      for (let i = 0; i < g0.constels.length; i += miniStep) {
        const c = g0.constels[i];
        const p = constelWorld(c, g0);
        const x = mw / 2 + p.x * sx,
          y = mh / 2 + p.y * sy;
        mctx.fillStyle = rgba(c.col, 0.55);
        mctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      }
      const grainStep = Math.max(1, Math.floor(g0.sectors.length / 800));
      for (let i = 0; i < g0.sectors.length; i += grainStep) {
        const s = g0.sectors[i];
        if (!sectorVisible(s)) continue;
        shown++;
        const p = sectorProj(s, g0);
        mctx.fillStyle = yoursSet.has(s.id) ? '#ccff00' : rgba(s.cCol, 0.85);
        mctx.fillRect(mw / 2 + p.x * sx, mh / 2 + p.y * sy, 1.2, 1.2);
      }
      const vw = (W / scale) * sx,
        vh = (H / scale) * sy;
      mctx.strokeStyle = 'rgba(204,255,0,.9)';
      mctx.lineWidth = 1.2;
      mctx.strokeRect(mw / 2 - (panX / scale) * sx - vw / 2, mh / 2 - (panY / scale) * sy - vh / 2, vw, vh);
      document.getElementById('miniCap').textContent = shown + ' grains · ' + g0.constels.length + ' constellations';
    }
    const miniIntervalId = setInterval(drawMini, 280);
    onCleanup(() => clearInterval(miniIntervalId));

    function pickSector(wx, wy) {
      let best = null,
        bd = 1e9;
      const step = scale < 1.5 ? 8 : scale < 3 ? 3 : 1;
      for (let i = 0; i < g0.sectors.length; i += step) {
        const s = g0.sectors[i];
        if (!sectorVisible(s)) continue;
        const p = sectorProj(s, g0);
        const d = Math.hypot(p.x - wx, p.y - wy);
        const hitR = Math.max((s.viz || 2) * 2.4, 5) / Math.max(scale * 0.85, 0.4);
        if (d < hitR && d < bd) {
          bd = d;
          best = { s, wx: p.x, wy: p.y, g: g0 };
        }
      }
      return best;
    }

    let hover = null;
    let alive = true;
    // Real IntersectionObserver instead of a getBoundingClientRect() check
    // re-run at the top of every frame forever: that read is cheap in the
    // common case but still executes 60x/sec even while fully offscreen,
    // and doesn't stop the rAF chain, just short-circuits inside it. This
    // fully halts requestAnimationFrame while out of view and restarts it
    // from the observer callback on re-entry — zero main-thread cost while
    // scrolled away, not just "less work."
    let inView = true;
    let pageVisible = !document.hidden;
    let rafId = null;
    function kickDraw() {
      if (alive && inView && pageVisible && rafId == null) rafId = requestAnimationFrame(draw);
    }
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        const wasInView = inView;
        inView = entry.isIntersecting;
        if (inView && !wasInView) kickDraw();
      },
      { rootMargin: '200px 0px' } // start/stop slightly early — avoids a pop-in the instant it crosses the edge
    );
    visibilityObserver.observe(frame);
    onCleanup(() => visibilityObserver.disconnect());
    function onPageVisibility() {
      pageVisible = !document.hidden;
      if (pageVisible) kickDraw();
    }
    document.addEventListener('visibilitychange', onPageVisibility);
    onCleanup(() => document.removeEventListener('visibilitychange', onPageVisibility));
    // Reused every frame instead of a fresh `[]` — the array itself no
    // longer costs an allocation; entries are still short-lived per-frame
    // objects, which V8's generational GC handles cheaply, so this targets
    // the one allocation actually worth removing without rewriting the
    // star loop into a riskier flat-typed-array form I can't visually test.
    const starBatch = [];
    function draw(now) {
      // No requestAnimationFrame(draw) on either of these early returns —
      // that's what actually stops the chain. alive=false (unmount) is
      // permanent; !inView / !pageVisible are temporary and get restarted
      // by IO / visibilitychange once work should resume.
      rafId = null;
      if (!alive || !inView || !pageVisible) return;
      sampleFrameTime(now);
      const t = (now - t0) / 1000;
      if (autoSpin) rot = t * 0.028;
      const frameYaw = viewYaw + rot * (autoSpin ? g0.spin : 0) + g0.m.roll;
      frameCosYaw = Math.cos(frameYaw);
      frameSinYaw = Math.sin(frameYaw);
      frameCosPitch = Math.cos(viewPitch);
      frameSinPitch = Math.sin(viewPitch);
      scale = lerp(scale, targetScale, 0.1);
      panX = lerp(panX, targetPanX, 0.1);
      panY = lerp(panY, targetPanY, 0.1);
      zoomLabel.textContent = viewLabel();

      ctx.fillStyle = '#010308';
      ctx.fillRect(0, 0, W, H);
      const g = g0;

      const deep = ctx.createRadialGradient(W / 2 + panX * 0.02, H / 2 + panY * 0.02, 10, W / 2, H / 2, Math.max(W, H) * 0.75);
      deep.addColorStop(0, '#050a18');
      deep.addColorStop(0.55, '#02040c');
      deep.addColorStop(1, '#000');
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, W, H);

      // Distant field stars as tiny discs — squares read as "pixels", not void.
      const bgStep = quality === 'high' ? 1 : quality === 'medium' ? 2 : 3;
      for (let bi = 0; bi < bgStars.length; bi += bgStep) {
        const s = bgStars[bi];
        const [sx, sy] = w2s(s.x + panX * 0.06, s.y + panY * 0.06);
        if (sx < -10 || sy < -10 || sx > W + 10 || sy > H + 10) continue;
        const a = 0.15 + 0.55 * s.a;
        ctx.fillStyle = `rgba(220,230,255,${a})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.6, s.r * 0.55), 0, Math.PI * 2);
        ctx.fill();
      }

      hover = null;
      let bestH = 0;
      // Hit-test stride mirrors sector draw stride so hover cost tracks quality.
      const hoverStep = quality === 'high' ? (scale < 2 ? 6 : 2) : quality === 'medium' ? 8 : 12;
      if (mx != null) {
        for (let si = 0; si < g.sectors.length; si += hoverStep) {
          const s = g.sectors[si];
          if (!sectorVisible(s)) continue;
          const p = sectorProj(s, g);
          const d = Math.hypot(p.x - mx, p.y - my);
          const hitR = Math.max((s.viz || 2) * 1.35, 3.2) / Math.max(scale, 0.35);
          const target = d < hitR ? 1 - d / hitR : 0;
          s.hover += (target - s.hover) * 0.28;
          if (s.hover > bestH) {
            bestH = s.hover;
            hover = { s, wx: p.x, wy: p.y };
          }
        }
        if (quality === 'high' && scale > 2) {
          const hStep = 4;
          for (let i = 0; i < g.constels.length; i += hStep) {
            const c = g.constels[i];
            const p = constelWorld(c, g);
            c.hover += ((Math.hypot(p.x - mx, p.y - my) < g.R * 0.04 ? 1 : 0) - c.hover) * 0.12;
          }
        }
      } else {
        for (const s of g.sectors) s.hover *= 0.85;
        for (const c of g.constels) c.hover *= 0.9;
      }

      if (hudEl) {
        const hide = scale > 3.2;
        if (hide !== lastHudHidden) {
          lastHudHidden = hide;
          hudEl.style.opacity = hide ? '0' : '1';
          hudEl.style.transition = 'opacity .35s';
        }
      }

      // Base LOD already thins the star field at low zoom; the quality
      // multiplier additionally thins it under sustained low frame rate —
      // this is the actual "halve the particle count under load" lever.
      // 'low' was bumped 3->4: rather than cutting the base count again
      // for every device, struggling ones now shed more automatically.
      const qualityLodMul = quality === 'high' ? 1 : quality === 'medium' ? 2 : 4;
      const lod = (scale < 0.65 ? 4 : scale < 1.3 ? 3 : scale < 2.6 ? 2 : 1) * qualityLodMul;
      const [gcx, gcy] = w2s(g.m.x, g.m.y);
      const holeFlat = Math.max(0.18, Math.abs(Math.cos(viewPitch)) * 0.65 + 0.2);
      const eh = filters.core ? Math.max(36, 58 * Math.min(scale, 2.2)) : 0;
      g._eh = eh;
      g._gcx = gcx;
      g._gcy = gcy;
      g._flat = holeFlat;
      function lensPoint(sx, sy) {
        if (eh < 1) return [sx, sy, false];
        const d = Math.hypot(sx - gcx, sy - gcy);
        if (d < eh * 0.72) return [sx, sy, true];
        return [sx, sy, false];
      }

      {
        const R = g.R * scale * 0.85;
        const flat = Math.max(0.08, Math.abs(Math.cos(viewPitch)) * 0.72 + 0.1);
        const hg = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, R * 1.25);
        hg.addColorStop(0, rgba(LIME, 0.09));
        hg.addColorStop(0.4, rgba([150, 190, 25], 0.04));
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.ellipse(gcx, gcy, R * 1.25, R * 1.25 * flat, viewYaw, 0, Math.PI * 2);
        ctx.fill();
      }

      // Gas-lane ribbons: 3 lanes/arm at full quality, thinned to 1 under
      // load, skipped entirely at 'low' — each lane is a 56-segment stroked
      // path rebuilt every frame, so this is one of the pricier decorative
      // layers relative to how subtle it is.
      const ribbonLanes = quality === 'high' ? 3 : quality === 'medium' ? 1 : 0;
      if (scale < 6 && ribbonLanes > 0) {
        for (let arm = 0; arm < g.m.arms; arm++) {
          for (let lane = 0; lane < ribbonLanes; lane++) {
            const off = (lane - 1) * 0.045;
            ctx.beginPath();
            let first = true;
            for (let k = 0; k <= 56; k++) {
              const u = k / 56;
              const r = u * g.R * (0.98 + lane * 0.01);
              const a0 = (arm / g.m.arms) * Math.PI * 2 + u * g.m.twist + off;
              const [lx2, ly2] = polarLocal(r, a0, 0);
              const pr = projectLocal(lx2, ly2, (u - 0.5) * 8, g);
              const [sx, sy] = w2s(pr.x, pr.y);
              if (first) {
                ctx.moveTo(sx, sy);
                first = false;
              } else ctx.lineTo(sx, sy);
            }
            ctx.strokeStyle = rgba(LIME, (0.04 + lane * 0.015) * (scale < 3 ? 1 : 0.55));
            ctx.lineWidth = (2.8 - lane * 0.6) * Math.min(scale, 1.8);
            ctx.stroke();
          }
        }
      }

      // Nebulae: full on high, still on medium (cached gradients), skip on low.
      if (quality !== 'low') {
        const breath = 0.85 + 0.15 * Math.sin(t * 0.7);
        for (const n of g.nebulae) {
          const [lx2, ly2] = polarLocal(n.r, n.a0 + Math.sin(t * n.sp + n.ph) * 0.02, 0);
          const pr = projectLocal(lx2, ly2, (n.u - 0.5) * 10, g);
          let [sx, sy] = w2s(pr.x, pr.y);
          const L = lensPoint(sx, sy);
          if (L[2]) continue;
          sx = L[0];
          sy = L[1];
          if (sx < -80 || sy < -80 || sx > W + 80 || sy > H + 80) continue;
          const rad = n.rad * scale * pr.persp * (scale < 2 ? 1 : 0.75);
          if (rad < 4) continue;
          const pulse = n.a * breath * (0.9 + 0.1 * Math.sin(t * n.sp + n.ph));
          if (!n._grd) {
            const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
            grd.addColorStop(0, rgba(n.col, 1));
            grd.addColorStop(0.45, rgba(n.col, 0.4));
            grd.addColorStop(1, 'rgba(0,0,0,0)');
            n._grd = grd;
          }
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(n.ang + viewYaw * 0.5);
          ctx.globalAlpha = pulse;
          ctx.fillStyle = n._grd;
          ctx.scale(rad * n.stretch, rad);
          ctx.beginPath();
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (quality === 'high') {
        // Individual stars, depth-sorted, each with its own twinkle/dust
        // tint/depth-fade — full fidelity for devices that can afford it.
        starBatch.length = 0;
        for (let i = 0; i < g.points.length; i += lod) {
          const p = g.points[i];
          const pr = pointProj(p, g, t);
          let [sx, sy] = w2s(pr.x, pr.y);
          const L = lensPoint(sx, sy);
          if (L[2]) continue;
          sx = L[0];
          sy = L[1];
          if (sx < -30 || sy < -30 || sx > W + 30 || sy > H + 30) continue;
          starBatch.push({ p, pr, sx, sy });
        }
        starBatch.sort((a, b) => a.pr.depth - b.pr.depth);
        for (const { p, pr, sx, sy } of starBatch) {
          let col = starColor(p.u);
          if (p.dust) col = colLerp(col, [8, 10, 6], 0.72);
          const tw = 0.6 + 0.4 * Math.sin(t * p.sp * 1.3 + p.ph);
          const depthFade = clamp(0.55 + pr.persp * 0.5, 0.35, 1.2);
          let sz = Math.max(0.45, Math.min(2.0, p.br * pr.persp * 0.85 * tw));
          if (p.u < 0.12) sz = Math.min(2.4, sz * 1.15);
          const a = ((p.dust ? 0.1 : 0.38) + p.br * 0.22 * tw) * depthFade;
          ctx.fillStyle = rgba(col, clamp(a, 0, 1));
          ctx.beginPath();
          ctx.arc(sx, sy, sz, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Batched discs (medium/low): one path + one fill() per color bucket.
        for (let bi = 0; bi < g.starBucketRanges.length; bi++) {
          const [start, end] = g.starBucketRanges[bi];
          const groupTw = 0.6 + 0.4 * Math.sin(t * 0.6 + bi * 0.7);
          ctx.beginPath();
          let any = false;
          for (let i = start; i < end; i += lod) {
            const p = g.points[i];
            const pr = pointProj(p, g, t);
            let [sx, sy] = w2s(pr.x, pr.y);
            const L = lensPoint(sx, sy);
            if (L[2]) continue;
            sx = L[0];
            sy = L[1];
            if (sx < -30 || sy < -30 || sx > W + 30 || sy > H + 30) continue;
            let sz = Math.max(0.45, Math.min(2.0, p.br * pr.persp * 0.85 * groupTw));
            if (p.u < 0.12) sz = Math.min(2.4, sz * 1.15);
            ctx.moveTo(sx + sz, sy);
            ctx.arc(sx, sy, sz, 0, Math.PI * 2);
            any = true;
          }
          if (any) {
            const a = clamp(g.starBucketAlphaScale[bi] * groupTw * 1.8, 0, 1);
            ctx.fillStyle = rgba(g.starBucketRGB[bi], a);
            ctx.fill();
          }
        }
      }

      // Comets are the cheapest visual thing to lose first — a handful of
      // gradient strokes that read as a bonus flourish, not core structure.
      for (const c of quality === 'high' ? g.comets : EMPTY_LIST) {
        const ang = c.a0 + t * c.spd * 0.35;
        const [lx2, ly2] = polarLocal(c.r, ang, 0);
        const head = projectLocal(lx2, ly2, Math.sin(t * 0.7 + c.ph) * 8 + c.tilt * 20, g);
        const [hx, hy] = w2s(head.x, head.y);
        const tang = ang - 0.08 * Math.sign(c.spd || 1);
        const [tlx, tly] = polarLocal(c.r * 1.02, tang, 0);
        const tail = projectLocal(tlx, tly, c.tilt * 20, g);
        const [tx, ty] = w2s(tail.x, tail.y);
        const dx = hx - tx,
          dy = hy - ty;
        const len = Math.hypot(dx, dy) || 1;
        const trail = c.len * scale * 0.35;
        const ex = hx - (dx / len) * trail,
          ey = hy - (dy / len) * trail;
        const grd = ctx.createLinearGradient(hx, hy, ex, ey);
        grd.addColorStop(0, rgba([255, 255, 220], 0.9));
        grd.addColorStop(0.25, rgba(LIME, 0.55));
        grd.addColorStop(1, 'rgba(204,255,0,0)');
        ctx.strokeStyle = grd;
        ctx.lineWidth = c.thick * Math.min(scale, 2);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.fillStyle = rgba([255, 255, 240], 0.95);
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(1.2, c.thick * scale * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }

      {
        const n = 3;
        for (let i = 0; i < n; i++) {
          const phase = (t * 0.22 + i * 1.7) % 4.2;
          if (phase > 1.1) continue;
          const u = phase / 1.1;
          const x0 = W * (-0.1 + i * 0.28) + Math.sin(i * 2.1) * 40;
          const y0 = H * (0.15 + i * 0.22);
          const x1 = x0 + W * 0.55,
            y1 = y0 + H * 0.18;
          const x = x0 + (x1 - x0) * u,
            y = y0 + (y1 - y0) * u;
          const px = x - (x1 - x0) * 0.08,
            py = y - (y1 - y0) * 0.08;
          const grd = ctx.createLinearGradient(x, y, px, py);
          grd.addColorStop(0, 'rgba(255,255,230,.95)');
          grd.addColorStop(1, 'rgba(204,255,0,0)');
          ctx.strokeStyle = grd;
          ctx.lineWidth = 1.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(px, py);
          ctx.stroke();
        }
      }

      if (filters.core) {
        const pulse = 0.7 + 0.3 * Math.sin(t * 1.2);
        const glow = ctx.createRadialGradient(gcx, gcy, eh * 0.4, gcx, gcy, eh * 2.4);
        glow.addColorStop(0, rgba([255, 255, 230], 0.55 * pulse));
        glow.addColorStop(0.28, rgba(LIME, 0.35 * pulse));
        glow.addColorStop(0.6, rgba([140, 180, 20], 0.1));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(gcx, gcy, eh * 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(gcx, gcy, eh * 0.72, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = rgba(LIME, 0.5 + pulse * 0.25);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(gcx, gcy, eh * 0.72, 0, Math.PI * 2);
        ctx.stroke();
      }

      {
        const sectorStep =
          scale < 1.2
            ? quality === 'low'
              ? 22
              : quality === 'medium'
                ? 16
                : 10
            : scale < 2.5
              ? quality === 'low'
                ? 10
                : quality === 'medium'
                  ? 6
                  : 3
              : quality === 'high'
                ? 2
                : quality === 'medium'
                  ? 3
                  : 5;
        for (let si = 0; si < g.sectors.length; si += sectorStep) {
          const s = g.sectors[si];
          if (!sectorVisible(s)) continue;
          const p = sectorProj(s, g);
          let [sx, sy] = w2s(p.x, p.y);
          const L = lensPoint(sx, sy);
          if (L[2]) continue;
          sx = L[0];
          sy = L[1];
          if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
          const grainR = Math.max(0.65, (s.viz || 2.1) * 0.4);
          let col = s.cCol;
          if (heatMode) {
            // Live heat: trained yours > yours > reserved by others > free
            const cid = String(s.constel || '');
            const mine = yoursSet.has(s.id);
            const trained = mine && trainedLots.has(cid);
            const reserved = !mine && takenMap.has(cid);
            const taught = trained ? 1 : mine ? 0.72 : reserved ? 0.4 : 0.06;
            const h = clamp(taught, 0, 1);
            col = [
              Math.floor(40 + h * 215),
              Math.floor(30 + h * 40),
              Math.floor(60 + h * 195),
            ];
          }
          if (yoursSet.has(s.id)) col = [180, 255, 120];
          const empty = s.kind === 'empty' && !heatMode;
          const inConstelSel = selectedConstels.has(s.constel);
          const selected = selectedSet.has(s.id) || inConstelSel;
          ctx.fillStyle = empty ? rgba([70, 82, 48], 0.4) : rgba(col, 0.65);
          ctx.beginPath();
          ctx.arc(sx, sy, grainR, 0, Math.PI * 2);
          ctx.fill();
          if ((s.tier === 'MEGA' || s.tier === 'LARGE') && scale > 2) {
            ctx.strokeStyle = rgba(col, s.tier === 'MEGA' ? 0.28 : 0.14);
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.arc(sx, sy, grainR + (s.tier === 'MEGA' ? 1.6 : 0.9), 0, Math.PI * 2);
            ctx.stroke();
          }
          if (selected) {
            ctx.strokeStyle = inConstelSel && !selectedSet.has(s.id)
              ? 'rgba(204,255,0,.5)'
              : 'rgba(204,255,0,.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(sx, sy, grainR + (inConstelSel ? 2.8 : 2.1), 0, Math.PI * 2);
            ctx.stroke();
          } else if (s.hover > 0.28) {
            ctx.strokeStyle = rgba(col, 0.5);
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(sx, sy, grainR + 1.4, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Constellation = connected LINE figures (stripes), not just dots.
      // Always draw — even on low quality — or the map reads as only points.
      {
        const vis = scale < 1.1 ? 0.45 : scale < 3 ? 0.7 : 0.85;
        const maxStars = quality === 'low' ? 3 : quality === 'medium' ? 3 : 4;
        // Sparse figures — far zoom is dots only; mid zoom samples hard.
        const constelStep =
          scale < 1.2
            ? quality === 'low'
              ? 22
              : quality === 'medium'
                ? 16
                : 12
            : scale < 2.5
              ? quality === 'low'
                ? 10
                : quality === 'medium'
                  ? 7
                  : 5
              : scale < 4
                ? quality === 'low'
                  ? 4
                  : 3
                : quality === 'low'
                  ? 2
                  : 1;
        const farSparkOnly = scale < 2.1;

        function strokePath(pts, close, col, a, w) {
          if (pts.length < 2) return;
          ctx.strokeStyle = rgba(col, a);
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(pts[0].sx, pts[0].sy);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
          if (close) ctx.closePath();
          ctx.stroke();
        }

        // Minimal spanning tree so every constellation reads as connected stripes
        function mstEdges(pts) {
          const n = pts.length;
          if (n < 2) return [];
          const used = new Array(n).fill(false);
          used[0] = true;
          const edges = [];
          for (let k = 1; k < n; k++) {
            let bi = -1,
              bj = -1,
              bd = 1e15;
            for (let i = 0; i < n; i++) {
              if (!used[i]) continue;
              for (let j = 0; j < n; j++) {
                if (used[j]) continue;
                const d =
                  (pts[i].sx - pts[j].sx) * (pts[i].sx - pts[j].sx) +
                  (pts[i].sy - pts[j].sy) * (pts[i].sy - pts[j].sy);
                if (d < bd) {
                  bd = d;
                  bi = i;
                  bj = j;
                }
              }
            }
            if (bj < 0) break;
            used[bj] = true;
            edges.push([pts[bi], pts[bj]]);
          }
          return edges;
        }

        function spark(x, y, col, a) {
          ctx.fillStyle = rgba([255, 255, 240], a * 0.95);
          ctx.beginPath();
          ctx.arc(x, y, 1.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = rgba(col, a * 0.55);
          ctx.beginPath();
          ctx.arc(x, y, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let ci = 0; ci < g.constels.length; ci++) {
          const c = g.constels[ci];
          const picked = selectedConstels.has(c.id);
          if (!picked && ci % constelStep) continue;
          if (!constelVisible(c) && !picked) continue;

          const center = constelWorld(c, g);
          const [cx0, cy0] = w2s(center.x, center.y);
          if (!picked && (cx0 < -50 || cy0 < -50 || cx0 > W + 50 || cy0 > H + 50)) continue;

          if (farSparkOnly && !picked) {
            spark(cx0, cy0, c.col, 0.28 * vis);
            continue;
          }

          const raw = [];
          for (const s of c.grains) {
            if (!sectorVisible(s) && !picked) continue;
            const p = sectorProj(s, g);
            const [sx, sy] = w2s(p.x, p.y);
            if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
            raw.push({
              s,
              sx,
              sy,
              br:
                (s.tier === 'MEGA' ? 3 : s.tier === 'LARGE' ? 1.6 : s.tier === 'MID' ? 0.4 : 0) +
                (s.kind === 'fed' ? 1.2 : 0) +
                s.hover,
            });
          }
          if (raw.length < 2) {
            if (picked) spark(cx0, cy0, LIME, 0.85);
            continue;
          }
          raw.sort((a, b) => b.br - a.br);
          const stars = raw.slice(0, Math.min(raw.length, maxStars));

          const hot = picked || c.hover > 0.2 || stars.some((p) => p.s.hover > 0.25);
          const pulse = 0.92 + 0.08 * Math.sin(t * 1.2 + c.a0 * 3);
          const aMain = (picked ? 0.85 : hot ? 0.48 : 0.28 * vis) * pulse;
          const strokeCol = picked ? LIME : c.col;

          const edges = mstEdges(stars);
          for (const [a, b] of edges) {
            if (picked || hot) {
              strokePath([a, b], false, strokeCol, aMain * 0.18, picked ? 2.4 : 1.6);
            }
            strokePath([a, b], false, strokeCol, aMain, picked ? 1.15 : hot ? 0.75 : 0.55);
          }

          // Closed ring only for selected / hovered — keeps the field quiet
          if (stars.length >= 3 && picked) {
            let cx = 0,
              cy = 0;
            for (const p of stars) {
              cx += p.sx;
              cy += p.sy;
            }
            cx /= stars.length;
            cy /= stars.length;
            const ring = stars
              .map((p) => {
                p.ang = Math.atan2(p.sy - cy, p.sx - cx);
                return p;
              })
              .sort((a, b) => a.ang - b.ang);
            strokePath(ring, true, strokeCol, aMain * 0.22, 0.7);
          }

          if (picked) {
            let hx = 0,
              hy = 0;
            for (const p of stars) {
              hx += p.sx;
              hy += p.sy;
            }
            hx /= stars.length;
            hy /= stars.length;
            const halo = ctx.createRadialGradient(hx, hy, 3, hx, hy, 28);
            halo.addColorStop(0, 'rgba(204,255,0,.18)');
            halo.addColorStop(1, 'rgba(204,255,0,0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(hx, hy, 28, 0, Math.PI * 2);
            ctx.fill();
          }

          for (const p of stars) {
            spark(p.sx, p.sy, strokeCol, (picked ? 0.9 : hot ? 0.55 : 0.35) * vis * pulse);
          }
        }
      }

      // Names only when close / selected / hovered — no wallpaper of text
      if (scale > 3.2) {
        const step = (scale < 4.5 ? 14 : scale < 6 ? 6 : 2) * (quality === 'low' ? 2 : 1);
        g.constels.forEach((c, idx) => {
          const picked = selectedConstels.has(c.id);
          const hot = picked || c.hover > 0.35;
          if (!picked && !hot && idx % step) return;
          if (!hot && scale < 4.2) return;
          if (!constelVisible(c) && !picked) return;
          if (c.grains.length < 2 && !picked) return;
          const p = constelWorld(c, g);
          const [sx, sy] = w2s(p.x, p.y);
          if (sx < 24 || sy < 24 || sx > W - 24 || sy > H - 24) return;
          const a = clamp(picked ? 0.9 : hot ? 0.7 : 0.32, 0, 0.95);
          const short = String(c.name || '')
            .replace(/\s+\d+$/, '')
            .slice(0, 14);
          const fs = hot ? 9 : 7;
          ctx.font = `${hot ? 600 : 500} ${fs}px IBM Plex Mono`;
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(0,0,0,${a * 0.4})`;
          ctx.fillText(short, sx + 1, sy + 1);
          ctx.fillStyle = rgba(picked ? LIME : c.col, a);
          ctx.fillText(short, sx, sy);
        });
      }

      if (scale < 1.15) {
        ctx.font = '11px IBM Plex Mono';
        ctx.textAlign = 'center';
        const ly2 = gcy + (eh || 40) * 1.15 + 18;
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        ctx.fillText('EXOMIND', gcx + 1, ly2 + 1);
        ctx.fillStyle = 'rgba(204,255,0,.55)';
        ctx.fillText('EXOMIND', gcx, ly2);
      }


      if (hover && hover.s.hover > 0.2) {
        const tipId = hover.s.id;
        if (tipId !== lastTipId) {
          lastTipId = tipId;
          const tip1 = document.getElementById('tip1');
          const tip2 = document.getElementById('tip2');
          if (tip1) tip1.textContent = `${hover.s.cName} · #${hover.s.id}`;
          if (tip2)
            tip2.textContent = `${hover.s.tier} · ${hover.s.size}c · ${formatUsd(hover.s.usd)} · ${
              hover.s.kind === 'empty' ? 'unclaimed' : hover.s.kind
            }`;
        }
        const [sx, sy] = w2s(hover.wx, hover.wy);
        tip.style.left = Math.min(W - 200, sx + 12) + 'px';
        tip.style.top = Math.min(H - 70, sy + 12) + 'px';
        tip.classList.add('show');
        canvas.style.cursor = 'pointer';
      } else {
        lastTipId = null;
        tip.classList.remove('show');
        if (!dragging) canvas.style.cursor = orbitMode ? 'grab' : 'grab';
      }
      rafId = requestAnimationFrame(draw);
    }
    rafId = requestAnimationFrame(draw);
    onCleanup(() => {
      alive = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
    });

    let burned = 7218018;
    const burnedIntervalId = setInterval(() => {
      burned += ri(10, 200);
      document.getElementById('burned').textContent = fmt(burned);
      const burnEl = document.getElementById('mindMetaBurn');
      if (burnEl) burnEl.textContent = `${fmt(burned)} $EXO burned`;
    }, 2600);
    onCleanup(() => clearInterval(burnedIntervalId));
  })();

  /* ================= MARKET ================= */
  (function () {
    let price = 0.002278,
      open24 = price / 1.6486,
      mcap = 2.16e6,
      liq = 1.3e6;
    const candles = [];
    function seed(n) {
      candles.length = 0;
      let p = price * 0.75;
      for (let i = 0; i < n; i++) {
        const o = p,
          c = Math.max(0.0002, o + (Math.random() - 0.46) * 0.00012);
        candles.push({ o, h: Math.max(o, c) * (1 + Math.random() * 0.01), l: Math.min(o, c) * (1 - Math.random() * 0.01), c, v: Math.random() });
        p = c;
      }
      price = candles.at(-1).c;
    }
    seed(70);
    const box = document.getElementById('chartBox');
    const cnv = document.getElementById('chart');
    const c = cnv.getContext('2d');
    const fmtP = (p) => '$' + p.toFixed(6);
    const fmtM = (n) => (n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : '$' + (n / 1e3).toFixed(0) + 'K');
    function push() {
      const chg = ((price - open24) / open24) * 100;
      document.getElementById('mPrice').textContent = fmtP(price);
      document.getElementById('mCap').textContent = fmtM(mcap);
      document.getElementById('mLiq').textContent = fmtM(liq);
      const el = document.getElementById('mChg');
      el.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
      el.className = 'v ' + (chg >= 0 ? 'up' : 'dn');
    }
    function resize() {
      const r = box.getBoundingClientRect();
      const d = Math.min(devicePixelRatio || 1, 2);
      cnv.width = r.width * d;
      cnv.height = r.height * d;
      cnv.style.width = r.width + 'px';
      cnv.style.height = r.height + 'px';
      c.setTransform(d, 0, 0, d, 0, 0);
      draw();
    }
    function draw() {
      const W = box.clientWidth,
        H = box.clientHeight;
      if (!W) return;
      c.clearRect(0, 0, W, H);
      let lo = Infinity,
        hi = -Infinity;
      candles.forEach((k) => {
        lo = Math.min(lo, k.l);
        hi = Math.max(hi, k.h);
      });
      const span = hi - lo || 1e-6;
      lo -= span * 0.05;
      hi += span * 0.05;
      const n = candles.length,
        slot = W / n,
        bw = Math.max(2, slot * 0.55);
      for (let i = 0; i < n; i++) {
        const k = candles[i],
          x = i * slot + slot / 2;
        const y = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 36);
        const up = k.c >= k.o,
          col = up ? '#ccff00' : '#ff4d5e';
        c.strokeStyle = col;
        c.beginPath();
        c.moveTo(x, y(k.h));
        c.lineTo(x, y(k.l));
        c.stroke();
        c.fillStyle = col;
        c.fillRect(x - bw / 2, Math.min(y(k.o), y(k.c)), bw, Math.max(1, Math.abs(y(k.c) - y(k.o))));
      }
    }
    const tickerIntervalId = setInterval(() => {
      const last = candles.at(-1);
      const nc = Math.max(0.00015, last.c + (Math.random() - 0.48) * 0.00004);
      last.c = nc;
      last.h = Math.max(last.h, nc);
      last.l = Math.min(last.l, nc);
      if (Math.random() < 0.1) {
        candles.push({ o: nc, h: nc, l: nc, c: nc, v: Math.random() * 0.3 });
        if (candles.length > 100) candles.shift();
      }
      price = nc;
      mcap = price * 9.5e8;
      push();
      draw();
    }, 800);
    onCleanup(() => clearInterval(tickerIntervalId));

    document.getElementById('tfs').onclick = (e) => {
      const b = e.target.closest('.tf');
      if (!b) return;
      document.querySelectorAll('.tf').forEach((t) => t.classList.remove('on'));
      b.classList.add('on');
      seed(+b.dataset.n);
      push();
      draw();
    };
    const marketResizeObserver = new ResizeObserver(resize);
    marketResizeObserver.observe(box);
    onCleanup(() => marketResizeObserver.disconnect());
    push();
    setTimeout(resize, 40);
  })();

  return function destroy() {
    disposers.forEach((fn) => {
      try {
        fn();
      } catch {
        /* no-op — teardown best-effort */
      }
    });
  };
}
