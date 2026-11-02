import { useEffect, useState, useSyncExternalStore } from 'react'
import { BUILTIN, getPlayer, subscribePlayer, toggle, next, prev } from './player.js'
import { formatCompactUsd, formatPercent } from './lib.js'
import { CITIES, CACHE_MS, describe, fetchWeather, currentPosition, readCache, writeCache } from './weather.js'
import { monthGrid, monthTitle, shiftMonth, WEEKDAYS } from './calendar.js'
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

// Compact player on the desktop: art, title, previous, play/pause, next. Music continues across windows.
export function PlayerWidget({ onOpen }) {
  const p = useSyncExternalStore(subscribePlayer, getPlayer, getPlayer)
  const title = p.mode === 'builtin' ? BUILTIN[p.trackIndex].title : p.files[p.fileIndex]?.name || 'No track'
  const sub = p.playing ? 'playing' : 'paused'
  return (
    <div className={`os-widget os-widget-player ${p.playing ? 'is-playing' : ''}`}>
      <button type="button" className="os-wp-art" onClick={() => onOpen('player')} aria-label="Open player">
        <span className="os-wp-disc" aria-hidden="true" />
      </button>
      <div className="os-wp-meta">
        <button type="button" className="os-wp-title" onClick={() => onOpen('player')}>{title}</button>
        <span className="os-muted os-small">{sub}</span>
      </div>
      <div className="os-wp-controls">
        <button type="button" onClick={prev} aria-label="Previous">‹‹</button>
        <button type="button" className="is-main" onClick={toggle} aria-label={p.playing ? 'Pause' : 'Play'}>{p.playing ? '❚❚' : '▶'}</button>
        <button type="button" onClick={next} aria-label="Next">››</button>
      </div>
    </div>
  )
}

// Weather: one card, one request per session (cached 20 minutes). Pick a city when location is not shared.
export function WeatherWidget() {
  const [st, setSt] = useState(() => {
    const c = readCache()
    return { data: c?.data ?? null, city: c?.city ?? null, status: c?.data ? 'ok' : 'loading' }
  })

  async function load(place) {
    setSt((s) => ({ ...s, status: 'loading' }))
    try {
      const data = await fetchWeather(place.lat, place.lon)
      writeCache({ at: Date.now(), city: place.name, data })
      setSt({ data, city: place.name, status: 'ok' })
    } catch {
      setSt((s) => ({ ...s, status: 'error' }))
    }
  }

  useEffect(() => {
    const c = readCache()
    if (c && Date.now() - c.at < CACHE_MS && c.data) return
    let alive = true
    ;(async () => {
      const pos = await currentPosition()
      if (!alive) return
      await load(pos ? { name: 'Your location', ...pos } : CITIES[0])
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const info = st.data?.code != null ? describe(st.data.code) : null
  return (
    <div className="os-widget os-widget-weather">
      <div className="os-widget-head">
        <span className="os-label">Weather</span>
        <select
          className="os-wx-city"
          value={st.city && CITIES.some((c) => c.name === st.city) ? st.city : ''}
          onChange={(e) => {
            const place = CITIES.find((c) => c.name === e.target.value)
            if (place) load(place)
          }}
          aria-label="City"
        >
          <option value="" disabled>{st.city || 'Pick a city'}</option>
          {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      {st.status === 'loading' && <p className="os-muted os-small">Reading the sky…</p>}
      {st.status === 'error' && <p className="os-muted os-small">Weather is unavailable right now.</p>}
      {st.status === 'ok' && st.data && (
        <div className="os-wx-main">
          <span className="os-wx-glyph" aria-hidden="true">{info.glyph}</span>
          <div className="os-wx-temp">{st.data.temp ?? '—'}°</div>
          <div className="os-wx-meta">
            <span>{info.label}</span>
            <span className="os-muted os-small">
              H {st.data.hi ?? '—'}° · L {st.data.lo ?? '—'}° · wind {st.data.wind ?? '—'} km/h
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Month calendar: Monday first, today in lime, arrows to move through months.
export function CalendarWidget() {
  const now = new Date()
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const rows = monthGrid(view.year, view.month, now)
  const move = (delta) => setView((v) => shiftMonth(v.year, v.month, delta))
  return (
    <div className="os-widget os-widget-cal">
      <div className="os-widget-head">
        <button type="button" className="os-cal-nav" onClick={() => move(-1)} aria-label="Previous month">‹</button>
        <span className="os-cal-title">{monthTitle(view.year, view.month)}</span>
        <button type="button" className="os-cal-nav" onClick={() => move(1)} aria-label="Next month">›</button>
      </div>
      <div className="os-cal-grid" role="grid" aria-label={monthTitle(view.year, view.month)}>
        {WEEKDAYS.map((d) => <span key={d} className="os-cal-dow" role="columnheader">{d}</span>)}
        {rows.flat().map((cell, i) =>
          cell ? (
            <span key={i} role="gridcell" className={`os-cal-day ${cell.isToday ? 'is-today' : ''}`} aria-current={cell.isToday ? 'date' : undefined}>
              {cell.day}
            </span>
          ) : (
            <span key={i} className="os-cal-day is-pad" aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  )
}
