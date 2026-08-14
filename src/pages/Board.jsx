import { Link } from 'react-router-dom'
import { AccountMenu } from '../components/AccountMenu'
import { PretendersBoard } from '../components/PretendersBoard'
import { MindChat } from '../components/MindChat'

export default function Board() {
  return (
    <div className="min-h-screen bg-void text-ink">
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-5 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/assets/void-logo.png" alt="" className="h-6 w-6" />
          <span className="font-display text-sm font-extrabold tracking-wide">
            VOID<span className="text-lime">.OS</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Link to="/map" className="text-[11px] tracking-wide text-muted hover:text-lime">
            map
          </Link>
          <Link to="/cabinet" className="text-[11px] tracking-wide text-muted hover:text-lime">
            cabinet
          </Link>
          <AccountMenu />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-10">
        <PretendersBoard />
      </main>
      <MindChat />
    </div>
  )
}
