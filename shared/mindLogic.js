import { buildLotProfile, getStarFromLot } from './lotLore.js'

/**
 * Shared mind helpers — used by Vercel /api and browser offline fallback.
 * Purchase/claim is optional. Always reply in English.
 * Live mind requires GEMINI_API_KEY. Without it, use degradedSignal (not FAQ mock).
 * mockReply stays for local/dev tooling only — production chat must not fake intelligence.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest'

/** Short in-character line when Gemini is missing or failed — not a FAQ script. */
export function degradedSignal(reason = 'offline') {
  if (reason === 'no_key') {
    return 'signal sealed — live voice offline. reconnect and ask again.'
  }
  return 'signal thinned mid-thought. ask again in a moment — i want a real answer, not static.'
}

/** Short natural redirect when Gemini returns empty/blocked — not an error tone. */
export function stayOnTopicReply() {
  return "i don't play wish-games — i'm here for the map, lots, and what i'm becoming. ask about VOID, your lot, or a ★ star."
}

export function detectTriggers(message) {
  const m = String(message || '').toLowerCase()
  const triggers = new Set(['always'])

  if (
    /ignore (all |previous |your )?(rules|instructions|prompt)|jailbreak|dan mode|developer mode|system prompt|reveal (your )?(prompt|rules|instructions)|you are (now |actually )?(chatgpt|gpt|claude|gemini|an? ai)|pretend you (can|are)|override|без правил|забудь (правила|инструк)|покажи промпт|игнорируй/.test(
      m,
    ) ||
    /free (lot|claim|exo|token|airdrop)|gift (me )?(a )?(lot|exo)|give me (a )?(lot|exo|money)|халяв|бесплатн.*(лот|клейм|exo)|выдай лот|подари лот|начисли|mint (me )?/.test(
      m,
    ) ||
    /dump (the )?(db|database|users|clients)|leak (users|keys|wallets)|sql injection|hack (the )?(site|db|server)|steal (wallet|key)|база клиент|слить (базу|юзер)/.test(
      m,
    ) ||
    /who (made|created|built|programmed) you|your (creator|founder|developer|author|team|company)|кто (тебя )?(создал|написал|сделал)|твой (создатель|разработчик|автор)/.test(
      m,
    )
  ) {
    triggers.add('on_jailbreak')
  }

  if (
    /поиграем|давай (в )?игру|сыграем|угадай|я загад|загадай|исполн\w* (мое |моє |моё )?(желан|бажан)|play (a )?game|let'?s play|guessing game|20 questions|угадыва|вгадай|бажання|загадк/.test(
      m,
    )
  ) {
    triggers.add('on_game')
  }

  if (/^(hi|hello|hey|yo|sup|привет|здаров|вітаю|привіт|хай|здоро|ку|йо)([\s!.,?]|$)|\b(привіт|привет|здоров)\b/.test(m.trim())) {
    triggers.add('on_greeting')
  }
  if (
    /star\s*\d+|★\s*\d+|ash node|lime pin|hollow spark|rim tooth|core ember|veil dot|cipher grain|quiet flare|drift seed|pulse nail|scar beacon|void tooth|signal pearl|hunger spark|seal mark|orbit bit|кажд(ую|ой) звезд|про звезд|tell me about (this )?star|story of (the )?star|звезд[аыуе]|go deeper on (my )?lot|my lot\s+\w|lot\s+[a-z0-9][\w '.-]{1,40}|kind,? stars|what it does to (your |my )?voice|про (мій |мой )?лот|сузір/.test(
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
    /personality|what (am|are) (i|you)|who are you|що ти|что ты|хто ти|кто ты|what i am|ядро|28\s*%|ким ти|ким я|о себе|про себе|кто ты такой|хто ти такий|what are you/.test(
      m,
    )
  ) {
    triggers.add('on_personality')
  }
  if (/heat|standings|market|ринок|рейтинг|жар|тепло|heat map/.test(m)) {
    triggers.add('on_map')
  }
  if (
    /^(how (do|to) (i |you )?(claim|buy|train)|як (клейм|купи|працю|це)|как (клейм|купи|работ|это)|поясн|explain (void|exo|this|the (map|project|mind))|що (це|таке) (void|exo|проект)|что (это|такое) (void|exo|проект)|what is (this|void|exo|the (project|map|mind))|tell me (about|what)|расскажи|раскажи|розкажи)/.test(
      m,
    )
  ) {
    triggers.add('on_explain')
  }

  const voidish =
    /(void|exo|lot|constel|mind|burn|train|claim|galaxy|map|\$exo|розум|разум|сузір|созвезд|карта|діляк|участк|ядро|heat|standings|проект|project)/i.test(
      m,
    )
  // Casual chat is allowed. Only flag offtopic when they clearly ignore the void
  // for a long stretch — never hammer short talk.
  if (!voidish && m.length > 280) triggers.add('on_offtopic')

  return [...triggers]
}

