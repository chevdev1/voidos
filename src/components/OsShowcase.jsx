// Written for: crypto holders and traders who care about privacy and want to see what VOID.OS is building.
const PILLARS = [
  {
    title: 'Your keys stay in your wallet',
    text: 'Connect the MetaMask or Phantom you already use. VOID.OS reads public balances and prices. It never asks for a seed phrase and never signs for you.',
  },
  {
    title: 'Notes only you can open',
    text: 'Research, watchlists and contract addresses are sealed with AES-256-GCM under a passphrase only you know. Nothing is uploaded to our servers.',
  },
  {
    title: 'Code with no way to your funds',
    text: 'Scripts run in an isolated sandbox with a time limit. They have no access to your wallet, your notes or your files.',
  },
]

export function OsShowcase() {
  return (
    <section id="os" className="relative overflow-hidden bg-void px-5 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="text-[11px] tracking-[0.2em] text-lime">VOID.OS · PRIVATE DESKTOP FOR CRYPTO</p>
          <span className="border border-lime/40 px-2 py-0.5 text-[10px] tracking-[0.15em] text-lime">IN DEVELOPMENT</span>
        </div>
        <h2 className="max-w-3xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-5xl">
          The desktop for people who hold crypto and want to keep it private.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          Your wallet, your notes and your research in one window, with your keys and your data kept
          on your own device. The prototype is live now. Try it and tell us what it is missing.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-lime/25 shadow-[0_0_60px_rgba(204,255,0,0.08)]">
          <img
            src="/landing/desktop.webp"
            width={1600}
            height={900}
            loading="lazy"
            alt="VOID.OS desktop with open windows, a dock, weather and calendar widgets"
            className="block h-auto w-full"
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a className="btn-lime" href="/os" target="_blank" rel="noopener noreferrer">
            Try the prototype ↗
          </a>
          <a className="btn-ghost" href="/os/docs">
            Read the docs
          </a>
          <span className="text-[12px] text-muted-2">Opens in a new tab. Best on a desktop browser.</span>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="border border-white/10 bg-black/40 p-6">
              <h3 className="mb-2 font-display text-base font-extrabold text-ink">{p.title}</h3>
              <p className="text-[13px] leading-relaxed text-muted">{p.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 border border-dashed border-white/15 p-6">
          <p className="mb-1 text-[11px] tracking-[0.2em] text-lime">ON THE ROADMAP</p>
          <p className="text-[13px] leading-relaxed text-muted">
            A real VPN tunnel built into the desktop, and a private browser that routes your traffic
            through it. Both are simulated in the prototype today.
          </p>
        </div>
      </div>
    </section>
  )
}
