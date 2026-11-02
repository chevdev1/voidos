import { audioContext } from './sound.js'

// Music lives here, not in a window, so it survives closing the player.
// Built-in ambient is synthesized on the device: soft pads in a warm register, a long convolution reverb
// and glassy bells. Your own audio files play from an object URL that is revoked when removed.

// Built-in ambient. Semitones are relative to the root frequency. Roots sit high enough to avoid rumble.
export const BUILTIN = [
  {
    id: 'nebula',
    title: 'Nebula',
    sub: 'ambient pads · D lydian',
    root: 146.83, // D3
    chords: [[0, 4, 7, 11], [0, 4, 7, 14], [-5, 0, 4, 7], [-2, 0, 4, 9]],
    scale: [0, 2, 4, 6, 7, 9, 11, 12, 14],
  },
  {
    id: 'orbit',
    title: 'Orbit',
    sub: 'ambient pads · A minor pentatonic',
    root: 110, // A2
    chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 0, 5, 7], [-7, 0, 4, 7]],
    scale: [0, 3, 5, 7, 10, 12, 15, 17],
  },
  {
    id: 'drift',
    title: 'Drift',
    sub: 'ambient pads · E phrygian',
    root: 164.81, // E3
    chords: [[0, 5, 7, 12], [-2, 3, 7, 10], [-4, 0, 3, 7], [-5, -2, 2, 7]],
    scale: [0, 1, 3, 5, 7, 8, 10, 12],
  },
]

const CHORD_MS = 12000
const VOICES = 4
const STOP_KEY = 'void-os-player-stopped'

const initial = {
  mode: 'builtin', // builtin | file
  trackIndex: 0,
  playing: false,
  volume: 0.6,
  elapsed: 0,
  duration: 0,
  files: [], // { id, name, url }
  fileIndex: -1,
  error: '',
}

let state = { ...initial, ...readSaved() }
const listeners = new Set()
let fileId = 0

function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem('void-os-player') || '{}')
    return typeof v.volume === 'number' ? { volume: Math.min(1, Math.max(0, v.volume)) } : {}
  } catch {
    return {}
  }
}

function userStopped() {
  try {
    return localStorage.getItem(STOP_KEY) === '1'
  } catch {
    return false
  }
}

function setUserStopped(on) {
  try {
    if (on) localStorage.setItem(STOP_KEY, '1')
    else localStorage.removeItem(STOP_KEY)
  } catch {
    /* ignore */
  }
}

function emit(next) {
  state = { ...state, ...next }
  try {
    localStorage.setItem('void-os-player', JSON.stringify({ volume: state.volume }))
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn())
}

