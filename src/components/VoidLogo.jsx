import logoUrl from '../assets/void-logo.png'

/**
 * Brand mark — Vite hashes this file into /assets/void-logo-[hash].png
 * so CDNs cannot keep serving the old public/ copy.
 */
export const VOID_LOGO_SRC = logoUrl

export function VoidLogo({ className = 'h-10 w-10 sm:h-12 sm:w-12', alt = '' }) {
  return (
    <span className={`relative inline-flex shrink-0 overflow-hidden rounded-full ${className}`}>
      <img src={VOID_LOGO_SRC} alt={alt} className="h-full w-full object-cover" />
    </span>
  )
}
