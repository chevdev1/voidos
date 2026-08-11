/**
 * Full-map lot book: every constellation lot priced so the 200 lots sum to $100,000.
 * Weights: closer to core = more expensive; rarer kinds get a mild bump; then renormalize.
 */

export const TOTAL_LOT_BOOK_USD = 100_000
export const TOTAL_PRICED_LOTS = 200

/** Matches voidEngine CONSTEL_DEFS figure → LOT_KINDS index. */
const KIND_MUL = [
  1.0, // Spire — common
  1.1, // Coil
  1.15, // Crown
  1.3, // Lattice
  1.35, // Vein
  1.55, // Halo — scarce
]

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

/** Same radial/figure layout as voidEngine CONSTEL_DEFS (ids c0…c199). */
export function lotDefMeta(index) {
  const n = Number(index) | 0
  const arms = 4
  const perArm = 50
  const arm = Math.floor(n / perArm) % arms
  const k = n % perArm
  const u = clamp(0.04 + k * (0.94 / (perArm - 1)) + (((arm * 5 + k * 3) % 7) - 3) * 0.006, 0.03, 0.97)
  const figure = n % 6
  return { id: 'c' + n, index: n, arm, u, figure }
}

function weightFor(meta) {
  // u ~ 0 at core side of arm param… in engine, smaller u is closer to core start of spiral.
  // Core proximity: 1 at center, 0 at rim.
  const core = Math.pow(1 - meta.u, 1.65)
  const kind = KIND_MUL[meta.figure] || 1
  // Floor so far-rim lots stay buyable (~few k), not dust.
  return (0.22 + core * 1.78) * kind
}

/** Integer USD per lot id; sum === TOTAL_LOT_BOOK_USD. */
let _book = null

function buildBook() {
  const metas = []
  const weights = []
  for (let i = 0; i < TOTAL_PRICED_LOTS; i++) {
    const m = lotDefMeta(i)
    metas.push(m)
    weights.push(weightFor(m))
  }
  const sumW = weights.reduce((a, b) => a + b, 0)
  const centsTarget = TOTAL_LOT_BOOK_USD * 100
  const rawCents = weights.map((w) => (w / sumW) * centsTarget)
  const floors = rawCents.map((c) => Math.floor(c))
  let rem = centsTarget - floors.reduce((a, b) => a + b, 0)
  const order = rawCents
    .map((c, i) => ({ i, frac: c - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < rem; k++) floors[order[k % order.length].i] += 1

  const byId = Object.create(null)
  let min = Infinity
  let max = 0
  for (let i = 0; i < TOTAL_PRICED_LOTS; i++) {
    const usd = floors[i] / 100
    byId[metas[i].id] = usd
    if (usd < min) min = usd
    if (usd > max) max = usd
  }
  return { byId, min, max }
}

function book() {
  if (!_book) _book = buildBook()
  return _book
}

export function getLotUsd(lotId) {
  const id = String(lotId || '')
  const b = book()
  if (b.byId[id] != null) return b.byId[id]
  const m = id.match(/^c(\d+)$/i)
  if (m) {
    const n = Number(m[1])
    if (n >= 0 && n < TOTAL_PRICED_LOTS) return b.byId['c' + n]
  }
  return b.min
}

export function lotBookStats() {
  const b = book()
  return {
    totalUsd: TOTAL_LOT_BOOK_USD,
    lots: TOTAL_PRICED_LOTS,
    minUsd: b.min,
    maxUsd: b.max,
    avgUsd: TOTAL_LOT_BOOK_USD / TOTAL_PRICED_LOTS,
  }
}

export function formatUsd(n) {
  const v = Math.round(Number(n) || 0)
  return '$' + v.toLocaleString('en-US')
}

/**
 * Stamp each constellation with book USD and split across grains
 * so grain tooltips / cart sums still match the lot price.
 */
export function applyLotBookToConstels(constels) {
  if (!Array.isArray(constels)) return
  for (const c of constels) {
    const lotUsd = getLotUsd(c.id)
    c.usd = lotUsd
    const grains = c.grains || []
    if (!grains.length) continue
    let wSum = 0
    const ws = grains.map((s) => {
      const core = 1 - clamp(Number(s.u) || 0.5, 0, 1)
      const mass = Math.max(1, Number(s.size) || 1)
      const w = mass * (0.45 + Math.pow(core, 1.4))
      wSum += w
      return w
    })
    if (wSum <= 0) {
      const each = lotUsd / grains.length
      for (const s of grains) s.usd = each
      continue
    }
    let assigned = 0
    for (let i = 0; i < grains.length; i++) {
      if (i === grains.length - 1) {
        grains[i].usd = Math.max(0, lotUsd - assigned)
      } else {
        const slice = Math.round(((ws[i] / wSum) * lotUsd) * 100) / 100
        grains[i].usd = slice
        assigned += slice
      }
    }
  }
}
