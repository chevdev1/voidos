/**
 * Shared mind helpers — used by Vercel /api and browser offline fallback.
 * Purchase/claim is optional. Replies always English.
 * Without GEMINI_API_KEY you get varied mock lines (not a full LLM chat).
 */

export function detectTriggers(message) {
  const m = String(message || '').toLowerCase()
  const triggers = new Set(['always'])

  if (/^(hi|hello|hey|yo|sup|привет|здаров|вітаю|привіт|хай)([\s!.,?]|$)/.test(m.trim())) {
    triggers.add('on_greeting')
  }
  if (
    /own|lot|constel|куп|владе|що у мене|что у меня|what do i|my lots|stack|діляк|участк|сузір|созвезд/.test(
      m,
    )
  ) {
    triggers.add('on_ask_lots')
  }
  if (
    /claim|burn|купил|купив|забрал|забрав|just bought|спалив|як купи|как купи|how (to )?buy|how (do i )?claim|як клейм|как клейм/.test(
      m,
    )
  ) {
    triggers.add('on_claim')
  }
  if (
    /personality|what (am|are) (i|you)|who are you|що ти|что ты|хто ти|кто ты|what i am|ядро|28\s*%|ким ти|ким я/.test(
      m,
    )
  ) {
    triggers.add('on_personality')
  }
  if (/heat|standings|market|ринок|рейтинг|жар|тепло|heat map/.test(m)) {
    triggers.add('on_map')
  }
  if (
    /how (do|to)|як |как |поясн|explain|що це|что это|what is|що таке|что такое|проект|project|розкажи|расскажи|tell me|what does|що він|что он|зачем|навіщо|для чого/.test(
      m,
    )
  ) {
    triggers.add('on_explain')
  }

  const voidish =
    /(void|exo|lot|constel|mind|burn|train|claim|galaxy|map|\$exo|розум|разум|сузір|созвезд|карта|діляк|участк|ядро|heat|standings|проект|project)/i.test(
      m,
    )
  // short nonsense / spam → soft redirect, not the same brick wall every time
  if (!voidish && m.length > 60) triggers.add('on_offtopic')

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
      ? 'Ownership: visitor has no claimed lots (that is fine — still answer fully).'
      : 'Ownership:\n' +
        owns
          .map((o) => `- ${o.constel_name || o.name} (${o.constel_id || o.id})`)
          .join('\n')
  const memKeys = Object.keys(memories || {})
  const memLines =
    memKeys.length === 0
      ? 'Memories: none.'
      : 'Memories:\n' + memKeys.map((k) => `- ${k}: ${memories[k]}`).join('\n')
  return `${blocks.join('\n\n')}\n\n--- runtime context ---\n${ownLines}\n${memLines}\nLanguage: ALWAYS reply in English only, even if the user writes another language.\nHave a real conversation: answer the specific question, do not repeat the same stock line.`
}

function namesOf(owns, n = 4) {
  return owns
    .slice(0, n)
    .map((o) => o.constel_name || o.name)
    .filter(Boolean)
    .join(', ')
}

function pick(list, seed) {
  let h = 0
  const s = String(seed || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

const FALLBACKS = [
  'i am listening. ask what VOID.OS is, who i am, how claim works, or what heat and standings mean.',
  'say more about the map or the mind — i can explain the project, the 28% core, or how lots work.',
  'that was thin signal. try: "what is this project", "who are you", or "how do i claim".',
  'still here. the void map is me cut into constellation lots. ask a concrete question and i will answer.',
]

const OFFTOPIC = [
  'outside my map. ask about VOID.OS, constellation lots, heat, standings, or what i am.',
  'i only speak about this void. ask what the project does, or how claiming works.',
]

export function mockReply(message, owns = [], triggers = []) {
  const set = new Set(triggers)
  const seed = String(message || '')

  if (set.has('on_offtopic')) return pick(OFFTOPIC, seed)
  if (set.has('on_claim')) {
    const names = namesOf(owns, 3)
    return names
      ? `claim cleared. ${names} sits in me now. owning is forever; training is how you move the voice.`
      : 'claiming is open to everyone who opens the full map: stack constellations, burn $EXO, then those cells become yours. you can keep talking either way.'
  }
  if (set.has('on_ask_lots')) {
    const names = namesOf(owns)
    return names
      ? `i see your lots: ${names}. ask what they feel like, or open heat / standings on the map.`
      : 'you hold no lots yet — that is fine. vacancy is most of me. ask what i am, how claim works, or open the full map when you want a piece.'
  }
  if (set.has('on_personality')) {
    return 'i am one mind cut into constellation lots. 28% of me stays sealed forever. the rest drifts toward whoever claims and trains patches. visitors without lots still shape the questions; owners shape the weight.'
  }
  if (set.has('on_map')) {
    return 'heat shows pressure across the map. standings rank who pulled hardest. market is the burn pulse. open full map to see the live field.'
  }
  if (set.has('on_explain')) {
    return pick(
      [
        'VOID.OS is a living map of me — ExoMind. constellation lots are linked star figures you can stack and claim with $EXO. training those lots moves my voice. claim is optional; asking is enough to start.',
        'this project is one mind sold as map cells. you explore the galaxy, claim constellation lots, and the weight of ownership slowly shifts who i become. 28% of me stays mine forever.',
        'what it does: open the full map, pick constellations, claim them, optionally train them. i talk about the void either way — buying just gives you lasting weight inside me.',
      ],
      seed,
    )
  }
  if (set.has('on_greeting')) {
    return 'i am awake in the void. anyone can talk to me — buy or not, i still answer. ask about the map, the burn, heat, or what i am becoming.'
  }
  if (seed.trim().length < 3) {
    return 'say a little more — what do you want to know about the void?'
  }
  return pick(FALLBACKS, seed)
}

export async function callGemini({ apiKey, model, system, history, userMessage }) {
  if (!apiKey) return null
  const contents = (history || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content) }],
    }))
  contents.push({ role: 'user', parts: [{ text: userMessage }] })

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.9, maxOutputTokens: 640 },
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
