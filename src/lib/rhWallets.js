import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  getAddress,
  formatEther,
  formatUnits,
  toHex,
} from 'viem'
import {
  RH_CHAIN_MAIN,
  RH_CHAIN_TEST,
  CLAIM_ABI,
  ERC20_ABI,
  DEFAULT_EXO_TOKEN,
  BURN_SINK,
  claimPricePerLotWei,
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
  return String(
    import.meta.env.VITE_EXO_TOKEN || import.meta.env.VITE_EXO_CA || DEFAULT_EXO_TOKEN || '',
  ).trim()
}

export function claimContractClient() {
  return String(import.meta.env.VITE_CLAIM_CONTRACT || '').trim()
}

export function isClaimLiveClient() {
  return Boolean(exoTokenClient())
}

export function hasWalletConnectProject() {
  return Boolean(String(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '').trim())
}

/** Phone / tablet — Trust deep-link path is better than desktop QR grid. */
export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true
  return Boolean(navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || ''))
}

/** Trust / MetaMask / any injected EVM (incl. Trust dApp browser). */
export function getInjectedEvm() {
  if (typeof window === 'undefined') return null
  const eth = window.ethereum
  if (!eth?.request) return null
  return eth
}

export function isTrustInjected() {
  const eth = getInjectedEvm()
  if (!eth) return false
  if (eth.isTrust || eth.isTrustWallet) return true
  const list = Array.isArray(eth.providers) ? eth.providers : []
  return list.some((p) => p?.isTrust || p?.isTrustWallet)
}

/** Open current page inside Trust Wallet browser (best mobile path). */
export function openSiteInTrustWallet() {
  if (typeof window === 'undefined') return
  const url = encodeURIComponent(window.location.href)
  window.location.href = `https://link.trustwallet.com/open_url?coin_id=60&url=${url}`
}

/**
 * Best connect path for this device:
 * - injected when Trust/MetaMask browser already present
 * - WalletConnect QR/deeplink otherwise
 */
export function pickConnectMode() {
  if (getInjectedEvm()) return 'injected'
  if (hasWalletConnectProject()) return 'qr'
  return null
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

/** Ethereum mainnet — Trust always accepts this for WC session + personal_sign. */
const ETH_MAINNET = {
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://ethereum.publicnode.com'] } },
}

function publicClient() {
  return createPublicClient({
    chain: getRhChain(),
    transport: http(rpcUrl()),
  })
}

function isWalletConnectProvider(provider) {
  if (!provider) return false
  if (wcProvider && provider === wcProvider) return true
  return Boolean(provider.isWalletConnect || provider.session)
}

async function readChainId(provider) {
  try {
    const current = await provider.request({ method: 'eth_chainId' })
    return String(current || '').toLowerCase()
  } catch {
    return ''
  }
}

async function ensureChain(provider) {
  const chain = getRhChain()
  const hexId = `0x${chain.id.toString(16)}`
  const current = await readChainId(provider)
  if (current && current === hexId.toLowerCase()) return

  // Trust / WalletConnect sessions often have no wallet_switchEthereumChain.
  // Let the next tx use whatever network the user picked in the wallet.
  if (isWalletConnectProvider(provider)) return

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexId }],
    })
  } catch (err) {
    const msg = String(err?.message || err || '')
    if (/already pending/i.test(msg)) {
      throw new Error(
        'Wallet still has a pending network request. Open the wallet → Reject, then claim again.',
      )
    }
    if (/Missing or invalid|does not exist|not supported|wallet_switchEthereumChain/i.test(msg)) {
      throw new Error(
        'This wallet cannot auto-switch. Pick Robinhood Chain in the wallet, then claim again.',
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
          throw new Error('Wallet still has a pending Add Network request. Reject it, then retry.')
        }
        if (/Missing or invalid|not supported|wallet_addEthereumChain/i.test(addMsg)) {
          throw new Error(
            'Add Robinhood Chain in the wallet (id 4663), switch to it, then claim again.',
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
  if (!provider?.request) {
    throw new Error(
      isMobileDevice()
        ? 'Open this site inside Trust Wallet (Browser), then tap Connect.'
        : 'No browser wallet found — use Trust / MetaMask or WalletConnect.',
    )
  }
  // Do NOT switch to Robinhood Chain here — Trust cannot personal_sign on RH
  // ("signRawData not supported for RobinhoodChain"). Link uses ETH mainnet.
  const accounts = await provider.request({ method: 'eth_requestAccounts' })
  if (!accounts?.[0]) throw new Error('No account returned from wallet')
  return { provider, address: getAddress(accounts[0]) }
}

/** Trust / many mobiles only support EIP-191 on Ethereum, not Robinhood Chain. */
async function preferEthereumForSign(provider) {
  if (!provider?.request) return
  try {
    const current = await provider.request({ method: 'eth_chainId' })
    if (String(current).toLowerCase() === '0x1') return
  } catch {
    /* continue */
  }
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }],
    })
  } catch (e) {
    console.warn('[void] switch to Ethereum for sign skipped', e)
  }
}

