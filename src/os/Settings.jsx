import { useMemo, useState } from 'react'
import { AppTile } from './AppTile.jsx'
import { savePrefs, clearPrefs, defaults, TEXT_SIZE_OPTIONS, HOME_OPTIONS } from './prefs.js'
import { GATEWAY_URL } from './gateway.js'
import {
  SettingsIcon,
  WelcomeIcon,
  InspectorIcon,
  BrowserIcon,
  VpnIcon,
  WalletIcon,
  CodeIcon,
  NetworkIcon,
  MarketIcon,
} from './icons.jsx'

// Each section is data: rows of kind 'switch' | 'segment' | 'info' | 'action'.
// Rows bind to a preference key, so adding a setting is one line here plus a default in prefs.js.
const SECTIONS = [
  {
    id: 'about',
    title: 'About',
    subtitle: 'This build of VOID.OS',
    grad: ['#c9ced8', '#7d8594'],
    Icon: WelcomeIcon,
    groups: [
      {
        title: 'VOID.OS',
        rows: [
          { kind: 'info', label: 'Version', value: '0.9.3 demo' },
          { kind: 'info', label: 'Status', value: 'Front-end demo. No keys are requested, no transactions are sent.' },
          { kind: 'info', label: 'Browser gateway', value: GATEWAY_URL ? 'Configured' : 'Not configured in this build' },
        ],
      },
    ],
  },
  {
    id: 'appearance',
    title: 'Appearance',
    subtitle: 'How the desktop looks',
    grad: ['#b59cff', '#6d4dff'],
    Icon: SettingsIcon,
    groups: [
      {
        title: 'Theme',
        rows: [
          { kind: 'info', label: 'Theme', value: 'VOID dark', hint: 'The landing also has aurora and night themes. The desktop keeps one look for now.' },
          { kind: 'switch', key: 'reduceTransparency', label: 'Reduce transparency', hint: 'Solid panels instead of blur. Helps on weaker machines.' },
        ],
      },
    ],
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    subtitle: 'Text, motion and focus',
    grad: ['#56a7ff', '#1d5fd1'],
    Icon: InspectorIcon,
    groups: [
      {
        title: 'Text',
        rows: [{ kind: 'segment', key: 'textSize', label: 'Text size', hint: 'Applies to the desktop and its apps.', options: TEXT_SIZE_OPTIONS }],
      },
      {
        title: 'Motion',
        rows: [
          { kind: 'switch', key: 'motion', label: 'Animations', hint: 'Turn off all motion. Also off when your system asks for reduced motion.' },
          { kind: 'info', label: 'Focus', value: 'Always visible', hint: 'Every control shows a ring when reached with the keyboard.' },
        ],
      },
    ],
  },
  {
    id: 'desktop',
    title: 'Desktop & Dock',
    subtitle: 'Wallpaper, widgets and the dock',
    grad: ['#9bf0c8', '#2fae7c'],
    Icon: MarketIcon,
    groups: [
      {
        title: 'Desktop',
        rows: [
          { kind: 'switch', key: 'wallpaper', label: 'Galaxy wallpaper', hint: 'The landing galaxy behind the windows. Off by default on weaker machines.' },
          { kind: 'switch', key: 'widgets', label: 'Widgets', hint: 'Clock and trending tokens on the left.' },
        ],
      },
      {
        title: 'Dock',
        rows: [{ kind: 'switch', key: 'dockMagnify', label: 'Magnification', hint: 'Icons grow as the pointer moves over the dock.' }],
      },
    ],
  },
  {
    id: 'browser',
    title: 'Browser',
    subtitle: 'Start page and live browsing',
    grad: ['#4aa8ff', '#1d6bf0'],
    Icon: BrowserIcon,
    groups: [
      {
        title: 'Start',
        rows: [{ kind: 'segment', key: 'browserHome', label: 'Start page', hint: 'The page a new browser window opens on.', options: HOME_OPTIONS }],
      },
      {
        title: 'Live browsing',
        rows: [
          {
            kind: 'info',
            label: 'Gateway',
            value: GATEWAY_URL ? 'Pages load inside the window' : 'Off. Web addresses open in a browser tab.',
            hint: 'Pages load on the gateway, so the site sees its address, not yours. The gateway can see the pages you open.',
          },
        ],
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy',
    subtitle: 'What this demo stores and how to clear it',
    grad: ['#7fe0a8', '#1fa86a'],
    Icon: VpnIcon,
    groups: [
      {
        title: 'On this device',
        rows: [
          { kind: 'info', label: 'Settings', value: 'localStorage, this browser only' },
          { kind: 'info', label: 'Code files', value: 'localStorage, this browser only' },
          { kind: 'action', label: 'Clear VOID.CODE files', hint: 'Removes your edits and restores the demo project.', action: 'clearCode' },
          { kind: 'action', label: 'Reset settings and reload', hint: 'Back to the defaults for this device.', action: 'resetAll', tone: 'danger' },
        ],
      },
      {
        title: 'What this demo does not do',
        rows: [
          { kind: 'info', label: 'Your IP and fingerprint', value: 'Not hidden by this demo' },
          { kind: 'info', label: 'Keys and seed phrases', value: 'Never requested' },
        ],
      },
    ],
  },
  {
    id: 'network',
    title: 'Network',
    subtitle: 'Tunnel status',
    grad: ['#3ddc97', '#0f9d6b'],
    Icon: NetworkIcon,
    groups: [
      {
        title: 'Tunnel',
        rows: [{ kind: 'info', label: 'VPN and Tor', value: 'Simulated in this build', hint: 'A real tunnel comes with the native app. The VPN panel shows the flow, nothing more.' }],
      },
    ],
  },
  {
    id: 'wallet',
    title: 'Wallet',
    subtitle: 'Networks and connection',
    grad: ['#5fe0b5', '#17a077'],
    Icon: WalletIcon,
    groups: [
      {
        title: 'Network',
        rows: [{ kind: 'info', label: 'Chain', value: 'Robinhood Chain · 4663', hint: 'Read-only in this demo. Signing happens in your own wallet app.' }],
      },
    ],
  },
  {
    id: 'code',
    title: 'Code',
    subtitle: 'VOID.CODE editor',
    grad: ['#4aa3ff', '#1565c0'],
    Icon: CodeIcon,
    groups: [
      {
        title: 'Sandbox',
        rows: [
          { kind: 'info', label: 'Run timeout', value: '2 seconds' },
          { kind: 'info', label: 'Network from scripts', value: 'Allowed', hint: 'Scripts can make web requests. Keep secrets out of files.' },
        ],
      },
    ],
  },
]

function Switch({ checked, onChange, label }) {
  return (
    <label className="os-ios">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span aria-hidden="true" />
    </label>
  )
}

function Segment({ value, options, onChange, label }) {
  return (
    <div className="os-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Settings({ prefs, setPrefs }) {
  const [active, setActive] = useState('appearance')
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')

  const set = (key) => (value) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    savePrefs(next)
  }

  const runAction = (action) => {
    if (action === 'clearCode') {
      try {
        localStorage.removeItem('void-code-files')
      } catch {
        /* ignore */
      }
      setNote('VOID.CODE files cleared. Open the editor to see the demo project.')
    }
    if (action === 'resetAll') {
      clearPrefs()
      setPrefs(defaults())
      window.location.reload()
    }
  }

  const q = query.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!q) return SECTIONS
    return SECTIONS.map((s) => ({
      ...s,
      groups: s.groups
        .map((g) => ({ ...g, rows: g.rows.filter((r) => `${r.label} ${r.hint || ''} ${s.title}`.toLowerCase().includes(q)) }))
        .filter((g) => g.rows.length),
    })).filter((s) => s.groups.length)
  }, [q])

  const section = SECTIONS.find((s) => s.id === active) || SECTIONS[0]
  const shown = q ? visible : [section]

  return (
    <div className="os-settings">
      <aside className="os-settings-side" aria-label="Settings sections">
        <input
          className="os-settings-search"
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search settings"
        />
        <nav>
          {(q ? visible : SECTIONS).map((s) => (
            <button
              key={s.id}
              className={`os-settings-item ${!q && active === s.id ? 'is-on' : ''}`}
              onClick={() => {
                setActive(s.id)
                setQuery('')
              }}
            >
              <AppTile Icon={s.Icon} grad={s.grad} size="sm" />
              <span>{s.title}</span>
            </button>
          ))}
          {q && !visible.length && <p className="os-muted os-small os-settings-empty">No settings match “{query}”.</p>}
        </nav>
      </aside>

      <main className="os-settings-main">
        {shown.map((s) => (
          <section key={s.id} className="os-settings-section" aria-labelledby={`st-${s.id}`}>
            <header>
              <h2 id={`st-${s.id}`}>{s.title}</h2>
              <p className="os-muted os-small">{s.subtitle}</p>
            </header>
            {s.groups.map((g) => (
              <div key={g.title} className="os-settings-group">
                <div className="os-label os-settings-group-title">{g.title}</div>
                <div className="os-settings-card">
                  {g.rows.map((r) => (
                    <div key={r.label} className="os-settings-row">
                      <div className="os-settings-text">
                        <span>{r.label}</span>
                        {r.hint && <span className="os-muted os-small">{r.hint}</span>}
                      </div>
                      <div className="os-settings-control">
                        {r.kind === 'switch' && (
                          <Switch checked={Boolean(prefs[r.key])} onChange={set(r.key)} label={r.label} />
                        )}
                        {r.kind === 'segment' && (
                          <Segment value={prefs[r.key]} options={r.options} onChange={set(r.key)} label={r.label} />
                        )}
                        {r.kind === 'info' && <span className="os-settings-value">{r.value}</span>}
                        {r.kind === 'action' && (
                          <button className={`os-btn ${r.tone === 'danger' ? 'os-btn-danger' : ''}`} onClick={() => runAction(r.action)}>
                            {r.label}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
        {note && <p className="os-note" role="status">{note}</p>}
      </main>
    </div>
  )
}
