/**
 * Brand mark — lattice already cropped tight in the PNG so it fills
 * the circle at header size instead of reading as a tiny green speck.
 */
export function VoidLogo({ className = 'h-12 w-12 sm:h-16 sm:w-16', alt = '' }) {
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-lime/35 ${className}`}
    >
      <img
        src="/assets/void-logo.png"
        alt={alt}
        className="h-full w-full object-cover"
        style={{ filter: 'drop-shadow(0 0 10px rgba(204,255,0,0.5))' }}
      />
    </span>
  )
}
