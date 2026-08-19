import { useEffect, useState } from 'react'
import { LotFigure } from './LotFigure'

const PHONE_QUERY = '(max-width: 767px)'

/**
 * Phone-only mirror of the constellation currently open in the lot sheet.
 *
 * On a phone that sheet is a ~70vh bottom sheet and the map centers the
 * tapped constellation in the viewport — directly behind it. So at the one
 * moment the lot matters most (reading its price, pressing claim) the thing
 * being bought is the one thing you can't see. This puts it in the free band
 * above the sheet, using the same silhouette geometry the map and the
 * cabinet draw, so it reads as the same object rather than a second render
 * of it. Drag to turn it.
 */
export function LotPreview() {
  const [lot, setLot] = useState(null)
  const [phone, setPhone] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    const sync = () => setPhone(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const onOpen = (e) => setLot(e.detail || null)
    const onClose = () => setLot(null)
    window.addEventListener('void-lot-open', onOpen)
    window.addEventListener('void-lot-close', onClose)
    return () => {
      window.removeEventListener('void-lot-open', onOpen)
      window.removeEventListener('void-lot-close', onClose)
    }
  }, [])

  if (!phone || !lot) return null

  return (
    <div className="lot-preview">
      <div className="lot-preview-figure">
        <LotFigure
          key={lot.id}
          lot={{ constel_id: lot.id, constel_name: lot.name, figure: lot.figure }}
          interactive
          autoSpin
        />
      </div>
      <p className="lot-preview-cap">
        <b>{lot.name}</b>
        <span>
          {lot.kind} · {lot.stars}★
        </span>
      </p>
    </div>
  )
}
