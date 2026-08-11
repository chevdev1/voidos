import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  getAddress,
  formatEther,
  formatUnits,
} from 'viem'
import {
  RH_CHAIN_MAIN,
  RH_CHAIN_TEST,
  CLAIM_ABI,
  ERC20_ABI,
  lotIdToBytes32,
} from '../../shared/rhChain.js'

function chainIdNum() {
  const n = Number(import.meta.env.VITE_RH_CHAIN_ID || RH_CHAIN_MAIN)
  return Number.isFinite(n) && n > 0 ? n : RH_CHAIN_MAIN
}

function rpcUrl() {
  const id = chainIdNum()
  const fromEnv = String(import.meta.env.VITE_RH_RPC_URL || '').trim()
  if (fromEnv) return fromEnv
  return id === RH_CHAIN_TEST
    ? 'https://rpc.testnet.chain.robinhood.com/rpc'
    : 'https://rpc.mainnet.chain.robinhood.com'
}

export function getRhChain() {
  const id = chainIdNum()
  const name =
    id === RH_CHAIN_TEST ? 'Robinhood Chain Testnet' : id === RH_CHAIN_MAIN ? 'Robinhood Chain' : `chain ${id}`
  return {
    id,
    name,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl()] } },
  }
}

export function exoTokenClient() {
  return String(import.meta.env.VITE_EXO_TOKEN || import.meta.env.VITE_EXO_CA || '').trim()
}

export function claimContractClient() {
  return String(import.meta.env.VITE_CLAIM_CONTRACT || '').trim()
}

export function isClaimLiveClient() {
  return Boolean(exoTokenClient() && claimContractClient())
}

export function hasWalletConnectProject() {
  return Boolean(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID)
}

/** Any injected EVM wallet (Robinhood in-app, Trust, MetaMask, …). */
export function getInjectedEvm() {
  if (typeof window === 'undefined') return null
  const eth = window.ethereum
  if (!eth?.request) return null
  return eth
}

/** Robinhood in-app EVM provider (not Solana). */
export function getRobinhoodInjected() {
  if (typeof window === 'undefined') return null
  const eth = window.ethereum
  if (!eth) return null
  if (eth.isRobinhood || eth.isRobinhoodWallet) return eth
  const list = Array.isArray(eth.providers) ? eth.providers : []
  const hit = list.find((p) => p?.isRobinhood || p?.isRobinhoodWallet)
  return hit || null
}

function publicClient() {
  return createPublicClient({
    chain: getRhChain(),
    transport: http(rpcUrl()),
  })
}

async function ensureChain(provider) {
  const chain = getRhChain()
  const hexId = `0x${chain.id.toString(16)}`
  try {
    const current = await provider.request({ method: 'eth_chainId' })
    if (String(current).toLowerCase() === hexId.toLowerCase()) return
  } catch {
    /* continue to switch */
  }
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexId }],
    })
  } catch (err) {
    const msg = String(err?.message || err || '')
    if (/already pending/i.test(msg)) {
      throw new Error(
        'MetaMask: старый запрос сети ещё открыт. Открой расширение MetaMask → Reject. Потом жми QR · Trust (не MetaMask).',
      )
    }
    if (err?.code === 4902 || /Unrecognized chain/i.test(msg)) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: hexId,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: [rpcUrl()],
              blockExplorerUrls: [
                chain.id === RH_CHAIN_TEST
                  ? 'https://explorer.testnet.chain.robinhood.com'
                  : 'https://robinhoodchain.blockscout.com',
              ],
            },
          ],
        })
      } catch (addErr) {
        const addMsg = String(addErr?.message || addErr || '')
        if (/already pending/i.test(addMsg)) {
          throw new Error(
            'MetaMask: запрос Add Network уже висит. Открой MetaMask → Reject. Потом используй QR · Trust.',
          )
        }
        throw addErr
      }
    } else {
      throw err
    }
  }
}

async function connectInjected() {
  const provider = getRobinhoodInjected() || getInjectedEvm()
  if (!provider?.request) throw new Error('no EVM wallet — use Trust / MetaMask / Robinhood, or WalletConnect QR')
  await ensureChain(provider)
  const accounts = await provider.request({ method: 'eth_requestAccounts' })
  const address = getAddress(accounts[0])
  return { provider, address }
}

let wcProvider = null

