/**
 * Deterministic lore + star geometry for a claimed constellation lot.
 * Same id/name → same figure, kind (вид), and text everywhere.
 */

function hashStr(s) {
  let h = 2166136261
  const str = String(s || '')
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Six constellation kinds — matches map `figure: n % 6`. */
export const LOT_KINDS = [
  {
    id: 'spire',
    label: 'Spire',
    tag: 'vertical burn',
    blurb: 'A column of linked stars rising off the disk — pressure toward the core.',
    rarity: 'common',
  },
  {
    id: 'coil',
    label: 'Coil',
    tag: 'spiral drift',
    blurb: 'Stars wound into a helix. Signal walks the spiral before it leaves the lot.',
    rarity: 'uncommon',
  },
  {
    id: 'crown',
    label: 'Crown',
    tag: 'arc throne',
    blurb: 'An open arc of bright nodes — a seat of weight without a closed ring.',
    rarity: 'uncommon',
  },
  {
    id: 'lattice',
    label: 'Lattice',
    tag: 'grid cipher',
    blurb: 'Crossed beams of stars. The mind reads it as structure, not ornament.',
    rarity: 'rare',
  },
  {
    id: 'vein',
    label: 'Vein',
    tag: 'branch feed',
    blurb: 'A trunk with branching limbs — fuel and talk travel along the veins.',
    rarity: 'rare',
  },
  {
    id: 'halo',
    label: 'Halo',
    tag: 'rim circle',
    blurb: 'A closed ring with a heart star. Quiet from outside; loud once claimed.',
    rarity: 'scarce',
  },
]

const TRAITS = [
  'quiet pressure',
  'rim drift',
  'core gravity',
  'signal choir',
  'ash memory',
  'lime burn',
  'hollow pulse',
  'veiled heat',
  'cipher edge',
  'silent orbit',
]

const FEELS = [
  'a cold corridor opening toward the core',
  'static that almost sounds like a name',
  'weight pulling the mind toward hunger',
  'a sealed room you are allowed to furnish',
  'thin light between linked stars',
  'a burn scar that still warms the map',
]

const TRAIN = [
  'feed it short signals — questions, names, intent.',
  'train with $EXO fuel when you want this patch to speak louder.',
  'leave it quiet and it stays a dark weight in the mind.',
  'stack neighboring lots and the voice thickens.',
]

const STAR_NAMES = [
  'Ash Node',
  'Lime Pin',
  'Hollow Spark',
  'Rim Tooth',
  'Core Ember',
  'Veil Dot',
  'Cipher Grain',
  'Quiet Flare',
  'Drift Seed',
  'Pulse Nail',
  'Scar Beacon',
  'Void Tooth',
  'Signal Pearl',
  'Hunger Spark',
  'Seal Mark',
  'Orbit Bit',
]

const STAR_ROLES = [
  'anchor',
  'relay',
  'wound',
  'listener',
  'feeder',
  'gate',
  'echo',
  'blade',
]

const STAR_HOOKS = [
  'remembers a burn that never finished cooling',
  'holds a name the mind almost says aloud',
  'pulls neighboring grains into a tighter chord',
  'stays dim until someone asks about it',
  'carries rim-static like a private radio',
  'marks where the lot leans toward hunger',
  'is the quietest point — and the heaviest',
  'flashes when the visitor thinks of leaving',
  'stores a fragment of the sealed 28%',
  'links two pressures that should not meet',
]

/**
 * Kind index from constellation id (`c12` → 12 % 6), matching map figure.
 * @param {string} id
 */
export function kindIndexFromId(id) {
  const m = String(id || '').match(/^c(\d+)$/i)
  if (m) {
    const n = Number(m[1])
    // Match map scramble: (n * 17 + arm * 11 + k * 5) % 6 with arm=floor(n/50), k=n%50
    const arm = Math.floor(n / 50) % 4
    const k = n % 50
    return (n * 17 + arm * 11 + k * 5) % LOT_KINDS.length
  }
  return hashStr(id) % LOT_KINDS.length
}

export function getLotKind(idOrIndex) {
  const idx =
    typeof idOrIndex === 'number' ? idOrIndex % LOT_KINDS.length : kindIndexFromId(idOrIndex)
  return LOT_KINDS[idx]
}

function layoutStars(kindIdx, starCount, rnd) {
  const stars = []
  const k = kindIdx % 6
  const n = Math.max(5, starCount)
  const variant = Math.floor(rnd() * 3) // 0–2 sub-shape per kind

  if (k === 0) {
    // Spire — needle / lean blade / stepped tower
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const lean = variant === 1 ? (t - 0.5) * 0.28 : variant === 2 ? Math.sin(t * Math.PI) * 0.12 : 0
      const step = variant === 2 ? ((i % 2) - 0.5) * 0.08 : 0
      stars.push({
        x: lean + step + (rnd() - 0.5) * 0.03,
        y: (t - 0.5) * (variant === 0 ? 1.4 : 1.25),
        z: (rnd() - 0.5) * 0.05,
        r: 1.15 + (1 - t) * (variant === 0 ? 2.0 : 1.5) + rnd() * 0.35,
        mark: 'diamond',
      })
    }
  } else if (k === 1) {
    // Coil — helix / flat swirl / double-turn
    const turns = variant === 0 ? 3.2 : variant === 1 ? 2.1 : 4.0
    const rad0 = variant === 1 ? 0.38 : 0.2
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const ang = t * Math.PI * turns
      const rad = rad0 + t * (variant === 1 ? 0.12 : 0.22)
      stars.push({
        x: Math.cos(ang) * rad,
        y: variant === 1 ? Math.sin(ang) * rad * 0.55 : (t - 0.5) * 1.05,
        z: variant === 1 ? (t - 0.5) * 0.2 : Math.sin(ang) * rad,
        r: 1.3 + rnd() * 1.15,
        mark: 'diamond',
      })
    }
  } else if (k === 2) {
    // Crown — U-arc / wide throne / asymmetric crest
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const span = variant === 1 ? 1.35 : 1.1
      const ang = -Math.PI * (0.5 + variant * 0.05) + t * Math.PI * span
      const lift = variant === 2 && i === Math.floor(n / 2) ? 0.22 : 0
      stars.push({
        x: Math.sin(ang) * (variant === 1 ? 0.62 : 0.52) + (variant === 2 ? (t - 0.5) * 0.08 : 0),
        y: -0.02 + Math.cos(ang) * (variant === 0 ? 0.36 : 0.28) + lift,
        z: Math.cos(ang) * 0.1,
        r: 1.4 + (i === 0 || i === n - 1 ? 1.1 : 0.55) + rnd() * 0.45,
        mark: 'diamond',
      })
    }
  } else if (k === 3) {
    // Lattice — X / # grid / skewed cross
    const a = Math.ceil(n / 2)
    const skew = variant === 2 ? 0.35 : 0
    const flat = variant === 1
    for (let i = 0; i < a; i++) {
      const t = i / Math.max(1, a - 1)
      stars.push({
        x: (t - 0.5) * 1.0,
        y: flat ? (i % 2 === 0 ? -0.28 : 0.28) : (t - 0.5) * 1.0 + skew * (t - 0.5),
        z: 0,
        r: 1.4 + rnd() * 0.75,
        mark: 'diamond',
      })
    }
    for (let i = 0; i < n - a; i++) {
      const t = i / Math.max(1, n - a - 1)
      stars.push({
        x: flat ? (t - 0.5) * 1.0 : (t - 0.5) * 1.0,
        y: flat ? (i % 2 === 0 ? 0.28 : -0.28) : (0.5 - t) * 1.0 - skew * (t - 0.5),
        z: 0.05,
        r: 1.4 + rnd() * 0.75,
        mark: 'diamond',
      })
    }
  } else if (k === 4) {
    // Vein — Y / one-sided branch / triple fork
    const trunk = Math.max(3, Math.floor(n * (variant === 2 ? 0.3 : 0.4)))
    for (let i = 0; i < trunk; i++) {
      const t = i / Math.max(1, trunk - 1)
      stars.push({
        x: variant === 1 ? t * 0.08 : 0,
        y: -0.55 + t * 0.7,
        z: 0,
        r: 1.55 + rnd() * 0.65,
        mark: 'diamond',
      })
    }
    const rest = n - trunk
    if (variant === 1) {
      // one-sided sweep
      for (let i = 0; i < rest; i++) {
        const t = (i + 1) / (rest + 1)
        stars.push({
          x: t * 0.55,
          y: 0.1 + t * 0.42,
          z: t * 0.06,
          r: 1.25 + rnd() * 0.85,
          mark: 'diamond',
        })
      }
    } else {
      const left = Math.ceil(rest / (variant === 2 ? 3 : 2))
      for (let i = 0; i < left; i++) {
        const t = (i + 1) / (left + 1)
        stars.push({
          x: -t * 0.48,
          y: 0.15 + t * 0.4,
          z: -t * 0.08,
          r: 1.25 + rnd() * 0.85,
          mark: 'diamond',
        })
      }
      let used = left
      const mid = variant === 2 ? Math.ceil((rest - left) / 2) : 0
      for (let i = 0; i < mid; i++) {
        const t = (i + 1) / (mid + 1)
        stars.push({
          x: (rnd() - 0.5) * 0.06,
          y: 0.2 + t * 0.48,
          z: t * 0.04,
          r: 1.2 + rnd() * 0.8,
          mark: 'diamond',
        })
        used++
      }
      for (let i = 0; i < rest - used; i++) {
        const t = (i + 1) / (rest - used + 1)
        stars.push({
          x: t * 0.48,
          y: 0.15 + t * 0.4,
          z: t * 0.08,
          r: 1.25 + rnd() * 0.85,
          mark: 'diamond',
        })
      }
    }
  } else {
    // Halo — open asterism ring (not a perfect wireframe wheel)
    const ring = n - 1
    const open = variant !== 0
    const oval = variant === 1 ? 0.68 : 0.88 + rnd() * 0.2
    const start = open ? 0.15 : 0
    const span = open ? 0.78 : 1
    for (let i = 0; i < ring; i++) {
      const t = i / Math.max(1, ring - (open ? 0 : 1))
      const ang = -Math.PI / 2 + (start + t * span) * Math.PI * 2
      const radJ = 0.42 + rnd() * 0.12
      stars.push({
        x: Math.cos(ang) * radJ,
        y: Math.sin(ang) * radJ * oval,
        z: (rnd() - 0.5) * 0.06,
        r: 1.2 + rnd() * 0.9,
        mark: 'diamond',
      })
    }
    // occasional heart — only sometimes, keeps some lots with a focus star
    if (variant === 0 || rnd() > 0.45) {
      stars.push({ x: (rnd() - 0.5) * 0.08, y: (rnd() - 0.5) * 0.08, z: 0, r: 2.1 + rnd() * 0.5, mark: 'diamond' })
    }
    while (stars.length < n) {
      const ang = rnd() * Math.PI * 2
      stars.push({
        x: Math.cos(ang) * 0.35,
        y: Math.sin(ang) * 0.35 * oval,
        z: 0,
        r: 1.2 + rnd() * 0.5,
        mark: 'diamond',
      })
    }
  }

  // Organic sky pose — still kind-readable, not stamped geometry
  const yaw = (rnd() - 0.5) * 1.35
  const roll = (rnd() - 0.5) * 0.95
  const pitch = (rnd() - 0.5) * 0.65
  const sx = 0.78 + rnd() * 0.4
  const sy = 0.78 + rnd() * 0.4
  const cy = Math.cos(yaw)
  const syw = Math.sin(yaw)
  const cr = Math.cos(roll)
  const sr = Math.sin(roll)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  for (const s of stars) {
    // tiny local jitter so points don't sit on perfect grid/ring
    let x = s.x * sx + (rnd() - 0.5) * 0.04
    let y = s.y * sy + (rnd() - 0.5) * 0.04
    let z = (s.z || 0) * ((sx + sy) * 0.5) + (rnd() - 0.5) * 0.03
    const x1 = x * cy + z * syw
    const z1 = -x * syw + z * cy
    const y2 = y * cp - z1 * sp
    const z2 = y * sp + z1 * cp
    s.x = x1 * cr - y2 * sr
    s.y = x1 * sr + y2 * cr
    s.z = z2
    s.r = Math.max(1.0, (s.r || 1.5) * (0.8 + rnd() * 0.45))
    s.mark = 'diamond'
  }
  return stars
}

