import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createVault, unlockVault, saveVault, passphraseProblem, toBase64, fromBase64 } from '../src/os/notes/vault.js'
import { render, inline, wikiLinks, tagsOf, backlinksTo, titleOf, wordCount } from '../src/os/notes/markdown.js'
import { monthGrid, monthTitle, shiftMonth } from '../src/os/calendar.js'
import { describe, parseForecast, forecastUrl } from '../src/os/weather.js'

// Tests use few PBKDF2 iterations so they run fast. The app uses ITERATIONS (600000).
const FAST = 1000

test('vault: a note round-trips through encryption with the right passphrase', async () => {
  const { stored, key, data } = await createVault('correct horse battery', FAST)
  assert.deepEqual(data.notes, [])
  const next = { ...data, notes: [{ id: '1', body: '# secret plan', folder: '', created: 0, updated: 0 }] }
  const box = await saveVault(key, stored, next)
  assert.ok(!JSON.stringify(box).includes('secret plan'), 'plaintext must not appear in storage')
  const opened = await unlockVault('correct horse battery', box)
  assert.equal(opened.data.notes[0].body, '# secret plan')
})

test('vault: a wrong passphrase is refused, with the same message every time', async () => {
  const { stored } = await createVault('correct horse battery', FAST)
  await assert.rejects(unlockVault('wrong passphrase!!', stored), /does not open this vault/)
})

test('vault: a changed byte in the ciphertext is detected (authenticated encryption)', async () => {
  const { stored, key, data } = await createVault('correct horse battery', FAST)
  const box = await saveVault(key, stored, { ...data, notes: [{ id: '1', body: 'x', folder: '', created: 0, updated: 0 }] })
  const bytes = fromBase64(box.box.ct)
  bytes[3] ^= 0x01
  const tampered = { ...box, box: { ...box.box, ct: toBase64(bytes) } }
  await assert.rejects(unlockVault('correct horse battery', tampered), /does not open this vault/)
})

test('vault: every save uses a fresh nonce', async () => {
  const { stored, key, data } = await createVault('correct horse battery', FAST)
  const a = await saveVault(key, stored, data)
  const b = await saveVault(key, stored, data)
  assert.notEqual(a.box.iv, b.box.iv)
  assert.notEqual(a.box.ct, b.box.ct)
})

test('vault: the passphrase must be long enough', () => {
  assert.ok(passphraseProblem('short'))
  assert.equal(passphraseProblem('long enough phrase'), null)
})

test('markdown: user text is escaped, so a note cannot inject markup', () => {
  const html = render('<script>alert(1)</script> and <img src=x onerror=alert(2)>')
  assert.ok(!html.includes('<script'))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('markdown: only http and https links become anchors', () => {
  assert.ok(inline('[bad](javascript:alert(1))').includes('javascript:') === false || !inline('[bad](javascript:alert(1))').includes('href="javascript'))
  assert.ok(inline('[ok](https://example.com)').includes('href="https://example.com"'))
})

test('markdown: headings, emphasis, lists, tasks, quotes, code and rules', () => {
  const html = render('# Title\n\nSome **bold** and *italic* and `code`.\n\n- one\n- two\n\n- [x] done\n- [ ] todo\n\n> quoted\n\n---')
  assert.ok(html.includes('<h1>Title</h1>'))
  assert.ok(html.includes('<strong>bold</strong>'))
  assert.ok(html.includes('<em>italic</em>'))
  assert.ok(html.includes('<code>code</code>'))
  assert.ok(html.includes('<ul>') && html.includes('<li>one</li>'))
  assert.ok(html.includes('is-done'))
  assert.ok(html.includes('<blockquote>quoted</blockquote>'))
  assert.ok(html.includes('<hr>'))
})

test('markdown: fenced code is escaped and kept as-is', () => {
  const html = render('```\n<b>not bold</b>\n```')
  assert.ok(html.includes('&lt;b&gt;not bold&lt;/b&gt;'))
  assert.ok(!html.includes('<b>'))
})

test('markdown: wiki links, tags and backlinks', () => {
  const notes = [
    { id: 'a', body: '# Alpha\nSee [[Beta]] and [[Gamma]].' },
    { id: 'b', body: '# Beta\n#ideas and #Wallet' },
    { id: 'c', body: '# Gamma\nno links' },
  ]
  assert.deepEqual(wikiLinks(notes[0].body), ['Beta', 'Gamma'])
  assert.deepEqual(tagsOf(notes[1].body), ['ideas', 'wallet'])
  assert.equal(backlinksTo(notes, 'beta').map((n) => n.id)[0], 'a')
  assert.equal(titleOf(notes[0].body), 'Alpha')
  assert.equal(titleOf('   \n\n'), 'Untitled')
  assert.equal(wordCount('one two  three'), 3)
  assert.ok(render('[[Beta]]').includes('data-note="Beta"'))
})

test('calendar: Monday-first grid with padding and today marked', () => {
  const rows = monthGrid(2026, 9, new Date(2026, 9, 30)) // October 2026
  assert.ok(rows.every((r) => r.length === 7))
  const days = rows.flat().filter(Boolean)
  assert.equal(days.length, 31)
  assert.equal(days.find((c) => c.isToday).day, 30)
  assert.equal(rows[0][0], null) // October 1, 2026 is a Thursday
  assert.equal(rows[0][3].day, 1)
})

test('calendar: month titles and navigation across years', () => {
  assert.match(monthTitle(2026, 9), /October 2026/)
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 })
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 })
})

test('weather: forecast url is built with the coordinates and parsed safely', () => {
  const url = forecastUrl(52.37, 4.89)
  assert.ok(url.startsWith('https://api.open-meteo.com/v1/forecast?'))
  assert.ok(url.includes('latitude=52.37'))
  const f = parseForecast({ current: { temperature_2m: 13.6, weather_code: 61, wind_speed_10m: 12.2 }, daily: { temperature_2m_max: [16], temperature_2m_min: [9] } })
  assert.equal(f.temp, 14)
  assert.equal(f.wind, 12)
  assert.equal(describe(61).label, 'Rain')
  assert.equal(describe(999).label, 'Unknown')
  assert.equal(parseForecast({}).temp, null)
})
