import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkUrl, isPrivateAddress, resolveSafe, clearDnsCache } from './safety.mjs'

test('checkUrl allows normal https sites', () => {
  assert.equal(checkUrl('https://example.com/a?b=1').ok, true)
  assert.equal(checkUrl('http://example.com').ok, true)
})

test('checkUrl refuses schemes, credentials, local names and odd ports', () => {
  assert.equal(checkUrl('file:///etc/passwd').ok, false)
  assert.equal(checkUrl('javascript:alert(1)').ok, false)
  assert.equal(checkUrl('https://user:pw@example.com').ok, false)
  assert.equal(checkUrl('http://localhost:3000').ok, false)
  assert.equal(checkUrl('http://intranet/').ok, false)
  assert.equal(checkUrl('https://example.com:8443').ok, false)
  assert.equal(checkUrl('not a url').ok, false)
})

test('checkUrl refuses private IP literals', () => {
  assert.equal(checkUrl('http://127.0.0.1/').ok, false)
  assert.equal(checkUrl('http://192.168.1.10/').ok, false)
  assert.equal(checkUrl('http://169.254.169.254/latest/meta-data').ok, false)
  assert.equal(checkUrl('http://[::1]/').ok, false)
})

test('isPrivateAddress covers the reserved ranges', () => {
  for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.0.1', '127.0.0.1', '169.254.1.1', '100.64.0.1', '0.0.0.0']) {
    assert.equal(isPrivateAddress(ip), true, ip)
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '93.184.216.34', '1.1.1.1']) {
    assert.equal(isPrivateAddress(ip), false, ip)
  }
  assert.equal(isPrivateAddress('::ffff:10.0.0.1'), true)
  assert.equal(isPrivateAddress('fd00::1'), true)
  assert.equal(isPrivateAddress('2606:4700::1111'), false)
})

test('resolveSafe refuses a name that resolves to a private address', async () => {
  clearDnsCache()
  const fakeLookup = async () => [{ address: '10.0.0.5', family: 4 }]
  assert.equal(await resolveSafe('evil.example', fakeLookup), false)
})

test('resolveSafe accepts public answers and refuses mixed answers', async () => {
  clearDnsCache()
  assert.equal(await resolveSafe('ok.example', async () => [{ address: '93.184.216.34', family: 4 }]), true)
  clearDnsCache()
  assert.equal(await resolveSafe('mixed.example', async () => [{ address: '93.184.216.34' }, { address: '127.0.0.1' }]), false)
})

test('resolveSafe refuses names that fail to resolve', async () => {
  clearDnsCache()
  assert.equal(await resolveSafe('nope.example', async () => { throw new Error('ENOTFOUND') }), false)
})
