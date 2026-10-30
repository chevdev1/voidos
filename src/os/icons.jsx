// Line icons for VOID.OS. 24px grid, 1.8 stroke, round caps. Color comes from currentColor.

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
}

export function WelcomeIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" opacity="0.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function WalletIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6.5" width="18" height="13" rx="3" />
      <path d="M3 10h18" opacity="0.6" />
      <path d="M15 14.5h2.5" />
      <path d="M6 6.5V5.2a1.7 1.7 0 0 1 1.7-1.7h8.6" opacity="0.6" />
    </svg>
  )
}

export function MarketIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 19.5h17" opacity="0.5" />
      <path d="M5.5 15.5l4-4.2 3.2 2.8 5.3-6.3" />
      <path d="M15.8 7.8h2.9v2.9" />
    </svg>
  )
}

export function InspectorIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4L20 20" />
      <circle cx="10.5" cy="10.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function NetworkIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="5.5" r="2.2" />
      <circle cx="5.5" cy="17.5" r="2.2" />
      <circle cx="18.5" cy="17.5" r="2.2" />
      <path d="M10.6 7.2L6.9 15.6M13.4 7.2l3.7 8.4M7.7 17.5h8.6" opacity="0.7" />
    </svg>
  )
}

export function SettingsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" opacity="0.6" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  )
}

export function CloseIcon(props) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  )
}

export function ClockIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function ArrowIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  )
}

export function TerminalIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <path d="M7 9.5l3 2.5-3 2.5" />
      <path d="M12.5 15h4.5" opacity="0.6" />
    </svg>
  )
}

export function VpnIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.2l7 2.7v5.4c0 4.3-2.9 7.9-7 9.5-4.1-1.6-7-5.2-7-9.5V5.9l7-2.7z" />
      <path d="M9.2 12.1l2.0 2 3.6-3.8" />
    </svg>
  )
}

export function BrowserIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" opacity="0.6" />
      <path d="M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5z" opacity="0.7" />
    </svg>
  )
}

export function AiIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1-5.1-1.9 5.1-1.9L12 3.5z" />
      <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" opacity="0.6" />
    </svg>
  )
}

export function MacIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="8" width="16" height="8" rx="2.5" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2.6" />
      <path d="M9 5v3M15 5v3M9 16v3M15 16v3" opacity="0.6" />
    </svg>
  )
}

export function PulseIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12h4l2.2-5 3.6 10 2.4-5h7" />
    </svg>
  )
}

export function WifiIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.8 9.2a13 13 0 0 1 18.4 0" opacity="0.5" />
      <path d="M5.8 12.4a8.6 8.6 0 0 1 12.4 0" opacity="0.75" />
      <path d="M9 15.6a4.2 4.2 0 0 1 6 0" />
      <circle cx="12" cy="18.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function XIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 4.5l15 15M19.5 4.5l-15 15" />
    </svg>
  )
}

export function CodeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.2 5.5l-2.4 13" />
    </svg>
  )
}

export function FilesIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2.2h7A1.5 1.5 0 0 1 20 9.7V17.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    </svg>
  )
}

export function PlayIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6.5v11l9-5.5z" fill="currentColor" />
    </svg>
  )
}
