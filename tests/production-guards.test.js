import test from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isValidLotId,
  lotBookStats,
  normalizeLotId,
  normalizeLotIds,
} from '../shared/lotPricing.js'
import {
  createClaimIntent,
  finalizePaidClaim,
  getOrCreateUser,
  linkWallet,
  parseCookies,
  resolveGuestKey,
  sidCookie,
} from '../shared/voidDb.js'

test('accepts only canonical map lot IDs', () => {
  assert.equal(normalizeLotId('C0'), 'c0')
  assert.equal(normalizeLotId('c199'), 'c199')
  assert.equal(normalizeLotId('c200'), '')
  assert.equal(normalizeLotId('javascript:alert(1)'), '')
  assert.equal(isValidLotId('c42'), true)
  assert.equal(isValidLotId('c999'), false)
  assert.deepEqual(normalizeLotIds([{ id: 'C1' }, 'c2']), ['c1', 'c2'])
  assert.throws(() => normalizeLotIds(['c1', 'C1']), /duplicate/)
})

test('pricing still covers exactly 200 lots', () => {
  const stats = lotBookStats()
  assert.equal(stats.lots, 200)
  assert.equal(stats.totalUsd, 300_000)
})

test('session cookie is signed and guest key comes from cookie', () => {
  const guestKey = 'guest_test_0123456789ab'
  const cookie = sidCookie(guestKey, { secure: true })
  const cookieHeader = cookie.split(';')[0]
  const req = { headers: { cookie: cookieHeader } }
  assert.equal(parseCookies(req).void_sid.startsWith(`${guestKey}.`), true)
  assert.equal(resolveGuestKey(req, 'guest_attacker_0123456789ab'), guestKey)
})

test('claim intent protects and atomically finalizes a paid batch', async () => {
  process.env.TURSO_DATABASE_URL = `file:${join(tmpdir(), `voidos-test-${Date.now()}.db`).replace(/\\/g, '/')}`
  const user = await getOrCreateUser(`intent_test_${Date.now()}`)
  const linked = await linkWallet(user.id, '0x4444444444444444444444444444444444444444')
  const intent = await createClaimIntent(linked.id, [{ id: 'C8', name: 'safe' }])
  const ownerships = await finalizePaidClaim(
    linked.id,
    '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    [{ id: 'c8', name: 'safe' }],
    intent.intentId,
  )
  assert.equal(ownerships[0].constel_id, 'c8')
})