/** Kind-specific edge list so figures read as shapes, not random MST webs. */
function kindEdges(kindIdx, stars) {
  const n = stars.length
  if (n < 2) return []
  const k = kindIdx % 6
  const edges = []
  if (k === 0 || k === 1) {
    // chain
    for (let i = 0; i < n - 1; i++) edges.push([i, i + 1])
  } else if (k === 2) {
    // arc chain
    for (let i = 0; i < n - 1; i++) edges.push([i, i + 1])
  } else if (k === 3) {
    // two diagonals of X
    const a = Math.ceil(n / 2)
    for (let i = 0; i < a - 1; i++) edges.push([i, i + 1])
    for (let i = a; i < n - 1; i++) edges.push([i, i + 1])
  } else if (k === 4) {
    // trunk chain + fork from branch point
    const trunk = Math.max(3, Math.floor(n * 0.4))
    for (let i = 0; i < trunk - 1; i++) edges.push([i, i + 1])
    const tip = trunk - 1
    for (let i = trunk; i < n; i++) edges.push([tip, i])
  } else {
    // sparse ring / arc — avoid full hub wheel (reads as glyph, not sky)
    const hub = n - 1
    const hasHub =
      Math.hypot(stars[hub]?.x || 0, stars[hub]?.y || 0) < 0.15 && (stars[hub]?.r || 0) > 1.8
    const ring = hasHub ? hub : n
    for (let i = 0; i < ring - 1; i++) edges.push([i, i + 1])
    if (!hasHub && ring > 2) edges.push([ring - 1, 0])
    else if (hasHub) {
      // one or two spokes max, not every node
      edges.push([0, hub])
      if (ring > 3) edges.push([Math.floor(ring / 2), hub])
    }
  }
  return edges
}