export const getPlayer = () => state
export function subscribePlayer(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ----- generative ambient -----

const amb = { ctx: null, bus: null, verb: null, master: null, voices: [], chordTimer: null, bellTimer: null, clockTimer: null, chord: 0, track: null, stopTimer: null }

function impulse(c, seconds = 5, decay = 3.4) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function ambientStart(track) {
  const c = audioContext()
  if (!c) return false
  ambientStop(true)
  amb.ctx = c
  amb.track = track

  const master = c.createGain()
  master.gain.value = 0.0001
  master.connect(c.destination)

  const verb = c.createConvolver()
  verb.buffer = impulse(c)
  const wet = c.createGain()
  wet.gain.value = 0.55
  verb.connect(wet).connect(master)

  // Warm, slow filter: the pads breathe without ever getting harsh.
  const bus = c.createBiquadFilter()
  bus.type = 'lowpass'
  bus.frequency.value = 2200
  bus.Q.value = 0.3
  const lfo = c.createOscillator()
  const lfoAmt = c.createGain()
  lfo.frequency.value = 0.03
  lfoAmt.gain.value = 420
  lfo.connect(lfoAmt).connect(bus.frequency)
  lfo.start()
  bus.connect(master)
  bus.connect(verb)

  const voices = []
  for (let i = 0; i < VOICES; i++) {
    const g = c.createGain()
    g.gain.value = 0.0001
    g.gain.exponentialRampToValueAtTime(0.09, c.currentTime + 6) // slow, soft entrance
    g.connect(bus)
    // Two sines a hair apart give a gentle shimmer; a quiet octave adds air. No triangles or saws: they buzz.
    const a = c.createOscillator()
    const b = c.createOscillator()
    const o = c.createOscillator()
    a.type = 'sine'
    b.type = 'sine'
    o.type = 'sine'
    b.detune.value = 4
    o.detune.value = -3
    const ga = c.createGain()
    ga.gain.value = 0.5
    const gb = c.createGain()
    gb.gain.value = 0.4
    const go = c.createGain()
    go.gain.value = 0.1
    a.connect(ga).connect(g)
    b.connect(gb).connect(g)
    o.connect(go).connect(g)
    a.start()
    b.start()
    o.start()
    voices.push({ a, b, o, g, ga, gb, go })
  }

  amb.master = master
  amb.bus = bus
  amb.verb = verb
  amb.voices = voices
  amb.chord = 0
  setChord(track, 0, 5)
  master.gain.exponentialRampToValueAtTime(Math.max(0.0001, state.volume * 0.42), c.currentTime + 4)

  amb.chordTimer = setInterval(() => {
    amb.chord = (amb.chord + 1) % track.chords.length
    setChord(track, amb.chord, 5)
  }, CHORD_MS)
  amb.bellTimer = setInterval(() => bell(track), 3800)
  return true
}

function setChord(track, index, glide) {
  const c = amb.ctx
  const chord = track.chords[index]
  const t = c.currentTime
  amb.voices.forEach((v, i) => {
    const semis = chord[i % chord.length] + (i >= chord.length ? 12 : 0)
    const freq = track.root * Math.pow(2, semis / 12)
    for (const osc of [v.a, v.b, v.o]) osc.frequency.cancelScheduledValues(t)
    v.a.frequency.exponentialRampToValueAtTime(freq, t + glide)
    v.b.frequency.exponentialRampToValueAtTime(freq, t + glide)
    v.o.frequency.exponentialRampToValueAtTime(freq * 2, t + glide)
  })
}

// A glassy bell: a pure sine two octaves above the pad, long decay, mostly sent to the reverb.
function bell(track) {
  const c = amb.ctx
  if (!c || !amb.master || Math.random() < 0.45) return
  const semis = track.scale[Math.floor(Math.random() * track.scale.length)] + 24
  const freq = track.root * Math.pow(2, semis / 12)
  const t = c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.035, t + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 5)
  osc.connect(g)
  g.connect(amb.verb)
  g.connect(amb.bus)
  osc.start(t)
  osc.stop(t + 5.1)
}

function ambientStop(immediate = false) {
  clearInterval(amb.chordTimer)
  clearInterval(amb.bellTimer)
  amb.chordTimer = null
  amb.bellTimer = null
  const c = amb.ctx
  if (!c || !amb.master) return
  const { master, voices, bus, verb } = amb
  const fade = immediate ? 0.05 : 1.8
  master.gain.cancelScheduledValues(c.currentTime)
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), c.currentTime)
  master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fade)
  clearTimeout(amb.stopTimer)
  amb.stopTimer = setTimeout(() => {
    voices.forEach((v) => {
      v.a.stop()
      v.b.stop()
      v.o.stop()
      v.g.disconnect()
    })
    bus.disconnect()
    verb.disconnect()
    master.disconnect()
  }, fade * 1000 + 150)
  amb.master = null
  amb.voices = []
}

// ----- MP3 files -----

const audio = typeof Audio !== 'undefined' ? new Audio() : null
if (audio) {
  audio.preload = 'auto'
  audio.addEventListener('timeupdate', () => emit({ elapsed: audio.currentTime, duration: audio.duration || 0 }))
  audio.addEventListener('ended', () => next())
  audio.addEventListener('error', () => emit({ playing: false, error: 'This file could not be played.' }))
}

function startClock() {
  clearInterval(amb.clockTimer)
  amb.clockTimer = setInterval(() => {
    if (state.mode === 'builtin' && state.playing) emit({ elapsed: state.elapsed + 1 })
  }, 1000)
}

// ----- actions -----

