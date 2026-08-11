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
  const n = Math.max(6, starCount)
  const variant = Math.floor(rnd() * 3)

  if (k === 0) {
    // Spire — lance: shaft + crossguard (sword / Orion feel)
    const shaft = Math.max(4, n - 2)
    for (let i = 0; i < shaft; i++) {
      const t = i / (shaft - 1)
      stars.push({
        x: (rnd() - 0.5) * 0.05 + (variant === 1 ? (t - 0.5) * 0.12 : 0),
        y: -0.55 + t * 1.15,
        z: (rnd() - 0.5) * 0.04,
        r: 1.2 + t * 1.6 + rnd() * 0.3,
      })
    }
    stars.push({ x: -0.28 - variant * 0.06, y: 0.05, z: 0.02, r: 1.5 + rnd() * 0.4 })
    while (stars.length < n) {
      stars.push({ x: 0.28 + variant * 0.06, y: 0.05, z: -0.02, r: 1.5 + rnd() * 0.4 })
    }
  } else if (k === 1) {
    // Coil — scorpion curve + stinger
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const ang = -0.2 + t * (variant === 2 ? 4.2 : 3.4)
      const rad = 0.18 + t * 0.38
      const sting = i === n - 1 ? 0.22 : 0
      stars.push({
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad * 0.85 + sting,
        z: Math.sin(ang * 0.5) * 0.08,
        r: 1.2 + (i === n - 1 ? 1.4 : rnd() * 1.0),
      })
    }
  } else if (k === 2) {
    // Crown — classic dipper / ladle
    const bowl = Math.min(4, n - 2)
    for (let i = 0; i < bowl; i++) {
      const t = i / Math.max(1, bowl - 1)
      stars.push({
        x: -0.35 + t * 0.7,
        y: 0.12 + Math.sin(t * Math.PI) * (variant === 1 ? 0.22 : 0.14),
        z: 0,
        r: 1.5 + rnd() * 0.7,
      })
    }
    const handle = n - bowl
    for (let i = 0; i < handle; i++) {
      const t = (i + 1) / handle
      stars.push({
        x: 0.35 + t * 0.35,
        y: 0.12 - t * (variant === 2 ? 0.55 : 0.42),
        z: t * 0.05,
        r: 1.3 + (1 - t) * 0.8,
      })
    }
  } else if (k === 3) {
    // Lattice — kite + long tail
    const kite = [
      { x: 0, y: 0.42, r: 2.0 },
      { x: -0.32, y: 0.05, r: 1.5 },
      { x: 0.32, y: 0.05, r: 1.5 },
      { x: 0, y: -0.22, r: 1.7 },
    ]
    for (const p of kite.slice(0, Math.min(4, n))) {
      stars.push({ x: p.x * (variant === 1 ? 1.15 : 1), y: p.y, z: 0, r: p.r + rnd() * 0.3 })
    }
    const tail = n - stars.length
    for (let i = 0; i < tail; i++) {
      const t = (i + 1) / (tail + 0.5)
      stars.push({
        x: (variant === 2 ? 0.12 : -0.08) * t,
        y: -0.22 - t * 0.55,
        z: 0.02,
        r: 1.2 + (1 - t) * 0.9,
      })
    }
  } else if (k === 4) {
    // Vein — hunter: belt + shoulders + legs
    const belt = Math.min(3, n)
    for (let i = 0; i < belt; i++) {
      const t = i / Math.max(1, belt - 1)
      stars.push({ x: -0.28 + t * 0.56, y: 0.05, z: 0, r: 1.8 + rnd() * 0.4 })
    }
    if (stars.length < n) stars.push({ x: -0.38, y: 0.42, z: 0.02, r: 1.6 })
    if (stars.length < n) stars.push({ x: 0.38, y: 0.42, z: -0.02, r: 1.6 })
    if (stars.length < n && variant !== 1) stars.push({ x: 0, y: 0.58, z: 0, r: 2.1 })
    while (stars.length < n) {
      const side = stars.length % 2 === 0 ? -1 : 1
      const t = (stars.length - 5) / Math.max(1, n - 5)
      stars.push({
        x: side * (0.18 + t * 0.2),
        y: -0.15 - t * 0.4,
        z: side * 0.03,
        r: 1.3 + rnd() * 0.5,
      })
    }
  } else {
    // Halo — lyre / harp (two pillars), not a wheel
    const left = Math.ceil(n / 2)
    for (let i = 0; i < left; i++) {
      const t = i / Math.max(1, left - 1)
      stars.push({
        x: -0.28 - Math.sin(t * Math.PI) * (variant === 1 ? 0.12 : 0.06),
        y: -0.45 + t * 0.95,
        z: 0,
        r: 1.3 + (i === left - 1 ? 0.9 : 0.4) + rnd() * 0.3,
      })
    }
    for (let i = 0; i < n - left; i++) {
      const t = i / Math.max(1, n - left - 1)
      stars.push({
        x: 0.28 + Math.sin(t * Math.PI) * (variant === 1 ? 0.12 : 0.06),
        y: -0.45 + t * 0.95,
        z: 0.02,
        r: 1.3 + (i === n - left - 1 ? 0.9 : 0.4) + rnd() * 0.3,
      })
    }
  }

  // Mild pose — keep silhouette readable
  const yaw = (rnd() - 0.5) * 0.9
  const roll = (rnd() - 0.5) * 0.55
  const sc = 0.9 + rnd() * 0.2
  const cy = Math.cos(yaw)
  const syw = Math.sin(yaw)
  const cr = Math.cos(roll)
  const sr = Math.sin(roll)
  for (const s of stars) {
    let x = s.x * sc + (rnd() - 0.5) * 0.025
    let y = s.y * sc + (rnd() - 0.5) * 0.025
    let z = (s.z || 0) * sc
    const x1 = x * cy + z * syw
    const z1 = -x * syw + z * cy
    s.x = x1 * cr - y * sr
    s.y = x1 * sr + y * cr
    s.z = z1
    s.r = Math.max(1.1, (s.r || 1.5) * (0.9 + rnd() * 0.3))
    s.mark = 'diamond'
  }
  return stars
}