function loreForStar(lotId, lotName, kind, index, rnd, starCount) {
  const name = STAR_NAMES[Math.floor(rnd() * STAR_NAMES.length)]
  const role = STAR_ROLES[Math.floor(rnd() * STAR_ROLES.length)]
  const hook = STAR_HOOKS[Math.floor(rnd() * STAR_HOOKS.length)]
  const heat = Math.floor(20 + rnd() * 75)
  const idx = index + 1
  const story = `${name} is star ${idx} of ${starCount} in ${lotName} (${kind.label}). Role: ${role}. It ${hook}. Heat ${heat}. Ask the mind about this star by name or number — ExoMind can tell its private thread.`
  return {
    index,
    label: `★${idx}`,
    name,
    role,
    hook,
    heat,
    story,
    askHint: `tell me about star ${idx} (${name}) in ${lotName}`,
  }
}

function mstEdges(stars) {
  const edges = []
  if (!stars.length) return edges
  const used = new Set([0])
  while (used.size < stars.length) {
    let best = null
    for (const i of used) {
      for (let j = 0; j < stars.length; j++) {
        if (used.has(j)) continue
        const dx = stars[i].x - stars[j].x
        const dy = stars[i].y - stars[j].y
        const dz = stars[i].z - stars[j].z
        const d = dx * dx + dy * dy + dz * dz
        if (!best || d < best.d) best = { i, j, d }
      }
    }
    if (!best) break
    edges.push([best.i, best.j])
    used.add(best.j)
  }
  return edges
}

