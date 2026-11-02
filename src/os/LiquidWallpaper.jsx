import { useEffect, useRef } from 'react'

// The wallpaper, alive. A small WebGL shader warps the static image with slow, layered waves, so the liquid
// seems to move. Cost: one textured quad at half resolution, capped at 30 fps, and it stops when the tab is hidden
// or motion is off. If WebGL is unavailable, the static image underneath still shows.
const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform vec2 u_scale;
uniform vec2 u_offset;
void main() {
  vec2 uv = v_uv * u_scale + u_offset;
  float t = u_time * 0.16;
  // two layers of slow domain warp: broad swells plus finer ripples
  vec2 w = vec2(sin(uv.y * 3.1 + t * 1.3), cos(uv.x * 2.6 - t * 1.1)) * 0.016;
  w += vec2(sin((uv.x + uv.y) * 6.5 + t * 2.1), cos((uv.x - uv.y) * 5.2 - t * 1.7)) * 0.006;
  vec4 c = texture2D(u_tex, clamp(uv + w, 0.0, 1.0));
  gl_FragColor = c;
}`

function compile(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
}

export function LiquidWallpaper({ animate = true }) {
  const canvas = useRef(null)

  useEffect(() => {
    const el = canvas.current
    const gl = el?.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false })
    if (!gl) return undefined

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return undefined
    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uScale = gl.getUniformLocation(prog, 'u_scale')
    const uOffset = gl.getUniformLocation(prog, 'u_offset')

    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0)

    let imgAspect = 1.57
    let raf = 0
    let last = 0
    let alive = true
    const img = new Image()
    img.onload = () => {
      if (!alive) return
      imgAspect = img.naturalWidth / img.naturalHeight
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
      frame(performance.now())
    }
    img.src = '/os/wallpaper.webp'

    // Cover-fit the image to the canvas, like background-size: cover.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1)
      const w = Math.max(1, Math.round(el.clientWidth * dpr * 0.5))
      const h = Math.max(1, Math.round(el.clientHeight * dpr * 0.5))
      el.width = w
      el.height = h
      gl.viewport(0, 0, w, h)
      const screen = w / h
      const sx = screen > imgAspect ? 1 : imgAspect / screen
      const sy = screen > imgAspect ? screen / imgAspect : 1
      gl.uniform2f(uScale, sx, sy)
      gl.uniform2f(uOffset, (1 - sx) / 2, (1 - sy) / 2)
      if (!animate) frame(performance.now())
    }

    const frame = (now) => {
      if (!alive) return
      // 30 fps is plenty for a slow liquid, and halves the work
      if (now - last >= 33) {
        last = now
        gl.uniform1f(uTime, now / 1000)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      if (animate && !document.hidden) raf = requestAnimationFrame(frame)
    }

    const onVis = () => {
      if (!document.hidden && animate) {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(frame)
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    document.addEventListener('visibilitychange', onVis)
    resize()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      gl.deleteTexture(tex)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [animate])

  return <canvas ref={canvas} className="os-liquid" aria-hidden="true" />
}
