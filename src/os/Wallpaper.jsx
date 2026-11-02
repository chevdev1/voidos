import { LiquidWallpaper } from './LiquidWallpaper.jsx'
import { WALLPAPERS, readCustom } from './wallpapers.js'

// The desktop background. Liquid is the animated shader over the image; the others are CSS (nearly free).
export function Wallpaper({ kind = 'liquid', animate = true }) {
  if (kind === 'liquid') {
    return (
      <div className="os-wallpaper os-wp-bg-liquid" aria-hidden="true">
        <LiquidWallpaper animate={animate} />
      </div>
    )
  }
  if (kind === 'custom') {
    const url = readCustom()
    if (url) {
      return <div className="os-wallpaper" style={{ backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} aria-hidden="true" />
    }
  }
  const w = WALLPAPERS.find((x) => x.id === kind) ?? WALLPAPERS[0]
  return <div className={`os-wallpaper ${w.css}`} aria-hidden="true" />
}
