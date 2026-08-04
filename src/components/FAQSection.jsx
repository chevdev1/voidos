import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const EASE_OUT = [0.23, 1, 0.32, 1]

// Apple-style critically-damped spring (bounce: 0 = no overshoot) — the
// duration-based spring API reads far more natural for a height reveal
// than a fixed-duration tween, per Emil Kowalski's guidance: keep bounce
// out of UI unless it's a drag/dismiss gesture.
const SPRING = { type: 'spring', duration: 0.4, bounce: 0 }

const FAQS = [
  {
    q: 'How do I acquire a sector?',
    a: "Sectors are claimed through the ExoMind app once the star map opens: connect a wallet, browse the 500 systems, and mint an available sector. Availability and pricing are shown live in-app — this page is lore, not the acquisition flow.",
  },
  {
    q: 'What happens if I sell my tokens?',
    a: 'Sector ownership and $EXO holdings are separate. Selling $EXO does not revoke a sector you already own — but transmitting new signals into it (publishing or retraining) still costs fuel, so you\'ll need $EXO on hand to keep influencing the Mind.',
  },
  {
    q: 'Is the smart contract audited and safe?',
    a: 'Audit status and report links belong here once finalized — treat any unaudited contract as high-risk. Always verify the contract address independently before interacting, and never trust a CA posted outside official channels.',
  },
  {
    q: 'What is the Immutable Core, exactly?',
    a: 'A fixed 28% of the personality weighting that no sector purchase, signal, or retraining can touch. It exists so the probe always retains a part of itself no commander can own.',
  },
]

function PlusIcon({ isOpen }) {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      animate={{ rotate: isOpen ? 45 : 0 }}
      transition={SPRING}
      className="shrink-0"
    >
      <path d="M7 1V13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M1 7H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </motion.svg>
  )
}

function FAQItem({ faq, isOpen, onToggle, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.45, ease: EASE_OUT, delay: index * 0.05 }}
      className="border-b border-gray-800 last:border-b-0"
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="group flex w-full items-center justify-between gap-6 py-6 text-left"
      >
        <span className="font-display text-base font-bold text-white transition-colors duration-200 ease-out group-hover:text-[#ccff00] sm:text-lg">
          {faq.q}
        </span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ease-out ${
            isOpen ? 'border-[#ccff00] text-[#ccff00]' : 'border-gray-700 text-gray-500 group-hover:border-gray-500'
          }`}
        >
          <PlusIcon isOpen={isOpen} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            style={{ overflow: 'hidden' }}
          >
            <p className="max-w-2xl pb-6 text-[13.5px] leading-relaxed text-gray-400">{faq.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <section id="faq" className="relative px-5 py-28 sm:px-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="mb-10 max-w-xl"
      >
        <span className="mb-3 block text-[11px] tracking-[0.2em] text-lime/70">KNOWLEDGE BASE</span>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Questions the probe <span className="text-[#ccff00]">already logged.</span>
        </h2>
      </motion.div>

      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-sm sm:p-8">
        {FAQS.map((faq, i) => (
          <FAQItem
            key={faq.q}
            faq={faq}
            index={i}
            isOpen={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
          />
        ))}
      </div>
    </section>
  )
}
