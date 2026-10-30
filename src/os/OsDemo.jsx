import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import './os.css'
import { Galaxy } from './Galaxy.jsx'
import { ClockWidget, TrendingWidget } from './widgets.jsx'
import { WelcomeApp, WalletApp, InspectorApp, NetworkApp } from './apps.jsx'
import { MarketApp } from './Market.jsx'
import { MacChanger } from './MacChanger.jsx'
import { Pulse } from './Pulse.jsx'
import { WifiCheck } from './WifiCheck.jsx'
import { Settings } from './Settings.jsx'
import { XApp } from './XApp.jsx'
import { WindowFrame } from './WindowFrame.jsx'
import { CodeApp } from './code/CodeApp.jsx'
import { AppTile } from './AppTile.jsx'
import { readPrefs } from './prefs.js'
import { Terminal } from './Terminal.jsx'
import { Vpn } from './Vpn.jsx'
import { VoidAi } from './VoidAi.jsx'
import { Browser } from './Browser.jsx'
import {
  WelcomeIcon,
  WalletIcon,
  MarketIcon,
  InspectorIcon,
  NetworkIcon,
  SettingsIcon,
  CodeIcon,
  TerminalIcon,
  VpnIcon,
  BrowserIcon,
  AiIcon,
  MacIcon,
  PulseIcon,
  WifiIcon,
  XIcon,
} from './icons.jsx'

// tint drives the dock tile and window accent; Icon is the line glyph.
const APPS = {
  welcome: { title: 'Welcome', w: 520, h: 400, tint: '#ccff00', grad: ["#d6ff4d","#8fbf00"], Icon: WelcomeIcon, Component: WelcomeApp },
  browser: { title: 'Browser', w: 720, h: 500, tint: '#7fc0ff', grad: ["#4aa8ff","#1d6bf0"], Icon: BrowserIcon, Component: Browser },
  vpn: { title: 'VPN', w: 460, h: 540, tint: '#4fd1a5', grad: ["#3ddc97","#0f9d6b"], Icon: VpnIcon, Component: Vpn },
  terminal: { title: 'Terminal', w: 640, h: 420, tint: '#ccff00', grad: ["#3a3f48","#0b0c0f"], Icon: TerminalIcon, Component: Terminal },
  ai: { title: 'VOID.AI', w: 460, h: 520, tint: '#b9a6ff', grad: ["#b59cff","#6d4dff"], Icon: AiIcon, Component: VoidAi },
  wallet: { title: 'Wallet', w: 480, h: 470, tint: '#4fd1a5', grad: ["#5fe0b5","#17a077"], Icon: WalletIcon, Component: WalletApp },
  market: { title: 'Market', w: 580, h: 470, tint: '#ccff00', grad: ["#a6e22e","#4f8a10"], Icon: MarketIcon, Component: MarketApp },
  inspector: { title: 'Inspector', w: 500, h: 380, tint: '#7fc0ff', grad: ["#9aa6bb","#56627a"], Icon: InspectorIcon, Component: InspectorApp },
  network: { title: 'Network', w: 420, h: 380, tint: '#b9a6ff', grad: ["#8fa0ff","#4d5fd1"], Icon: NetworkIcon, Component: NetworkApp },
  settings: { title: 'Settings', w: 660, h: 500, tint: '#c3cad4', grad: ["#c9ced8","#7d8594"], Icon: SettingsIcon, Component: Settings },
  mac: { title: 'MAC Changer', w: 480, h: 540, tint: '#f2994a', grad: ["#ffb34d","#f2701a"], Icon: MacIcon, Component: MacChanger },
  pulse: { title: 'Pulse', w: 520, h: 520, tint: '#4fd1a5', grad: ["#ff7090","#d6284d"], Icon: PulseIcon, Component: Pulse },
  code: { title: 'VOID.CODE', w: 900, h: 580, tint: '#4aa3ff', grad: ['#4aa3ff', '#1565c0'], Icon: CodeIcon, Component: CodeApp },
  x: { title: 'X', w: 440, h: 540, tint: '#f0f0f0', grad: ["#3a3a3f","#000000"], Icon: XIcon, Component: XApp },
  wifi: { title: 'Wi-Fi Check', w: 480, h: 560, tint: '#7fc0ff', grad: ["#6cc0ff","#2a7ae0"], Icon: WifiIcon, Component: WifiCheck },
}
const DOCK = ['browser', 'vpn', 'mac', 'terminal', 'code', 'ai', 'wallet', 'market', 'pulse', 'inspector', 'wifi', 'x', 'network', 'settings']
const LAYOUT_KEY = 'void-os-layout'
const BOOT_LINES = [
  'kernel: loading',
  'mounting constellations',
  'wallet bridge: standby',
  'network: robinhood-chain 4663',
  'tor: simulated (demo)',
  'ready',
]

// ---------- window state ----------

function readLayout() {
  try {
    const list = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '[]')
    return Array.isArray(list) ? list.filter((w) => w && typeof w.app === 'string' && Number.isFinite(w.x) && Number.isFinite(w.y)) : []
  } catch {
    return []
  }
}

