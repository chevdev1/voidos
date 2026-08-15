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
import { getLotKind, buildLotProfile } from '../../shared/lotLore.js'
import { applyLotBookToConstels, formatUsd } from '../../shared/lotPricing.js'
import { formatClaimBurn } from '../../shared/rhChain.js'

export function initVoidEngine() {
  'use strict';
  const disposers = [];
  const onCleanup = (fn) => disposers.push(fn);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const fmt = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function closeTerm() {
    const el = document.getElementById('term')
    if (el) el.classList.remove('open')
    document.body.classList.remove('term-open')
  }

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
    document.body.classList.add('term-open');
    window.__voidDismissMapPrompt?.()
    if (typeof window.__voidSyncTermButtons === 'function') window.__voidSyncTermButtons();
  }

  const termX = document.getElementById('termX')
  if (termX) {
    termX.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      closeTerm()
    }
  }
  const onTermKey = (e) => {
    if (e.key === 'Escape') closeTerm()
  }
  window.addEventListener('keydown', onTermKey)
  onCleanup(() => window.removeEventListener('keydown', onTermKey))

  /** Weighted grain mass — most mid/micro, rare megas you can actually see. */
  function rollGrainMass() {
    const r = Math.random();
    if (r < 0.035) return { size: ri(480, 980), tier: 'MEGA', viz: rnd(4.4, 6.5) };
    if (r < 0.14) return { size: ri(240, 479), tier: 'LARGE', viz: rnd(3.0, 4.2) };
    if (r < 0.55) return { size: ri(110, 239), tier: 'MID', viz: rnd(1.9, 2.9) };
    return { size: ri(32, 109), tier: 'MICRO', viz: rnd(1.15, 1.85) };
  }
  /* Per-grain USD is assigned later from the $300k lot book (applyLotBookToConstels). */
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
    if (!frame || !canvas || !canvas.getContext) {
      window.dispatchEvent(new Event('void-cosmos-ready'));
      return;
    }
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      window.dispatchEvent(new Event('void-cosmos-ready'));
      return;
    }
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
      arms: 4,
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
      // Softer olive→lime so idle lots don't scream
      const t = (i % 20) / 19;
      return [Math.floor(78 + t * 110), Math.floor(118 + t * 95), Math.floor(22 + t * 38)];
    }
    /* dense constellation grid — ~200 across the disk */
    const CONSTEL_DEFS = [];
    {
      let n = 0;
      const arms = 4,
        perArm = 50;
      for (let arm = 0; arm < arms; arm++) {
        for (let k = 0; k < perArm; k++) {
          const u = 0.04 + k * (0.94 / (perArm - 1)) + (((arm * 5 + k * 3) % 7) - 3) * 0.006;
          const name = NAME_A[n % NAME_A.length] + ' ' + NAME_B[(n * 5 + arm * 2) % NAME_B.length];
          const tag = n > NAME_A.length ? ' ' + (n + 1) : '';
          // Scramble kinds along the arm so neighbors aren't the same silhouette
          const figure = (n * 17 + arm * 11 + k * 5) % 6;
          CONSTEL_DEFS.push({
            id: 'c' + n,
            name: (name + tag).toUpperCase(),
            col: limeShade(n + arm * 2),
            arm,
            u: clamp(u, 0.03, 0.97),
            spread: 0.22 + (n % 7) * 0.035,
            figure,
          });
          n++;
        }
      }
    }

    function colLerp(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    /* milky-way lime: warm core → soft arms → faint olive rim (not neon slap) */
    function starColor(u) {
      u = clamp(u, 0, 1);
      if (u < 0.08) return colLerp([235, 235, 210], [220, 220, 150], u / 0.08);
      if (u < 0.28) return colLerp([200, 220, 110], [170, 210, 50], (u - 0.08) / 0.2);
      if (u < 0.55) return colLerp([160, 200, 45], [120, 160, 40], (u - 0.28) / 0.27);
      if (u < 0.8) return colLerp([95, 130, 40], [65, 90, 32], (u - 0.55) / 0.25);
      return colLerp([48, 65, 24], [28, 38, 16], (u - 0.8) / 0.2);
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
      // Fewer stars = map stays live while wallet / claim run on the same thread.
      for (let i = 0; i < 2800; i++) {
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
          col: u < 0.25 ? [230, 220, 160] : u < 0.55 ? [170, 210, 50] : [100, 140, 38],
          a: rnd(0.025, 0.07),
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

      function nearestConstel(r, a0) {
        const x = r * Math.cos(a0),
          y = r * Math.sin(a0);
        let best = constels[0],
          bd = 1e9;
        for (const c of constels) {
          const d = Math.hypot(x - c.x, y - c.y) / (c.spread * R * 0.35 + 20);
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
        return best;
      }

      const sectors = [];
      let tries = 0;
      while (sectors.length < 2800 && tries++ < 90000) {
        const mass = rollGrainMass();
        const r = rnd(R * 0.04, R * 0.98);
        const arm = ri(0, m.arms - 1);
        const a0 = (arm / m.arms) * Math.PI * 2 + (r / R) * m.twist + rnd(-0.28, 0.28);
        const off = rnd(-14, 14);
        const minDist = 4.0 + mass.viz * 0.95;
        let ok = true;
        for (const s of sectors) {
          if (
            Math.hypot(r * Math.cos(a0) - s.r * Math.cos(s.a0), r * Math.sin(a0) - s.r * Math.sin(s.a0)) <
            minDist
          ) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const c = nearestConstel(r, a0);
        const sec = {
          id: 1000 + sectors.length,
          r,
          a0,
          off,
          u: r / R,
          radius: mass.viz,
          viz: mass.viz,
          size: mass.size,
          tier: mass.tier,
          kind: Math.random() < 0.14 ? 'fed' : Math.random() < 0.22 ? 'empty' : 'claimed',
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

      for (const c of constels) {
        if (!c.grains.length) continue;
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
      const populated = constels.filter((c) => c.grains.length >= 2);
      applyLotBookToConstels(populated);

      return {
        m,
        R,
        points,
        comets,
        nebulae,
        sectors,
        constels: populated,
        spin: 1.05,
        starBucketRanges,
        starBucketRGB,
        starBucketAlphaScale,
      };
    }

    const galaxies = [buildMegaGalaxy(GAL)];
    const g0 = galaxies[0];
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
        const c = g0.constels.find((x) => String(x.id) === String(cid));
        if (c && !constelOwned(c)) n++;
      }
      return n;
    }

    /** Live system stats from Turso ledger + local owns (not decorative seed). */
    function realSystemStats() {
      const totalLots = mapTotals.total || g0.constels.length || 200;
      const reservedAll = mapTotals.claimed || takenMap.size;
      const yoursLots = countOwnedConstels();
      let trainedOthers = 0;
      for (const [cid, info] of takenMap) {
        if (!info?.trained) continue;
        const c = g0.constels.find((x) => String(x.id) === String(cid));
        if (c && !constelOwned(c)) trainedOthers++;
      }
      const trained = trainedLots.size + trainedOthers;
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
        ledger: mapLedgerStatus,
      };
    }
    function detectStartQuality() {
      try {
        const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
        const narrow = matchMedia('(max-width: 960px)').matches;
        const saveData = navigator.connection && navigator.connection.saveData;
        const mem = navigator.deviceMemory;
        if (saveData || (mem != null && mem <= 2)) return 'low';
        if (coarse || narrow) return 'medium';
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low';
      } catch (_) {
        /* ignore */
      }
      return 'medium';
    }
    let quality = detectStartQuality(); // 'high' | 'medium' | 'low'
    if (quality === 'low') {
      autoSpin = false;
      orbitMode = false;
      document.getElementById('spinBtn')?.classList.remove('on');
      document.getElementById('orbitBtn')?.classList.remove('on');
    }
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
      if (badStreak > 30 && quality !== 'low') {
        setQuality('low');
        badStreak = 0;
      }
      // Never climb to high — that is what froze phones during connect/claim.
    }

    const bgStars = Array.from({ length: 48 }, () => ({
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
      return 1;
    }
    function renderScaleForQuality() {
      if (quality === 'high') return 0.85;
      if (quality === 'medium') return 0.7;
      return 0.55;
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
    let mapTotals = { claimed: 0, available: 200, total: 200 };
    /** live = API ok with rows · empty = API ok, 0 lots · offline = fetch failed */
    let mapLedgerStatus = 'unknown';

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
      for (const [cid, info] of takenMap) {
        const c = g0.constels.find((x) => String(x.id) === String(cid));
        if (!c) continue;
        const trained = Boolean(info?.trained);
        const mine = c.grains.length > 0 && c.grains.every((s) => yoursSet.has(s.id));
        if (mine) {
          if (trained) trainedLots.add(String(cid));
          continue;
        }
        for (const s of c.grains) {
          if (yoursSet.has(s.id)) continue;
          if (trained) s.kind = 'fed';
          else if (s.kind === 'empty') s.kind = 'claimed';
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
          trained: Boolean(o.trained || o.trained_at),
        });
      }
      applyTakenVisuals();
      refreshCounts();
      paintHudLeaders();
    }

    function paintHudLeaders() {
      const el = document.getElementById('hudLeaders');
      if (!el) return;
      const top = (mapLeaders || []).slice(0, 8);
      if (!top.length) {
        el.innerHTML =
          '<p class="hud-board-cap">PRETENDERS</p><p class="hud-board-row">no claims yet</p>';
        return;
      }
      el.innerHTML =
        '<p class="hud-board-cap">PRETENDERS</p>' +
        top
          .map(
            (r, i) =>
              `<div class="hud-board-row"><b>#${i + 1}</b> <span>${shortWallet(r.wallet)}</span> <em>${r.count}</em></div>`,
          )
          .join('') +
        '<button type="button" class="hud-board-btn" data-open-board>full board</button>';
    }

    window.__voidHydrateTaken = hydrateTakenFromPublic;

    async function refreshMapOwnerships() {
      try {
        const data = await mindMapOwnerships({ force: false });
        hydrateTakenFromPublic(data);
        const n = Array.isArray(data?.lots) ? data.lots.length : 0;
        const claimed = Number(data?.totals?.claimed) || n;
        mapLedgerStatus = claimed > 0 ? 'live' : 'empty';
      } catch {
        mapLedgerStatus = 'offline';
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
        const reserved = lastTermConstel && constelReserved(lastTermConstel);
        const taken = lastTermConstel ? constelTakenInfo(lastTermConstel) : null;
        buyBtn.textContent = lastTermConstel
          ? constelOwned(lastTermConstel)
            ? 'already yours'
            : reserved
              ? 'RESERVED · ' + shortWallet(taken?.wallet)
              : !hasWallet
                ? 'connect wallet to claim'
                : 'claim · burn $TEST'
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

      // Drop lots that are already yours / reserved so totals never flash $0
      for (const cid of [...selectedConstels]) {
        const c = g0.constels.find((x) => x.id === cid);
        if (!c || constelOwned(c) || constelReserved(c)) selectedConstels.delete(cid);
      }

      // Stack = constellations only (any leftover grain picks dropped)
      selectedSet.clear();
      const items = [];
      let mass = 0,
        burn = 0;
      for (const cid of selectedConstels) {
        const c = g0.constels.find((x) => x.id === cid);
        if (!c) continue;
        for (const s of c.grains) {
          items.push(s);
          mass += s.size;
          burn += Number(s.usd) || 0;
        }
      }

      if (!selectedConstels.size) {
        dock.hidden = true;
        list.innerHTML = '';
        if (title) title.textContent = 'STACK · 0 constellations';
        if (massEl) massEl.textContent = '0';
        if (burnEl) burnEl.textContent = formatClaimBurn(0);
        syncTermButtons();
        return;
      }
      dock.hidden = false;
      list.innerHTML = [...selectedConstels]
        .map((cid) => {
          const c = g0.constels.find((x) => x.id === cid);
          if (!c) return '';
          const cm = c.grains.reduce((a, s) => a + s.size, 0);
          const cb = c.grains.reduce((a, s) => a + (Number(s.usd) || 0), 0);
          return `<button type="button" class="cart-chip constel" data-cid="${c.id}" title="remove">✧ ${escHtml(
            c.name,
          )} · ${c.grains.length}g · ${escHtml(formatClaimBurn(1))}</button>`;
        })
        .join('');
      if (title) title.textContent = `STACK · ${selectedConstels.size} constellations`;
      if (massEl) massEl.textContent = fmt(mass);
      if (burnEl) burnEl.textContent = formatClaimBurn(selectedConstels.size);
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
      if (typeof window.__openWalletMenu === 'function') window.__openWalletMenu();
      toast('connect wallet to claim');
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

      if (!isClaimLiveClient()) {
        toast('token not configured');
        return false;
      }
      try {
        toast('confirm burn in wallet · Robinhood Chain…');
        const { hash } = await claimOnChain(previewLots.map((l) => l.id));
        await mindClaimVerify({ txHash: hash, lots: previewLots });
        claimSectors(items, { skipSync: true, celebrate: true });
        await refreshMapOwnerships();
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

    const celebrateLots = new Map(); // constel_id → until performance.now()
    const figureCache = new Map(); // constel_id → lot profile (same as cabinet)

    function figureForConstel(c) {
      const id = String(c?.id || '');
      if (!id) return null;
      let p = figureCache.get(id);
      if (!p) {
        p = buildLotProfile({
          constel_id: id,
          constel_name: c.name,
          figure: typeof c.figure === 'number' ? c.figure : undefined,
        });
        figureCache.set(id, p);
      }
      return p;
    }

    function escHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function toast(msg, opts = {}) {
      const el =
        document.getElementById('voidToast') ||
        (() => {
          const n = document.createElement('div');
          n.id = 'voidToast';
          n.className = 'void-toast';
          document.body.appendChild(n);
          return n;
        })();
      el.classList.toggle('claim', Boolean(opts.claim));
      if (opts.html) el.innerHTML = String(msg);
      else el.textContent = String(msg);
      el.classList.add('show');
      clearTimeout(el._t);
      el._t = setTimeout(() => {
        el.classList.remove('show');
        el.classList.remove('claim');
        el.textContent = '';
      }, opts.claim ? 4200 : 2800);
    }

    function celebrateClaim(cids) {
      const ids = [...cids].map(String).filter(Boolean);
      if (!ids.length) return;
      const until = performance.now() + 4200;
      for (const id of ids) celebrateLots.set(id, until);
      const first = g0.constels.find((c) => ids.includes(String(c.id)));
      if (first) {
        const p = constelWorld(first, g0);
        focusOn(p.x, p.y, 4.0);
        openConstelTerm(first);
      }
      const names = ids
        .map((id) => g0.constels.find((c) => String(c.id) === id)?.name || id)
        .filter(Boolean);
      const burn = ids.reduce((a, id) => {
        const c = g0.constels.find((x) => String(x.id) === id);
        if (!c) return a;
        return a + c.grains.reduce((s, g) => s + (Number(g.usd) || 0), 0);
      }, 0);
      toast(
        `<b>CLAIMED</b><span>${escHtml(names.slice(0, 3).join(' · '))}${
          names.length > 3 ? '…' : ''
        }</span><em>${escHtml(formatUsd(burn))} · yours forever</em>`,
        { html: true, claim: true },
      );
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

      if (opts.celebrate !== false && touched.size) {
        celebrateClaim(touched);
      }

      if (opts.skipSync) return touched;
      const lots = [...touched]
        .map((cid) => g0.constels.find((x) => x.id === cid))
        .filter((c) => c && constelOwned(c))
        .map((c) => ({ id: c.id, name: c.name }));
      syncClaimedLots(lots);
      return touched;
    }

    /** Apply server / localStorage ownership list onto the live map. */
    function hydrateOwnsFromLedger(list) {
      if (!g0?.constels || !Array.isArray(list)) return;
      // Rebuild from scratch so dropped local ghosts disappear
      if (g0.sectors) {
        for (const s of g0.sectors) {
          if (yoursSet.has(s.id) && (s.kind === 'claimed' || s.kind === 'fed')) {
            s.kind = 'empty';
          }
        }
      }
      yoursSet.clear();
      trainedLots.clear();
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
        const cid = sessionStorage.getItem('void_focus_lot');
        if (!cid) return;
        sessionStorage.removeItem('void_focus_lot');
        const targetCid = String(cid);
        if (sessionStorage.getItem('void_open_arena')) {
          sessionStorage.removeItem('void_open_arena');
        }
        enterArena();
        // enterArena snaps to home view on rAF — focus after that lands.
        const tryFocus = () => {
          if (!g0?.constels) return false;
          const c = g0.constels.find((x) => String(x.id) === targetCid);
          if (!c) return false;
          const p = constelWorld(c, g0);
          focusOn(p.x, p.y, 3.6);
          openConstelTerm(c);
          return true;
        };
        setTimeout(() => {
          if (!tryFocus()) setTimeout(() => {
            if (!tryFocus()) toast('lot not found on map — open full map and search');
          }, 400);
        }, 250);
      } catch (_) {
        /* ignore */
      }
    }

    window.__voidFocusLot = (cid) => {
      try {
        sessionStorage.setItem('void_focus_lot', String(cid || ''));
        sessionStorage.setItem('void_open_arena', '1');
        focusLotFromStorage();
      } catch (_) {
        /* ignore */
      }
    };
    onCleanup(() => {
      if (window.__voidFocusLot) delete window.__voidFocusLot;
    });

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
        return refreshMapOwnerships()
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
        const c = g0.constels.find((x) => x.id === grain.s.constel);
        if (c) return { c, p: constelWorld(c, g0) };
      }
      let best = null,
        bd = 1e9;
      const hitR = g0.R * (scale < 2 ? 0.22 : scale < 5 ? 0.16 : 0.11);
      for (const c of g0.constels) {
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
        price: owned
          ? 'claimed (yours)'
          : reserved
            ? 'RESERVED · one owner only'
            : isClaimLiveClient()
              ? formatClaimBurn(1) + ' · on-chain'
              : formatClaimBurn(1) + ' · connect to claim',
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
    function uiHit(t) {
      return (
        t instanceof Element &&
        Boolean(
          t.closest(
            '#term, .cart-dock, .arena-close, .arena-hud-actions, .account-menu, .arena-home, .mind-bar, .mind-panel, .mind-chat, .filters, .vc, .minimap, .cosmos-bar, .cosmos-explore',
          ),
        )
      )
    }
    function onPointerDown(e) {
      if (uiHit(e.target)) return
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
      if (uiHit(e.target)) return
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
      if (uiHit(e.target)) {
        pendingTouch = null
        dragging = false
        try {
          canvas.releasePointerCapture?.(e.pointerId)
        } catch (_) {
          /* ignore */
        }
        return
      }
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
      if (uiHit(e.target)) return
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
    document.getElementById('termBuy').onclick = async (e) => {
      e?.stopPropagation?.()
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
            formatClaimBurn(nConst),
        );
        if (!ok) return;
        selectedConstels.clear();
        refreshCartDock();
      };
    }

    function enterArena() {
      // The boot splash (see BootSplash.jsx / LandingPage.jsx) sits at
      // z-[400000] — above the arena popup (z-index:80) — and its own
      // ready->fade sequence takes at least 2 rAFs + 520ms even after the
      // engine signals it's loaded. If the map is opened early (e.g. a
      // #map URL hash on cold load, or a very fast click), the arena was
      // opening correctly *underneath* the still-visible splash: exactly
      // "black screen but clickable" (click-through starts as soon as the
      // splash's fade-out flips on pointer-events:none, well before the
      // pixels are actually gone). This tells the boot sequence to skip
      // straight to done instead of racing it.
      window.dispatchEvent(new Event('void-map-opened'));
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
      // Bug (found after the first fix): if the hero-slot demo had been
      // paused, the draw() rAF chain was fully stopped (rafId === null).
      // Setting arenaMode = true alone doesn't restart it, so kickDraw()
      // is needed here — but calling it *before* resize()/applyHomeView()
      // have run meant the first real draw() frame could fire using the
      // still-stale hero-slot W/H and canvas buffer size (resize() for the
      // new full-screen arena size only happens in the rAF below), while
      // the canvas's on-screen CSS size had already jumped to full-screen
      // via .in-arena — one frame drawn at the wrong buffer size, stretched
      // by the browser to the new on-screen size: exactly the "grains are
      // clickable but the visuals are shifted/missing" symptom. Fix: run
      // resize() + applyHomeView() first (synchronously, inside this same
      // rAF callback) and only kickDraw() after, so the very first frame
      // draws already knows the correct dimensions and home view.
      requestAnimationFrame(() => {
        resize();
        applyHomeView(true);
        kickDraw('enterArena');
        console.info('[void cosmos] enterArena resize done', {
          W, H, canvasW: canvas.width, canvasH: canvas.height, scale, targetScale, quality, rafId,
        });
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
      document.body.classList.remove('term-open');
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
      pauseDemo,
      resumeDemo,
      releaseUi: () => {
        document.body.classList.remove('wc-modal-open')
        if (!document.querySelector('.account-menu-sheet')) {
          document.body.classList.remove('wallet-ui-open')
          document.body.style.removeProperty('overflow')
        }
        resumeDemo()
      },
      relocateTo(parent) {
        if (parent && frame) {
          parent.appendChild(frame);
          resize();
        }
      },
    };
    // Defensive: without this, a torn-down instance's methods stay
    // reachable through window.__voidCosmos until a fresh initVoidEngine()
    // call overwrites it — a window where any external caller (a stray
    // timer, an event handler that fired late) hits dead closures instead
    // of either the right instance or a clean "not ready yet" no-op.
    const api = window.__voidCosmos;
    onCleanup(() => {
      // Guarded by identity (not just "does it exist") so this can't
      // clobber a newer instance's reference if this cleanup happens to
      // run after a fresh initVoidEngine() already replaced it.
      if (window.__voidCosmos === api) delete window.__voidCosmos;
      delete window.__voidMapPainted;
    });
    window.dispatchEvent(new Event('void-cosmos-ready'));
    if (window.__voidCosmosPendingEnter) {
      window.__voidCosmosPendingEnter = false;
      enterArena();
    }
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) searchBtn.onclick = () => {
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
        const ledgerLine =
          st.ledger === 'offline'
            ? 'ownership API failed — these zeros are not a mock, the ledger did not load (Turso env / redeploy).'
            : st.ledger === 'empty'
              ? 'ownership API is live · this host DB has 0 reserved lots. Claims in another Turso or a local file do not show here.'
              : 'live from GET /api/map-ownerships · reserved lots move these numbers.';
        body.innerHTML = `
          <p class="mp-cap">live map composition · ExoMind ledger</p>
          <div class="mp-stat"><span>immutable core</span><b>28%</b></div>
          <div class="mp-stat"><span>claimed of sellable</span><b>${st.soldOfSellable}%</b></div>
          <div class="mp-stat"><span>lots reserved</span><b>${st.reservedAll} / ${st.totalLots}</b></div>
          <div class="mp-stat"><span>still free</span><b>${st.free}</b></div>
          <div class="mp-stat"><span>other wallets</span><b>${st.others}</b></div>
          <div class="mp-stat"><span>your share</span><b>${st.yoursLots}</b></div>
          <p class="mp-note">28% is lore (sealed, not from DB). The lot counts are real. ${ledgerLine}</p>`;
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
      resumeDemo();
      kickDraw('mindPanel');
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
      document.getElementById('actBoardCompact')?.addEventListener('click', () => {
        openMindPanel('standings');
      });
      document.getElementById('hudLeaders')?.addEventListener('click', (e) => {
        if (e.target.closest('[data-open-board]')) openMindPanel('standings');
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
      for (const c of g0.constels) {
        const p = constelWorld(c, g0);
        const x = mw / 2 + p.x * sx,
          y = mh / 2 + p.y * sy;
        const grd = mctx.createRadialGradient(x, y, 0, x, y, 20);
        grd.addColorStop(0, rgba(c.col, 0.5));
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grd;
        mctx.beginPath();
        mctx.arc(x, y, 20, 0, Math.PI * 2);
        mctx.fill();
      }
      for (const s of g0.sectors) {
        if (!sectorVisible(s)) continue;
        shown++;
        const p = sectorProj(s, g0);
        mctx.fillStyle = yoursSet.has(s.id) ? '#ccff00' : rgba(s.cCol, 0.9);
        mctx.beginPath();
        mctx.arc(mw / 2 + p.x * sx, mh / 2 + p.y * sy, Math.max(0.7, (s.viz || 2) * 0.12), 0, Math.PI * 2);
        mctx.fill();
      }
      const vw = (W / scale) * sx,
        vh = (H / scale) * sy;
      mctx.strokeStyle = 'rgba(204,255,0,.9)';
      mctx.lineWidth = 1.2;
      mctx.strokeRect(mw / 2 - (panX / scale) * sx - vw / 2, mh / 2 - (panY / scale) * sy - vh / 2, vw, vh);
      document.getElementById('miniCap').textContent = shown + ' grains · ' + g0.constels.length + ' constellations';
    }
    const miniIntervalId = setInterval(drawMini, 1600);
    onCleanup(() => clearInterval(miniIntervalId));

    function pickSector(wx, wy) {
      let best = null,
        bd = 1e9;
      for (const s of g0.sectors) {
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
    // Hero-slot teaser gate: the small demo pauses itself once the "open
    // full map" prompt card covers it (see Hero.jsx) — no point spending a
    // render loop on a canvas sitting under an opaque blur. Doesn't apply
    // once the user is actually in the full-screen arena.
    let demoActive = true;
    let rafId = null;
    let uiPaused = document.body.classList.contains('wallet-ui-open')
      || document.body.classList.contains('wc-modal-open');
    function kickDraw(tag) {
      // arenaMode bypasses inView on purpose: #cosmosFrame gets moved via
      // appendChild from the (small, possibly off-screen) hero slot into
      // the full-screen arena stage while that stage's ancestor (.cosmos-
      // map-pop) still has `hidden` set — the IntersectionObserver watching
      // frame doesn't reliably re-fire for a target that was reparented
      // out of a display:none subtree until something else forces the
      // browser to recompute (confirmed: minimizing/restoring the tab, or
      // a full reload, "unstuck" it every time). Once we're actually in
      // the arena the canvas fills the viewport by definition, so trusting
      // a possibly-stale inView here was the actual bug, not just missing
      // diagnostics.
      const ok = alive && !uiPaused && (inView || arenaMode) && pageVisible && (demoActive || arenaMode) && rafId == null;
      if (ok) {
        rafId = requestAnimationFrame(draw);
      } else if (tag) {
        // Diagnostic only when called with a tag (from enterArena/exitArena/
        // pauseDemo/resumeDemo) — logs exactly which gate blocked the draw
        // loop from (re)starting, since a declined kickDraw() throws no
        // error and previously left zero trace of why rendering stayed off.
        console.warn('[void cosmos] kickDraw declined', tag, {
          alive, inView, pageVisible, demoActive, arenaMode, rafId,
        });
      }
    }
    function pauseDemo() {
      if (arenaMode) return;
      demoActive = false;
    }
    function resumeDemo() {
      demoActive = true;
      kickDraw('resumeDemo');
    }
    const onPageShow = () => {
      document.body.classList.remove('wc-modal-open');
      resumeDemo();
      kickDraw('pageshow');
    };
    window.addEventListener('pageshow', onPageShow);
    onCleanup(() => window.removeEventListener('pageshow', onPageShow));
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
    function readUiPaused() {
      return (
        document.body.classList.contains('wallet-ui-open') ||
        document.body.classList.contains('wc-modal-open')
      );
    }
    function onUiPauseChange() {
      const next = readUiPaused();
      if (next === uiPaused) return;
      uiPaused = next;
      if (uiPaused) {
        if (rafId != null) cancelAnimationFrame(rafId);
        rafId = null;
      } else {
        kickDraw('uiResume');
      }
    }
    const uiPauseObserver = new MutationObserver(onUiPauseChange);
    uiPauseObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    onCleanup(() => uiPauseObserver.disconnect());
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
      if (!alive || uiPaused || (!inView && !arenaMode) || !pageVisible || (!demoActive && !arenaMode)) return;
      // Defensive: the rAF chain is self-scheduling (the next frame is
      // requested from *inside* this one), which means a single uncaught
      // exception anywhere in a frame silently kills rendering forever —
      // no error overlay, no crash, just a canvas that never draws again
      // (typically stuck on whatever the last fillRect background left
      // it, i.e. solid black). try/finally guarantees the next frame gets
      // scheduled either way, and the catch logs what actually broke
      // instead of failing in total silence.
      try {
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
      if (zoomLabel) zoomLabel.textContent = viewLabel();

      ctx.fillStyle = '#010308';
      ctx.fillRect(0, 0, W, H);
      {
        const deep = ctx.createRadialGradient(
          W / 2 + panX * 0.02,
          H / 2 + panY * 0.02,
          10,
          W / 2,
          H / 2,
          Math.max(W, H) * 0.75,
        );
        deep.addColorStop(0, '#050a18');
        deep.addColorStop(0.55, '#02040c');
        deep.addColorStop(1, '#000');
        ctx.fillStyle = deep;
        ctx.fillRect(0, 0, W, H);
      }
      if (W > 4 && H > 4 && !window.__voidMapPainted) {
        window.__voidMapPainted = true;
        window.dispatchEvent(new Event('void-cosmos-frame'));
      }
      const g = g0;

      const bgStep = quality === 'low' ? 3 : 2;
      ctx.fillStyle = 'rgba(220,230,255,0.35)';
      for (let bi = 0; bi < bgStars.length; bi += bgStep) {
        const s = bgStars[bi];
        const [sx, sy] = w2s(s.x + panX * 0.06, s.y + panY * 0.06);
        if (sx < -10 || sy < -10 || sx > W + 10 || sy > H + 10) continue;
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }

      hover = null;
      let bestH = 0;
      // Hit-test stride mirrors sector draw stride so hover cost tracks quality.
      const hoverStep = quality === 'high' ? 1 : quality === 'medium' ? 2 : 3;
      if (mx != null && quality !== 'low') {
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
        if (quality !== 'low') {
          for (const c of g.constels) {
            const p = constelWorld(c, g);
            c.hover += ((Math.hypot(p.x - mx, p.y - my) < g.R * 0.14 ? 1 : 0) - c.hover) * 0.12;
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
      const qualityLodMul = quality === 'high' ? 1 : quality === 'medium' ? 1 : 2;
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
      /** Hard black-core radius — nothing should paint on top of it. */
      const coreR = eh > 0 ? eh * 0.72 : 0;
      function inCore(sx, sy, pad) {
        if (coreR < 1) return false;
        return Math.hypot(sx - gcx, sy - gcy) < coreR + (pad || 0);
      }
      function paintBlackCore() {
        if (coreR < 1) return;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(gcx, gcy, coreR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(LIME, 0.55);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(gcx, gcy, coreR, 0, Math.PI * 2);
        ctx.stroke();
      }

      {
        const R = g.R * scale * 0.85;
        const flat = Math.max(0.08, Math.abs(Math.cos(viewPitch)) * 0.72 + 0.1);
        const hg = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, R * 1.25);
        hg.addColorStop(0, rgba(LIME, 0.05));
        hg.addColorStop(0.4, rgba([120, 155, 30], 0.025));
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
      const ribbonLanes = quality === 'high' ? 3 : 1;
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
      if (true) {
        const breath = 0.85 + 0.15 * Math.sin(t * 0.7);
        const nebStep = quality === 'low' ? 2 : 1;
        for (let ni = 0; ni < g.nebulae.length; ni += nebStep) {
          const n = g.nebulae[ni];
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
          let sz = Math.max(0.5, Math.min(2.2, p.br * pr.persp * 0.95 * tw));
          if (p.u < 0.12) sz = Math.min(2.6, sz * 1.2);
          const a = ((p.dust ? 0.14 : 0.48) + p.br * 0.28 * tw) * depthFade;
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
            let sz = Math.max(0.7, Math.min(2.4, p.br * pr.persp * 0.95 * groupTw));
            if (p.u < 0.12) sz = Math.min(2.8, sz * 1.2);
            ctx.moveTo(sx + sz, sy);
            ctx.arc(sx, sy, sz, 0, Math.PI * 2);
            any = true;
          }
          if (any) {
            const a = clamp(g.starBucketAlphaScale[bi] * groupTw * 2.4, 0, 1);
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
        // Black disk is painted again after constellations so nothing draws over it.
      }

      {
        // Grains are lot mass dots — keep them quiet so the sky reads as stars,
        // not a pile of neon discs. Full grain detail only when zoomed in.
        const showGrains = scale > 2.8 || heatMode;
        const sectorStep = quality === 'high' ? 1 : quality === 'medium' ? 2 : 3;
        const drawLabels = quality === 'high' && scale > 6;
        if (showGrains) {
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
          const grainR = Math.max(0.7, (s.viz || 2.1) * (scale < 2.5 ? 0.38 : scale < 4 ? 0.55 : 0.85));
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
          if (yoursSet.has(s.id)) col = [200, 255, 100];
          const empty = s.kind === 'empty' && !heatMode;
          const inConstelSel = selectedConstels.has(s.constel);
          const selected = selectedSet.has(s.id) || inConstelSel;
          const mineGrain = yoursSet.has(s.id);
          const celebUntil = celebrateLots.get(String(s.constel || ''));
          const celebrating = celebUntil && performance.now() < celebUntil;
          ctx.fillStyle = empty ? rgba([70, 78, 52], 0.35) : rgba(col, mineGrain ? 0.75 : 0.28);
          ctx.beginPath();
          ctx.arc(sx, sy, grainR * (mineGrain ? 1.05 : 0.9), 0, Math.PI * 2);
          ctx.fill();
          if (mineGrain && (celebrating || selected || s.hover > 0.2 || scale > 3.2)) {
            const gp = celebrating ? 0.55 + 0.45 * Math.sin(t * 3.2 + s.id) : 0.35;
            ctx.strokeStyle = rgba([204, 255, 0], 0.22 + gp * 0.25);
            ctx.lineWidth = celebrating ? 1.6 : 1;
            ctx.beginPath();
            ctx.arc(sx, sy, grainR + 2.2 + (celebrating ? gp * 2 : 0), 0, Math.PI * 2);
            ctx.stroke();
          }
          // No MEGA rings at mid zoom — concentric rings read as glyphs, not stars
          if (scale > 3.5 && (s.tier === 'MEGA' || s.tier === 'LARGE')) {
            ctx.strokeStyle = rgba(col, s.tier === 'MEGA' ? 0.22 : 0.12);
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.arc(sx, sy, grainR + (s.tier === 'MEGA' ? 2.2 : 1.1), 0, Math.PI * 2);
            ctx.stroke();
          }
          if (selected) {
            ctx.strokeStyle = inConstelSel && !selectedSet.has(s.id)
              ? 'rgba(204,255,0,.55)'
              : 'rgba(204,255,0,.85)';
            ctx.lineWidth = inConstelSel ? 1.6 : 1.3;
            ctx.beginPath();
            ctx.arc(sx, sy, grainR + (inConstelSel ? 4 : 3.2), 0, Math.PI * 2);
            ctx.stroke();
          } else if (s.hover > 0.2) {
            ctx.strokeStyle = rgba(col, 0.55);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(sx, sy, grainR + 2.0, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (drawLabels && (s.hover > 0.25 || selected || scale > 10 || s.tier === 'MEGA')) {
            ctx.fillStyle = rgba(col, 0.85);
            ctx.font = '9px IBM Plex Mono';
            ctx.textAlign = 'center';
            ctx.fillText('#' + s.id, sx, sy - grainR - 6);
            if (s.hover > 0.45 || selected) {
              ctx.fillText(s.tier + ' · ' + s.size + 'c', sx, sy + grainR + 10);
              ctx.fillText(formatUsd(s.usd), sx, sy + grainR + 20);
            }
          }
        }
        }
      }

      // Premium constellation figures (same silhouette as cabinet LotFigure).
      // Soft astronomy stars — not UI plus-glyphs.
      {
        function strokeLink(a, b, col, alpha, w) {
          if (alpha < 0.04) return;
          ctx.strokeStyle = rgba(col, alpha);
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }

        /**
         * Beautiful star: soft bloom + bright core + thin diffraction spikes.
         * Reads as a real sky sparkle, not a neon + stamp.
         */
        function prettyStar(x, y, col, a, r, twinkle) {
          const rr = Math.max(1.4, r || 2);
          const tw = twinkle == null ? 1 : twinkle;
          const glowR = rr * (3.8 + tw * 0.6);
          const bloom = ctx.createRadialGradient(x, y, 0, x, y, glowR);
          bloom.addColorStop(0, rgba([255, 255, 235], a * 0.55 * tw));
          bloom.addColorStop(0.18, rgba(col, a * 0.42 * tw));
          bloom.addColorStop(0.5, rgba(col, a * 0.12));
          bloom.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = bloom;
          ctx.beginPath();
          ctx.arc(x, y, glowR, 0, Math.PI * 2);
          ctx.fill();

          // soft diffraction spikes (astronomy look) — only brighter stars
          if (rr > 1.9 && a > 0.45) {
            const spike = rr * (2.8 + tw * 1.2);
            const spikeA = a * 0.35 * tw;
            const g1 = ctx.createLinearGradient(x - spike, y, x + spike, y);
            g1.addColorStop(0, rgba(col, 0));
            g1.addColorStop(0.5, rgba([255, 255, 220], spikeA));
            g1.addColorStop(1, rgba(col, 0));
            ctx.strokeStyle = g1;
            ctx.lineWidth = Math.max(0.55, rr * 0.18);
            ctx.beginPath();
            ctx.moveTo(x - spike, y);
            ctx.lineTo(x + spike, y);
            ctx.stroke();
            const g2 = ctx.createLinearGradient(x, y - spike, x, y + spike);
            g2.addColorStop(0, rgba(col, 0));
            g2.addColorStop(0.5, rgba([255, 255, 220], spikeA));
            g2.addColorStop(1, rgba(col, 0));
            ctx.strokeStyle = g2;
            ctx.beginPath();
            ctx.moveTo(x, y - spike);
            ctx.lineTo(x, y + spike);
            ctx.stroke();
            // faint diagonal sparkle
            if (rr > 2.4) {
              const d = spike * 0.55;
              ctx.strokeStyle = rgba(col, spikeA * 0.35);
              ctx.lineWidth = 0.45;
              ctx.beginPath();
              ctx.moveTo(x - d, y - d);
              ctx.lineTo(x + d, y + d);
              ctx.moveTo(x - d, y + d);
              ctx.lineTo(x + d, y - d);
              ctx.stroke();
            }
          }

          // warm core
          ctx.fillStyle = rgba([255, 255, 245], Math.min(1, a * 1.05));
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.7, rr * 0.38), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = rgba(col, a);
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1.0, rr * 0.62), 0, Math.PI * 2);
          ctx.fill();
        }

        const viewCx = W * 0.5;
        const viewCy = H * 0.5;
        const scored = [];
        for (let ci = 0; ci < g.constels.length; ci++) {
          const c = g.constels[ci];
          const picked = selectedConstels.has(c.id);
          const mine = constelOwned(c);
          const celebUntil = celebrateLots.get(String(c.id));
          const celebrating = Boolean(celebUntil && performance.now() < celebUntil);
          if (!celebrating && celebUntil) celebrateLots.delete(String(c.id));
          if (!constelVisible(c) && !picked && !mine && !celebrating) continue;
          const center = constelWorld(c, g);
          const [hx, hy] = w2s(center.x, center.y);
          if (hx < -100 || hy < -100 || hx > W + 100 || hy > H + 100) continue;
          const dist2 = (hx - viewCx) ** 2 + (hy - viewCy) ** 2;
          const hot = picked || mine || celebrating || c.hover > 0.1;
          const priority =
            (celebrating ? 1e12 : 0) +
            (picked ? 1e11 : 0) +
            (mine ? 1e10 : 0) +
            (hot ? 1e8 : 0) -
            dist2;
          scored.push({ c, picked, mine, celebrating, hot, hx, hy, priority, dist2 });
        }
        scored.sort((a, b) => a.priority - b.priority);

        const placed = [];
        const crowdRef = scale < 1.15 ? 16 : scale < 1.8 ? 20 : 26;
        // Fill arm slits with bead chains — especially when zoomed (large px gaps)
        {
          const byArm = new Map();
          for (const item of scored) {
            const arm = item.c.arm ?? 0;
            if (!byArm.has(arm)) byArm.set(arm, []);
            byArm.get(arm).push(item);
          }
          for (const list of byArm.values()) {
            list.sort((a, b) => (a.c.u || 0) - (b.c.u || 0));
            for (let i = 0; i < list.length - 1; i++) {
              const a = list[i];
              const b = list[i + 1];
              if (inCore(a.hx, a.hy, 6) || inCore(b.hx, b.hy, 6)) continue;
              const gap = Math.hypot(a.hx - b.hx, a.hy - b.hy);
              // Only skip if already overlapping; never skip large gaps (those are the "пролёты")
              if (gap < 16) continue;
              const col = a.c.col || LIME;
              const beads = Math.min(10, Math.max(1, Math.round(gap / 26)));
              strokeLink(
                { sx: a.hx, sy: a.hy },
                { sx: b.hx, sy: b.hy },
                col,
                clamp(0.1 + gap / 400, 0.1, 0.22),
                0.65,
              );
              for (let bi = 1; bi <= beads; bi++) {
                const t = bi / (beads + 1);
                // slight sideways wobble so it reads as a star lane, not a ruler
                const nx = -(b.hy - a.hy) / gap;
                const ny = (b.hx - a.hx) / gap;
                const wob = Math.sin(t * Math.PI * 2 + (a.c.a0 || 0)) * Math.min(6, gap * 0.04);
                const x = a.hx + (b.hx - a.hx) * t + nx * wob;
                const y = a.hy + (b.hy - a.hy) * t + ny * wob;
                if (inCore(x, y, 8)) continue;
                const mag = 0.9 + (bi % 3 === 0 ? 0.55 : 0.15);
                prettyStar(x, y, col, 0.45 + mag * 0.25, 1.1 + mag * 0.7, 0.92);
              }
            }
          }
        }

        for (const item of scored) {
          const { c, picked, mine, celebrating, hot, hx, hy } = item;
          const forced = picked || mine || celebrating || c.hover > 0.15;

          // Whole figure sits on the black core — skip
          if (inCore(hx, hy, 6)) continue;

          let figMul = 1;
          if (!forced) {
            for (const p of placed) {
              const d = Math.hypot(p.x - hx, p.y - hy);
              if (d < crowdRef) {
                figMul = Math.min(figMul, 0.7 + (d / crowdRef) * 0.3);
              }
            }
          }

          const profile = figureForConstel(c);
          if (!profile?.stars?.length) continue;

          const baseScale =
            g.R *
            scale *
            (forced ? 0.1 : scale < 1.15 ? 0.078 : scale < 2 ? 0.088 : 0.095);
          const figScale = clamp(baseScale * figMul, forced ? 28 : 20, forced ? 78 : 62);

          // Keep original indices for kind edges; only skip drawing occluded nodes
          const stars = profile.stars.map((s, i) => {
            const mag = 0.75 + ((s.r || 1.6) / 3.2) * 0.55;
            const sx = hx + s.x * figScale;
            const sy = hy - s.y * figScale;
            const r = Math.max(
              1.6,
              mag * (forced ? 2.5 : scale < 1.4 ? 1.85 : 2.2) * Math.max(0.75, figMul),
            );
            return {
              sx,
              sy,
              r,
              mag,
              ph: i * 1.7 + c.a0,
              occluded: inCore(sx, sy, Math.max(4, r * 1.2)),
            };
          });
          const visible = stars.filter((s) => !s.occluded);
          if (visible.length < 2) continue;

          placed.push({ x: hx, y: hy });

          const pulse =
            mine || celebrating
              ? 0.9 + 0.1 * Math.sin(t * 2.0 + c.a0 * 3)
              : 0.96 + 0.04 * Math.sin(t * 1.0 + c.a0 * 2);
          const lineA =
            (forced ? 0.62 : hot ? 0.44 : scale < 1.2 ? 0.34 : 0.4) * pulse;
          const starA =
            (forced ? 1 : hot ? 0.92 : scale < 1.2 ? 0.82 : 0.9) * pulse;
          const strokeCol = mine || picked || celebrating
            ? LIME
            : [
                Math.min(255, c.col[0] + 20),
                Math.min(255, c.col[1] + 10),
                Math.min(120, c.col[2] + 15),
              ];
          const lineW = celebrating ? 1.55 : mine || picked ? 1.25 : hot ? 1.05 : 0.85;

          if (forced && !inCore(hx, hy, figScale * 0.4)) {
            const plate = ctx.createRadialGradient(hx, hy, 2, hx, hy, figScale * 0.95);
            plate.addColorStop(0, rgba(strokeCol, 0.1));
            plate.addColorStop(1, rgba(strokeCol, 0));
            ctx.fillStyle = plate;
            ctx.beginPath();
            ctx.arc(hx, hy, figScale * 0.95, 0, Math.PI * 2);
            ctx.fill();
          }

          // Use designed kind edges (not MST) so silhouettes stay beautiful
          for (const [ai, bi] of profile.edges || []) {
            const a = stars[ai];
            const b = stars[bi];
            if (!a || !b || a.occluded || b.occluded) continue;
            const midX = (a.sx + b.sx) * 0.5;
            const midY = (a.sy + b.sy) * 0.5;
            if (inCore(midX, midY, 3)) continue;
            strokeLink(a, b, strokeCol, lineA * 0.22, lineW + 1.6);
            strokeLink(a, b, strokeCol, lineA, lineW);
          }

          if ((picked || celebrating) && !inCore(hx, hy, 8)) {
            const boom = celebrating ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
            const rad = (celebrating ? 56 : 40) + boom * 18;
            const halo = ctx.createRadialGradient(hx, hy, 2, hx, hy, rad);
            halo.addColorStop(0, 'rgba(204,255,0,' + (celebrating ? 0.2 : 0.1) + ')');
            halo.addColorStop(1, 'rgba(204,255,0,0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(hx, hy, rad, 0, Math.PI * 2);
            ctx.fill();
          }

          const order = visible.map((_, i) => i).sort((i, j) => visible[i].mag - visible[j].mag);
          for (const i of order) {
            const p = visible[i];
            const tw = 0.88 + 0.12 * Math.sin(t * 2.4 + p.ph);
            prettyStar(p.sx, p.sy, strokeCol, starA * (0.7 + p.mag * 0.35), p.r, tw);
          }
        }
      }

      // Occlude anything that still bled onto the event horizon
      paintBlackCore();

      if (scale > 0.95 && scale < 9) {
        const step = (scale < 1.3 ? 3 : scale < 2.2 ? 2 : 1) * (quality === 'low' ? 2 : 1);
        const yoursLabels = [];
        g.constels.forEach((c, idx) => {
          const picked = selectedConstels.has(c.id);
          const mine = constelOwned(c);
          const celebrating =
            celebrateLots.has(String(c.id)) && performance.now() < celebrateLots.get(String(c.id));
          if (!picked && !mine && !celebrating && idx % step) return;
          if (!constelVisible(c) && !picked && !mine) return;
          if (c.grains.length < 2 && !picked && !mine) return;
          const p = constelWorld(c, g);
          const [sx, sy] = w2s(p.x, p.y);
          if (inCore(sx, sy, 10)) return;
          if (sx < 18 || sy < 18 || sx > W - 18 || sy > H - 18) return;
          const dist2 = (sx - W * 0.5) ** 2 + (sy - H * 0.5) ** 2;
          const showBadge =
            celebrating || picked || c.hover > 0.2 || (mine && (scale > 2.2 || dist2 < 180 * 180));
          if (mine || celebrating) {
            yoursLabels.push({ c, sx, sy, picked, mine, celebrating, dist2, showBadge, idx });
            return;
          }
          if (!picked && c.hover < 0.15 && scale < 1.35) return;
          const pulse = 0.75 + 0.25 * Math.sin(t * 1.6 + idx);
          const a = clamp(
            0.35 + c.hover * 0.55 + (picked ? 0.55 : 0) + (scale > 1.5 ? 0.28 : 0.12) * pulse,
            0,
            0.95,
          );
          const fs = scale < 1.4 ? 8 : scale < 2.8 ? 11 : 10;
          ctx.font = '600 ' + fs + 'px IBM Plex Mono';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(0,0,0,' + a * 0.45 + ')';
          ctx.fillText(c.name, sx + 1, sy + 1);
          ctx.fillStyle = rgba(picked ? LIME : c.col, a);
          ctx.fillText(c.name, sx, sy);
          if (picked || scale > 2.5) {
            ctx.fillStyle = rgba(picked ? LIME : c.col, a * 0.65);
            ctx.font = '7px IBM Plex Mono';
            ctx.fillText((picked ? '● ' : '') + c.grains.length + '★', sx, sy + 12);
          }
        });
        yoursLabels.sort((a, b) => {
          if (a.celebrating !== b.celebrating) return a.celebrating ? -1 : 1;
          if (a.picked !== b.picked) return a.picked ? -1 : 1;
          return a.dist2 - b.dist2;
        });
        const labelCap = scale < 1.5 ? 3 : scale < 2.5 ? 5 : 8;
        yoursLabels.slice(0, labelCap).forEach(({ c, sx, sy, picked, celebrating, showBadge, idx }) => {
          const pulse = 0.8 + 0.2 * Math.sin(t * 2 + idx);
          const a = clamp(0.55 + (picked || celebrating ? 0.35 : 0.15) * pulse, 0, 0.98);
          const fs = scale < 1.4 ? 8 : scale < 2.8 ? 11 : 10;
          ctx.font = '600 ' + fs + 'px IBM Plex Mono';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(0,0,0,' + a * 0.55 + ')';
          ctx.fillText(c.name, sx + 1, sy + 1);
          ctx.fillStyle = rgba(LIME, a);
          ctx.fillText(c.name, sx, sy);
          if (showBadge) {
            ctx.font = '700 8px IBM Plex Mono';
            ctx.fillStyle = rgba(LIME, 0.92);
            ctx.fillText(celebrating ? '◆ CLAIMED' : '◆ YOURS', sx, sy + 12);
          }
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
      } catch (err) {
        console.error('[void cosmos] draw() frame threw — recovering, will retry next frame', err);
      } finally {
        if (alive && !uiPaused && pageVisible && (inView || arenaMode) && (demoActive || arenaMode)) {
          rafId = requestAnimationFrame(draw);
        }
      }
    }
    rafId = requestAnimationFrame(draw);
    onCleanup(() => {
      alive = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
    });

    let burned = 0;
    const burnedIntervalId = setInterval(() => {
      const el = document.getElementById('burned');
      if (el) el.textContent = fmt(burned);
    }, 4000);
    onCleanup(() => clearInterval(burnedIntervalId));
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