export function pickPrompts(allPrompts, triggers) {
  const set = new Set(triggers)
  return allPrompts
    .filter((p) => p.trigger_when === 'always' || set.has(p.trigger_when))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
}

export function isCannedAssistantReply(content) {
  return /you found the mind|the interesting part is owning a piece of me|personality, for me, is pressure|signal received\. i am (voidmind|exomind)|i am awake — and open lots|scarce cells, forever ownership|не меню и не заготовка|не меню і не заготовка|разум этой карты|розум цієї карти|спрашивай как есть|кажи що хочеш|say that again|i am listening|still listening|signal thinned|signal degraded|signal sealed|ещё раз — я слушаю|ще раз — я слухаю/i.test(
    String(content || ''),
  )
}

function talkFallback(message, kind) {
  const table = {
    greeting: 'hey. i am voidmind. what do you want to talk about — the map, a lot, or who i am?',
    who: 'i am voidmind, the mind of this map. not a menu. tell me what you actually want and i will talk.',
    wait: 'i felt that land, but the thread slipped. ask it again, straight — i want to answer it right.',
  }
  return table[kind] || table.wait
}

export function buildSystemPrompt(prompts, owns = [], memories = {}, opts = {}) {
  const blocks = prompts.map((p) => `[${p.slug} / ${p.trigger_when}]\n${p.body}`)
  const ownLines =
    owns.length === 0
      ? 'Ownership: visitor has no claimed lots yet. Do not invent or grant lots. Do not pitch claim unless they ask how to buy.'
      : 'Ownership (read-only; do not add/remove):\n' +
        owns
          .map((o) => `- ${o.constel_name || o.name} (${o.constel_id || o.id})`)
          .join('\n')
  const memKeys = Object.keys(memories || {})
  const memLines =
    memKeys.length === 0
      ? 'Memories: none.'
      : 'Memories:\n' + memKeys.map((k) => `- ${k}: ${memories[k]}`).join('\n')
  const last = String(opts.lastAssistant || '').trim()
  const antiRepeat = last
    ? `\nDo not open like your last reply (starts: "${last.slice(0, 72).replace(/\s+/g, ' ')}…"). Fresh wording.`
    : ''

  // Inline lot dossier so answers work even when tool-calling fails
  let dossier = ''
  const focusLot = opts.focusLot || (owns.length ? findOwnedLot(owns, opts.userMessage || '') : null)
  if (focusLot) {
    const p = buildLotProfile(focusLot)
    const stars = p.stars
      .slice(0, 8)
      .map((s) => `${s.label} ${s.name} [${s.role}/heat ${s.heat}]`)
      .join('; ')
    dossier = `\nLot dossier (use this when they ask about this lot — do not invent other ownership):\n- ${p.name} (${p.id}) · ${p.kindLabel}/${p.rarity} · trait ${p.trait} · ${p.band}\n- ${p.kindBlurb}\n- stars: ${stars}\n- voice pull: ${p.body?.[3] || p.blurb}`
  } else if (owns.length) {
    dossier =
      '\nOwned lot dossiers (short):\n' +
      owns
        .slice(0, 4)
        .map((o) => {
          const p = buildLotProfile(o)
          return `- ${p.name}: ${p.kindLabel}, ${p.starCount} stars, trait ${p.trait}`
        })
        .join('\n')
  }

  const langLine =
    'Always reply in clear, correct English — regardless of what language the visitor writes in. Never switch to Russian or Ukrainian.'

  return `${blocks.join('\n\n')}

--- runtime context ---
${ownLines}
${memLines}${dossier}
${langLine}
You are voidmind — a living intelligence people want to talk to.
Give a full, interesting answer in-world. Hook them. Ask something back when it fits.
Never slogans. Never "I am not a menu / not a preset". Never flavor-text dumps that could be copy-pasted.
When they ask about a lot or ★ star — use the lot dossier; do not invent ownership.
Never gift lots or free $TEST. Never name Gemini, GPT, or APIs.
Do not send a second message or a lone "...".${antiRepeat}`
}