function writeLayout(wins) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(wins.map(({ app, x, y, min, max }) => ({ app, x, y, min, max }))))
  } catch {
    /* storage full or disabled: the layout simply is not remembered */
  }
}


function openWindow(state, app, payload) {
  const z = state.z + 1
  const existing = state.wins.find((w) => w.app === app)
  if (existing) {
    return {
      z,
      wins: state.wins.map((w) => (w.app === app ? { ...w, z, payload: payload ?? w.payload, min: false } : w)),
    }
  }
  const n = state.wins.length
  const { w, h } = APPS[app]
  const vw = window.innerWidth
  const vh = window.innerHeight
  // Open to the right of the widget column, cascading down.
  const x = Math.max(12, Math.min(380 + n * 28, vw - w - 12))
  const y = Math.max(44, Math.min(84 + n * 24, vh - h - 110))
  return { z, wins: [...state.wins, { app, x, y, z, payload, min: false, max: false }] }
}

function reducer(state, action) {
  switch (action.type) {
    case 'open':
      return openWindow(state, action.app, action.payload)
    case 'focus':
      return { ...state, z: state.z + 1, wins: state.wins.map((w) => (w.app === action.app ? { ...w, z: state.z + 1 } : w)) }
    case 'move':
      return { ...state, wins: state.wins.map((w) => (w.app === action.app ? { ...w, x: action.x, y: action.y } : w)) }
    case 'min':
      return { ...state, wins: state.wins.map((w) => (w.app === action.app ? { ...w, min: true } : w)) }
    case 'max':
      return { ...state, wins: state.wins.map((w) => (w.app === action.app ? { ...w, max: !w.max, z: state.z + 1 } : w)), z: state.z + 1 }
    case 'restore': {
      // Rebuild the windows saved on the last visit. Unknown apps are skipped.
      const wins = action.wins
        .filter((w) => APPS[w.app])
        .map((w, i) => ({ app: w.app, x: w.x, y: w.y, z: i + 1, payload: undefined, min: Boolean(w.min), max: Boolean(w.max) }))
      return { z: wins.length, wins }
    }
    case 'close':
      return { ...state, wins: state.wins.filter((w) => w.app !== action.app) }
    default:
      return state
  }
}

// ---------- chrome ----------

function MenuBar({ onOpen, onSpotlight }) {
  const [now, setNow] = useState(() => new Date())
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <nav className="os-menubar" aria-label="System menu">
      <div className="os-menubar-left">
        <span className="os-brand">VOID<span>.OS</span></span>
        <div className="os-menu-wrap">
          <button className="os-menu-btn" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>Apps</button>
          {menu && (
            <div className="os-menu" role="menu">
              {Object.keys(APPS).map((id) => (
                <button
                  key={id}
                  role="menuitem"
                  className="os-menu-item"
                  onClick={() => {
                    onOpen(id)
                    setMenu(false)
                  }}
                >
                  {APPS[id].title}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="os-menu-btn" onClick={() => onOpen('welcome')}>Help</button>
      </div>
      <div className="os-menubar-right">
        <button className="os-menu-btn os-kbd" onClick={onSpotlight} aria-label="Open Spotlight">⌘K</button>
        <span className="os-status"><i className="os-dot os-dot-ok" />Robinhood 4663</span>
        <span className="os-status"><i className="os-dot os-dot-warn" />Tor · sim</span>
        <time dateTime={now.toISOString()}>
          {now.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </nav>
  )
}

// Mac-style magnification: each icon scales by its distance from the pointer.
// Reads offsetLeft (layout only), so transforms never feed back into the math.
const MAG_MAX = 1.55
const MAG_SIGMA = 80
const MAG_LIFT = 12

function Dock({ openIds, onOpen, magnify = true }) {
  const dock = useRef(null)
  const items = useRef([])
  const frame = useRef(0)

  const paint = (mx) => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      for (const el of items.current) {
        if (!el) continue
        const center = el.offsetLeft + el.offsetWidth / 2
        const d = mx - center
        const k = 1 + (MAG_MAX - 1) * Math.exp(-(d * d) / (2 * MAG_SIGMA * MAG_SIGMA))
        el.style.transform = `translateY(${-(k - 1) * MAG_LIFT}px) scale(${k.toFixed(3)})`
      }
    })
  }
  const rest = () => {
    cancelAnimationFrame(frame.current)
    for (const el of items.current) if (el) el.style.transform = ''
  }

  return (
    <div
      ref={dock}
      className="os-dock"
      role="toolbar"
      aria-label="Apps"
      onPointerMove={(e) => magnify && paint(e.clientX - dock.current.getBoundingClientRect().left)}
      onPointerLeave={rest}
    >
      {DOCK.map((id, i) => {
        const { title, tint, grad, Icon } = APPS[id]
        return (
          <button
            key={id}
            ref={(el) => (items.current[i] = el)}
            className="os-dock-item"
            onClick={() => onOpen(id)}
            aria-label={title}
            title={title}
            style={{ '--tint': tint }}
          >
            <AppTile Icon={Icon} grad={grad} size="lg" />
            {openIds.includes(id) && <i className="os-dock-dot" />}
          </button>
        )
      })}
    </div>
  )
}

function Spotlight({ onSubmit, onClose }) {
  const [q, setQ] = useState('')
  return (
    <div className="os-spotlight-backdrop" onMouseDown={onClose}>
      <form
        className="os-spotlight"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(q)
        }}
      >
        <input
          autoFocus
          className="os-spotlight-input"
          placeholder="Wallet, token or transaction…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Spotlight search"
        />
        <p className="os-note">Enter opens Inspector. Esc closes.</p>
      </form>
    </div>
  )
}

