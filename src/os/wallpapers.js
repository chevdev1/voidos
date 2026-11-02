// Desktop wallpapers. Built-in ones are CSS only (nearly free), plus the liquid shader and a user image.
export const CUSTOM_KEY = 'void-wallpaper-custom'
const MAX_EDGE = 1920
const MAX_CHARS = 2_500_000 // keeps the stored image well inside localStorage limits

export const WALLPAPERS = [
  { id: 'liquid', name: 'Liquid', css: 'os-wp-bg-liquid', thumb: '/os/wallpaper.webp' },
  { id: 'nebula', name: 'Nebula', css: 'os-wp-bg-nebula' },
  { id: 'stars', name: 'Starfield', css: 'os-wp-bg-stars' },
  { id: 'void', name: 'Void', css: 'os-wp-bg-void' },
  { id: 'custom', name: 'Your image', css: '' },
]

export const KINDS = WALLPAPERS.map((w) => w.id)

export function readCustom(storage = globalThis.localStorage) {
  try {
    const v = storage.getItem(CUSTOM_KEY)
    return typeof v === 'string' && v.startsWith('data:image/') ? v : null
  } catch {
    return null
  }
}

export function writeCustom(dataUrl, storage = globalThis.localStorage) {
  try {
    storage.setItem(CUSTOM_KEY, dataUrl)
    return true
  } catch {
    return false
  }
}

// Scales the picked image down and re-encodes it as JPEG. Returns a data URL or throws a readable error.
export async function prepareImage(file, doc = globalThis.document) {
  if (!/^image\//.test(file.type)) throw new Error('Pick an image file (jpg, png, webp).')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That image could not be read.'))
      el.src = url
    })
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = doc.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    let quality = 0.86
    let out = canvas.toDataURL('image/jpeg', quality)
    while (out.length > MAX_CHARS && quality > 0.5) {
      quality -= 0.1
      out = canvas.toDataURL('image/jpeg', quality)
    }
    if (out.length > MAX_CHARS) throw new Error('That image is too large to keep on this device. Try a smaller one.')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
