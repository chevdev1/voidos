/**
 * Brand mark. Query bump forces browsers/CDN to drop the previous PNG.
 */
export const VOID_LOGO_SRC = '/assets/void-logo.png?v=5'

export function VoidLogo({ className = 'h-10 w-10 sm:h-12 sm:w-12', alt = '' }) {
  return (
    <span className={`relative inline-flex shrink-0 overflow-hidden rounded-full ${className}`}>
      <img
        src={VOID_LOGO_SRC}
        alt={alt}
        className="h-full w-full object-cover"
      />
    </span>
  )
}