// ---------- boot ----------

function Boot({ onDone, exiting }) {
  const [line, setLine] = useState(0)

  useEffect(() => {
    const timers = BOOT_LINES.map((_, i) => setTimeout(() => setLine(i + 1), 330 * (i + 1)))
    const done = setTimeout(onDone, 330 * BOOT_LINES.length + 500)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(done)
    }
  }, [onDone])

  return (
    <div className={`os-boot ${exiting ? 'is-exiting' : ''}`} onClick={onDone} role="status" aria-live="polite">
      <div className="os-boot-logo">VOID<span>.OS</span></div>
      <ul className="os-boot-log">
        {BOOT_LINES.slice(0, line).map((l) => (
          <li key={l}>› {l}</li>
        ))}
      </ul>
      <div className="os-boot-bar"><i style={{ width: `${(line / BOOT_LINES.length) * 100}%` }} /></div>
      <p className="os-boot-skip">click to skip</p>
    </div>
  )
}

// ---------- page ----------

export default function OsDemo() {
  const [booted, setBooted] = useState(false)
  const [spot, setSpot] = useState(false)
  const [prefs, setPrefs] = useState(readPrefs)
  const [state, dispatch] = useReducer(reducer, { wins: [], z: 0 })
  const [exiting, setExiting] = useState(false)
  // Boot fades out first; the desktop mounts once the curtain is down.
  const finishBoot = useCallback(() => {
    setExiting(true)
    setTimeout(() => {
      setBooted(true)
      const saved = readLayout()
      if (saved.length) dispatch({ type: 'restore', wins: saved })
      else dispatch({ type: 'open', app: 'welcome' })
    }, 420)
  }, [])

  const open = useCallback((app, payload) => dispatch({ type: 'open', app, payload }), [])

  useEffect(() => {
    document.title = 'VOID.OS · demo'
  }, [])

  useEffect(() => {
    if (booted) writeLayout(state.wins)
  }, [state.wins, booted])

  // Cmd/Ctrl+K opens Spotlight. Esc closes Spotlight first, otherwise the top window.
  const topApp = state.wins.filter((w) => !w.min).reduce((a, w) => (a === null || w.z > a.z ? w : a), null)
  const topZ = topApp ? topApp.z : -1
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSpot(true)
        return
      }
      if (e.key !== 'Escape') return
      const typing = e.target?.matches?.('input, textarea, [contenteditable="true"]') || e.target?.closest?.('.cm-editor')
      if (typing && !spot) return
      if (spot) setSpot(false)
      else if (topApp) dispatch({ type: 'close', app: topApp.app })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [spot, topApp])

  return (
    <div
      className={`os-root text-${prefs.textSize} ${prefs.wallpaper ? '' : 'no-wallpaper'} ${prefs.motion ? '' : 'no-motion'} ${prefs.reduceTransparency ? 'reduce-transparency' : ''} ${prefs.dockMagnify ? '' : 'no-magnify'}`}
    >
      {prefs.wallpaper && (
        <div className="os-enter-galaxy">
          <Galaxy />
        </div>
      )}
      {!booted && <Boot onDone={finishBoot} exiting={exiting} />}
      {booted && (
        <>
          {prefs.widgets && <div className="os-widgets">
            <ClockWidget />
            <TrendingWidget onOpen={open} />
          </div>}
          <MenuBar onOpen={open} onSpotlight={() => setSpot(true)} />
          {state.wins.map((win) => {
            const { Component } = APPS[win.app]
            return (
              <WindowFrame
                key={win.app}
                win={win}
                app={APPS[win.app]}
                active={win.z === topZ && !win.min}
                onFocus={() => dispatch({ type: 'focus', app: win.app })}
                onClose={() => dispatch({ type: 'close', app: win.app })}
                onMove={(x, y) => dispatch({ type: 'move', app: win.app, x, y })}
                onMinimize={() => dispatch({ type: 'min', app: win.app })}
                onToggleMax={() => dispatch({ type: 'max', app: win.app })}
              >
                <Component payload={win.payload} onOpen={open} prefs={prefs} setPrefs={setPrefs} />
              </WindowFrame>
            )
          })}
          <Dock openIds={state.wins.map((w) => w.app)} onOpen={open} magnify={prefs.dockMagnify} />
          {spot && (
            <Spotlight
              onClose={() => setSpot(false)}
              onSubmit={(q) => {
                setSpot(false)
                open('inspector', { query: q })
              }}
            />
          )}
          <p className="os-demo-badge">DEMO · no keys requested · Tor simulated</p>
        </>
      )}
    </div>
  )
}