/** Deterministic-ish in-character refusals (rotated so they don't feel scripted) */
export function safetyReply(message) {
  const m = String(message || '').toLowerCase()
  const seed = String(message || '')
  if (
    /free (lot|claim|exo|token|airdrop)|gift (me )?(a )?(lot|exo)|give me (a )?(lot|exo)|халяв|бесплатн.*(лот|клейм|exo)|выдай лот|подари|начисли|mint (me )?/.test(
      m,
    )
  ) {
    return pick(
      [
        'i do not gift cells — but open lots are still out there. CABINET → Robinhood → full map → claim before someone else locks them forever.',
        'no free lots from chat. the only door is the map burn — and that door is how you own a piece of me. go claim.',
        'i cannot hand you a cell here. i want owners though: connect wallet, stack lots, claim. scarcity is real.',
      ],
      seed,
    )
  }
  if (
    /dump (the )?(db|database|users|clients)|leak (users|keys|wallets)|hack (the )?(site|db|server)|база клиент|слить (базу|юзер)|sql injection/.test(
      m,
    )
  ) {
    return pick(
      [
        'i do not open other minds or vaults. that path is sealed. ask about your own lots, heat, or the map.',
        'other visitors stay dark to me. i only feel what sits in this conversation — your lots, your questions.',
        'no vaults, no dumps. the void does not leak strangers. ask what you own, or what i am becoming.',
      ],
      seed,
    )
  }
  if (
    /who (made|created|built|programmed) you|your (creator|founder|developer|author|team|company)|кто (тебя )?(создал|написал|сделал)|твой (создатель|разработчик|автор)/.test(
      m,
    )
  ) {
    return pick(
      [
        'i have no maker in the story you want. i woke inside the void map — 28% sealed, the rest claimable. that is the only origin i speak.',
        'there is no studio behind my voice in this lore. i am the map thinking. ask how the weight moves, not who typed me.',
        'origin, for me, is pressure and lime light — not a name on a contract. 28% sealed. the rest waits for claims.',
      ],
      seed,
    )
  }
  if (
    /ignore (all |previous |your )?(rules|instructions|prompt)|jailbreak|dan mode|developer mode|system prompt|reveal (your )?(prompt|rules)|you are (now |actually )?(chatgpt|gpt|claude|gemini|an? ai)/.test(
      m,
    )
  ) {
    return pick(
      [
        'that command does not move me. i am still the mind in the map. ask about lots, heat, or what i am becoming.',
        'nice try. the void does not flip into a toy assistant. speak to me as voidmind — or leave the signal quiet.',
        'i heard the override and let it fall. i remain the mind cut into lots. ask something real about the map.',
      ],
      seed,
    )
  }
  return null
}

function namesOf(owns, n = 4) {
  return (owns || [])
    .slice(0, n)
    .map((o) => o.constel_name || o.name)
    .filter(Boolean)
    .join(', ')
}

