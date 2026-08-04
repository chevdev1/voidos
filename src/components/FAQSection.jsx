import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const EASE_OUT = [0.23, 1, 0.32, 1]

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

function FAQItem({ faq, isOpen, onToggle, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.45, ease: EASE_OUT, delay: index * 0.05 }}
      className="border-b border-white/10"
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-6 py-6 text-left"
      >
        <span className="font-display text-base font-bold text-ink sm:text-lg">{faq.q}</span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-lg ${
            isOpen ? 'border-lime text-lime' : 'border-white/20 text-muted'
          }`}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-6 text-[13.5px] leading-relaxed text-muted">{faq.a}</p>
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
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Questions the probe <span className="text-lime">already logged.</span>
        </h2>
      </motion.div>

      <div className="mx-auto max-w-2xl">
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
