// Window geometry shared by the frame and its tests. Pure: no DOM.
export const MENU_H = 40 // below the menu bar
export const MIN_W = 300
export const MIN_H = 220

// Resize from any edge: the box is clamped to the screen and to the minimum size. Returns the new box, clamped to the screen and the minimums.
export function resizeBox(start, edges, dx, dy, screen) {
  const [l, t, r, b] = edges
  let { x, y, w, h } = start
  if (r) w = start.w + dx
  if (b) h = start.h + dy
  if (l) {
    const nw = Math.max(MIN_W, Math.min(start.w - dx, start.x + start.w - 8))
    x = start.x + start.w - nw
    w = nw
  }
  if (t) {
    const nh = Math.max(MIN_H, Math.min(start.h - dy, start.y + start.h - MENU_H))
    y = start.y + start.h - nh
    h = nh
  }
  w = Math.max(MIN_W, Math.min(w, screen.w - x - 8))
  h = Math.max(MIN_H, Math.min(h, screen.h - y - 110))
  x = Math.max(8, Math.min(x, screen.w - 120))
  y = Math.max(MENU_H, Math.min(y, screen.h - 80))
  return { x, y, w, h }
}
