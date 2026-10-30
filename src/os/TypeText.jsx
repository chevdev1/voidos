import { useEffect, useState } from 'react'

// Reveals text one character at a time. Used for fresh AI replies only.
// Under reduced motion (or when the caller opts out) it renders the full text at once.
export function TypeText({ text, speed = 16, instant = false }) {
  const [n, setN] = useState(instant ? text.length : 0)

  useEffect(() => {
    if (instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(text.length)
      return undefined
    }
    setN(0)
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(id)
          return v
        }
        return v + 1
      })
    }, speed)
    return () => clearInterval(id)
  }, [text, speed, instant])

  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="os-caret" aria-hidden="true" />}
    </>
  )
}
