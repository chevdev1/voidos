/**
 * $EXO buy helpers — Dex link when live, else CA copy / market fallback.
 */

export function getDexUrl() {
  return String(import.meta.env.VITE_DEX_URL || '').trim()
}

export function getExoCa() {
  return String(
    import.meta.env.VITE_EXO_CA || import.meta.env.VITE_EXO_TOKEN || import.meta.env.VITE_EXO_MINT || '',
  ).trim()
}

export function isBuyLive() {
  return Boolean(getDexUrl() || getExoCa())
}

/** Open Dex in a new tab when configured. Returns true if opened. */
export function openDexBuy() {
  const url = getDexUrl()
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

export async function copyExoCa() {
  const ca = getExoCa()
  if (!ca) return false
  try {
    await navigator.clipboard.writeText(ca)
    return true
  } catch {
    return false
  }
}
