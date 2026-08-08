import bs58 from 'bs58'

/** Robinhood in-app Web3 browser inject only (no Phantom / Solflare). */
export function getRobinhoodInjected() {
  if (typeof window === 'undefined') return null
  const candidates = [
    window.robinhood?.solana,
    window.robinhoodWallet?.solana,
    window.solana?.isRobinhood || window.solana?.isRobinhoodWallet ? window.solana : null,
  ]
  for (const p of candidates) {
    if (p && typeof p.connect === 'function') return p
  }
  return null
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
 * Connect Robinhood (WalletConnect QR or in-app inject) + sign link message.
 */
export async function connectAndSignLink(message) {
  const encoded = new TextEncoder().encode(message)

  const injected = getRobinhoodInjected()
  if (injected) {
    const resp = await injected.connect()
    const pubkey = resp?.publicKey?.toString?.() || injected.publicKey?.toString?.()
    if (!pubkey) throw new Error('no pubkey')
    const signed = await injected.signMessage(encoded, 'utf8')
    const signature = bs58.encode(signed.signature || signed)
    return { pubkey, signature, walletLabel: 'Robinhood' }
  }

  const adapter = await createWalletConnectAdapter()
  await adapter.connect()
  const pubkey = adapter.publicKey?.toBase58?.() || adapter.publicKey?.toString?.()
  if (!pubkey) throw new Error('no pubkey from WalletConnect')
  const raw = await adapter.signMessage(encoded)
  const signature = bs58.encode(raw?.signature || raw)
  return { pubkey, signature, walletLabel: 'Robinhood' }
}
