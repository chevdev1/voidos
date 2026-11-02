import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMarkets, usdValue, randomAddress, randomBalances, makeDemoAccount, readDemo, writeDemo, assetsOf, COINS } from '../src/os/walletData.js'

const memory = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

test('parseMarkets maps CoinGecko rows to our symbols and keeps missing values as null', () => {
  const out = parseMarkets([
    { id: 'bitcoin', current_price: 77000, price_change_percentage_24h: -2.5, image: 'https://img/btc.png' },
    { id: 'ethereum', current_price: null, price_change_percentage_24h: null, image: 'https://img/eth.png' },
  ])
  assert.equal(out.BTC.usd, 77000)
  assert.equal(out.BTC.change, -2.5)
  assert.equal(out.BTC.image, 'https://img/btc.png')
  assert.equal(out.ETH.usd, null) // never a guessed price
  assert.equal(out.SOL.usd, null)
  assert.deepEqual(Object.keys(out).sort(), Object.keys(COINS).sort())
})

test('usdValue is null when the price is unknown', () => {
  assert.equal(usdValue(2, 150), 300)
  assert.equal(usdValue(2, null), null)
  assert.equal(usdValue(NaN, 150), null)
})

test('random demo addresses are 0x + 40 hex, and balances stay in range', () => {
  for (let i = 0; i < 20; i++) assert.match(randomAddress(), /^0x[0-9a-f]{40}$/)
  const b = randomBalances()
  for (const sym of Object.keys(COINS)) assert.ok(b[sym] >= 0, sym)
  assert.ok(b.BTC <= 0.05 && b.ETH <= 3)
})

test('demo accounts are created with names, addresses and balances', () => {
  const a = makeDemoAccount(3)
  assert.equal(a.name, 'Demo account 3')
  assert.match(a.address, /^0x[0-9a-f]{40}$/)
  assert.deepEqual(Object.keys(a.balances).sort(), Object.keys(COINS).sort())
  assert.equal(assetsOf(a.balances).length, Object.keys(COINS).length)
})

test('demo accounts persist, and a damaged store is ignored', () => {
  const s = memory()
  assert.equal(readDemo(s), null)
  const v = { accounts: [makeDemoAccount(1), makeDemoAccount(2)], active: 'x' }
  v.active = v.accounts[1].id
  writeDemo(v, s)
  assert.equal(readDemo(s).accounts.length, 2)
  s.setItem('void-wallet-demo', '{"accounts":[{"bad":1}],"active":"x"}')
  assert.equal(readDemo(s), null)
})
