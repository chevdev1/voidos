// UI sounds, synthesized with Web Audio. No files to ship, and nothing plays until the user has interacted
// with the page (browsers require that gesture before audio can start).
let ctx = null
let enabled = true
let lastClick = 0

export function setSoundsEnabled(on) {
  enabled = Boolean(on)
}

export function soundsEnabled() {
  return enabled
}

// Shared with the player, so both sounds and music use one audio graph.
export function audioContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// A soft, rounded tick: a sine that falls a fifth in 45 ms. Used for buttons, dock icons and tabs.
export function clickSoft() {
  if (!enabled) return
  const now = performance.now()
  if (now - lastClick < 35) return // a press that fires twice (pointer + click) is one sound
  lastClick = now
  const c = audioContext()
  if (!c) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1320, t)
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.045)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.07, t + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.08)
}

// Minimize: a short air whoosh, a band-pass noise that sweeps down.
export function whoosh() {
  if (!enabled) return
  const c = audioContext()
  if (!c) return
  const t = c.currentTime
  const len = Math.floor(c.sampleRate * 0.45)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(2400, t)
  filter.frequency.exponentialRampToValueAtTime(380, t + 0.4)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.09, t + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
  src.connect(filter).connect(gain).connect(c.destination)
  src.start(t)
  src.stop(t + 0.45)
}

// Restore and open-from-dock: two soft notes, a major third apart.
export function chime() {
  if (!enabled) return
  const c = audioContext()
  if (!c) return
  const t = c.currentTime
  ;[659.25, 830.61].forEach((freq, i) => {
    const start = t + i * 0.07
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
    osc.connect(gain).connect(c.destination)
    osc.start(start)
    osc.stop(start + 0.37)
  })
}
