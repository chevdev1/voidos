import { verifyMessage, getAddress, createPublicClient, http, formatEther, formatUnits, decodeEventLog, zeroAddress } from 'viem'
import {
  rhChainId,
  rhRpcUrl,
  exoTokenAddress,
  claimContractAddress,
  isEvmAddress,
  ERC20_ABI,
  CLAIM_ABI,
  BURN_SINK,
  RH_CHAIN_MAIN,
  RH_CHAIN_TEST,
  lotIdToBytes32,
} from './rhChain.js'

function chainDef() {
  const id = rhChainId()
  return {
    id,
    name: id === RH_CHAIN_TEST ? 'Robinhood Chain Testnet' : 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rhRpcUrl()] } },
  }
}

export function publicRhClient() {
  return createPublicClient({
    chain: chainDef(),
    transport: http(rhRpcUrl()),
  })
}

/** EIP-191 personal_sign verify (viem). */
export async function verifyEvmLinkSignature({ address, message, signature }) {
  if (!isEvmAddress(address)) return false
  try {
    return await verifyMessage({
      address: getAddress(address),
      message: String(message || ''),
      signature: String(signature || ''),
    })
  } catch {
    return false
  }
}

export async function readRhBalances(address) {
  const addr = getAddress(address)
  const pub = publicRhClient()
  const wei = await pub.getBalance({ address: addr })
  const eth = Number(formatEther(wei))

  let exo = null
  const token = exoTokenAddress()
  if (token && isEvmAddress(token)) {
    try {
      const [raw, decimals] = await Promise.all([
        pub.readContract({
          address: getAddress(token),
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [addr],
        }),
        pub.readContract({
          address: getAddress(token),
          abi: ERC20_ABI,
          functionName: 'decimals',
        }),
      ])
      exo = Number(formatUnits(raw, decimals))
    } catch {
      exo = null
    }
  }

  const chain = chainDef()
  return {
    eth: Number(eth.toFixed(6)),
    exo: exo == null ? null : Number(exo),
    exoToken: token || null,
    chainId: chain.id,
    network: chain.name,
  }
}

/**
 * Confirm a claim tx on RH Chain before ledger write.
 * When claim contract is set, require receipt success + matching to (optional).
 */
export async function verifyClaimReceipt({ txHash, expectedFrom, minAmount = 0n, lotIds = [] }) {
  const hash = String(txHash || '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error('invalid tx hash')
  }
  const pub = publicRhClient()
  const receipt = await pub.getTransactionReceipt({ hash })
  if (!receipt) throw new Error('tx not found')
  if (receipt.status !== 'success') throw new Error('tx failed on chain')

  const contract = claimContractAddress()
  const token = exoTokenAddress()
  const to = String(receipt.to || '').toLowerCase()
  const ids = (lotIds || []).map((l) => String(l?.constel_id || l?.id || l || '').trim()).filter(Boolean)

  if (contract && isEvmAddress(contract)) {
    if (to !== getAddress(contract).toLowerCase()) {
      throw new Error('tx not sent to claim contract')
    }
    if (expectedFrom && isEvmAddress(expectedFrom) && ids.length) {
      for (const id of ids) {
        const locked = await pub.readContract({
          address: getAddress(contract),
          abi: CLAIM_ABI,
          functionName: 'claimedBy',
          args: [lotIdToBytes32(id)],
        })
        if (!locked || String(locked).toLowerCase() === zeroAddress) {
          throw new Error('lot not locked on chain')
        }
        if (getAddress(locked) !== getAddress(expectedFrom)) {
          throw new Error('lot locked to a different wallet on chain')
        }
      }
    }
  } else if (token && isEvmAddress(token)) {
    if (to !== getAddress(token).toLowerCase()) {
      throw new Error('tx not a token burn')
    }
    const dead = BURN_SINK.toLowerCase()
    const tokenLc = getAddress(token).toLowerCase()
    let paid = 0n
    for (const log of receipt.logs || []) {
      if (String(log.address || '').toLowerCase() !== tokenLc) continue
      try {
        const parsed = decodeEventLog({
          abi: ERC20_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (parsed.eventName === 'Transfer' && String(parsed.args.to || '').toLowerCase() === dead) {
          paid += BigInt(parsed.args.value)
        }
      } catch {
        /* skip non-transfer logs */
      }
    }
    const need = typeof minAmount === 'bigint' ? minAmount : BigInt(minAmount || 0)
    if (need > 0n && paid < need) {
      throw new Error('burn amount too small')
    }
  }

  if (expectedFrom && isEvmAddress(expectedFrom)) {
    const from = String(receipt.from || '').toLowerCase()
    if (from !== getAddress(expectedFrom).toLowerCase()) {
      throw new Error('tx sender mismatch')
    }
  }

  return {
    hash,
    blockNumber: Number(receipt.blockNumber),
    from: receipt.from,
    to: receipt.to,
    status: 'success',
  }
}

/** Train fuel: ERC-20 transfer to the burn sink (never ExoClaim.claim). */
export async function verifyBurnReceipt({ txHash, expectedFrom, minAmount = 0n }) {
  const hash = String(txHash || '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error('invalid tx hash')
  }
  const pub = publicRhClient()
  const receipt = await pub.getTransactionReceipt({ hash })
  if (!receipt) throw new Error('tx not found')
  if (receipt.status !== 'success') throw new Error('tx failed on chain')

  const token = exoTokenAddress()
  if (!token || !isEvmAddress(token)) throw new Error('claim token not set')
  const to = String(receipt.to || '').toLowerCase()
  if (to !== getAddress(token).toLowerCase()) {
    throw new Error('tx not a token burn')
  }
  const dead = BURN_SINK.toLowerCase()
  const tokenLc = getAddress(token).toLowerCase()
  let paid = 0n
  for (const log of receipt.logs || []) {
    if (String(log.address || '').toLowerCase() !== tokenLc) continue
    try {
      const parsed = decodeEventLog({
        abi: ERC20_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName === 'Transfer' && String(parsed.args.to || '').toLowerCase() === dead) {
        paid += BigInt(parsed.args.value)
      }
    } catch {
      /* skip */
    }
  }
  const need = typeof minAmount === 'bigint' ? minAmount : BigInt(minAmount || 0)
  if (need > 0n && paid < need) {
    throw new Error('burn amount too small')
  }
  if (expectedFrom && isEvmAddress(expectedFrom)) {
    const from = String(receipt.from || '').toLowerCase()
    if (from !== getAddress(expectedFrom).toLowerCase()) {
      throw new Error('tx sender mismatch')
    }
  }
  return {
    hash,
    blockNumber: Number(receipt.blockNumber),
    from: receipt.from,
    to: receipt.to,
    status: 'success',
  }
}
