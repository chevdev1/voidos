/**
 * Robinhood Chain (EVM) helpers — shared by Vercel API and browser.
 * Chain ids match mindlessrh.net: 4663 main, 46630 testnet.
 */

export const RH_CHAIN_MAIN = 4663
export const RH_CHAIN_TEST = 46630

/** Live $VOID on Robinhood Chain. */
export const TOKEN_SYMBOL = 'VOID'
export const DEFAULT_EXO_TOKEN = '0x55b7c52aed0f5b6010b3ec0a87f5b0d70a9b68e4'
/** DEX pair/pool address for $VOID — not the token CA. Set once liquidity is live
 *  (Dexscreener/GeckoTerminal pool id), via env (MARKET_POOL) or here. Empty until then
 *  so the market widget shows "—" instead of stale numbers from the old $TEST pool. */
export const DEFAULT_POOL = ''
export const DEFAULT_DEX_URL = DEFAULT_POOL ? `https://dexscreener.com/robinhood/${DEFAULT_POOL}` : ''
export const DEFAULT_GECKO_URL = DEFAULT_POOL
  ? `https://www.geckoterminal.com/robinhood/pools/${DEFAULT_POOL}`
  : ''
/** Burn sink — claim sends tokens here (no extra claim contract needed). */
export const BURN_SINK = '0x000000000000000000000000000000000000dEaD'
/** Tiny but visible amount so wallets don't show "0 VOID" and fail gas estimate. */
export const DEFAULT_CLAIM_PRICE_WEI = 10n ** 15n

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
    process.env.EXO_TOKEN || process.env.VITE_EXO_TOKEN || process.env.VITE_EXO_CA || DEFAULT_EXO_TOKEN,
  ).trim()
}

export function claimContractAddress() {
  return String(process.env.CLAIM_CONTRACT || process.env.VITE_CLAIM_CONTRACT || '').trim()
}

export function isEvmAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(addr || '').trim())
}

export function claimPricePerLotWei() {
  const raw = String(process.env.CLAIM_PRICE_WEI || process.env.VITE_CLAIM_PRICE_WEI || '').trim()
  if (raw) {
    try {
      const n = BigInt(raw)
      if (n > 0n) return n
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_CLAIM_PRICE_WEI
}

/** Token is enough: burn-to-dead. Optional CLAIM_CONTRACT uses ExoClaim instead. */
export function isClaimLive() {
  return isEvmAddress(exoTokenAddress())
}

export function claimConfig() {
  const contract = claimContractAddress()
  return {
    chainId: rhChainId(),
    token: exoTokenAddress().toLowerCase(),
    contract: isEvmAddress(contract) ? contract.toLowerCase() : null,
    priceWei: claimPricePerLotWei().toString(),
  }
}

export function claimTokensPerLot() {
  return Number(claimPricePerLotWei()) / 1e18
}

export function formatClaimBurn(lotCount = 1) {
  const n = Math.max(0, Number(lotCount) || 0)
  const t = claimTokensPerLot() * n
  if (!n || !t) return '0 $VOID'
  const s = t >= 0.01 ? t.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : t.toPrecision(2)
  return `${s} $VOID`
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
    name: 'claimedBy',
    stateMutability: 'view',
    inputs: [{ name: 'lotId', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'seedClaimed',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'lotIds', type: 'bytes32[]' },
      { name: 'owners', type: 'address[]' },
    ],
    outputs: [],
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
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
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