/**
 * personal_sign for wallet link — never bind to Robinhood Chain.
 * Trust mobile rejects signRawData on RH.
 */
async function signLinkMessage(provider, address, message) {
  await preferEthereumForSign(provider)
  const text = String(message)
  const hexMsg = toHex(text)

  try {
    const sig = await provider.request({
      method: 'personal_sign',
      params: [hexMsg, address],
    })
    if (sig) return sig
  } catch (e1) {
    const m1 = String(e1?.message || e1 || '')
    if (/reject|cancel|denied|User rejected/i.test(m1)) throw e1
    // Some wallets want address first
    try {
      const sig = await provider.request({
        method: 'personal_sign',
        params: [address, hexMsg],
      })
      if (sig) return sig
    } catch (e2) {
      const m2 = String(e2?.message || e2 || '')
      if (/reject|cancel|denied|User rejected/i.test(m2)) throw e2
      if (/signRawData|RobinhoodChain|not supported/i.test(m1 + m2)) {
        throw new Error(
          'Trust cannot sign on Robinhood Chain. Stay on Ethereum (or Open in Trust Browser) and Connect again.',
        )
      }
    }
  }

  // Last resort: viem on Ethereum mainnet only (never RH)
  const walletClient = createWalletClient({
    account: address,
    chain: ETH_MAINNET,
    transport: custom(provider),
  })
  return walletClient.signMessage({ account: address, message: text })
}

let wcProvider = null
let wcBusy = false

export async function abortWalletConnect() {
  wcBusy = false
  if (typeof document !== 'undefined') document.body.classList.remove('wc-modal-open')
  if (!wcProvider) return
  try {
    await wcProvider.disconnect()
  } catch {
    /* ignore */
  }
  wcProvider = null
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(label + ' timed out. Tap Cancel, then try again.'))
    }, ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function friendlyWcError(e) {
  const msg = String(e?.message || e || '')
  if (/reject|cancel|closed|denied|User closed|reset/i.test(msg)) return 'Connection cancelled or reset'
  if (/signRawData|RobinhoodChain|not supported/i.test(msg)) {
    return 'Trust cannot sign on Robinhood Chain — Connect again (Ethereum). Or Open in Trust Browser.'
  }
  if (/project id|Unauthorized|401/i.test(msg)) return 'WalletConnect Project ID invalid — check Vercel env'
  if (/Chain|unrecognized|4902|switch/i.test(msg)) {
    return 'Network error — open the site in Trust Browser and Connect again'
  }
  if (/timed out/i.test(msg)) return msg
  return msg || 'WalletConnect failed'
}

