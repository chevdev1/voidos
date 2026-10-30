import { useSyncExternalStore } from 'react'

// One shared answer to "is this session protected right now?".
// Levels: off | connecting | vpn | ssh. The VPN panel and an SSH session publish their state here,
// and the browser reads it to decide whether to warn. Simulated in this build: nothing here touches the network.
let level = 'off'
const listeners = new Set()

export const isProtected = (l = level) => l === 'vpn' || l === 'ssh'

export function getProtection() {
  return level
}

export function setProtection(next) {
  if (next === level) return
  level = next
  listeners.forEach((fn) => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useProtection() {
  return useSyncExternalStore(subscribe, getProtection, getProtection)
}