async function connectWalletConnect() {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
  if (!projectId) throw new Error('set VITE_WALLETCONNECT_PROJECT_ID (Reown)')
  const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
  const chain = getRhChain()
  if (wcProvider) {
    try {
      await wcProvider.disconnect()
    } catch {
      /* ignore */
    }
    wcProvider = null
  }
  wcProvider = await EthereumProvider.init({
    projectId,
    showQrModal: true,
    chains: [chain.id],
    optionalChains: [RH_CHAIN_MAIN, RH_CHAIN_TEST],
    rpcMap: { [chain.id]: rpcUrl() },
    metadata: {
      name: 'VOID.OS',
      description: 'ExoMind constellation lots on Robinhood Chain',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://void.os',
      icons: [
        typeof window !== 'undefined'
          ? `${window.location.origin}/assets/void-logo.png`
          : 'https://void.os/assets/void-logo.png',
      ],
    },
  })
  await wcProvider.enable()
  // Do not force wallet_addEthereumChain on WC — Trust may already be on testnet from faucet.
  try {
    await ensureChain(wcProvider)
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (!/already pending|MetaMask/i.test(msg)) throw e
    // Continue — sign/link can still work; wrong chain shows later on balance/claim.
  }
  const accounts = wcProvider.accounts?.length
    ? wcProvider.accounts
    : await wcProvider.request({ method: 'eth_accounts' })
  if (!accounts?.[0]) throw new Error('no account from WalletConnect')
  return { provider: wcProvider, address: getAddress(accounts[0]) }
}

/**
 * Link wallet + EIP-191 sign.
 * mode: 'qr' | 'injected' | 'auto'
 * 'qr' NEVER falls back to MetaMask — needs VITE_WALLETCONNECT_PROJECT_ID.
 */
export async function connectAndSignLink(message, opts = {}) {
  const mode = opts.mode || 'qr'
  let provider
  let address

  if (mode === 'qr') {
    if (!hasWalletConnectProject()) {
      throw new Error(
        'Нет VITE_WALLETCONNECT_PROJECT_ID на Vercel. Добавь Project ID → Redeploy. Без этого QR для Trust не работает (MetaMask тут ни при чём).',
      )
    }
    ;({ provider, address } = await connectWalletConnect())
  } else if (mode === 'injected') {
    ;({ provider, address } = await connectInjected())
  } else if (getRobinhoodInjected()) {
    ;({ provider, address } = await connectInjected())
  } else if (hasWalletConnectProject()) {
    ;({ provider, address } = await connectWalletConnect())
  } else {
    throw new Error('Нет WalletConnect Project ID и нет browser wallet')
  }

  const walletClient = createWalletClient({
    account: address,
    chain: getRhChain(),
    transport: custom(provider),
  })
  const signature = await walletClient.signMessage({
    account: address,
    message: String(message),
  })
  return { pubkey: address, address, signature, walletLabel: mode === 'injected' ? 'browser' : 'WalletConnect' }
}

export async function readBalances(address) {
  const pub = publicClient()
  const addr = getAddress(address)
  const wei = await pub.getBalance({ address: addr })
  const eth = Number(formatEther(wei))

  let exo = null
  const token = exoTokenClient()
  if (token) {
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

  return {
    eth: Number(eth.toFixed(6)),
    exo: exo == null ? null : Number(exo),
    exoToken: token || null,
    chainId: chainIdNum(),
    network: getRhChain().name,
  }
}

/**
 * On-chain claim when VITE_CLAIM_CONTRACT + VITE_EXO_TOKEN are set.
 * lotIds: constellation string ids → bytes32.
 */
export async function claimOnChain(lotIds = []) {
  if (!isClaimLiveClient()) {
    throw new Error('claim contract not live — set VITE_CLAIM_CONTRACT + VITE_EXO_TOKEN')
  }
  const ids = (lotIds || []).map(String).filter(Boolean)
  if (!ids.length) throw new Error('no lots to claim')

  const injected = getRobinhoodInjected()
  const { provider, address } = injected
    ? await connectInjected()
    : wcProvider
      ? { provider: wcProvider, address: getAddress(wcProvider.accounts[0]) }
      : await connectWalletConnect()

  const walletClient = createWalletClient({
    account: address,
    chain: getRhChain(),
    transport: custom(provider),
  })
  const hash = await walletClient.writeContract({
    address: getAddress(claimContractClient()),
    abi: CLAIM_ABI,
    functionName: 'claim',
    args: [ids.map(lotIdToBytes32)],
    account: address,
    chain: getRhChain(),
  })
  const pub = publicClient()
  const receipt = await pub.waitForTransactionReceipt({ hash })
  return { hash, receipt, address, lotIds: ids }
}
