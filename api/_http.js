export function cors(req, res) {
  const origin = req.headers?.origin || req.headers?.Origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin === 'null' ? '*' : origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
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