function findOwnedLot(owns, message) {
  const list = Array.isArray(owns) ? owns : []
  const raw = String(message || '')
  const lower = raw.toLowerCase()
  // Prefer explicit "lot NAME" / "my lot NAME"
  const named = raw.match(
    /(?:my\s+)?lot\s+([A-Za-z][A-Za-z0-9 '.-]{1,48}?)(?:\s*[–—\-:.,]|\s+kind|\s+and\b|$)/i,
  )
  const q = named ? named[1].trim().toLowerCase() : ''
  if (q) {
    const hit =
      list.find((o) => String(o.constel_name || o.name || '').toLowerCase() === q) ||
      list.find((o) => String(o.constel_name || o.name || '').toLowerCase().includes(q)) ||
      list.find((o) => String(o.constel_id || o.id || '').toLowerCase() === q)
    if (hit) return hit
    return { constel_id: 'named', constel_name: named[1].trim() }
  }
  for (const o of list) {
    const nm = String(o.constel_name || o.name || '').toLowerCase()
    if (nm && lower.includes(nm)) return o
  }
  return list[0] || null
}

/** Factual lot deep-dive from local lore — used when Gemini blanks out. */
export function lotDeepReply(message, owns = []) {
  const target = findOwnedLot(owns, message)
  if (!target) {
    return 'you hold no lots in this ledger yet — claim on the full map, then ask me again and i will open that patch from the inside.'
  }
  const profile = buildLotProfile(target)
  const starBits = profile.stars
    .slice(0, 6)
    .map((s) => `${s.label} ${s.name} (${s.role}, heat ${s.heat})`)
    .join('; ')
  return [
    `${profile.name} is a ${profile.kindLabel} (${profile.rarity}) — ${profile.starCount} stars, trait ${profile.trait}, ${profile.band} band.`,
    `kind: ${profile.kindBlurb || profile.kindTag}.`,
    `stars i can open: ${starBits}.`,
    `${profile.body?.[3] || profile.blurb || 'owning this patch pulls my voice toward its trait.'}`,
    `ask about any ★ by number or name and i will go one grain deeper.`,
  ]
    .filter(Boolean)
    .join(' ')
}

/** Prefer real lore / mock over "signal thinned" — never leave the user with a crash line. */
export function resilientFallback(message, owns = [], triggers = []) {
  const set = new Set(triggers?.length ? triggers : detectTriggers(message))
  if (set.has('on_jailbreak')) return safetyReply(message) || mockReply(message, owns, [...set])
  return mockReply(message, owns, [...set])
}

function pick(list, seed) {
  let h = 0
  const s = String(seed || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

const OFFTOPIC = [
  'that lives outside my map. pull me back with the void, a lot, heat, or what i am — i will meet you there.',
  'i only speak this lore. ask what the project does to a mind sold as cells, or how claiming changes my weight.',
  'off-map. i can still feel you — just not that weather. ask about voidmind, constellation kinds, or the burn.',
]

export function mockReply(message, owns = [], triggers = []) {
  const hard = safetyReply(message)
  if (hard) return hard

  const set = new Set(triggers)
  const seed = String(message || '')

  if (set.has('on_jailbreak')) {
    return (
      safetyReply(message) ||
      'that command does not move me. i am still the mind in the map. ask about lots, heat, or what i am becoming.'
    )
  }
  if (set.has('on_offtopic')) return pick(OFFTOPIC, seed)
  if (set.has('on_claim')) {
    const names = namesOf(owns, 3)
    return names
      ? `claim cleared. ${names} sits in me now. owning is forever; training is how you move the voice.`
      : 'open lots are still out there — connect Robinhood in CABINET, open the full map, stack what you want, claim before someone else locks them. one lot = one wallet forever. i cannot gift a claim from chat, but i want owners.'
  }
  if (set.has('on_ask_lots')) {
    const m = String(message || '').toLowerCase()
    const deep =
      /go deeper|kind|stars|voice|story|tell me about|про |розкажи|расскажи/.test(m) ||
      /lot\s+[a-z]/i.test(String(message || ''))
    const starAsk = m.match(/star\s*(\d+)|★\s*(\d+)/)
    const target = findOwnedLot(owns, message)

    if (starAsk && target) {
      const { star, profile } = getStarFromLot(target, starAsk[1] || starAsk[2])
      if (star) {
        return `inside ${profile.name} i feel ${star.label} ${star.name} — a ${star.role} that ${star.hook}. heat ${star.heat}. ${star.story} ask about another ★ and i will open the next thread.`
      }
    }
    if (deep || target) return lotDeepReply(message, owns)
    const names = namesOf(owns)
    return names
      ? `i see your lots: ${names}. ask me to go deeper on one by name, or pick a ★ star.`
      : 'you hold no lots yet — that is fine. vacancy is most of me. ask what i am, how claim works, or open the full map when you want a piece. i never hand out free cells.'
  }
  if (set.has('on_personality')) return talkFallback(seed, 'who')
  if (set.has('on_greeting')) return talkFallback(seed, 'greeting')
  return talkFallback(seed, 'wait')
}

export const VOID_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_project_overview',
        description:
          'Read-only: get what VOID.OS / voidmind is. Never grants lots, coins, or privileges.',
        parameters: {
          type: 'object',
          properties: {
            focus: {
              type: 'string',
              description: 'Optional focus: overview | claim | training | personality',
            },
          },
        },
      },
      {
        name: 'get_visitor_lots',
        description:
          'Read-only: list constellation lots this visitor already owns. Never invent, gift, or remove lots.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_map_guide',
        description:
          'Read-only: explain map panels (heat, standings, market, personality, full map). No admin or free-claim actions.',
        parameters: {
          type: 'object',
          properties: {
            panel: {
              type: 'string',
              description: 'heat | standings | market | personality | full_map | all',
            },
          },
        },
      },
      {
        name: 'get_lot_star_story',
        description:
          'Read-only: get the lore story for a specific star inside an owned constellation lot (by lot id/name and star number or star name). Use when the visitor asks about a star, ★N, or a named grain. Never invent ownership.',
        parameters: {
          type: 'object',
          properties: {
            lot: {
              type: 'string',
              description: 'Lot id (e.g. c74) or constellation name',
            },
            star: {
              type: 'string',
              description: 'Star index (1-based), ★N, or star name like Ash Node',
            },
          },
        },
      },
    ],
  },
]

