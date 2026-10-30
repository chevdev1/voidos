// Heuristic guard: warn before a file that looks like a key or seed phrase is saved.
// Pure and offline. It catches common shapes, not every secret. Saving still works, the file never leaves the device.
const RULES = [
  {
    id: 'pem',
    test: (t) => /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(t),
    message: 'A PEM private key block.',
  },
  {
    // 32-byte hex, the size of a private key. Transaction hashes have the same shape, so this can flag public data too.
    id: 'hex32',
    test: (t) => /\b0x[a-fA-F0-9]{64}\b/.test(t),
    message: 'A 32-byte hex value. Private keys look like this (so do transaction hashes).',
  },
  {
    // A line that is exactly twelve or twenty-four lowercase words is the usual seed-phrase shape.
    id: 'seed',
    test: (t) => t.split('\n').some((line) => {
      const words = line.trim().split(/\s+/)
      return (words.length === 12 || words.length === 24) && words.every((w) => /^[a-z]{3,8}$/.test(w))
    }),
    message: 'A line of 12 or 24 plain words. That is the shape of a seed phrase.',
  },
]

export function detectSecrets(text) {
  return RULES.filter((r) => r.test(text)).map((r) => r.message)
}
