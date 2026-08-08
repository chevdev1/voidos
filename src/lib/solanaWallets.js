import bs58 from 'bs58'

/** @returns {{ id: string, label: string, provider: any }[]} */
export function listInjectedSolana() {
  if (typeof window === 'undefined') return []
  const out = []
  const seen = new Set()

  function add(id, label, provider) {
    if (!provider || typeof provider.connect !== 'function') return
    if (seen.has(provider)) return
    seen.add(provider)
    out.push({ id, label, provider })
  }

  const ph = window.phantom?.solana
  if (ph?.isPhantom) add('phantom', 'Phantom', ph)

  const sol = window.solana
  if (sol?.isPhantom) add('phantom', 'Phantom', sol)
  else if (sol?.isSolflare) add('solflare', 'Solflare', sol)
  else if (sol && !sol.isPhantom) add('injected', detectInjectedLabel(sol), sol)

  if (window.solflare?.isSolflare) add('solflare', 'Solflare', window.solflare)
  if (window.robinhood?.solana) add('robinhood', 'Robinhood', window.robinhood.solana)
  if (window.robinhoodWallet?.solana) {
    add('robinhood', 'Robinhood', window.robinhoodWallet.solana)
  }

  return out
}

function detectInjectedLabel(p) {
  if (p.isRobinhood || p.isRobinhoodWallet) return 'Robinhood'
  if (p.isSolflare) return 'Solflare'
  if (p.isPhantom) return 'Phantom'
  return 'Wallet'
}

export function hasWalletConnectProject() {
  return Boolean(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID)
}

async function createWalletConnectAdapter() {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
  if (!projectId) {
    throw new Error('set VITE_WALLETCONNECT_PROJECT_ID (Reown / WalletConnect Cloud)')
  }
  const [{ WalletAdapterNetwork }, { WalletConnectWalletAdapter }] = await Promise.all([
    import('@solana/wallet-adapter-base'),
    import('@walletconnect/solana-adapter'),
  ])
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://void.os'
  return new WalletConnectWalletAdapter({
    network: WalletAdapterNetwork.Mainnet,
    options: {
      projectId,
      metadata: {
        name: 'VOID.OS',
        description: 'ExoMind constellation lots',
        url: origin,
        icons: [`${origin}/assets/void-logo.png`],
      },
    },
  })
}

/**
 * Connect + sign ownership message; returns { pubkey, signature, walletLabel }
 */
export async function connectAndSignLink(source, message) {
  const encoded = new TextEncoder().encode(message)

  if (source === 'walletconnect' || source === 'robinhood') {
    const adapter = await createWalletConnectAdapter()
    await adapter.connect()
    const pubkey = adapter.publicKey?.toBase58?.() || adapter.publicKey?.toString?.()
    if (!pubkey) throw new Error('no pubkey from WalletConnect')
    const raw = await adapter.signMessage(encoded)
    const signature = bs58.encode(raw?.signature || raw)
    return { pubkey, signature, walletLabel: 'Robinhood / WalletConnect', adapter }
  }

  const injected = listInjectedSolana()
  const pick =
    (typeof source === 'object' && source?.provider && source) ||
    injected.find((w) => w.id === source) ||
    injected[0]
  if (!pick?.provider) {
    throw new Error('no injected wallet — use Robinhood WalletConnect or install Phantom')
  }

  const provider = pick.provider
  const resp = await provider.connect()
  const pubkey = resp?.publicKey?.toString?.() || provider.publicKey?.toString?.()
  if (!pubkey) throw new Error('no pubkey')
  const signed = await provider.signMessage(encoded, 'utf8')
  const signature = bs58.encode(signed.signature || signed)
  return { pubkey, signature, walletLabel: pick.label, adapter: null }
}
