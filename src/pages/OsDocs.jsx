// Written for: people who open VOID.OS for the first time and want to know what each app does before clicking around.
import { Link } from 'react-router-dom'
import { VoidLogo } from '../components/VoidLogo'

const SHOTS = '/landing/docs'

const SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    image: '/landing/desktop.webp',
    alt: 'VOID.OS desktop with Market, weather, calendar and the dock',
    body: [
      'VOID.OS is a desktop that runs in one browser tab. Nothing to install, no account to create. Windows, a dock, notes, files, a code editor and a wallet all live in the same page.',
      'Everything you create stays on your device: notes, files, code and wallet settings are saved in this browser. Closing the tab keeps them; clearing site data removes them.',
    ],
    note: 'Use Reset in Settings to clear the desktop back to its first-run state.',
  },
  {
    id: 'desktop',
    title: 'Desktop, windows and dock',
    body: [
      'Drag a window by its title bar and resize it from any of the eight edges or corners. Yellow minimizes it into the dock, green goes full screen, red closes it.',
      'The dock magnifies under the cursor. Press Ctrl+K (⌘K on Mac) to open Spotlight and launch any app by name. The desktop remembers where your windows were when you come back.',
    ],
  },
  {
    id: 'files',
    title: 'Files',
    image: `${SHOTS}/files.webp`,
    alt: 'Files app showing the Documents folder with Welcome.txt',
    body: [
      'Two folders sit on the desktop: Documents and Projects. Double-click one to open it in the Files app.',
      'Create folders and text files with New folder and New file, open a text file to edit it, and delete anything with the × on its tile. The tree is stored in this browser.',
    ],
  },
  {
    id: 'notes',
    title: 'Encrypted notes',
    image: `${SHOTS}/notes.webp`,
    alt: 'Notes app in split view with an encrypted Markdown note',
    body: [
      'Notes are Markdown. Link to another note with [[double brackets]], tag with #tags, and write task lists with - [ ]. Split view shows the source and the rendered page side by side.',
      'The vault is encrypted with AES-256-GCM. Your passphrase is turned into a key with PBKDF2-SHA256 (600,000 rounds), and only the encrypted data is saved. The vault locks after five minutes without input.',
    ],
    note: 'Remember your passphrase: the vault opens only with it.',
  },
  {
    id: 'code',
    title: 'VOID.CODE',
    image: `${SHOTS}/code.webp`,
    alt: 'VOID.CODE editor with a project tree, editor tabs and a terminal panel',
    body: [
      'A code editor with real folders. Create, rename and delete files and folders from the explorer, a right-click menu or the keyboard. Ctrl+P opens a file by name, and the command palette runs project actions.',
      'Code you run goes to a sandboxed Web Worker with a two-second time limit. It has no access to your files, your wallet or the rest of the desktop.',
    ],
  },
  {
    id: 'wallet',
    title: 'Wallet',
    image: `${SHOTS}/wallet.webp`,
    alt: 'Wallet app with account switcher, total balance and token list',
    body: [
      'Connect your own MetaMask or Phantom browser extension to see your addresses, balances and prices in one place. The wallet reads the public addresses and balances your extension shares with the page. Private keys and seed phrases stay in the extension, and every signature is confirmed there.',
      'Without an extension, create demo accounts to explore the wallet. They are generated on this device with prototype balances, so you can try the flow before connecting a real one.',
      'Prices come from CoinGecko and refresh every minute.',
    ],
  },
  {
    id: 'market',
    title: 'Market',
    image: `${SHOTS}/market.webp`,
    alt: 'Market app listing trending tokens on Robinhood Chain',
    body: [
      'Market lists trending pools and tokens on Robinhood Chain from GeckoTerminal. Open any pool on GeckoTerminal to read the details yourself.',
      'Listings come from public APIs. Check the contract yourself before you trade.',
    ],
  },
  {
    id: 'privacy-tools',
    title: 'VPN, MAC changer and Wi-Fi check',
    image: `${SHOTS}/vpn.webp`,
    alt: 'VPN app with server list and protocol choice, marked as simulated',
    body: [
      'This is a prototype: the interfaces and flows are real, and the network side is simulated for now so the whole desktop can be explored in a browser.',
      'The VPN app lets you pick a server and protocol, then runs the connection sequence. The MAC changer lists the network interfaces and walks through a new address. Wi-Fi check scores the strength of a password you type in and suggests how to make it stronger.',
      'The Terminal runs tor and ssh as simulations against a demo host.',
    ],
    note: 'Next step: real WireGuard and Tor tunnels, a real MAC change and live network checks, planned for the native build with system permissions.',
  },
  {
    id: 'browser',
    title: 'Browser',
    body: [
      'The Browser loads real websites through a remote browser gateway: a server you run yourself that renders pages in Chromium and streams them to the window. Connect a gateway and sites open right inside the window.',
      'Until a VPN is connected, the browser shows a "You are not protected" banner, so you always see your current protection level. Gateway safety checks block private network addresses, which keeps pages away from your local machine and home network.',
    ],
  },
  {
    id: 'appearance',
    title: 'Settings and wallpapers',
    image: `${SHOTS}/settings.webp`,
    alt: 'Settings app on the Wallpaper page with the gallery of backgrounds',
    body: [
      'Pick a wallpaper from the gallery: liquid, nebula, starfield, void, or your own image. Your image is resized in the browser and stays on this device.',
      'Settings also covers text size, reduced motion and transparency, sounds, the dock magnification, and the browser home page.',
    ],
  },
  {
    id: 'data',
    title: 'What leaves your browser',
    body: [
      'Your data is stored in this browser. The page talks to public services when you open an app that needs them: Open-Meteo for weather, CoinGecko and GeckoTerminal for prices and tokens, mempool.space and public RPC endpoints for balances, and DuckDuckGo when you search in the browser.',
      'Notes are encrypted before they are saved on this device. Files, code and demo accounts stay in this browser too.',
    ],
  },
]

