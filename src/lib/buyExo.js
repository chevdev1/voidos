/**
 * $TEST buy helpers. Trust in-app browser freezes on window.open / target=_blank.
 */

import { DEFAULT_DEX_URL, DEFAULT_EXO_TOKEN, DEFAULT_GECKO_URL } from '../../shared/rhChain.js'
import { isMobileDevice, isTrustInjected } from './rhWallets'

export function getDexUrl() {
  return String(import.meta.env.VITE_DEX_URL || DEFAULT_DEX_URL || '').trim()
}

export function getGeckoUrl() {
  return String(import.meta.env.VITE_GECKO_URL || DEFAULT_GECKO_URL || '').trim()
}

export function getExoCa() {
  return String(
    import.meta.env.VITE_EXO_CA ||
      import.meta.env.VITE_EXO_TOKEN ||
      import.meta.env.VITE_EXO_MINT ||
      DEFAULT_EXO_TOKEN ||
      '',
  ).trim()
}

export function isBuyLive() {
  return Boolean(getDexUrl() || getExoCa())
}

function pauseMapForNav() {
  try {
    document.body.classList.add('wc-modal-open')
    window.__voidCosmos?.pauseDemo?.()
  } catch {
    /* ignore */
  }
}

export function shouldBuyInSameTab() {
  if (typeof window === 'undefined') return false
  if (isTrustInjected()) return true
  return isMobileDevice()
}

/**
 * Open Dex. Trust / phone: same tab after pausing the galaxy (popup = freeze).
 */
export function openDexBuy(url) {
  const href = String(url || getDexUrl() || '').trim()
  if (!href) return false
  pauseMapForNav()
  const go = () => {
    if (shouldBuyInSameTab()) {
      window.location.assign(href)
      return
    }
    const w = window.open(href, '_blank', 'noopener,noreferrer')
    if (!w) window.location.assign(href)
  }
  requestAnimationFrame(() => setTimeout(go, 40))
  return true
}

export async function copyExoCa() {
  const ca = getExoCa()
  if (!ca) return false
  try {
    await navigator.clipboard.writeText(ca)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = ca
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      return true
    } catch {
      return false
    }
  }
}
