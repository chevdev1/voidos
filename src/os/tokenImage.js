import { useEffect, useState } from 'react'
// Token logos come from GeckoTerminal's token endpoint. One request per address, cached for the session.
import { RH_CHAIN } from './lib.js'

const cache = new Map()

export function loadTokenImage(address) {
  if (!address) return Promise.resolve(null)
  if (!cache.has(address)) {
    cache.set(
      address,
      fetch(`https://api.geckoterminal.com/api/v2/networks/${RH_CHAIN.geckoNetwork}/tokens/${address}`, {
        headers: { accept: 'application/json' },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => json?.data?.attributes?.image_url || null)
        .catch(() => null),
    )
  }
  return cache.get(address)
}

export function useTokenImage(address) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let alive = true
    loadTokenImage(address).then((url) => {
      if (alive) setSrc(url)
    })
    return () => {
      alive = false
    }
  }, [address])
  return src
}
