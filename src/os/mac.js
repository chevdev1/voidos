// Locally administered unicast: bit 1 of the first octet set, multicast bit cleared.
export function randomMac() {
  const b = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256))
  b[0] = (b[0] | 0x02) & 0xfe
  return b.map((x) => x.toString(16).padStart(2, '0')).join(':')
}

export function isValidMac(s) {
  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(s)
}
