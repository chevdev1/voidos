// Weather for the desktop widget, from Open-Meteo (no API key, CORS enabled).
// Location: the browser's position if the user allows it, otherwise a city the user picks.
// Results are cached for 20 minutes, so the widget costs one request per session most of the time.

export const CITIES = [
  { name: 'Amsterdam', lat: 52.37, lon: 4.89 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
]

export const CACHE_KEY = 'void-weather'
export const CACHE_MS = 20 * 60 * 1000

// WMO weather codes, grouped into a short label and a glyph.
const WMO = {
  0: ['Clear', '☀'],
  1: ['Mostly clear', '☀'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁'],
  45: ['Fog', '≋'],
  48: ['Fog', '≋'],
  51: ['Drizzle', '☂'],
  53: ['Drizzle', '☂'],
  55: ['Drizzle', '☂'],
  61: ['Rain', '☂'],
  63: ['Rain', '☂'],
  65: ['Heavy rain', '☂'],
  71: ['Snow', '❄'],
  73: ['Snow', '❄'],
  75: ['Heavy snow', '❄'],
  80: ['Showers', '☂'],
  81: ['Showers', '☂'],
  82: ['Heavy showers', '☂'],
  95: ['Thunderstorm', '⚡'],
  96: ['Thunderstorm', '⚡'],
  99: ['Thunderstorm', '⚡'],
}

export function describe(code) {
  return WMO[code] ? { label: WMO[code][0], glyph: WMO[code][1] } : { label: 'Unknown', glyph: '·' }
}

export function forecastUrl(lat, lon) {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1',
  })
  return `https://api.open-meteo.com/v1/forecast?${q}`
}

// Reduces the API answer to what the widget shows. Missing fields become null.
export function parseForecast(json) {
  const c = json?.current || {}
  const d = json?.daily || {}
  const num = (v) => (Number.isFinite(v) ? Math.round(v) : null)
  return {
    temp: num(c.temperature_2m),
    wind: num(c.wind_speed_10m),
    code: Number.isFinite(c.weather_code) ? c.weather_code : null,
    hi: num(d.temperature_2m_max?.[0]),
    lo: num(d.temperature_2m_min?.[0]),
    at: Date.now(),
  }
}

export async function fetchWeather(lat, lon, fetchImpl = fetch) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 7000)
  try {
    const res = await fetchImpl(forecastUrl(lat, lon), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`weather ${res.status}`)
    return parseForecast(await res.json())
  } finally {
    clearTimeout(timer)
  }
}

export function readCache(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(CACHE_KEY) || 'null')
    return v && typeof v.at === 'number' ? v : null
  } catch {
    return null
  }
}

export function writeCache(value, storage = globalThis.localStorage) {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the widget just asks again next time */
  }
}

// Browser location with a timeout. Resolves null if denied, unavailable or slow.
export function currentPosition(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    const timer = setTimeout(() => resolve(null), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer)
        resolve({ lat: p.coords.latitude, lon: p.coords.longitude })
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
      { maximumAge: 30 * 60 * 1000, timeout: timeoutMs },
    )
  })
}
