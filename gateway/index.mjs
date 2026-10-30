// VOID.OS browser gateway.
// One headless Chromium, one page per client connection. Frames go out as JPEG over a WebSocket,
// input comes back the same way. Every request the page makes is checked before it leaves the server.
//
//   node index.mjs            (after `npm install` here)
//   env: PORT=8788  CHROME_PATH=...  GATEWAY_ORIGINS=http://localhost:4173,http://localhost:5173
import http from 'node:http'
import { WebSocketServer } from 'ws'
import puppeteer from 'puppeteer-core'
import { checkUrl, resolveSafe } from './safety.mjs'

const PORT = Number(process.env.PORT || 8788)
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 4)
const IDLE_MS = Number(process.env.IDLE_MS || 5 * 60_000)
const VIEW = { width: 1100, height: 700 }
const ORIGINS = new Set(
  (process.env.GATEWAY_ORIGINS || 'http://localhost:4173,http://localhost:5173').split(',').map((s) => s.trim()),
)
const CHROME =
  process.env.CHROME_PATH ||
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome')

const log = (...a) => console.log(new Date().toISOString(), ...a)
let browserPromise = null
const sessions = new Set()

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: CHROME,
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-features=Translate'],
        defaultViewport: VIEW,
      })
      .then((b) => {
        b.on('disconnected', () => {
          browserPromise = null
          log('chromium disconnected')
        })
        return b
      })
      .catch((err) => {
        browserPromise = null
        throw err
      })
  }
  return browserPromise
}

const KEY_NAMES = new Set([
  'Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown', 'Shift', 'Control', 'Alt', 'Meta',
])
const validKey = (k) => typeof k === 'string' && (k.length === 1 || KEY_NAMES.has(k))
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null)

async function startSession(ws) {
  // Messages can arrive while Chromium is still starting. Queue them until the page is ready.
  let markReady
  const ready = new Promise((r) => (markReady = r))
  let s = null
  ws.on('message', (raw) => {
    ready.then(() => onClientMessage(s, raw))
  })

  if (sessions.size >= MAX_SESSIONS) {
    send(ws, { type: 'error', message: 'The gateway is busy. Try again in a minute.' })
    ws.close()
    return
  }
  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.setViewport(VIEW)
  s = { ws, page, cdp: null, idle: null }
  sessions.add(s)
  const touch = () => {
    clearTimeout(s.idle)
    s.idle = setTimeout(() => ws.close(), IDLE_MS)
  }
  touch()

  // Every request, including redirects and sub-resources, goes through the same two checks.
  await page.setRequestInterception(true)
  page.on('request', async (req) => {
    try {
      // data: and blob: never leave the server, so they are safe to pass through.
      if (/^(data|blob):/.test(req.url())) return await req.continue()
      const check = checkUrl(req.url())
      if (!check.ok || !(await resolveSafe(new URL(req.url()).hostname))) {
        await req.abort('blockedbyclient')
        return
      }
      await req.continue()
    } catch {
      await req.abort().catch(() => {})
    }
  })

  page.on('framenavigated', async (frame) => {
    if (frame !== page.mainFrame()) return
    send(ws, { type: 'url', url: frame.url(), title: await page.title().catch(() => '') })
  })

  s.cdp = await page.createCDPSession()
  s.cdp.on('Page.screencastFrame', async (frame) => {
    send(ws, { type: 'frame', data: frame.data, w: VIEW.width, h: VIEW.height })
    await s.cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
  })
  await s.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: VIEW.width, maxHeight: VIEW.height, everyNthFrame: 1 })

  // The client may have left while the page was starting.
  if (ws.readyState !== 1) {
    sessions.delete(s)
    await page.close().catch(() => {})
    return
  }
  s.touch = touch
  markReady()

  ws.on('close', async () => {
    clearTimeout(s.idle)
    sessions.delete(s)
    await s.cdp?.send('Page.stopScreencast').catch(() => {})
    await page.close().catch(() => {})
  })
}

async function onClientMessage(s, raw) {
  s.touch()
  let msg
  try {
    msg = JSON.parse(String(raw))
  } catch {
    return
  }
  try {
    await handle(s, msg)
  } catch (err) {
    send(s.ws, { type: 'error', message: String(err?.message || err).slice(0, 200) })
  }
}

async function handle(s, msg) {
  const { page } = s
  switch (msg.type) {
    case 'open': {
      const check = checkUrl(msg.url)
      if (!check.ok) return send(s.ws, { type: 'error', message: `Blocked: ${check.reason}.` })
      const host = new URL(check.url).hostname
      if (!(await resolveSafe(host))) return send(s.ws, { type: 'error', message: 'Blocked: that address points to a private network.' })
      await page.goto(check.url, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      return
    }
    case 'mouse': {
      const x = num(msg.x, 0, VIEW.width)
      const y = num(msg.y, 0, VIEW.height)
      if (x === null || y === null) return
      if (msg.kind === 'move') return page.mouse.move(x, y)
      if (msg.kind === 'down') return page.mouse.down({ button: msg.button === 2 ? 'right' : 'left' }).then(() => page.mouse.move(x, y))
      if (msg.kind === 'up') return page.mouse.up({ button: msg.button === 2 ? 'right' : 'left' })
      return
    }
    case 'wheel': {
      const dy = num(msg.dy, -2000, 2000) ?? 0
      const dx = num(msg.dx, -2000, 2000) ?? 0
      return page.mouse.wheel({ deltaX: dx, deltaY: dy })
    }
    case 'key': {
      if (!validKey(msg.key)) return
      if (msg.kind === 'down') return page.keyboard.down(msg.key)
      if (msg.kind === 'up') return page.keyboard.up(msg.key)
      return
    }
    case 'nav': {
      if (msg.action === 'back') return page.goBack({ timeout: 10_000 }).catch(() => {})
      if (msg.action === 'forward') return page.goForward({ timeout: 10_000 }).catch(() => {})
      if (msg.action === 'reload') return page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => {})
      return
    }
    default:
      return
  }
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj))
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const origin = req.headers.origin
    const cors = ORIGINS.has(origin) ? { 'access-control-allow-origin': origin } : {}
    res.writeHead(200, { 'content-type': 'application/json', ...cors })
    return res.end(JSON.stringify({ ok: true, sessions: sessions.size, max: MAX_SESSIONS }))
  }
  res.writeHead(404).end()
})

const wss = new WebSocketServer({
  server,
  path: '/browser',
  verifyClient: ({ origin }) => ORIGINS.has(origin),
})
wss.on('connection', (ws) => {
  startSession(ws).catch((err) => {
    log('session failed', err?.message)
    send(ws, { type: 'error', message: 'Could not start a browser session.' })
    ws.close()
  })
})

server.listen(PORT, () => log(`browser gateway on ws://localhost:${PORT}/browser (chrome: ${CHROME})`))
