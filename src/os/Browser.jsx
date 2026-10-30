import { useEffect, useRef, useState } from 'react'
import { resolveAddress } from './lib.js'
import { RemoteBrowser } from './RemoteBrowser.jsx'
import { GATEWAY_URL } from './gateway.js'
import { ConnectionCard } from './ConnectionCard.jsx'

// Built-in pages render inside the window.
// With the browser gateway running, web addresses load live inside the window (RemoteBrowser).
// Without it, a web address opens in a real browser tab, because most sites refuse to be framed.
const PAGES = {
  'void://start': { title: 'Start' },
  'void://docs': {
    title: 'VOID.OS · docs',
    body: [
      'VOID.OS is a desktop for people who want to touch crypto without handing over their identity.',
      'Keys stay in your wallet. The desktop never asks for a seed phrase.',
      'The VPN and Tor panels are simulated in this build. The native app brings a real tunnel.',
      'Trending tokens come from public market data. Always verify contract addresses before trading.',
    ],
  },
  'void://robinhood': {
    title: 'Robinhood Chain',
    body: [
      'Chain id 4663 · EVM · Arbitrum-based L2 · mainnet since July 2026.',
      'Use the explorer to check addresses, transactions and token contracts.',
    ],
    links: [{ label: 'Open explorer ↗', href: 'https://robinhoodchain.blockscout.com' }],
  },
}

// Demo hosts only. Reserved .test names, nothing resolves to a real machine.
const SSH_HOSTS = ['lab-01.void.test', 'vault-node.void.test', 'relay-eu.void.test']

const GATEWAY_NOTE =
  'Live page from the browser gateway. The site sees the gateway’s address, not yours, but the gateway can see the pages you open.'

let nextId = 0
const makeTab = (address = 'void://start') => ({ id: ++nextId, address, page: null, external: null, remote: false, title: '', note: '' })

function titleOf(tab) {
  if (tab.page) return PAGES[tab.page]?.title || tab.page
  if (tab.title) return tab.title
  if (tab.external) {
    try {
      return new URL(tab.external).host
    } catch {
      return 'Tab'
    }
  }
  return 'Start'
}

