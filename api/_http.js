const rateBuckets = new Map()

function allowedOrigins() {
  const configured = String(
    process.env.APP_ORIGINS || process.env.APP_ORIGIN || '',
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (process.env.VERCEL_URL) configured.push(`https://${process.env.VERCEL_URL}`)
  if (process.env.NODE_ENV !== 'production') {
    configured.push('http://localhost:5173', 'http://127.0.0.1:5173')
  }
  return new Set(configured)
}

function localRateLimit(req, res, { name, limit, windowMs }) {
  const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For']
  const ip = String(forwarded || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim()
  const now = Date.now()
  const key = `${name}:${ip}`
  const current = rateBuckets.get(key)
  const bucket =
    current && now - current.startedAt < windowMs
      ? current
      : { startedAt: now, count: 0 }
  bucket.count += 1
  rateBuckets.set(key, bucket)
  if (rateBuckets.size > 5000) {
    for (const [entryKey, entry] of rateBuckets) {
      if (now - entry.startedAt >= windowMs) rateBuckets.delete(entryKey)
    }
  }
  if (bucket.count <= limit) return false
  const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000))
  res.setHeader('Retry-After', String(retryAfter))
  res.status(429).json({ error: 'too many requests', retryAfter })
  return true
}

export async function rateLimit(req, res, options) {
  const redisUrl = String(process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '')
  const redisToken = String(process.env.UPSTASH_REDIS_REST_TOKEN || '')
  if (redisUrl && redisToken) {
    const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For']
    const ip = String(forwarded || req.socket?.remoteAddress || 'unknown')
      .split(',')[0]
      .trim()
    const key = encodeURIComponent(`void:rate:${options.name}:${ip}`)
    try {
      const response = await fetch(`${redisUrl}/incr/${key}`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      })
      const payload = await response.json()
      const count = Number(payload?.result)
      if (!response.ok || !Number.isFinite(count)) throw new Error('rate-limit store failed')
      if (count === 1) {
        await fetch(`${redisUrl}/expire/${key}/${Math.ceil(options.windowMs / 1000)}`, {
          headers: { Authorization: `Bearer ${redisToken}` },
        })
      }
      if (count <= options.limit) return false
      const retryAfter = Math.max(1, Math.ceil(options.windowMs / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      res.status(429).json({ error: 'too many requests', retryAfter })
      return true
    } catch {
      // Keep a local guard if the optional Redis service is unavailable.
    }
  }
  return localRateLimit(req, res, options)
}

export function cors(req, res) {
  const origin = req.headers?.origin || req.headers?.Origin || '*'
  const allowed = origin !== '*' && origin !== 'null' && allowedOrigins().has(origin)
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')
}

export function readBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body || {}
}

export function isSecureReq(req) {
  const proto = req.headers?.['x-forwarded-proto'] || ''
  return proto === 'https' || process.env.NODE_ENV === 'production'
}
