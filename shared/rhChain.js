/**
 * Robinhood Chain (EVM) helpers — shared by Vercel API and browser.
 * Chain ids match mindlessrh.net: 4663 main, 46630 testnet.
 */

export const RH_CHAIN_MAIN = 4663
export const RH_CHAIN_TEST = 46630

export function rhChainId() {
  const n = Number(process.env.VITE_RH_CHAIN_ID || process.env.RH_CHAIN_ID || RH_CHAIN_MAIN)
  return Number.isFinite(n) && n > 0 ? n : RH_CHAIN_MAIN
}

export function rhRpcUrl() {
  const id = rhChainId()
  const fromEnv = String(process.env.RH_RPC_URL || process.env.VITE_RH_RPC_URL || '').trim()
  if (fromEnv) return fromEnv
  return id === RH_CHAIN_TEST
    ? 'https://rpc.testnet.chain.robinhood.com/rpc'
    : 'https://rpc.mainnet.chain.robinhood.com'
}

export function exoTokenAddress() {
  return String(
    process.env.EXO_TOKEN || process.env.VITE_EXO_TOKEN || process.env.VITE_EXO_CA || '',
  ).trim()
}

export function claimContractAddress() {
  return String(process.env.CLAIM_CONTRACT || process.env.VITE_CLAIM_CONTRACT || '').trim()
}

export function isEvmAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(addr || '').trim())
}

export function isClaimLive() {
  return Boolean(exoTokenAddress() && claimContractAddress())
}

/**
 * Claim + quote ABI. Matches contracts/ExoClaim.sol.
 * quote() is optional: if the deployed contract has only claim(), the wallet
 * still sends claim() after a best-effort approve.
 */
export const CLAIM_ABI = [
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'lotIds', type: 'bytes32[]' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'quote',
    stateMutability: 'view',
    inputs: [{ name: 'lotIds', type: 'bytes32[]' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'exoToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
]

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
]

/** Encode constellation id string as bytes32 for claim(lotIds). */
export function lotIdToBytes32(id) {
  const raw = String(id || '')
  const bytes = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(raw)
    : Uint8Array.from(Buffer.from(raw, 'utf8'))
  let hex = ''
  for (let i = 0; i < Math.min(bytes.length, 32); i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return `0x${hex.padEnd(64, '0')}`
}
