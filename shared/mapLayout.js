/**
 * Single source of truth for constellation lot count / spiral layout.
 * voidEngine, lotPricing, and voidDb all import from here.
 */

export const MAP_ARMS = 8
export const MAP_LOTS_PER_ARM = 1250
/** Claimable constellation lots on the shared map (c0…c{N-1}). */
export const TOTAL_MAP_LOTS = MAP_ARMS * MAP_LOTS_PER_ARM // 10_000

export function clamp01(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, v))
}

/** Deterministic layout meta for lot index — mirrors voidEngine CONSTEL_DEFS. */
export function lotDefMeta(index) {
  const n = Number(index) | 0
  const arm = Math.floor(n / MAP_LOTS_PER_ARM) % MAP_ARMS
  const k = n % MAP_LOTS_PER_ARM
  const jitter = (((arm * 5 + k * 3) % 7) - 3) * 0.004
  const u = clamp01(0.03 + k * (0.94 / Math.max(1, MAP_LOTS_PER_ARM - 1)) + jitter, 0.02, 0.98)
  return {
    id: 'c' + n,
    index: n,
    arm,
    u,
    figure: n % 6,
    spread: 0.07 + (n % 7) * 0.01,
  }
}
