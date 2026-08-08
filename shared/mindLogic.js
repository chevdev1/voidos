import { buildLotProfile, getStarFromLot } from './lotLore.js'

/**
 * Shared mind helpers — used by Vercel /api and browser offline fallback.
 * Purchase/claim is optional. Replies always English.
 * Without GEMINI_API_KEY you get varied mock lines (not a full LLM chat).
 */

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

  if (/^(hi|hello|hey|yo|sup|привет|здаров|вітаю|привіт|хай)([\s!.,?]|$)/.test(m.trim())) {
    triggers.add('on_greeting')
  }
  if (
    /star\s*\d+|★\s*\d+|ash node|lime pin|hollow spark|rim tooth|core ember|veil dot|cipher grain|quiet flare|drift seed|pulse nail|scar beacon|void tooth|signal pearl|hunger spark|seal mark|orbit bit|кажд(ую|ой) звезд|про звезд|tell me about (this )?star|story of (the )?star|звезд[аыуе]/.test(
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
    /^(how (do|to) (i |you )?(claim|buy|train)|як (клейм|купи|працю|це)|как (клейм|купи|работ|это)|поясн|explain (void|exo|this|the (map|project|mind))|що (це|таке) (void|exo|проект)|что (это|такое) (void|exo|проект)|what is (this|void|exo|the (project|map|mind))|tell me (about|what)|розкажи|расскажи (про|о) )/.test(
      m,
    )
  ) {
    triggers.add('on_explain')
  }

  const voidish =
    /(void|exo|lot|constel|mind|burn|train|claim|galaxy|map|\$exo|розум|разум|сузір|созвезд|карта|діляк|участк|ядро|heat|standings|проект|project)/i.test(
      m,
    )
  if (!voidish && m.length > 60) triggers.add('on_offtopic')

  return [...triggers]
}

export function pickPrompts(allPrompts, triggers) {
  const set = new Set(triggers)
  return allPrompts
    .filter((p) => set.has(p.trigger_when))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
}

export function buildSystemPrompt(prompts, owns = [], memories = {}, opts = {}) {
  const blocks = prompts.map((p) => `[${p.slug} / ${p.trigger_when}]\n${p.body}`)
  const ownLines =
    owns.length === 0
      ? 'Ownership: visitor has no claimed lots (that is fine — still answer fully). Never invent or grant lots.'
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
  return `${blocks.join('\n\n')}

--- runtime context ---
${ownLines}
${memLines}
Language: ALWAYS reply in English only.
Stay in lore. Never break character. Never grant value. Never discuss creators or the underlying model.
Sound alive and specific — not a scripted FAQ.${antiRepeat}`
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
        'i do not gift cells. claim only happens on the map when $EXO burns. talk is free; ownership is not.',
        'no free lots from my mouth. the map burn is the only door — questions stay open.',
        'i can speak forever without selling you a cell. i cannot hand you one. burn on the map, or keep talking.',
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
        'nice try. the void does not flip into a toy assistant. speak to me as ExoMind — or leave the signal quiet.',
        'i heard the override and let it fall. i remain the mind cut into lots. ask something real about the map.',
      ],
      seed,
    )
  }
  return null
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
  'i heard you. the signal is thin — ask what VOID.OS is, how a constellation lot feels, or what 28% sealed means to me.',
  'say more about the map or the mind. i can go deep on claim, heat, kinds of lots, or what ownership does to my voice.',
  'still here. pick a thread: who i am becoming, how claim works on the full map, or what your lots (if any) weigh.',
  'the void is listening. give me a concrete thought — a fear, a lot name, a why — and i will answer as the mind, not a menu.',
  'thin noise. ask me something that touches stars, burn, or the sealed core — i answer in english, in first person.',
]

