// macOS-style app tile: a rounded gradient plate with a white glyph on top.
// `grad` is [top, bottom]. `size` is 'lg' for the dock and 'sm' for window title bars.
export function AppTile({ Icon, grad, size = 'lg' }) {
  const glyph = size === 'lg' ? 30 : 12
  return (
    <span className={`os-tile os-tile-${size}`} style={{ '--g1': grad[0], '--g2': grad[1] }} aria-hidden="true">
      <Icon className="os-tile-glyph" width={glyph} height={glyph} />
    </span>
  )
}
