import { audioContext } from './sound.js'

// Music lives here, not in the window, so it keeps playing when the player is closed.
// Two sources: built-in generative ambient (synthesized on the device) and MP3 files the user drops in.
// Files never leave the device: they play from an object URL that is revoked when removed.

// Built-in ambient. Semitones are relative to the root frequency.
export const BUILTIN = [
  {
    id: 'nebula',
    title: 'Nebula',
    sub: 'generative ambient · D lydian',
    root: 73.42,
    chords: [[0, 4, 7, 11], [0, 4, 7, 14], [-5, 0, 4, 7], [-2, 0, 4, 9]],
    scale: [0, 2, 4, 7, 9, 11, 12, 14, 16],
  },
  {
    id: 'orbit',
    title: 'Orbit',
    sub: 'generative ambient · A minor pentatonic',
    root: 55,
    chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 0, 5, 7], [-7, 0, 4, 7]],
    scale: [0, 3, 5, 7, 10, 12, 15, 17],
  },
  {
    id: 'drift',
    title: 'Drift',
    sub: 'generative ambient · E phrygian',
    root: 82.41,
    chords: [[0, 5, 7, 12], [-2, 3, 7, 10], [-4, 0, 3, 7], [-5, -2, 2, 7]],
    scale: [0, 1, 3, 5, 7, 8, 10, 12],
  },
]

const CHORD_MS = 9000
const VOICES = 4

const initial = {
  mode: 'builtin', // builtin | file
  trackIndex: 0,
  playing: false,
  volume: 0.6,
  elapsed: 0, // seconds in the current track
  duration: 0, // known for files only
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

const ambient = {
  ctx: null,
  master: null,
  delay: null,
  voices: [],
  chordTimer: null,
  bellTimer: null,
  clockTimer: null,
  chord: 0,
  track: null,
}

function ambientStart(track) {
  const c = audioContext()
  if (!c) return false
  ambientStop(true)
  ambient.ctx = c
  ambient.track = track

  const master = c.createGain()
  master.gain.value = 0.0001
  master.connect(c.destination)

  // Space: a long, dark delay that the bells feed into.
  const delay = c.createDelay(2)
  delay.delayTime.value = 0.62
  const feedback = c.createGain()
  feedback.gain.value = 0.42
  const wet = c.createGain()
  wet.gain.value = 0.35
  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(master)

  // Pads: detuned pairs of sine and triangle, through a slow, breathing low-pass.
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  lp.Q.value = 0.4
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = 0.045
  lfoGain.gain.value = 320
  lfo.connect(lfoGain).connect(lp.frequency)
  lfo.start()
  lp.connect(master)

  const voices = []
  for (let i = 0; i < VOICES; i++) {
    const g = c.createGain()
    g.gain.value = 0.0001
    g.gain.exponentialRampToValueAtTime(0.11, c.currentTime + 4)
    g.connect(lp)
    const a = c.createOscillator()
    const b = c.createOscillator()
    a.type = 'sine'
    b.type = 'triangle'
    b.detune.value = 6
    const ga = c.createGain()
    ga.gain.value = 0.6
    const gb = c.createGain()
    gb.gain.value = 0.35
    a.connect(ga).connect(g)
    b.connect(gb).connect(g)
    a.start()
    b.start()
    voices.push({ a, b, g })
  }

  ambient.master = master
  ambient.delay = delay
  ambient.voices = voices
  ambient.chord = 0
  setChord(track, 0, 4)
  master.gain.exponentialRampToValueAtTime(Math.max(0.0001, state.volume * 0.8), c.currentTime + 3)

  ambient.chordTimer = setInterval(() => {
    ambient.chord = (ambient.chord + 1) % track.chords.length
    setChord(track, ambient.chord, 2.5)
  }, CHORD_MS)

  ambient.bellTimer = setInterval(() => bell(track), 2600)
  return true
}

function setChord(track, index, glide) {
  const c = ambient.ctx
  const chord = track.chords[index]
  const t = c.currentTime
  ambient.voices.forEach((v, i) => {
    const semis = chord[i % chord.length] + (i >= chord.length ? 12 : 0)
    const freq = track.root * Math.pow(2, semis / 12)
    v.a.frequency.cancelScheduledValues(t)
    v.b.frequency.cancelScheduledValues(t)
    v.a.frequency.exponentialRampToValueAtTime(freq, t + glide)
    v.b.frequency.exponentialRampToValueAtTime(freq * 2, t + glide)
  })
}

function bell(track) {
  const c = ambient.ctx
  if (!c || !ambient.master) return
  if (Math.random() < 0.35) return // not every tick: silence is part of the mood
  const notes = track.scale
  const semis = notes[Math.floor(Math.random() * notes.length)] + 12
  const freq = track.root * 2 * Math.pow(2, semis / 12)
  const t = c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2)
  osc.connect(g)
  g.connect(ambient.master)
  g.connect(ambient.delay)
  osc.start(t)
  osc.stop(t + 3.3)
}

function ambientStop(immediate = false) {
  clearInterval(ambient.chordTimer)
  clearInterval(ambient.bellTimer)
  ambient.chordTimer = null
  ambient.bellTimer = null
  const c = ambient.ctx
  if (!c || !ambient.master) return
  const { master, voices, delay } = ambient
  const fade = immediate ? 0.05 : 1.6
  master.gain.cancelScheduledValues(c.currentTime)
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), c.currentTime)
  master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fade)
  setTimeout(() => {
    voices.forEach((v) => {
      v.a.stop()
      v.b.stop()
      v.a.disconnect()
      v.b.disconnect()
      v.g.disconnect()
    })
    master.disconnect()
    delay.disconnect()
  }, fade * 1000 + 100)
  ambient.master = null
  ambient.voices = []
  ambient.delay = null
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
  clearInterval(ambient.clockTimer)
  ambient.clockTimer = setInterval(() => {
    if (state.mode === 'builtin' && state.playing) emit({ elapsed: state.elapsed + 1 })
  }, 1000)
}

// ----- actions -----

export function play() {
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

export function pause() {
  if (state.mode === 'builtin') {
    ambientStop()
    clearInterval(ambient.clockTimer)
  } else if (audio) {
    audio.pause()
  }
  emit({ playing: false })
}

export function toggle() {
  if (state.playing) pause()
  else play()
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
  if (state.mode === 'builtin') {
    selectBuiltin((state.trackIndex + 1) % BUILTIN.length)
  } else if (state.files.length) {
    selectFile((state.fileIndex + 1) % state.files.length)
  }
}

export function prev() {
  if (state.mode === 'builtin') {
    selectBuiltin((state.trackIndex + BUILTIN.length - 1) % BUILTIN.length)
  } else if (state.files.length) {
    selectFile((state.fileIndex - 1 + state.files.length) % state.files.length)
  }
}

export function setVolume(v) {
  const volume = Math.min(1, Math.max(0, v))
  if (audio) audio.volume = volume
  if (ambient.master && ambient.ctx) {
    ambient.master.gain.setTargetAtTime(Math.max(0.0001, volume * 0.8), ambient.ctx.currentTime, 0.05)
  }
  emit({ volume })
}

export function seek(seconds) {
  if (state.mode === 'file' && audio && Number.isFinite(seconds)) audio.currentTime = seconds
}

// Accepts only audio files. Anything else is refused with a message, the list stays unchanged.
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

// Used by the menu bar indicator: the title of whatever is playing.
export function nowPlaying(s = state) {
  if (!s.playing) return null
  if (s.mode === 'builtin') return BUILTIN[s.trackIndex].title
  return s.files[s.fileIndex]?.name || null
}