/** Classic stick-figure edges per kind. */
function kindEdges(kindIdx, stars) {
  const n = stars.length
  if (n < 2) return []
  const k = kindIdx % 6
  const edges = []
  if (k === 0) {
    const shaft = Math.max(4, n - 2)
    for (let i = 0; i < shaft - 1; i++) edges.push([i, i + 1])
    const mid = Math.floor(shaft * 0.45)
    for (let i = shaft; i < n; i++) edges.push([mid, i])
  } else if (k === 1 || k === 2) {
    for (let i = 0; i < n - 1; i++) edges.push([i, i + 1])
  } else if (k === 3) {
    if (n >= 4) {
      edges.push([0, 1], [0, 2], [1, 3], [2, 3])
      for (let i = 3; i < n - 1; i++) edges.push([i, i + 1])
    } else {
      for (let i = 0; i < n - 1; i++) edges.push([i, i + 1])
    }
  } else if (k === 4) {
    const belt = Math.min(3, n)
    for (let i = 0; i < belt - 1; i++) edges.push([i, i + 1])
    const mid = Math.floor((belt - 1) / 2)
    for (let i = belt; i < n; i++) {
      const anchor = i < belt + 2 ? (i === belt ? 0 : belt - 1) : mid
      edges.push([Math.min(anchor, belt - 1), i])
    }
  } else {
    const left = Math.ceil(n / 2)
    for (let i = 0; i < left - 1; i++) edges.push([i, i + 1])
    for (let i = left; i < n - 1; i++) edges.push([i, i + 1])
    if (left > 0 && n > left) {
      edges.push([left - 1, n - 1])
      if (left > 2 && n - left > 2) edges.push([1, left + 1])
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
