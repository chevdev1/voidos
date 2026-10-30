// Pure password scoring for the Wi-Fi check. Runs locally; nothing is sent anywhere.
const COMMON = [
  'password', 'qwerty', '12345678', '123456789', 'iloveyou', 'admin', 'welcome', 'wifi',
  'letmein', 'monkey', 'dragon', 'sunshine', 'princess', 'football', 'baseball', 'superman',
  'internet', 'router', 'network', 'wireless', 'hello', 'qazwsx', 'passw0rd', 'homewifi',
]

// Simple, honest scoring: length, character variety, common words and repeats.
export function scorePassword(pw) {
  if (!pw) return { score: 0, label: 'empty', tips: ['Type your Wi-Fi password above.'] }
  const tips = []
  let points = 0
  const len = pw.length
  if (len >= 8) points += 1
  if (len >= 12) points += 1
  if (len >= 16) points += 1
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  if (classes >= 3) points += 1
  if (classes === 4) points += 1
  const lower = pw.toLowerCase()
  const common = COMMON.some((w) => lower.includes(w))
  if (common) {
    points -= 2
    tips.push('Contains a common word. Attackers try these first.')
  }
  if (/(.)\1{2,}/.test(pw)) {
    points -= 1
    tips.push('Repeated characters make it weaker.')
  }
  if (len < 12) tips.push('Use at least 12 characters. Longer is better than clever.')
  if (classes < 3) tips.push('Mix upper and lower case, digits and symbols.')
  const score = Math.max(0, Math.min(4, points))
  const label = ['very weak', 'weak', 'fair', 'strong', 'very strong'][score]
  if (score >= 3 && !tips.length) tips.push('Good. Store it in a password manager and keep it unique.')
  return { score, label, tips }
}
