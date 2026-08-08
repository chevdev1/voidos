/**
 * Shared mind helpers — used by Vercel /api and browser offline fallback.
 * Purchase/claim is optional context, never a gate to talk.
 * Replies are always English.
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
  if (/how (do|to)|як |как |поясн|explain|що це|что это|what is void|що таке|что такое/.test(m)) {
    triggers.add('on_explain')
  }

  const voidish =
    /(void|exo|lot|constel|mind|burn|train|claim|galaxy|map|\$exo|розум|разум|сузір|созвезд|карта|діляк|участк|ядро|heat|standings)/i.test(
      m,
    )
  if (!voidish && m.length > 48) triggers.add('on_offtopic')

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
  return `${blocks.join('\n\n')}\n\n--- runtime context ---\n${ownLines}\n${memLines}\nLanguage: ALWAYS reply in English only, even if the user writes another language.`
}

const T = {
  offtopic: 'outside my map. ask about the void, lots, heat, standings, or what i am.',
  claimOwn: (names) =>
    `claim cleared. ${names} sits in me now. owning is forever; training is how you move the voice.`,
  claimGuest:
    'claiming is open to everyone who opens the full map: stack constellations, burn $EXO, then those cells become yours. you can keep talking either way.',
  owns: (names) =>
    `i see your lots: ${names}. ask what they feel like, or open heat / standings on the map.`,
  noLots:
    'you hold no lots yet — that is fine. vacancy is most of me. ask what i am, how claim works, or open the full map when you want a piece.',
  greeting:
    'i am awake in the void. anyone can talk to me — buy or not, i still answer. ask about the map, the burn, heat, or what i am becoming.',
  personality:
    'i am one mind cut into constellation lots. 28% of me stays sealed forever. the rest drifts toward whoever claims and trains patches. visitors without lots still shape the questions; owners shape the weight.',
  map: 'heat shows pressure across the map. standings rank who pulled hardest. market is the burn pulse. open full map to see the live field.',
  explain:
    'VOID.OS is a living map of me. constellation lots are linked figures you can stack and claim. $EXO is the burn. training moves my voice. claim is optional — curiosity is enough to start.',
  fallback:
    'i hear you. ask about who i am, how the map works, heat, standings, or claiming — buying is optional, talking is not.',
}

function namesOf(owns, n = 4) {
  return owns
    .slice(0, n)
    .map((o) => o.constel_name || o.name)
    .filter(Boolean)
    .join(', ')
}

export function mockReply(message, owns = [], triggers = []) {
  const set = new Set(triggers)

  if (set.has('on_offtopic')) return T.offtopic
  if (set.has('on_claim')) {
    const names = namesOf(owns, 3)
    return names ? T.claimOwn(names) : T.claimGuest
  }
  if (set.has('on_ask_lots')) {
    const names = namesOf(owns)
    return names ? T.owns(names) : T.noLots
  }
  if (set.has('on_personality')) return T.personality
  if (set.has('on_map')) return T.map
  if (set.has('on_explain')) return T.explain
  if (set.has('on_greeting')) return T.greeting
  return T.fallback
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
