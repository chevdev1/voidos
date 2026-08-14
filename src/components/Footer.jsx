import { Link } from 'react-router-dom'
import { DEFAULT_DEX_URL } from '../../shared/rhChain.js'

const X_URL = String(import.meta.env.VITE_X_URL || '').trim()
const GITHUB_URL = String(import.meta.env.VITE_GITHUB_URL || '').trim()
const DEX_URL = String(import.meta.env.VITE_DEX_URL || DEFAULT_DEX_URL || '').trim()

const LINKS = [
  { label: 'X / Twitter', href: X_URL },
  { label: 'GitHub', href: GITHUB_URL },
  { label: 'Documentation', to: '/docs' },
  { label: 'DexScreener', href: DEX_URL },
]

function FooterLink({ label, href, to }) {
  const className =
    'group inline-flex items-center gap-1.5 font-mono text-[13px] tracking-wide text-muted transition-colors duration-200 ease-out hover:text-lime'

  const arrow = (
    <span
      aria-hidden
      className="inline-block transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
    >
      ↗
    </span>
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {label}
        {arrow}
      </Link>
    )
  }

  if (!href) {
    return (
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[13px] tracking-wide text-muted-2"
        title="URL not set yet — add VITE_* env on Vercel"
      >
        {label}
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-2/80">soon</span>
      </span>
    )
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
      {arrow}
    </a>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-5 py-10 sm:px-10">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <img src="/assets/void-logo.png" alt="" className="h-6 w-6" />
            <span className="font-display text-base font-extrabold tracking-tight text-ink">
              VOID<span className="text-lime">.OS</span>
            </span>
          </div>
          <p className="mt-2 text-xs tracking-wide text-muted-2">
            you buy the pull, not the permanence.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-2">
            An autonomous probe, listening. Nothing on this page is financial advice — verify
            the contract independently before you transmit anything of value.
          </p>
        </div>

        <nav className="flex flex-col items-start gap-3 sm:items-end">
          {LINKS.map((link) => (
            <FooterLink key={link.label} {...link} />
          ))}
        </nav>
      </div>

      <div className="mt-8 flex flex-col gap-2 border-t border-white/5 pt-5 text-[10px] tracking-wide text-muted-2 sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} VOID.OS / EXOMIND</span>
        <span>SIGNAL STATUS: NOMINAL</span>
      </div>
    </footer>
  )
}
