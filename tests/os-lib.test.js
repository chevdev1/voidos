import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyInput,
  explorerUrl,
  formatCompactUsd,
  formatPercent,
  mapTrendingPools,
} from '../src/os/lib.js'

test('classifyInput recognises address, tx, symbol and garbage', () => {
  const addr = '0x' + 'a'.repeat(40)
  const tx = '0x' + 'b'.repeat(64)
  assert.equal(classifyInput(addr).kind, 'address')
  assert.equal(classifyInput(tx).kind, 'tx')
  assert.equal(classifyInput(' void ').kind, 'symbol')
  assert.equal(classifyInput(' void ').value, 'VOID')
  assert.equal(classifyInput('').kind, 'empty')
  assert.equal(classifyInput('hello world!!').kind, 'unknown')
})

test('explorerUrl points tx and address to the right path', () => {
  const tx = '0x' + 'c'.repeat(64)
  assert.match(explorerUrl({ kind: 'tx', value: tx }), /\/tx\/0x/)
  assert.match(explorerUrl({ kind: 'address', value: '0x' + 'd'.repeat(40) }), /\/address\//)
})

test('formatters handle big, small and invalid numbers', () => {
  assert.equal(formatCompactUsd(1280000), '$1.28M')
  assert.equal(formatCompactUsd(950), '$950.00')
  assert.equal(formatCompactUsd(NaN), '—')
  assert.equal(formatPercent(-4.1), '-4.10%')
  assert.equal(formatPercent(2.2), '+2.20%')
})

test('mapTrendingPools maps GeckoTerminal shape and drops rows without volume', () => {
  const json = {
    data: [
      {
        id: 'robinhood_0xpool1',
        attributes: {
          name: 'NOVA / WETH 1%',
          base_token_price_usd: '0.5',
          reserve_in_usd: '1000',
          price_change_percentage: { h24: '3.5' },
          volume_usd: { h24: '2000' },
        },
      },
      { id: 'x', attributes: { name: 'NO VOLUME' } },
    ],
  }
  const rows = mapTrendingPools(json)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].symbol, 'NOVA')
  assert.equal(rows[0].volume24h, 2000)
  assert.equal(rows[0].poolAddress, '0xpool1')
  assert.deepEqual(mapTrendingPools({}), [])
})