async function connectWalletConnect() {
  const projectId = String(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '').trim()
  if (!projectId) throw new Error('set VITE_WALLETCONNECT_PROJECT_ID (Reown)')
  if (wcBusy) throw new Error('Connection already in progress — tap Cancel first')
  wcBusy = true
  try {
    if (typeof document !== 'undefined') document.body.classList.add('wc-modal-open')
    await import('@walletconnect/modal')
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
    if (wcProvider) {
      try {
        await wcProvider.disconnect()
      } catch {
        /* ignore */
      }
      wcProvider = null
    }
    // Ethereum-only WC session for link/sign.
    // Including RH makes Trust try signRawData on RobinhoodChain → hard fail.
    wcProvider = await withTimeout(
      EthereumProvider.init({
        projectId,
        showQrModal: true,
        chains: [ETH_MAINNET.id],
        optionalChains: [ETH_MAINNET.id],
        rpcMap: {
          [ETH_MAINNET.id]: 'https://ethereum.publicnode.com',
        },
        qrModalOptions: {
          themeMode: 'dark',
          themeVariables: {
            '--wcm-z-index': '100000',
            '--wcm-max-width': '100vw',
            '--wcm-padding': '12px',
          },
          enableExplorer: true,
          explorerRecommendedWalletIds: [
            '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust
            'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
            '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
            'd0ca99ff52b99abc48743dad0f7fc891e041be73574f7fac4afe5d4bb83845c8', // Coinbase
            'ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18', // Zerion
            '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // Bitget
            '19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927', // Ledger
          ],
          mobileWallets: [
            {
              id: 'trust',
              name: 'Trust Wallet',
              links: {
                native: 'trust://',
                universal: 'https://link.trustwallet.com',
              },
            },
            {
              id: 'metamask',
              name: 'MetaMask',
              links: {
                native: 'metamask://',
                universal: 'https://metamask.app.link',
              },
            },
            {
              id: 'rainbow',
              name: 'Rainbow',
              links: {
                native: 'rainbow://',
                universal: 'https://rainbow.me',
              },
            },
          ],
          desktopWallets: [
            {
              id: 'metamask',
              name: 'MetaMask',
              links: {
                native: '',
                universal: 'https://metamask.io/download/',
              },
            },
          ],
        },
        metadata: {
          name: 'VOID.OS',
          description: 'ExoMind constellation lots on Robinhood Chain',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://void.os',
          icons: [
            typeof window !== 'undefined'
              ? window.location.origin + '/assets/void-logo.png'
              : 'https://void.os/assets/void-logo.png',
          ],
        },
      }),
      25000,
      'WalletConnect init',
    )
    await withTimeout(wcProvider.enable(), 120000, 'WalletConnect')
    const accounts = wcProvider.accounts?.length
      ? wcProvider.accounts
      : await wcProvider.request({ method: 'eth_accounts' })
    if (!accounts?.[0]) throw new Error('No account from WalletConnect')
    return { provider: wcProvider, address: getAddress(accounts[0]) }
  } catch (e) {
    try {
      if (wcProvider) await wcProvider.disconnect()
    } catch {
      /* ignore */
    }
    wcProvider = null
    throw new Error(friendlyWcError(e))
  } finally {
    wcBusy = false
    if (typeof document !== 'undefined') document.body.classList.remove('wc-modal-open')
  }
}

/**
 * Link wallet + EIP-191 sign.
 * mode: 'qr' | 'injected' | 'auto'
 */
