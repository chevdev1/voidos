import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const EASE_OUT = [0.23, 1, 0.32, 1]

const SPRING = { type: 'spring', duration: 0.4, bounce: 0 }

const FAQS = [
  {
    q: 'How do I claim a constellation lot?',
    a: 'Open the full map, tap to explore, multi-select constellation lots, then claim. Right now claim runs in test mode — free, no real $EXO burn — until the mint goes live. After claim, open CABINET to rotate the lot and read each ★ star.',
  },
  {
    q: 'What happens if I sell my $EXO?',
    a: 'Lot ownership and $EXO balance are separate. Selling $EXO does not revoke lots you already claimed. Training / transmitting later will still need fuel once mint is live — silence stays free; influence costs burn.',
  },
  {
    q: 'Is the smart contract audited?',
    a: 'No live mint or audited claim contract is wired on this site yet (CA shows TBA until set). Treat unaudited deploys as high-risk. Never trust a contract address posted outside official channels once launch happens.',
  },
  {
    q: 'What is the Immutable Core?',
    a: 'A fixed 28% of ExoMind’s personality weighting that no claim, signal, or training pass can touch. It stays sealed so the probe always keeps a part of itself no commander can own.',
  },
  {
    q: 'What does Ask the mind do?',
    a: 'It is a live chat with ExoMind (Gemini). Talk about the map, your lots, or ★ stars. It stays on VOID topics — it will not play wish-games or grant free lots. With owned lots it can brief what you hold.',
  },
  {
    q: 'How does training work?',
    a: 'In CABINET, open a claimed lot and use Train patch (test). That marks the lot as trained in your ledger and on the map filter — free while $EXO mint is off. When mint is live, training will burn $EXO as fuel.',
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