export default function OsDocs() {
  return (
    <div className="min-h-dvh bg-void text-ink">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-void/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-10">
          <Link to="/" className="flex items-center gap-2.5">
            <VoidLogo className="h-8 w-8" />
            <span className="font-display text-sm font-extrabold tracking-wide">
              VOID<span className="text-lime">.OS</span> <span className="text-muted">/ docs</span>
            </span>
          </Link>
          <a className="btn-lime !px-4 !py-2 !text-[12px]" href="/os" target="_blank" rel="noopener noreferrer">
            Open VOID.OS ↗
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-10 lg:grid-cols-[200px_1fr] lg:py-20">
        <nav aria-label="Docs sections" className="hidden lg:block">
          <ul className="sticky top-28 space-y-2 text-[13px] text-muted">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a className="transition-colors hover:text-lime" href={`#${s.id}`}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0">
          <p className="mb-3 text-[11px] tracking-[0.2em] text-lime">DOCUMENTATION</p>
          <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">How VOID.OS works</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
            A tour of every app on the desktop, with screenshots. Each section links to the live app
            so you can click through it yourself.
          </p>

          <div className="mt-16 space-y-20">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{s.title}</h2>
                <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted">
                  {s.body.map((p) => (
                    <p key={p.slice(0, 24)}>{p}</p>
                  ))}
                </div>

                {s.note && (
                  <p className="mt-5 border-l-2 border-lime/60 pl-4 text-[13px] leading-relaxed text-ink/80">{s.note}</p>
                )}

                {s.image && (
                  <figure className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                    <img src={s.image} alt={s.alt} loading="lazy" className="block h-auto w-full" />
                    <figcaption className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3 text-[12px] text-muted-2">
                      <span>{s.alt}</span>
                      <a className="shrink-0 text-lime hover:underline" href="/os" target="_blank" rel="noopener noreferrer">
                        Try it ↗
                      </a>
                    </figcaption>
                  </figure>
                )}
              </section>
            ))}
          </div>

          <div className="mt-24 border-t border-white/10 pt-10">
            <p className="text-[15px] text-muted">Ready to click through?</p>
            <a className="btn-lime mt-4 inline-block" href="/os" target="_blank" rel="noopener noreferrer">
              Open VOID.OS ↗
            </a>
          </div>
        </main>
      </div>
    </div>
  )
}
