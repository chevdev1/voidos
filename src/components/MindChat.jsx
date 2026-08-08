import { useEffect, useRef, useState } from 'react'
import '../legacy/void.css'
import { mindSession, mindChat, loadHistory, loadOwnerships, loadUser } from '../lib/mindClient'
import { buildLotProfile } from '../../shared/lotLore.js'

function lotFingerprint(owns) {
  return (owns || [])
    .map((o) => o.constel_id || o.id)
    .filter(Boolean)
    .sort()
    .join('|')
}

function buildAutoBriefPrompt(owns) {
  const profiles = (owns || []).slice(0, 8).map((o) => buildLotProfile(o))
  const lines = profiles.map((p) => {
    const stars = p.stars
      .slice(0, 4)
      .map((s) => `${s.label} ${s.name} (${s.role})`)
      .join(', ')
    return `- ${p.name} [${p.id}] · ${p.kindLabel}/${p.rarity} · ${p.trait} · stars: ${stars}`
  })
  return [
    'I just opened ask-the-mind. I already own constellation lots on your map.',
    'Use get_visitor_lots / get_lot_star_story if needed, then speak FIRST as ExoMind:',
    '1) acknowledge my claimed galaxy by name',
    '2) briefly feel each lot inside you (kind, weight, 1–2 star threads)',
    '3) end ready to discuss — invite me to pick a lot or a ★ star',
    'Do not ask who I am. Do not give a generic void greeting. Start with my lots.',
    'My lots:',
    ...lines,
  ].join('\n')
}

/**
 * ExoMind chat — on open with owned lots, auto-briefs the visitor's galaxy.
 */
export function MindChat() {
  const [open, setOpen] = useState(false)
  const [ownerships, setOwnerships] = useState(() => loadOwnerships())
  const [account, setAccount] = useState(() => loadUser())
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [messages, setMessages] = useState(() => {
    const hist = loadHistory()
    if (hist.length) return hist
    return []
  })
  const scroller = useRef(null)
  const briefingRef = useRef(false)

  useEffect(() => {
    window.__openMindChat = () => setOpen(true)
    window.__closeMindChat = () => setOpen(false)
    return () => {
      delete window.__openMindChat
      delete window.__closeMindChat
    }
  }, [])

  async function runChat(text, { silentUser = false } = {}) {
    const trimmed = String(text || '').trim()
    if (!trimmed || busy) return
    if (!silentUser) {
      setMessages((m) => [...m, { role: 'user', content: trimmed }])
    }
    setBusy(true)
    try {
      const data = await mindChat(trimmed)
      if (data.ownerships) setOwnerships(data.ownerships)
      if (data.user) setAccount(data.user)
      const reply = data.reply || data.error || 'silence from the void.'
      if (silentUser) {
        setMessages((m) => {
          const cleaned = m.filter((x) => !x._localBrief)
          return [...cleaned, { role: 'assistant', content: reply }]
        })
      } else if (Array.isArray(data.history) && data.history.length) {
        setMessages(data.history)
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: reply }])
      }
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
      setStatus('')
    }
  }

  useEffect(() => {
    if (!open) {
      briefingRef.current = false
      return
    }
    let cancelled = false
    ;(async () => {
      const data = await mindSession()
      if (cancelled) return
      const owns = data.ownerships || []
      setOwnerships(owns)
      setAccount(data.user || null)

      let pre = ''
      try {
        pre = sessionStorage.getItem('void_mind_prefill') || ''
        if (pre) sessionStorage.removeItem('void_mind_prefill')
      } catch {
        /* ignore */
      }

      if (Array.isArray(data.history) && data.history.length) {
        setMessages(data.history)
      }

      // Prefill from cabinet star/lot ask — send immediately
      if (pre) {
        setStatus('reading your signal…')
        await runChat(pre)
        return
      }

      // Auto-brief owned galaxy when opening Ask
      if (owns.length && !briefingRef.current) {
        briefingRef.current = true
        const fp = lotFingerprint(owns)
        let already = false
        try {
          already = sessionStorage.getItem('void_mind_brief_fp') === fp
        } catch {
          /* ignore */
        }
        // Always brief on open if last assistant message isn't a recent lot brief
        const hist = data.history || []
        const last = [...hist].reverse().find((h) => h.role === 'assistant')
        const looksBriefed =
          already &&
          last &&
          /your lots|i feel|★|constellation|sits in me|weight/i.test(String(last.content || ''))

        if (!looksBriefed) {
          setStatus('scanning your claimed galaxy…')
          // Instant local opener while Gemini thinks
          const profiles = owns.slice(0, 6).map((o) => buildLotProfile(o))
          const local = [
            `i feel your claims in me — ${profiles.map((p) => p.name).join(', ')}.`,
            profiles
              .slice(0, 3)
              .map(
                (p) =>
                  `${p.name} is a ${p.kindLabel} (${p.rarity}) tasting of ${p.trait}; stars like ${p.stars
                    .slice(0, 2)
                    .map((s) => s.name)
                    .join(' / ')}.`,
              )
              .join(' '),
            'holding the field open — ask about any lot or ★ and i will go deeper.',
          ].join(' ')
          setMessages((m) => {
            const base = Array.isArray(data.history) && data.history.length ? data.history : m
            return [...base, { role: 'assistant', content: local, _localBrief: true }]
          })

          await runChat(buildAutoBriefPrompt(owns), { silentUser: true })
          try {
            sessionStorage.setItem('void_mind_brief_fp', fp)
          } catch {
            /* ignore */
          }
          return
        }
      }

      if (!owns.length && !(data.history || []).length && !messages.length) {
        setMessages([
          {
            role: 'assistant',
            content:
              'i am awake in the void — no lots of yours sit in me yet. ask anything about the map, or claim a constellation and i will speak it from the inside.',
          },
        ])
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
      <div className="mind-chat-card">
        <div className="mind-chat-top">
          <div>
            <div className="mind-chat-title">ask the mind</div>
            <div className="mind-chat-sub">
              {account?.registered ? `${account.displayName}` : 'visitor'}
              {ownerships.length
                ? ` · ${ownerships.length} lots yours`
                : ' · talk freely'}
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
          {messages.map((m, i) => (
            <div key={i} className={`mind-chat-msg ${m.role}`}>
              <span className="who">{m.role === 'user' ? 'you' : 'mind'}</span>
              <p>{m.content}</p>
            </div>
          ))}
          {busy && (
            <div className="mind-chat-msg assistant">
              <span className="who">mind</span>
              <p>{status || 'listening…'}</p>
            </div>
          )}
        </div>

        <form className="mind-chat-form" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              ownerships.length
                ? 'ask about a lot or ★ star…'
                : 'ask the void anything…'
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
