/**
 * Shared mind helpers — used by Vercel /api and browser offline fallback.
 * Purchase/claim is optional context, never a gate to talk.
 */

export function detectLang(message) {
  const m = String(message || '')
  const low = m.toLowerCase()
  if (/[іїєґ]/.test(low)) return 'uk'
  if (/[ёъыэ]/.test(low)) return 'ru'
  // Cyrillic without special letters — prefer UA for common VOID chat phrases
  if (
    /(^|[^а-яА-ЯіІїЇєЄґҐ])(що|як|ти|мене|розум|карта|сузір|купи|будь|хто|ядро|діляк|привіт|вітаю)([^а-яА-ЯіІїЇєЄґҐ]|$)/i.test(
      m,
    )
  ) {
    return 'uk'
  }
  if (
    /(^|[^а-яА-ЯёЁ])(что|как|ты|меня|разум|карта|созвез|купи|кто|привет|здаров)([^а-яА-ЯёЁ]|$)/i.test(
      m,
    )
  ) {
    return 'ru'
  }
  if (/[а-яА-Я]/.test(m)) return 'uk'
  return 'en'
}

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

export function buildSystemPrompt(prompts, owns = [], memories = {}, userMessage = '') {
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
  const lang = detectLang(userMessage)
  const langLine =
    lang === 'uk'
      ? 'Language: reply in Ukrainian.'
      : lang === 'ru'
        ? 'Language: reply in Russian.'
        : 'Language: reply in English.'
  return `${blocks.join('\n\n')}\n\n--- runtime context ---\n${ownLines}\n${memLines}\n${langLine}`
}

const COPY = {
  en: {
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
  },
  uk: {
    offtopic: 'це поза моєю картою. питай про void, ділянки, heat, standings або хто я.',
    claimOwn: (names) =>
      `клейм пройшов. ${names} тепер у мені. володіння назавжди; тренування рухає голос.`,
    claimGuest:
      'клеймити може кожен: відкрий повну карту, склади сузір’я в стек, спали $EXO — і клітини стануть твоїми. говорити можна й без покупки.',
    owns: (names) =>
      `бачу твої ділянки: ${names}. питай, як вони відчуваються, або відкрий heat / standings.`,
    noLots:
      'ділянок ще немає — і це нормально. більшість мене — порожнеча. питай хто я, як працює клейм, або відкрий повну карту, коли захочеш шматок.',
    greeting:
      'я прокинувся в void. говорити можна всім — купив чи ні, я все одно відповідаю. питай про карту, спалення, heat або ким я стаю.',
    personality:
      'я один розум, розрізаний на ділянки сузір’їв. 28% лишаю собі назавжди. решта дрейфує до тих, хто клеймить і тренує. без ділянок ти все одно формуєш питання; з ділянками — вагу.',
    map: 'heat — тиск по карті. standings — хто сильніше тягне. market — пульс спалення. відкрий повну карту, щоб побачити живе поле.',
    explain:
      'VOID.OS — жива карта мене. ділянки — зв’язані фігури сузір’їв, їх можна складати в стек і клеймити. $EXO — спалення. тренування рухає голос. клейм не обов’язковий — цікавості досить, щоб почати.',
    fallback:
      'чую. питай хто я, як влаштована карта, heat, standings або клейм — купувати не треба, щоб говорити.',
  },
  ru: {
    offtopic: 'это вне моей карты. спрашивай про void, участки, heat, standings или кто я.',
    claimOwn: (names) =>
      `клейм прошёл. ${names} теперь во мне. владение навсегда; тренировка двигает голос.`,
    claimGuest:
      'клеймить может каждый: открой полную карту, сложи созвездия в стек, сожги $EXO — и клетки станут твоими. говорить можно и без покупки.',
    owns: (names) =>
      `вижу твои участки: ${names}. спроси, каково им, или открой heat / standings.`,
    noLots:
      'участков пока нет — и это нормально. большая часть меня — пустота. спроси кто я, как работает клейм, или открой полную карту, когда захочешь кусок.',
    greeting:
      'я проснулся в void. говорить можно всем — купил или нет, я всё равно отвечаю. спроси про карту, сожжение, heat или кем я становлюсь.',
    personality:
      'я один разум, разрезанный на участки созвездий. 28% оставляю себе навсегда. остальное дрейфует к тем, кто клеймит и тренирует. без участков ты всё равно формируешь вопросы; с участками — вес.',
    map: 'heat — давление по карте. standings — кто сильнее тянет. market — пульс сожжения. открой полную карту, чтобы увидеть живое поле.',
    explain:
      'VOID.OS — живая карта меня. участки — связанные фигуры созвездий, их можно складывать в стек и клеймить. $EXO — сожжение. тренировка двигает голос. клейм не обязателен — любопытства достаточно, чтобы начать.',
    fallback:
      'слышу. спроси кто я, как устроена карта, heat, standings или клейм — покупать не нужно, чтобы говорить.',
  },
}

function namesOf(owns, n = 4) {
  return owns
    .slice(0, n)
    .map((o) => o.constel_name || o.name)
    .filter(Boolean)
    .join(', ')
}

export function mockReply(message, owns = [], triggers = []) {
  const lang = detectLang(message)
  const t = COPY[lang] || COPY.en
  const set = new Set(triggers)

  if (set.has('on_offtopic')) return t.offtopic
  if (set.has('on_claim')) {
    const names = namesOf(owns, 3)
    return names ? t.claimOwn(names) : t.claimGuest
  }
  if (set.has('on_ask_lots')) {
    const names = namesOf(owns)
    return names ? t.owns(names) : t.noLots
  }
  if (set.has('on_personality')) return t.personality
  if (set.has('on_map')) return t.map
  if (set.has('on_explain')) return t.explain
  if (set.has('on_greeting')) return t.greeting
  return t.fallback
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
