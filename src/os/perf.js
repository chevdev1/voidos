// Long-task counter for the desktop. Off by default: enable with ?perf=1 in the address.
// It records main-thread tasks longer than 50 ms, which are what users feel as lag.
// Results live on window.__perf so a test or a developer can read them.
export function startPerfWatch() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return
  if (!new URLSearchParams(window.location.search).has('perf')) return
  if (window.__perf) return
  const stats = { longTasks: 0, longest: 0, total: 0, since: performance.now() }
  window.__perf = {
    get: () => ({ ...stats, sinceMs: Math.round(performance.now() - stats.since) }),
    reset: () => Object.assign(stats, { longTasks: 0, longest: 0, total: 0, since: performance.now() }),
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        stats.longTasks += 1
        stats.total += e.duration
        stats.longest = Math.max(stats.longest, e.duration)
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    /* longtask not supported in this browser */
  }
}
