import { motion } from 'framer-motion'

const LINKS = [
  { label: 'X / TWITTER', href: '#' },
  { label: 'GITHUB', href: '#' },
  { label: 'DOCUMENTATION', href: '#' },
  { label: 'DEXSCREENER', href: '#' },
]

function FooterLink({ label, href }) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover="hover"
      className="group flex items-center justify-between border-t border-white/10 py-5 text-ink sm:py-6"
    >
      <span className="font-display text-xl font-extrabold tracking-tight sm:text-3xl">
        {label}
      </span>
      <motion.span
        variants={{ hover: { x: 6, color: '#ccff00' } }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-2xl text-muted"
        aria-hidden
      >
        ↗
      </motion.span>
    </motion.a>
  )
}

export function Footer() {
  return (
    <footer className="relative border-t-2 border-lime/30 px-5 pb-8 pt-16 sm:px-10">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <img src="/assets/void-logo.png" alt="" className="h-9 w-9" />
            <span className="font-display text-2xl font-extrabold tracking-tight text-ink">
              VOID<span className="text-lime">.OS</span>
            </span>
          </div>
          <p className="mt-2 text-[11px] tracking-wide text-muted-2">
            you buy the pull, not the permanence.
          </p>
        </div>
        <p className="max-w-xs text-[11px] leading-relaxed text-muted-2">
          An autonomous probe, listening. Nothing on this page is financial advice — verify the
          contract independently before you transmit anything of value.
        </p>
      </div>

      <nav>
        {LINKS.map((link) => (
          <FooterLink key={link.label} {...link} />
        ))}
      </nav>

      <div className="mt-10 flex flex-col gap-2 text-[10px] tracking-wide text-muted-2 sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} EXOMIND NETWORK</span>
        <span>SIGNAL STATUS: NOMINAL</span>
      </div>
    </footer>
  )
}