export function play() {
  setUserStopped(false)
  if (state.mode === 'builtin') {
    const track = BUILTIN[state.trackIndex]
    if (!ambientStart(track)) return emit({ error: 'Audio is not available in this browser.' })
    startClock()
    if (audio) audio.pause()
    return emit({ playing: true, error: '' })
  }
  const file = state.files[state.fileIndex]
  if (!file || !audio) return
  if (audio.src !== file.url) audio.src = file.url
  audio.volume = state.volume
  audio.play().then(() => emit({ playing: true, error: '' })).catch(() => emit({ playing: false, error: 'Press play again to start the file.' }))
  ambientStop()
}

// byUser: a press on pause is remembered, so music does not come back on its own after a reload.
export function pause(byUser = false) {
  if (byUser) setUserStopped(true)
  if (state.mode === 'builtin') {
    ambientStop()
    clearInterval(amb.clockTimer)
  } else if (audio) {
    audio.pause()
  }
  emit({ playing: false })
}

export function toggle() {
  if (state.playing) pause(true)
  else play()
}

// Start the music as soon as the desktop is ready. Browsers only let audio start after a user gesture,
// so if the page is not allowed to play yet, the first click or key press anywhere starts it.
export function autostart() {
  if (state.playing || userStopped()) return
  const c = audioContext()
  if (c && c.state === 'running') {
    play()
    return
  }
  const go = () => {
    window.removeEventListener('pointerdown', go, true)
    window.removeEventListener('keydown', go, true)
    if (!state.playing && !userStopped()) play()
  }
  window.addEventListener('pointerdown', go, true)
  window.addEventListener('keydown', go, true)
}

export function selectBuiltin(index) {
  pause()
  emit({ mode: 'builtin', trackIndex: index, elapsed: 0, duration: 0, error: '' })
  play()
}

export function selectFile(index) {
  if (!state.files[index]) return
  if (audio) audio.pause()
  ambientStop()
  emit({ mode: 'file', fileIndex: index, elapsed: 0, duration: 0, playing: false, error: '' })
  play()
}

export function next() {
  if (state.mode === 'builtin') selectBuiltin((state.trackIndex + 1) % BUILTIN.length)
  else if (state.files.length) selectFile((state.fileIndex + 1) % state.files.length)
}

export function prev() {
  if (state.mode === 'builtin') selectBuiltin((state.trackIndex + BUILTIN.length - 1) % BUILTIN.length)
  else if (state.files.length) selectFile((state.fileIndex - 1 + state.files.length) % state.files.length)
}

export function setVolume(v) {
  const volume = Math.min(1, Math.max(0, v))
  if (audio) audio.volume = volume
  if (amb.master && amb.ctx) amb.master.gain.setTargetAtTime(Math.max(0.0001, volume * 0.42), amb.ctx.currentTime, 0.05)
  emit({ volume })
}

export function seek(seconds) {
  if (state.mode === 'file' && audio && Number.isFinite(seconds)) audio.currentTime = seconds
}

export function addFiles(fileList) {
  const added = []
  for (const f of Array.from(fileList || [])) {
    if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|ogg|wav|flac)$/i.test(f.name)) continue
    added.push({ id: ++fileId, name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) })
  }
  if (!added.length) return emit({ error: 'Only audio files can be added (mp3, m4a, ogg, wav, flac).' })
  const files = [...state.files, ...added]
  emit({ files, error: '' })
  if (state.mode !== 'file' || state.fileIndex < 0) selectFile(files.length - added.length)
}

export function removeFile(index) {
  const f = state.files[index]
  if (!f) return
  URL.revokeObjectURL(f.url)
  const files = state.files.filter((_, i) => i !== index)
  if (state.mode === 'file' && state.fileIndex === index) {
    if (audio) audio.pause()
    emit({ files, fileIndex: -1, playing: false, mode: 'builtin', elapsed: 0, duration: 0 })
  } else {
    emit({ files, fileIndex: state.fileIndex > index ? state.fileIndex - 1 : state.fileIndex })
  }
}

// Title of whatever is playing, for the menu bar and the desktop widget.
export function nowPlaying(s = state) {
  if (!s.playing) return null
  if (s.mode === 'builtin') return BUILTIN[s.trackIndex].title
  return s.files[s.fileIndex]?.name || null
}
