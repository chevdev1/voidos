import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scorePassword } from '../src/os/passwordScore.js'
import { randomMac, isValidMac } from '../src/os/mac.js'
import { toRow } from '../src/os/lib.js'

test('scorePassword rates empty, common and long passwords', () => {
  assert.equal(scorePassword('').label, 'empty')
  assert.ok(scorePassword('password123').score <= 1)
  assert.ok(scorePassword('Vq7!mWp2#Lr9xT4z').score >= 3)
})

test('scorePassword flags repeats and short length with tips', () => {
  const r = scorePassword('aaaa1111')
  assert.ok(r.tips.some((t) => /Repeated/.test(t)))
  assert.ok(r.tips.some((t) => /12 characters/.test(t)))
})

test('randomMac produces a valid locally administered unicast address', () => {
  for (let i = 0; i < 50; i++) {
    const m = randomMac()
    assert.ok(isValidMac(m), m)
    const first = parseInt(m.slice(0, 2), 16)
    assert.equal(first & 0x02, 0x02, 'local bit set')
    assert.equal(first & 0x01, 0, 'multicast bit clear')
  }
})

test('isValidMac rejects malformed input', () => {
  assert.equal(isValidMac('3c:22:fb:9e:41:07'), true)
  assert.equal(isValidMac('3c:22:fb:9e:41'), false)
  assert.equal(isValidMac('zz:22:fb:9e:41:07'), false)
})

test('toRow converts an RPC block to a display row', () => {
  const row = toRow({
    number: '0x10',
    gasUsed: '0x5208',
    gasLimit: '0xf4240',
    timestamp: '0x65000000',
    transactions: ['0x1', '0x2'],
  })
  assert.equal(row.num, 16)
  assert.equal(row.txs, 2)
  assert.equal(row.gasPct, 2)
})
