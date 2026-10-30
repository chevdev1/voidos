import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAddress } from '../src/os/lib.js'

test('resolveAddress sends built-in pages to the page', () => {
  assert.deepEqual(resolveAddress('void://docs'), { page: 'void://docs' })
  assert.deepEqual(resolveAddress('void://nope'), { page: 'void://start' })
})

test('resolveAddress turns a typed site into a full https url', () => {
  assert.equal(resolveAddress('x.com').url, 'https://x.com/')
  assert.equal(resolveAddress('https://robinhood.com/us/en').url, 'https://robinhood.com/us/en')
})

test('resolveAddress rejects empty and dotless input', () => {
  assert.ok(resolveAddress('').error)
  assert.ok(resolveAddress('localhost').error)
})

import { mapTrendingPools } from '../src/os/lib.js'

test('mapTrendingPools keeps missing market cap as NaN, not 0', () => {
  const rows = mapTrendingPools({
    data: [{ id: 'robinhood_0xp', attributes: { name: 'A / B', volume_usd: { h24: '10' }, market_cap_usd: null, fdv_usd: '500' } }],
  })
  assert.ok(Number.isNaN(rows[0].marketCap))
  assert.equal(rows[0].fdv, 500)
})