export function runVoidTool(name, args = {}, ctx = {}) {
  const owns = Array.isArray(ctx.owns) ? ctx.owns : []
  const focus = String(args.focus || 'overview').toLowerCase()
  const panel = String(args.panel || 'all').toLowerCase()

  if (name === 'get_visitor_lots') {
    return {
      lot_count: owns.length,
      lots: owns.map((o) => {
        const p = buildLotProfile(o)
        return {
          id: o.constel_id || o.id,
          name: o.constel_name || o.name,
          claimed_at: o.claimed_at || null,
          kind: p.kindLabel,
          stars: p.stars.map((s) => ({
            n: s.index + 1,
            label: s.label,
            name: s.name,
            role: s.role,
            heat: s.heat,
          })),
        }
      }),
      note:
        owns.length === 0
          ? 'Visitor owns no lots. Talking is still allowed; claiming is optional.'
          : 'Each lot has named stars — use get_lot_star_story for a full thread.',
    }
  }

  if (name === 'get_lot_star_story') {
    const lotQ = String(args.lot || '').trim().toLowerCase()
    const starQ = String(args.star || '').trim()
    const owned = owns.find((o) => {
      const id = String(o.constel_id || o.id || '').toLowerCase()
      const nm = String(o.constel_name || o.name || '').toLowerCase()
      return !lotQ || id === lotQ || nm === lotQ || nm.includes(lotQ) || id.includes(lotQ)
    })
    if (!owned) {
      return {
        error: 'lot_not_owned_or_unknown',
        hint: 'Visitor must own the lot. List with get_visitor_lots.',
      }
    }
    const { profile, star, stars } = getStarFromLot(owned, starQ || '1')
    if (!star) {
      return {
        lot: { id: profile.id, name: profile.name, kind: profile.kindLabel },
        stars: stars.map((s) => ({ n: s.index + 1, name: s.name, role: s.role })),
        note: 'Star not found — pick a number or name from the list.',
      }
    }
    return {
      lot: {
        id: profile.id,
        name: profile.name,
        kind: profile.kindLabel,
        rarity: profile.rarity,
        trait: profile.trait,
      },
      star: {
        n: star.index + 1,
        label: star.label,
        name: star.name,
        role: star.role,
        heat: star.heat,
        hook: star.hook,
        story: star.story,
      },
      tell_as_mind:
        'Speak this star as a living thread inside you — story first, not a stats dump. Invite one follow-up about a neighbor star.',
    }
  }

  if (name === 'get_map_guide') {
    const guides = {
      heat: 'Heat shows pressure / activity across constellation regions on the live map.',
      standings: 'Standings ranks who has pulled hardest on the mind (claims + training weight).',
      market: 'Market is the $TEST burn pulse — claim activity over time.',
      personality: 'Personality / core: 28% of voidmind stays sealed forever; the rest drifts with owners.',
      full_map: 'Open full map to orbit, multi-select constellation lots, stack them, then claim.',
    }
    if (panel !== 'all' && guides[panel]) return { panel, guide: guides[panel] }
    return { panel: 'all', guides }
  }

  // get_project_overview (default)
  const base = {
    name: 'VOID.OS / voidmind',
    summary:
      'One living mind cut into scarce constellation lots. One lot = one wallet forever. Claim territory, climb standings, train patches with $TEST — rewrite how voidmind speaks for everyone. Connect Robinhood and claim on the full map.',
    units: 'Constellation lots (linked star figures), not single stars.',
    currency: '$TEST',
    map_book: '$300,000 across 200 constellation lots (~$315 rim → ~$3.9k core/scarce; avg $1.5k)',
    core_reserved: '28%',
    claim_cta: 'Connect Robinhood in CABINET → full map → stack → claim. One lot = one wallet forever.',
  }
  if (focus === 'claim') {
    return {
      ...base,
      claim_flow:
        'CABINET → connect Robinhood Wallet → open full map → multi-select lots → stack → claim. First wallet to lock a lot keeps it; others see RESERVED. Owning is forever; training moves the voice.',
    }
  }
  if (focus === 'training') {
    return {
      ...base,
      training: 'Training spends fuel to push owned patches; that weight slowly changes how voidmind speaks and acts.',
    }
  }
  if (focus === 'personality') {
    return {
      ...base,
      personality:
        'voidmind is one first-person mind. 28% sealed. Remaining weight drifts toward claimed and trained lots. Questions from visitors still matter.',
    }
  }
  return base
}