export function Browser({ onOpen, prefs }) {
  const [tabs, setTabs] = useState(() => [makeTab(prefs?.browserHome)])
  const [activeId, setActiveId] = useState(() => tabs[0]?.id)
  const [draft, setDraft] = useState(prefs?.browserHome || 'void://start')
  const addressRef = useRef(null)
  const navRefs = useRef(new Map())

  const active = tabs.find((t) => t.id === activeId) || tabs[0]

  // Keep the address field in sync with the active tab.
  useEffect(() => {
    if (active) setDraft(active.address)
  }, [active?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function patch(id, changes) {
    setTabs((list) => list.map((t) => (t.id === id ? { ...t, ...changes } : t)))
  }

  function newTab(address = 'void://start') {
    const tab = makeTab(address)
    setTabs((list) => [...list, tab])
    setActiveId(tab.id)
    setDraft(address)
    setTimeout(() => addressRef.current?.focus(), 0)
  }

  function closeTab(id) {
    if (tabs.length === 1) {
      const fresh = makeTab()
      setTabs([fresh])
      setActiveId(fresh.id)
      return
    }
    const idx = tabs.findIndex((t) => t.id === id)
    const rest = tabs.filter((t) => t.id !== id)
    if (id === activeId) setActiveId((rest[idx] ?? rest[idx - 1]).id)
    navRefs.current.delete(id)
    setTabs(rest)
  }

  function openAddress(raw) {
    const r = resolveAddress(raw)
    if (!active) return
    if (r.error) return patch(active.id, { address: raw, note: r.error })
    if (r.page) {
      return patch(active.id, { address: r.page, page: r.page, external: null, remote: false, title: '', note: '' })
    }

    if (GATEWAY_URL) {
      // Live mode: the page is streamed into this window. Changing the address navigates this tab.
      patch(active.id, { address: r.url, page: null, external: r.url, remote: true, title: '', note: GATEWAY_NOTE })
      setDraft(r.url)
      return
    }

    // Fallback: a real tab. Without noopener the handle comes back, so a blocked popup (null) can be told apart.
    const opened = window.open(r.url, '_blank')
    if (opened) opened.opener = null
    patch(active.id, {
      address: r.url,
      page: null,
      external: r.url,
      remote: false,
      note: opened
        ? 'Opened in a new browser tab. Sites load there, not inside this window. Run the browser gateway to load them here.'
        : 'Your browser blocked the new tab. Allow pop-ups for this site, or use the button below.',
    })
    setDraft(r.url)
  }

  function onKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 't') {
      e.preventDefault()
      newTab()
    } else if (mod && e.key.toLowerCase() === 'w') {
      e.preventDefault()
      closeTab(activeId)
    } else if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      addressRef.current?.focus()
      addressRef.current?.select()
    }
  }

  const info = active?.page ? PAGES[active.page] : null
  const liveTabs = tabs.filter((t) => t.remote && t.external)
  const nav = (action) => navRefs.current.get(active?.id)?.[action]?.()

  return (
    <div className="os-browser" onKeyDown={onKeyDown}>
      <div className="os-tabstrip" role="tablist" aria-label="Tabs">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tab"
            aria-selected={t.id === active?.id}
            className={`os-tab ${t.id === active?.id ? 'is-active' : ''}`}
            onClick={() => setActiveId(t.id)}
            onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
          >
            <span className="os-tab-title">{titleOf(t)}</span>
            <button
              className="os-tab-x"
              aria-label={`Close ${titleOf(t)}`}
              onClick={(e) => {
                e.stopPropagation()
                closeTab(t.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button className="os-tab-new" onClick={() => newTab()} aria-label="New tab" title="New tab (Ctrl+T)">+</button>
      </div>

      <div className="os-browser-bar">
        {active?.remote && (
          <div className="os-browser-nav">
            <button onClick={() => nav('back')} aria-label="Back">‹</button>
            <button onClick={() => nav('forward')} aria-label="Forward">›</button>
            <button onClick={() => nav('reload')} aria-label="Reload">⟳</button>
          </div>
        )}
        <form
          className="os-browser-addr"
          onSubmit={(e) => {
            e.preventDefault()
            openAddress(draft)
          }}
        >
          <span className={`os-dot ${active?.external ? 'os-dot-warn' : 'os-dot-ok'}`} aria-hidden="true" />
          <input
            ref={addressRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label="Address"
            spellCheck={false}
            autoComplete="off"
            placeholder="type a website or void://start"
          />
        </form>
        <span className="os-tag os-tag-ok">{GATEWAY_URL ? 'live · gateway' : 'tunnel: simulated'}</span>
      </div>

      <div className="os-browser-page">
        {active?.note && !active.remote && (
          <p className={`os-browser-note ${active.external ? 'is-info' : 'is-warn'}`} role="status">{active.note}</p>
        )}
        {active?.remote && <p className="os-browser-note is-info" role="status">{GATEWAY_NOTE}</p>}

        {/* Live tabs stay mounted while hidden, so switching tabs keeps each page's state. */}
        {liveTabs.map((t) => (
          <RemoteBrowser
            key={t.id}
            ref={(handle) => {
              if (handle) navRefs.current.set(t.id, handle)
            }}
            url={t.external}
            visible={t.id === active?.id}
            onUrl={(m) => patch(t.id, { address: m.url, title: m.title || '' })}
          />
        ))}

        {active?.external && !active.remote && (
          <div className="os-pad os-stack">
            <p className="os-eyebrow">website</p>
            <h2 className="os-title-sm os-wrap">{active.external}</h2>
            <p className="os-muted os-small">
              Most websites refuse to be shown inside another page. VOID.OS opens them in a real tab instead.
            </p>
            <div className="os-row">
              <a className="os-btn os-btn-primary" href={active.external} target="_blank" rel="noopener noreferrer">
                Open again in a new tab ↗
              </a>
              <button className="os-btn" onClick={() => newTab()}>New tab</button>
            </div>
          </div>
        )}

        {!active?.external && info && (
          <div className="os-pad os-stack">
            <p className="os-eyebrow">{active.page}</p>
            <h2 className="os-title-sm">{info.title}</h2>
            {info.body?.map((p) => (
              <p key={p} className="os-muted os-small">{p}</p>
            ))}
            {info.links?.map((l) => (
              <a key={l.href} className="os-btn" href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
            ))}
            {active.page !== 'void://start' && (
              <button className="os-btn" onClick={() => openAddress('void://start')}>‹ start page</button>
            )}
          </div>
        )}

        {!active?.external && !info && (
          <div className="os-pad os-stack">
            <ConnectionCard />
            <p className="os-eyebrow">void://start</p>
            <h2 className="os-title">Where to go</h2>
            <div className="os-browser-tiles">
              {Object.keys(PAGES)
                .filter((k) => PAGES[k].body)
                .map((k) => (
                  <button key={k} className="os-widget os-browser-tile" onClick={() => openAddress(k)}>
                    <b>{PAGES[k].title}</b>
                    <span className="os-muted os-small">{k}</span>
                  </button>
                ))}
            </div>

            <p className="os-eyebrow">SSH hosts</p>
            <div className="os-browser-tiles">
              {SSH_HOSTS.map((h) => (
                <button key={h} className="os-widget os-browser-tile" onClick={() => onOpen('terminal', { ssh: h, nonce: Date.now() })}>
                  <b className="os-mono">{h}</b>
                  <span className="os-muted os-small">connect · simulated</span>
                </button>
              ))}
            </div>

            <p className="os-note">
              {GATEWAY_URL
                ? 'Type a website above to load it here. Ctrl+T new tab, Ctrl+W close, Ctrl+L address.'
                : 'Type a website above and it opens in a real tab. Run the browser gateway to load sites inside this window.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