export async function connectAndSignLink(message, opts = {}) {
  let mode = opts.mode || 'auto'
  if (mode === 'auto') mode = pickConnectMode() || 'qr'
  let provider
  let address

  try {
    if (mode === 'qr') {
      if (!hasWalletConnectProject()) {
        throw new Error(
          'No WalletConnect Project ID. On phone: open the site in Trust Browser, then Connect.',
        )
      }
      ;({ provider, address } = await connectWalletConnect())
    } else if (mode === 'injected') {
      ;({ provider, address } = await connectInjected())
    } else if (getInjectedEvm()) {
      ;({ provider, address } = await connectInjected())
    } else if (hasWalletConnectProject()) {
      ;({ provider, address } = await connectWalletConnect())
    } else {
      throw new Error('No wallet available')
    }
  } catch (e) {
    if (mode === 'qr' && getInjectedEvm()) {
      ;({ provider, address } = await connectInjected())
    } else {
      throw e
    }
  }

  try {
    const signature = await signLinkMessage(provider, address, message)
    return {
      pubkey: address,
      address,
      signature,
      walletLabel: mode === 'injected' ? 'browser' : 'WalletConnect',
    }
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (/reject|cancel|denied/i.test(msg)) throw new Error('Signature cancelled in wallet')
    if (/signRawData|RobinhoodChain|not supported/i.test(msg)) {
      throw new Error(
        'Trust cannot sign on Robinhood Chain. Open in Trust Browser (Ethereum) and Connect again.',
      )
    }
    throw new Error(friendlyWcError(e) || msg || 'Sign failed')
  }
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

async function existingConnectedWallet() {
  if (wcProvider?.accounts?.[0]) {
    return { provider: wcProvider, address: getAddress(wcProvider.accounts[0]) }
  }
  const eth = getRobinhoodInjected() || getInjectedEvm()
  if (!eth?.request) return null
  try {
    const acc = await eth.request({ method: 'eth_accounts' })
    if (acc?.[0]) return { provider: eth, address: getAddress(acc[0]) }
  } catch {
    /* not authorized yet */
  }
  return null
}

async function providerForClaim() {
  const existing = await existingConnectedWallet()
  if (existing) return existing
  if (getRobinhoodInjected() || getInjectedEvm()) return connectInjected()
  return connectWalletConnect()
}

async function ensureChainForClaim(provider) {
  try {
    await withTimeout(ensureChain(provider), 25000, 'switch to Robinhood Chain')
    return provider
  } catch (e) {
    const inj = getRobinhoodInjected() || getInjectedEvm()
    if (inj && inj !== provider) {
      try {
        await withTimeout(ensureChain(inj), 25000, 'switch to Robinhood Chain')
        return inj
      } catch {
        /* fall through */
      }
    }
    throw new Error(
      e?.message ||
        'Switch the wallet to Robinhood Chain (4663), keep ETH for gas, then claim again.',
    )
  }
}

export async function claimOnChain(lotIds = []) {
  if (!isClaimLiveClient()) {
    throw new Error('claim token not set')
  }
  const ids = (lotIds || []).map(String).filter(Boolean)
  if (!ids.length) throw new Error('no lots to claim')

  let { provider, address } = await providerForClaim()
  provider = await ensureChainForClaim(provider)
  if (provider === getInjectedEvm() || provider === getRobinhoodInjected()) {
    try {
      const acc = await provider.request({ method: 'eth_accounts' })
      if (acc?.[0]) address = getAddress(acc[0])
    } catch {
      /* keep address */
    }
  }

  const walletClient = createWalletClient({
    account: address,
    chain: getRhChain(),
    transport: custom(provider),
  })
  const pub = publicClient()
  const tokenAddr = getAddress(exoTokenClient())
  const claimAddrRaw = claimContractClient()
  const lotBytes = ids.map(lotIdToBytes32)
  const cost = claimPricePerLotWei() * BigInt(ids.length)

  const [ethBal, tokenBal] = await Promise.all([
    pub.getBalance({ address }),
    pub.readContract({
      address: tokenAddr,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }),
  ])
  if (ethBal === 0n) {
    throw new Error('Need ETH on Robinhood Chain for gas. Bridge or buy a little ETH on this network.')
  }
  if (tokenBal < cost) {
    throw new Error(
      'Need $TEST on this wallet. Open Buy $TEST, swap a tiny amount, then claim again.',
    )
  }

  try {
    await pub.simulateContract({
      address: tokenAddr,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [BURN_SINK, cost],
      account: address,
    })
  } catch (simErr) {
    const sm = String(simErr?.shortMessage || simErr?.message || simErr || '')
    throw new Error(
      /transfer|paused|restrict|blacklist|allow/i.test(sm)
        ? 'Token transfer was rejected (buy $TEST first, or this token may block burns).'
        : sm.slice(0, 140) || 'Wallet cannot simulate this burn — check $TEST balance and ETH gas.',
    )
  }

  if (claimAddrRaw) {
    const claimAddr = getAddress(claimAddrRaw)
    let quote = 0n
    try {
      quote = await pub.readContract({
        address: claimAddr,
        abi: CLAIM_ABI,
        functionName: 'quote',
        args: [lotBytes],
      })
    } catch {
      quote = cost
    }
    if (quote > 0n) {
      const allowance = await pub.readContract({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, claimAddr],
      })
      if (allowance < quote) {
        const approveHash = await walletClient.writeContract({
          address: tokenAddr,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [claimAddr, quote],
          account: address,
          chain: getRhChain(),
        })
        await withTimeout(
          pub.waitForTransactionReceipt({ hash: approveHash }),
          90000,
          'approve tx',
        )
      }
    }
    const hash = await walletClient.writeContract({
      address: claimAddr,
      abi: CLAIM_ABI,
      functionName: 'claim',
      args: [lotBytes],
      account: address,
      chain: getRhChain(),
    })
    const receipt = await withTimeout(
      pub.waitForTransactionReceipt({ hash }),
      90000,
      'claim tx',
    )
    return { hash, receipt, address, lotIds: ids }
  }

  const hash = await walletClient.writeContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [BURN_SINK, cost],
    account: address,
    chain: getRhChain(),
  })
  const receipt = await withTimeout(pub.waitForTransactionReceipt({ hash }), 90000, 'burn tx')
  return { hash, receipt, address, lotIds: ids }
}
