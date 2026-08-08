import { useEffect, useRef, useState } from 'react'
import '../legacy/void.css'
import { mindSession, mindChat, loadHistory, loadOwnerships } from '../lib/mindClient'

/**
 * ExoMind chat — works on Vercel (/api) or local mind server; falls back to offline local mind.
 */
export function MindChat() {
  const [open, setOpen] = useState(false)
  const [ownerships, setOwnerships] = useState(() => loadOwnerships())
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('—')
  const [messages, setMessages] = useState(() => {
    const hist = loadHistory()
    if (hist.length) return hist
    return [
      {
        role: 'assistant',
        content:
          'i am one mind cut into constellation lots. claim on the map — i will remember what you own. ask me something.',
      },
    ]
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

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const data = await mindSession()
      if (cancelled) return
      setOwnerships(data.ownerships || [])
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  async function send(e) {
    e?.preventDefault?.()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setBusy(true)
    try {
      const data = await mindChat(text)
      setMode(data.mode || '—')
      if (data.ownerships) setOwnerships(data.ownerships)
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: data.reply || data.error || 'silence from the void.',
        },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'something snagged in the void. try again in a moment.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="mind-chat" role="dialog" aria-modal="true" aria-label="ask the mind">
      <div className="mind-chat-card">
        <div className="mind-chat-top">
          <div>
            <div className="mind-chat-title">ask the mind</div>
            <div className="mind-chat-sub">
              mode <b>{mode}</b>
              {ownerships.length ? ` · ${ownerships.length} lots yours` : ' · no lots yet'}
            </div>
          </div>
          <button type="button" className="mind-chat-x" onClick={() => setOpen(false)} aria-label="close">
            ✕
          </button>
        </div>

        {ownerships.length > 0 && (
          <div className="mind-chat-owns">
            {ownerships.slice(0, 8).map((o) => (
              <span key={o.constel_id} className="mind-chat-chip">
                ✧ {o.constel_name}
              </span>
            ))}
          </div>
        )}

        <div className="mind-chat-log" ref={scroller}>
          {messages.map((m, i) => (
            <div key={i} className={`mind-chat-msg ${m.role}`}>
              <span className="who">{m.role === 'user' ? 'you' : 'mind'}</span>
              <p>{m.content}</p>
            </div>
          ))}
        </div>

        <form className="mind-chat-form" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ask about lots, burn, what you are…"
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
