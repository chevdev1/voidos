import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resizeBox, MIN_W, MIN_H } from '../src/os/geometry.js'

const start = { x: 200, y: 150, w: 400, h: 300 }
const screen = { w: 1440, h: 900 }

test('dragging the east edge grows width only', () => {
  const b = resizeBox(start, [0, 0, 1, 0], 100, 50, screen)
  assert.deepEqual([b.x, b.y, b.w, b.h], [200, 150, 500, 300])
})

test('dragging the west edge moves the left side and keeps the right side fixed', () => {
  const b = resizeBox(start, [1, 0, 0, 0], -80, 0, screen)
  assert.equal(b.w, 480)
  assert.equal(b.x + b.w, start.x + start.w) // right edge did not move
})

test('dragging the north edge keeps the bottom fixed', () => {
  const b = resizeBox(start, [0, 1, 0, 0], 0, -60, screen)
  assert.equal(b.h, 360)
  assert.equal(b.y + b.h, start.y + start.h)
})

test('a corner moves two edges at once', () => {
  const b = resizeBox(start, [1, 1, 0, 0], -40, -30, screen)
  assert.deepEqual([b.x, b.y, b.w, b.h], [160, 120, 440, 330])
})

test('minimum size is enforced from every side', () => {
  const b = resizeBox(start, [0, 0, 1, 1], -1000, -1000, screen)
  assert.equal(b.w, MIN_W)
  assert.equal(b.h, MIN_H)
  const c = resizeBox(start, [1, 1, 0, 0], 1000, 1000, screen)
  assert.equal(c.w, MIN_W)
  assert.equal(c.h, MIN_H)
})

test('the box never leaves the screen', () => {
  const b = resizeBox(start, [0, 0, 1, 0], 5000, 0, screen)
  assert.ok(b.x + b.w <= screen.w)
  const t = resizeBox(start, [0, 1, 0, 0], 0, -5000, screen)
  assert.ok(t.y >= 40)
})