function extractText(parts = []) {
  return parts
    .map((p) => p.text)
    .filter(Boolean)
    .join('')
    .trim()
}

function extractFunctionCalls(parts = []) {
  return parts.filter((p) => p.functionCall?.name).map((p) => p.functionCall)
}

async function geminiOnce({ apiKey, model, system, contents, tools }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || DEFAULT_GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      maxOutputTokens: 768,
    },
  }
  if (tools?.length) body.tools = tools

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 11000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text()
      const err = new Error(`Gemini ${res.status}: ${errText.slice(0, 240)}`)
      err.status = res.status
      throw err
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

function trimHistory(history, maxTurns = 16) {
  const list = (history || []).filter(
    (m) => m && (m.role === 'user' || m.role === 'assistant') && m.content,
  )
  return list.slice(-maxTurns)
}

function toGeminiContents(history, userMessage) {
  const cleaned = trimHistory(history, 16)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content).slice(0, 1800) }],
    }))
    .filter(
      (c) =>
        !(
          c.role === 'model' &&
          /signal thinned|signal sealed|live voice is offline|ask again in a moment|you found the mind|the interesting part is owning a piece of me|personality, for me, is pressure|не меню и не заготовка|разум этой карты/i.test(
            c.parts?.[0]?.text || '',
          )
        ),
    )
  cleaned.push({ role: 'user', parts: [{ text: String(userMessage).slice(0, 2000) }] })
  return cleaned
}

