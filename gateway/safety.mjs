// Safety rules for the browser gateway. Pure where possible, so they can be tested without a browser.
// The gateway must never become a way into the server's own network, so private and loopback
// addresses are refused, both as typed addresses and after DNS resolution.
import dns from 'node:dns/promises'
import net from 'node:net'

const ALLOWED_PORTS = new Set(['', '80', '443'])

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    )
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::') return true
    if (v.startsWith('fc') || v.startsWith('fd')) return true // unique local
    if (v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')) return true // link local
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    return false
  }
  return true // not an IP at all: the caller must resolve it first
}

// Synchronous check of the typed address. Returns { ok, url } or { ok: false, reason }.
export function checkUrl(raw) {
  let u
  try {
    u = new URL(String(raw || '').trim())
  } catch {
    return { ok: false, reason: 'not a valid address' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reason: 'only http and https are allowed' }
  if (u.username || u.password) return { ok: false, reason: 'addresses with credentials are not allowed' }
  if (!ALLOWED_PORTS.has(u.port)) return { ok: false, reason: 'only the standard web ports are allowed' }
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (!host.includes('.') && !net.isIP(host)) return { ok: false, reason: 'local names are not allowed' }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, reason: 'local names are not allowed' }
  }
  if (net.isIP(host) && isPrivateAddress(host)) return { ok: false, reason: 'private addresses are not allowed' }
  return { ok: true, url: u.href }
}

// Resolves the host and refuses it if any answer is private. Results are cached briefly.
const cache = new Map()
const TTL_MS = 60_000

export async function resolveSafe(hostname, lookup = dns.lookup) {
  const now = Date.now()
  const hit = cache.get(hostname)
  if (hit && hit.until > now) return hit.ok
  let ok = true
  if (!net.isIP(hostname)) {
    try {
      const answers = await lookup(hostname, { all: true })
      ok = answers.length > 0 && answers.every((a) => !isPrivateAddress(a.address))
    } catch {
      ok = false
    }
  } else {
    ok = !isPrivateAddress(hostname)
  }
  cache.set(hostname, { ok, until: now + TTL_MS })
  return ok
}

export function clearDnsCache() {
  cache.clear()
}
