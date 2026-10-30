import { useEffect, useRef, useState } from 'react'
import { TypeText } from './TypeText.jsx'

// VOID.AI pretest. No model is called from the browser: the Gemini key must stay on the server.
// Integration point: POST /api/os-ai { messages } -> { reply }, a serverless route next to
// api/chat.js (which already calls Gemini with GEMINI_API_KEY). Until that route exists,
// answers come from the canned table below.
const CANNED = [
  { match: /wallet|кошел/i, reply: 'Wallets connect from the Wallet app. VOID.OS never asks for a seed phrase or a private key.' },
  { match: /vpn|tor|тор|анон/i, reply: 'The VPN panel is simulated in this build. Real tunnels and Tor circuits come with the native app.' },
  { match: /token|токен|market|рынок/i, reply: 'Market lists trending tokens on Robinhood Chain. Always check the contract address in the explorer before you trade.' },
  { match: /ssh/i, reply: 'SSH in this build is a simulated shell. A real connection goes through a WebSocket gateway, so the browser never holds your key.' },
]
const FALLBACK = 'Pretest mode. I answer a few questions about VOID.OS for now. The full model arrives with the next build.'

const CHIPS = ['What can VOID.OS do?', 'How does the VPN work?', 'Is my wallet safe?', 'Show trending tokens']

function answer(q) {
  return CANNED.find((c) => c.match.test(q))?.reply || FALLBACK
}

export function VoidAi({ payload }) {
  const [msgs, setMsgs] = useState([
    { role: 'ai', text: 'VOID.AI is in pretest. Ask about wallets, the VPN, SSH or the market.' },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scroller = useRef(null)
  const timer = useRef(null)

  function send(text) {
    const q = text.trim()
    if (!q || thinking) return
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setThinking(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setMsgs((m) => [...m, { role: 'ai', text: answer(q), fresh: true }])
      setThinking(false)
    }, 700 + Math.min(900, q.length * 12))
  }

  // Opened from Terminal with `ai <question>`.
  useEffect(() => {
    if (payload?.query) send(payload.query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.nonce])

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, thinking])

  return (
    <div className="os-ai">
      <div className="os-ai-head">
        <div className="os-ai-mark" aria-hidden="true">✦</div>
        <div>
          <div className="os-title-sm">VOID.AI</div>
          <div className="os-muted os-small">Gemini-powered assistant</div>
        </div>
        <span className="os-tag os-tag-warn os-ai-badge">SOON · PRETEST</span>
      </div>

      <div className="os-ai-log" ref={scroller} aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`os-ai-msg os-ai-${m.role}`}>
            {m.fresh ? <TypeText text={m.text} /> : m.text}
          </div>
        ))}
        {thinking && <div className="os-ai-msg os-ai-ai os-ai-typing" aria-label="thinking"><i /><i /><i /></div>}
      </div>

      <div className="os-ai-chips">
        {CHIPS.map((c) => (
          <button key={c} className="os-chip" onClick={() => send(c)} disabled={thinking}>{c}</button>
        ))}
      </div>

      <form
        className="os-ai-form"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input
          className="os-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask VOID.AI…"
          aria-label="Message VOID.AI"
          spellCheck={false}
        />
        <button className="os-btn os-btn-primary" type="submit" disabled={thinking || !input.trim()}>Send</button>
      </form>
      <p className="os-note">In pretest the answers are canned, and nothing you type is sent anywhere.</p>
    </div>
  )
}
