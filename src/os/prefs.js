export const PREFS_KEY = 'void-os-prefs'

// Low-end devices (4 cores or less, or 4 GB of RAM or less) start with the galaxy wallpaper off.
export function isLowEndDevice() {
  const cores = navigator.hardwareConcurrency || 8
  const memory = navigator.deviceMemory || 8
  return cores <= 4 || memory <= 4
}

// Every setting the Settings app can change. Add a key here and in SECTIONS, nowhere else.
export function defaults() {
  return {
    wallpaper: !isLowEndDevice(), // galaxy behind the windows
    widgets: true, // clock and trending on the desktop
    dockMagnify: true, // icons grow under the pointer
    motion: true, // all animation (also off under the system reduced-motion setting)
    reduceTransparency: false, // solid panels instead of blur
    textSize: 'md', // sm | md | lg
    browserHome: 'void://start', // page a new browser window starts on
  }
}

const TEXT_SIZES = ['sm', 'md', 'lg']
const HOMES = ['void://start', 'void://docs']

export function readPrefs() {
  let stored = {}
  try {
    stored = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    stored = {}
  }
  const merged = { ...defaults(), ...stored }
  // Only accept known values, so a hand-edited or old value cannot break the desktop.
  if (!TEXT_SIZES.includes(merged.textSize)) merged.textSize = 'md'
  if (!HOMES.includes(merged.browserHome)) merged.browserHome = 'void://start'
  return merged
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* private mode or disabled storage: keep the setting for this session only */
  }
}

export function clearPrefs() {
  try {
    localStorage.removeItem(PREFS_KEY)
  } catch {
    /* ignore */
  }
}

export const TEXT_SIZE_OPTIONS = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Default' },
  { id: 'lg', label: 'Large' },
]

export const HOME_OPTIONS = [
  { id: 'void://start', label: 'Start' },
  { id: 'void://docs', label: 'Docs' },
]
