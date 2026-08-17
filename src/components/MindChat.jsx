import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import '../legacy/void.css'
import { mindSession, mindChat, loadHistory, loadOwnerships, loadUser } from '../lib/mindClient'
import { buildLotProfile } from '../../shared/lotLore.js'

/**
 * voidmind chat — replies only when the visitor sends a message (or cabinet prefill).
 */
export function MindChat() {
  const [open, setOpen] = useState(false)
  const [ownerships, setOwnerships] = useState(() => loadOwnerships())
  const [account, setAccount] = useState(() => loadUser())
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [live, setLive] = useState(true)
  const [messages, setMessages] = useState(() => {
    const hist = loadHistory()
    if (hist.length) return hist
    return []
  })
  const scroller = useRef(null)

  useEffect(() => {
    window.__openMindChat = () => setOpen(true)
    window.__closeMindChat = () => setOpen(false)
    return () => {
      delete window.__openMindChat
      delete window.__closeMindChat
    }
  }, [])

  // Central pause point: this modal is a full-viewport overlay (see
  // .mind-chat in void.css — position:fixed; inset:0), so whenever it's
  // open the hero cosmos canvas underneath is fully hidden regardless of
  // which button opened it (nav link, hero prompt card, the demo's own
  // "ask me" button, etc.) — no reason to spend a render loop on something
  // nothing can see. Deliberately doesn't resume on close: per spec, the
  // hero demo only comes back via its own explicit "keep spinning this
  // one" action, not implicitly just because an overlay went away.
  useEffect(() => {
    if (open) window.__voidCosmos?.pauseDemo?.()
    else window.__voidCosmos?.resumeDemo?.()
  }, [open])

  async function runChat(text) {
    const trimmed = String(text || '').trim()
    if (!trimmed || busy) return
    setMessages((m) => [...m, { role: 'user', content: trimmed }])
    setBusy(true)
    try {
      const data = await mindChat(trimmed)
      if (data.ownerships) setOwnerships(data.ownerships)
      if (data.user) setAccount(data.user)
      if (typeof data.live === 'boolean') setLive(data.live)
      const reply = data.reply || data.error || 'silence from the void.'
      if (Array.isArray(data.history) && data.history.length) {
        setMessages(data.history)
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: reply }])
      }
    } catch {
      setLive(false)
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'the signal thinned out mid-thought. give me a moment and ask again.',
        },
      ])
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const base = import.meta.env.VITE_MIND_API_URL
          ? String(import.meta.env.VITE_MIND_API_URL).replace(/\/$/, '')
          : ''
        const hr = await fetch(`${base}/api/health`, { credentials: 'include' })
        const hj = await hr.json().catch(() => ({}))
        if (!cancelled && typeof hj.gemini === 'boolean') setLive(hj.gemini)
      } catch {
        /* health is optional — chat still works */
      }

      const data = await mindSession()
      if (cancelled) return
      const owns = data.ownerships || []
      setOwnerships(owns)
      setAccount(data.user || null)

      if (Array.isArray(data.history) && data.history.length) {
        setMessages(data.history)
      }

      let pre = ''
      try {
        pre = sessionStorage.getItem('void_mind_prefill') || ''
        if (pre) sessionStorage.removeItem('void_mind_prefill')
      } catch {
        /* ignore */
      }

      // Only respond when the visitor explicitly asked (cabinet star/lot chip).
      if (pre) {
        setStatus('reading your signal…')
        await runChat(pre)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, busy])

  async function send(e) {
    e?.preventDefault?.()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    await runChat(text)
  }

  if (!open) return null

  return (
    <div className="mind-chat" role="dialog" aria-modal="true" aria-label="ask the mind">
      {/* Mobile-only: the in-card ✕ sits under the fixed nav header (nav is
          z-[200], this modal is z-140) once the card goes full-height below
          768px, so it's effectively unreachable there. This floats above
          the nav instead. Desktop keeps just the in-card ✕. */}
      <button
        type="button"
        className="mind-chat-x-float"
        onClick={() => setOpen(false)}
        aria-label="close ask the mind"
      >
        ✕
      </button>

      <div className="mind-chat-card">
        <div className="mind-chat-top">
          <div>
            <div className="mind-chat-title">ask the mind</div>
            <div className="mind-chat-sub">
              {account?.wallet
                ? `${account.wallet.slice(0, 6)}…${account.wallet.slice(-4)}`
                : 'connect wallet'}
              {ownerships.length
                ? ` · ${ownerships.length} lots yours`
                : ' · talk freely'}
              {!live ? ' · signal degraded' : ''}
              {status ? ` · ${status}` : ''}
            </div>
          </div>
          <button type="button" className="mind-chat-x" onClick={() => setOpen(false)} aria-label="close">
            ✕
          </button>
        </div>

        {ownerships.length > 0 && (
          <div className="mind-chat-owns">
            {ownerships.slice(0, 8).map((o) => (
              <button
                key={o.constel_id}
                type="button"
                className="mind-chat-chip"
                disabled={busy}
                onClick={() => {
                  const p = buildLotProfile(o)
                  setInput(`go deeper on my lot ${p.name} — kind, stars, what it does to your voice`)
                }}
              >
                ✧ {o.constel_name}
              </button>
            ))}
          </div>
        )}

        <div className="mind-chat-log" ref={scroller}>
          <AnimatePresence initial={false}>
            {!messages.length && !busy ? (
              <p className="mind-chat-hint">say something — i'll talk. i wait until you do.</p>
            ) : null}
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                className={`mind-chat-msg ${m.role}`}
              >
                <span className="who">{m.role === 'user' ? 'you' : 'voidmind'}</span>
                <p>{m.content}</p>
              </motion.div>
            ))}
            {busy && (
              <motion.div
                key="busy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mind-chat-msg assistant"
              >
                <span className="who">voidmind</span>
                {status && status !== 'listening…' ? (
                  <p>{status}</p>
                ) : (
                  <p className="mind-listening" aria-label="listening">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form className="mind-chat-form" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              ownerships.length
                ? 'talk — lots, stars, or anything on your mind…'
                : 'talk to the mind…'
            }
            disabled={busy}
            autoComplete="off"
          />
          <button type="submit" className="btn-lime" disabled={busy || !input.trim()}>
            {busy ? '…' : 'send'}
          </button>
        </form>
      </div>
    </div>
  )
}
