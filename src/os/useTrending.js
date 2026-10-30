import { useEffect, useState } from 'react'
import { DEMO_MARKET, RH_CHAIN, mapTrendingPools } from './lib.js'

// One shared request for the whole desktop (widget + Market app), cached for the session.
let cached = null

export function loadTrending() {
  if (!cached) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 7000)
    cached = fetch(`https://api.geckoterminal.com/api/v2/networks/${RH_CHAIN.geckoNetwork}/trending_pools`, {
      signal: ctrl.signal,
      headers: { accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        const live = mapTrendingPools(json)
        return live.length ? { rows: live, source: 'live' } : { rows: DEMO_MARKET, source: 'demo' }
      })
      .catch(() => ({ rows: DEMO_MARKET, source: 'demo' }))
      .finally(() => clearTimeout(timer))
  }
  return cached
}

export function useTrending() {
  const [state, setState] = useState({ rows: DEMO_MARKET, source: 'demo', loading: true })
  useEffect(() => {
    let alive = true
    loadTrending().then((res) => {
      if (alive) setState({ ...res, loading: false })
    })
    return () => {
      alive = false
    }
  }, [])
  return state
}
