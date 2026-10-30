// Runs a JavaScript file in a Web Worker: no window, no document, no localStorage, no wallet provider.
// The worker is stopped after `timeoutMs`, so loops cannot freeze the desktop.
// Network access is still available inside a worker; the UI says so.

const WORKER_SOURCE = `
self.onmessage = (event) => {
  const logs = [];
  const show = (value) => {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  };
  const push = (kind) => (...args) => logs.push({ kind, text: args.map(show).join(' ') });
  const sandboxConsole = { log: push('log'), info: push('log'), warn: push('warn'), error: push('error') };
  const started = Date.now();
  try {
    const fn = new Function('console', event.data.code);
    const result = fn(sandboxConsole);
    if (result !== undefined) logs.push({ kind: 'result', text: show(result) });
    self.postMessage({ ok: true, logs, ms: Date.now() - started });
  } catch (err) {
    self.postMessage({ ok: false, logs, error: String((err && err.message) || err), ms: Date.now() - started });
  }
};
`

export const TIMEOUT_MS = 2000

export function runInSandbox(code, { timeoutMs = TIMEOUT_MS, WorkerImpl = globalThis.Worker, urlApi = globalThis.URL } = {}) {
  return new Promise((resolve) => {
    if (!WorkerImpl) {
      resolve({ ok: false, logs: [], error: 'Workers are not available in this browser.', ms: 0 })
      return
    }
    const blob = new Blob([WORKER_SOURCE], { type: 'text/javascript' })
    const url = urlApi.createObjectURL(blob)
    const worker = new WorkerImpl(url)
    const started = Date.now()
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      urlApi.revokeObjectURL(url)
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({ ok: false, logs: [], error: `Stopped after ${timeoutMs / 1000}s (timeout).`, ms: Date.now() - started })
    }, timeoutMs)

    worker.onmessage = (event) => finish(event.data)
    worker.onerror = (event) => finish({ ok: false, logs: [], error: event.message || 'Worker error', ms: Date.now() - started })
    worker.postMessage({ code })
  })
}
