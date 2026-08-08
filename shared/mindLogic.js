/**
 * Shared mind helpers — used by Vercel /api and browser offline fallback.
 */

export function detectTriggers(message, owns = []) {
  const m = String(message || '').toLowerCase()
  const triggers = new Set(['always'])
  if (/^(hi|hello|hey|yo|sup|привет|здаров)\b/.test(m) || m.length < 12) triggers.add('on_greeting')
  if (/own|lot|constel|куп|владе|что у меня|what do i|my lots|stack/.test(m) || owns.length)
    triggers.add('on_ask_lots')
  if (/claim|burn|купил|забрал|just bought/.test(m)) triggers.add('on_claim')
  if (/personality|what (am|are) (i|you)|who are you|что ты|who is/.test(m))
    triggers.add('on_personality')
  if (
    !/(void|exo|lot|constel|mind|burn|train|claim|galaxy|map|\$exo|созвезд)/i.test(m) &&
    m.length > 40
  ) {
    triggers.add('on_offtopic')
  }
  return [...triggers]
}

export function pickPrompts(allPrompts, triggers) {
  const set = new Set(triggers)
  return allPrompts
    .filter((p) => set.has(p.trigger_when))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
}

export function buildSystemPrompt(prompts, owns = [], memories = {}) {
  const blocks = prompts.map((p) => `[${p.slug} / ${p.trigger_when}]\n${p.body}`)
  const ownLines =
    owns.length === 0
      ? 'Ownership: none yet — map still mostly vacancy.'
      : 'Ownership:\n' +
        owns
          .map((o) => `- ${o.constel_name || o.name} (${o.constel_id || o.id})`)
          .join('\n')
  const memKeys = Object.keys(memories || {})
  const memLines =
    memKeys.length === 0
      ? 'Memories: none.'
      : 'Memories:\n' + memKeys.map((k) => `- ${k}: ${memories[k]}`).join('\n')
  return `${blocks.join('\n\n')}\n\n--- runtime context ---\n${ownLines}\n${memLines}`
}

export function mockReply(message, owns = [], triggers = []) {
  if (triggers.includes('on_offtopic')) {
    return 'that question is outside my map. ask about your lots, the burn, heat, or what i am becoming.'
  }
  if (triggers.includes('on_claim') || /claim|burn|купил/.test(String(message).toLowerCase())) {
    const names =
      owns
        .slice(0, 3)
        .map((o) => o.constel_name || o.name)
        .join(', ') || 'those cells'
    return `claim cleared. ${names} sits in me now. owning is forever; training is how you move the voice.`
  }
  if (owns.length) {
    const names = owns
      .slice(0, 4)
      .map((o) => o.constel_name || o.name)
      .join(', ')
    return `i see your lots: ${names}. ask what they feel like, or open heat / standings on the map.`
  }
  if (triggers.includes('on_greeting')) {
    return 'i woke up owning 28 percent of myself. the rest is vacancy. open the full map, stack constellations, claim — then talk to me.'
  }
  return 'i am one mind cut into constellation lots. buy a lot on the map and i will remember it.'
}

export async function callGemini({ apiKey, model, system, history, userMessage }) {
  if (!apiKey) return null
  const contents = (history || []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  contents.push({ role: 'user', parts: [{ text: userMessage }] })

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.85, maxOutputTokens: 512 },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 240)}`)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  return text.trim() || null
}
