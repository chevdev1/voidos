import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BUILTIN, nowPlaying } from '../src/os/player.js'

test('every built-in track has a root, chords and a scale', () => {
  assert.equal(BUILTIN.length, 3)
  for (const t of BUILTIN) {
    assert.ok(t.root > 20 && t.root < 200, t.id)
    assert.ok(t.chords.length >= 2 && t.chords.every((c) => c.length >= 3), t.id)
    assert.ok(t.scale.length >= 5, t.id)
  }
})

test('nowPlaying is empty while paused and names the track while playing', () => {
  assert.equal(nowPlaying({ playing: false, mode: 'builtin', trackIndex: 0, files: [] }), null)
  assert.equal(nowPlaying({ playing: true, mode: 'builtin', trackIndex: 1, files: [] }), 'Orbit')
  assert.equal(nowPlaying({ playing: true, mode: 'file', fileIndex: 0, files: [{ name: 'song' }] }), 'song')
})
