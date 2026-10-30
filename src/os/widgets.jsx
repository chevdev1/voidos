import { useEffect, useState } from 'react'
import { formatCompactUsd, formatPercent } from './lib.js'
import { useTrending } from './useTrending.js'

export function ClockWidget() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  return (
    <div className="os-widget os-widget-clock">
      <div className="os-widget-time">{time}</div>
      <div className="os-widget-date">{date}</div>
    </div>
  )
}

export function TrendingWidget({ onOpen }) {
  const { rows, source, loading } = useTrending()
  const top = [...rows].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 3)
  return (
    <button type="button" className="os-widget os-widget-trend" onClick={() => onOpen('market')}>
      <div className="os-widget-head">
        <span className="os-label">Trending</span>
        <span className={`os-tag ${source === 'live' ? 'os-tag-ok' : 'os-tag-warn'}`}>
          {loading ? 'loading' : source === 'live' ? 'live' : 'demo'}
        </span>
      </div>
      {top.map((t) => (
        <div className="os-widget-row" key={t.id}>
          <span className="os-sym">{t.symbol}</span>
          <span className={t.change24h >= 0 ? 'os-up' : 'os-down'}>{formatPercent(t.change24h)}</span>
          <span className="os-mono os-muted">{formatCompactUsd(t.volume24h)}</span>
        </div>
      ))}
    </button>
  )
}