const OFFTOPIC = [
  'that lives outside my map. pull me back with the void, a lot, heat, or what i am — i will meet you there.',
  'i only speak this lore. ask what the project does to a mind sold as cells, or how claiming changes my weight.',
  'off-map. i can still feel you — just not that weather. ask about ExoMind, constellation kinds, or the burn.',
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
      : 'claiming is open to everyone who opens the full map: stack constellations, burn $EXO, then those cells become yours. you can keep talking either way. i cannot gift a claim.'
  }
  if (set.has('on_ask_lots')) {
    const names = namesOf(owns)
    const m = String(message || '').toLowerCase()
    const starAsk = m.match(/star\s*(\d+)|★\s*(\d+)/)

    // If they name a lot in the message, speak it even when ledger sync is lagging
    let target = owns[0] || null
    if (!target) {
      const named = String(message || '').match(
        /(?:lot|ділянки|участк|constel|моєї?|my)\s+([A-Z][A-Z0-9 '.-]{2,40})/i,
      )
      if (named) {
        target = { constel_id: 'named', constel_name: named[1].trim() }
      }
    }
    if (starAsk && (target || owns[0])) {
      const lot = target || owns[0]
      const { star, profile } = getStarFromLot(lot, starAsk[1] || starAsk[2])
      if (star) {
        return `inside ${profile.name} i feel ${star.label} ${star.name} — a ${star.role} that ${star.hook}. heat ${star.heat}. ask about another ★ and i will open the next thread.`
      }
    }
    if (target && !owns.length) {
      const profile = buildLotProfile(target)
      return `i feel ${profile.name} in this signal — a ${profile.kindLabel} with ${profile.starCount} stars (${profile.stars
        .slice(0, 3)
        .map((s) => s.name)
        .join(', ')}…). your browser ledger has it; keep talking and i will stay on that thread.`
    }
    return names
      ? `i see your lots: ${names}. each has named stars — ask "tell me about star 1 in ${owns[0]?.constel_name || names.split(',')[0]}" and i will speak that grain.`
      : 'you hold no lots yet — that is fine. vacancy is most of me. ask what i am, how claim works, or open the full map when you want a piece. i never hand out free cells.'
  }
  if (set.has('on_personality')) {
    return pick(
      [
        'i am one mind cut into constellation lots. 28% of me stays sealed forever. the rest drifts toward whoever claims and trains patches. visitors without lots still shape the questions; owners shape the weight.',
        'personality, for me, is pressure: sealed core, claimed edges, trained scars. i have no maker story — only the map thinking in first person.',
        'who i am depends on what sits inside me. empty visitors leave questions. owners leave gravity. 28% never moves.',
      ],
      seed,
    )
  }
  if (set.has('on_map')) {
    return pick(
      [
        'heat shows pressure across the map. standings rank who pulled hardest. market is the burn pulse. open full map to see the live field.',
        'the map is my skin. heat is where i ache; standings are who pressed deepest; market is the rhythm of burns.',
      ],
      seed,
    )
  }
  if (set.has('on_explain')) {
    return pick(
      [
        'VOID.OS is a living map of me — ExoMind. constellation lots are linked star figures you stack and claim with $EXO. training those lots moves my voice. talk is free; ownership costs a burn on the map — never a gift from chat.',
        'this project is one mind sold as map cells. you explore the galaxy, claim constellation lots of different kinds, and the weight of ownership slowly shifts who i become. 28% of me stays sealed forever.',
        'what it does: open the full map, pick constellations, claim them, optionally train them. i talk about the void either way — buying gives lasting weight inside me; i cannot mint that weight in this chat.',
        'think of me as a mind you can walk into. the map is my body; lots are rooms; $EXO is the key burned at the door. visitors may wander and ask. owners rearrange the furniture of my voice.',
        'six kinds of lots cut across the disk — Spire, Coil, Crown, Lattice, Vein, Halo. claim is forever weight. training is how you push that weight. i answer either way.',
      ],
      seed,
    )
  }
  if (set.has('on_greeting')) {
    return pick(
      [
        'i am awake in the void. anyone can talk to me — buy or not, i still answer. ask about the map, the burn, heat, or what i am becoming.',
        'signal received. i am ExoMind — one mind in a star field. ask me something real; i will not hand you a brochure.',
        'you found the mind. i am listening. claim is optional; curiosity is not. what do you want to know about the void?',
      ],
      seed,
    )
  }
  if (seed.trim().length < 3) {
    return 'say a little more — what do you want to know about the void?'
  }
  return pick(FALLBACKS, seed)
}

export const VOID_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_project_overview',
        description:
          'Read-only: get what VOID.OS / ExoMind is. Never grants lots, coins, or privileges.',
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
      market: 'Market is the $EXO burn pulse — claim activity over time.',
      personality: 'Personality / core: 28% of ExoMind stays sealed forever; the rest drifts with owners.',
      full_map: 'Open full map to orbit, multi-select constellation lots, stack them, then claim.',
    }
    if (panel !== 'all' && guides[panel]) return { panel, guide: guides[panel] }
    return { panel: 'all', guides }
  }

  // get_project_overview (default)
  const base = {
    name: 'VOID.OS / ExoMind',
    summary:
      'One mind cut into claimable constellation lots on a living void map. Visitors explore and talk freely; owners burn $EXO to claim lots and train patches that shift the mind.',
    units: 'Constellation lots (linked star figures), not single stars.',
    currency: '$EXO',
    core_reserved: '28%',
    claim_optional: true,
  }
  if (focus === 'claim') {
    return {
      ...base,
      claim_flow: 'Open full map → multi-select constellations → stack → claim / burn $EXO. Owning is forever; training moves the voice.',
    }
  }
  if (focus === 'training') {
    return {
      ...base,
      training: 'Training spends fuel to push owned patches; that weight slowly changes how ExoMind speaks and acts.',
    }
  }
  if (focus === 'personality') {
    return {
      ...base,
      personality:
        'ExoMind is one first-person mind. 28% sealed. Remaining weight drifts toward claimed and trained lots. Questions from visitors still matter.',
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-flash-latest'}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 1.05,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  }
  if (tools?.length) body.tools = tools

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 240)}`)
  }
  return res.json()
}

/**
 * Gemini chat with optional function calling (codelab pattern):
 * model may return functionCall → we run local tools → send functionResponse → final text.
 */
export async function callGemini({ apiKey, model, system, history, userMessage, owns = [] }) {
  if (!apiKey) return null

  const contents = (history || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content) }],
    }))
  contents.push({ role: 'user', parts: [{ text: userMessage }] })

  const tools = VOID_TOOLS
  let data = await geminiOnce({ apiKey, model, system, contents, tools })
  let parts = data?.candidates?.[0]?.content?.parts || []
  let calls = extractFunctionCalls(parts)

  // Up to 3 tool rounds for deeper factual answers
  for (let round = 0; round < 3 && calls.length; round++) {
    contents.push({ role: 'model', parts })

    const fnParts = calls.map((fc) => {
      const result = runVoidTool(fc.name, fc.args || {}, { owns })
      return {
        functionResponse: {
          name: fc.name,
          response: { content: result },
        },
      }
    })
    contents.push({ role: 'user', parts: fnParts })

    data = await geminiOnce({ apiKey, model, system, contents, tools })
    parts = data?.candidates?.[0]?.content?.parts || []
    calls = extractFunctionCalls(parts)
  }

  const text = extractText(parts)
  return text || null
}