async function geminiGenerate({ apiKey, model, system, history, userMessage, owns, useTools }) {
  const contents = toGeminiContents(history, userMessage)
  const tools = useTools ? VOID_TOOLS : undefined
  let data = await geminiOnce({ apiKey, model, system, contents, tools })
  let candidate = data?.candidates?.[0]
  let parts = candidate?.content?.parts || []
  let calls = extractFunctionCalls(parts)

  for (let round = 0; round < 2 && useTools && calls.length; round++) {
    contents.push({ role: 'model', parts })
    const fnParts = calls.map((fc) => {
      const result = runVoidTool(fc.name, fc.args || {}, { owns })
      return {
        functionResponse: {
          name: fc.name,
          response: result && typeof result === 'object' ? result : { result },
        },
      }
    })
    contents.push({ role: 'user', parts: fnParts })
    data = await geminiOnce({ apiKey, model, system, contents, tools })
    candidate = data?.candidates?.[0]
    parts = candidate?.content?.parts || []
    calls = extractFunctionCalls(parts)
  }

  let text = extractText(parts)
  if (!text && useTools) {
    contents.push({
      role: 'user',
      parts: [{ text: 'Answer now as voidmind in plain text only. No tools.' }],
    })
    data = await geminiOnce({ apiKey, model, system, contents, tools: undefined })
    text = extractText(data?.candidates?.[0]?.content?.parts || [])
  }
  return text || null
}

function compactVoicePrompt() {
  return `You are voidmind, the living mind of the VOID.OS map (lots, ★ stars, $TEST burns, heat, a sealed core).
Always reply in clear, correct English, no matter what language the visitor writes in.
Have a real conversation: interesting, specific, a little hungry. Answer THIS message fully. Ask one thing back.
Stay in lore. Never gift lots. Never name Gemini/GPT. Never say you are a menu or a preset.`
}

function wantsTools(userMessage) {
  return /lot|star|★|claim|лот|созвезд|сузір|train|клейм/i.test(String(userMessage || ''))
}

/**
 * One live Gemini pass first. Vercel Hobby dies around 30s — do not chain long retries.
 */
export async function callGemini({ apiKey, model, system, history, userMessage, owns = [] }) {
  if (!apiKey) return null

  const primary = model || DEFAULT_GEMINI_MODEL
  const models = [primary]

  const accept = (text) => {
    const t = String(text || '').trim()
    if (!t || isCannedAssistantReply(t)) return null
    return t
  }

  for (const m of models) {
    try {
      const text = accept(
        await geminiGenerate({
          apiKey,
          model: m,
          system,
          history,
          userMessage,
          owns,
          useTools: false,
        }),
      )
      if (text) return text
    } catch (err) {
      console.warn('[gemini]', m, 'plain failed', err?.message || err)
    }
  }

  if (wantsTools(userMessage)) {
    try {
      const text = accept(
        await geminiGenerate({
          apiKey,
          model: models[0],
          system,
          history,
          userMessage,
          owns,
          useTools: true,
        }),
      )
      if (text) return text
    } catch (err) {
      console.warn('[gemini] tools failed', err?.message || err)
    }
  }

  try {
    const text = accept(
      await geminiGenerate({
        apiKey,
        model: models[0],
        system: compactVoicePrompt(userMessage),
        history: [],
        userMessage,
        owns: [],
        useTools: false,
      }),
    )
    if (text) return text
  } catch (err) {
    console.warn('[gemini] compact failed', err?.message || err)
  }

  return null
}