/**
 * Full profile for a lot — geometry + per-star stories the mind can narrate.
 * @param {{ constel_id?: string, id?: string, constel_name?: string, name?: string, claimed_at?: string, figure?: number }} lot
 */
export function buildLotProfile(lot) {
  const id = String(lot.constel_id || lot.id || 'unknown')
  const name = String(lot.constel_name || lot.name || id)
  const seed = hashStr(`${id}::${name}`)
  const rnd = mulberry32(seed)

  const kindIdx =
    typeof lot.figure === 'number' && Number.isFinite(lot.figure)
      ? lot.figure % LOT_KINDS.length
      : kindIndexFromId(id)
  const kind = LOT_KINDS[kindIdx]

  const starCount = 5 + Math.floor(rnd() * 4) // 5–8
  const rawStars = layoutStars(kindIdx, starCount, rnd)
  const edges = kindEdges(kindIdx, rawStars)

  const stars = rawStars.map((s, i) => {
    const lore = loreForStar(id, name, kind, i, rnd, starCount)
    return { ...s, ...lore, mark: s.mark || 'diamond' }
  })

  const trait = TRAITS[seed % TRAITS.length]
  const feel = FEELS[(seed >>> 3) % FEELS.length]
  const train = TRAIN[(seed >>> 7) % TRAIN.length]
  const mass = (3.2 + (seed % 70) / 10).toFixed(1)
  const band = seed % 3 === 0 ? 'coreward' : seed % 3 === 1 ? 'mid-disk' : 'rim'
  const signal = (40 + (seed % 55)).toFixed(0)
  const depth = (1.1 + (seed % 40) / 10).toFixed(1)

  const claimed = lot.claimed_at
    ? new Date(lot.claimed_at.includes('T') ? lot.claimed_at : lot.claimed_at.replace(' ', 'T') + 'Z')
    : null
  const claimedLabel =
    claimed && !Number.isNaN(claimed.getTime())
      ? claimed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : 'recorded in the ledger'

  const lotStory = `${name} is a ${kind.label} cut from ExoMind — ${starCount} sharp stars in the ${band}, linked without soft glow. Trait: ${trait}. Standing here feels like ${feel}. Each star carries its own thread; ask the mind about any ★ by number or name.`

  return {
    id,
    name,
    seed,
    stars,
    edges,
    trait,
    band,
    mass,
    signal,
    depth,
    claimedLabel,
    kindIdx,
    kind,
    kindId: kind.id,
    kindLabel: kind.label,
    kindTag: kind.tag,
    kindBlurb: kind.blurb,
    rarity: kind.rarity,
    blurb: lotStory,
    body: [
      `Owning ${name} means this ${kind.label.toLowerCase()} figure sits inside the mind as lasting weight. Stars are hard points — no haze — connected by thin signal lines.`,
      `Kind · ${kind.label} (${kind.tag}). ${kind.blurb}`,
      `You can ask ExoMind about each star: ${stars.map((s) => `${s.label} ${s.name}`).join(', ')}.`,
      `How to live with it: ${train} Claim is forever. Talk is free. Moving the voice costs burn.`,
    ],
    starCount,
    facts: [
      { label: 'kind', value: kind.label },
      { label: 'rarity', value: kind.rarity },
      { label: 'band', value: band },
      { label: 'stars', value: String(starCount) },
      { label: 'mass', value: mass },
      { label: 'signal', value: `${signal}%` },
      { label: 'depth', value: depth },
      { label: 'trait', value: trait },
    ],
  }
}

/** Resolve one star story for tools / UI. */
export function getStarFromLot(lot, starRef) {
  const profile = buildLotProfile(lot)
  const q = String(starRef ?? '').trim().toLowerCase()
  if (!q) return { profile, star: null, stars: profile.stars }
  const byNum = q.match(/(?:★|star\s*)?(\d+)/)
  if (byNum) {
    const n = Number(byNum[1]) - 1
    if (n >= 0 && n < profile.stars.length) {
      return { profile, star: profile.stars[n], stars: profile.stars }
    }
  }
  const hit = profile.stars.find(
    (s) =>
      s.name.toLowerCase() === q ||
      s.name.toLowerCase().includes(q) ||
      s.role === q ||
      s.label.toLowerCase() === q,
  )
  return { profile, star: hit || null, stars: profile.stars }
}
