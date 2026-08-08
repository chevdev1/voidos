/**
 * Deterministic lore + star geometry for a claimed constellation lot.
 * Same id/name → same figure and text everywhere (map / cabinet).
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

/**
 * @param {{ constel_id?: string, id?: string, constel_name?: string, name?: string, claimed_at?: string }} lot
 */
export function buildLotProfile(lot) {
  const id = String(lot.constel_id || lot.id || 'unknown')
  const name = String(lot.constel_name || lot.name || id)
  const seed = hashStr(`${id}::${name}`)
  const rnd = mulberry32(seed)

  const starCount = 4 + Math.floor(rnd() * 5) // 4–8
  const stars = []
  for (let i = 0; i < starCount; i++) {
    const ang = (i / starCount) * Math.PI * 2 + rnd() * 0.7
    const rad = 0.28 + rnd() * 0.55
    stars.push({
      x: 0.5 + Math.cos(ang) * rad * 0.42,
      y: 0.5 + Math.sin(ang) * rad * 0.42,
      r: 1.4 + rnd() * 2.2,
    })
  }
  // mild jitter toward center cluster
  for (const s of stars) {
    s.x = Math.min(0.92, Math.max(0.08, s.x + (rnd() - 0.5) * 0.08))
    s.y = Math.min(0.92, Math.max(0.08, s.y + (rnd() - 0.5) * 0.08))
  }

  // MST edges
  const edges = []
  const used = new Set([0])
  while (used.size < stars.length) {
    let best = null
    for (const i of used) {
      for (let j = 0; j < stars.length; j++) {
        if (used.has(j)) continue
        const dx = stars[i].x - stars[j].x
        const dy = stars[i].y - stars[j].y
        const d = dx * dx + dy * dy
        if (!best || d < best.d) best = { i, j, d }
      }
    }
    if (!best) break
    edges.push([best.i, best.j])
    used.add(best.j)
  }

  const trait = TRAITS[seed % TRAITS.length]
  const feel = FEELS[(seed >>> 3) % FEELS.length]
  const train = TRAIN[(seed >>> 7) % TRAIN.length]
  const mass = (3.2 + (seed % 70) / 10).toFixed(1)
  const band = seed % 3 === 0 ? 'coreward' : seed % 3 === 1 ? 'mid-disk' : 'rim'

  const claimed = lot.claimed_at
    ? new Date(lot.claimed_at.includes('T') ? lot.claimed_at : lot.claimed_at.replace(' ', 'T') + 'Z')
    : null
  const claimedLabel =
    claimed && !Number.isNaN(claimed.getTime())
      ? claimed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : 'recorded in the ledger'

  return {
    id,
    name,
    seed,
    stars,
    edges,
    trait,
    band,
    mass,
    claimedLabel,
    blurb: `${name} is a constellation lot cut from ExoMind — ${starCount} linked stars in the ${band}. Its signal tastes like ${trait}.`,
    body: [
      `Owning ${name} means this figure of stars sits inside the mind as lasting weight. On the map it draws as lines between grains; in you it becomes a private room of the void.`,
      `Standing here feels like ${feel}. The lot does not speak unless trained — but even silent, it shifts how ExoMind leans.`,
      `How to live with it: ${train} Claim is forever. Talk is free. Moving the voice costs burn.`,
    ],
    starCount,
  }
}
