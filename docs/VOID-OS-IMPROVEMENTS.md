# VOID.OS: improvements and plan

Written for: the team, to read before picking the next work. Companion to `VOID-OS-GAPS.md` (what is missing for the story) and `VOID-CODE.md` (the code editor). This file is about quality: how the desktop feels, what breaks, and what to fix first.

Status is as of branch `feat/void-os-demo`, after the latest round.

---

## 1. Done in this round

| Area | Change | How it was checked |
|---|---|---|
| Resilience | Every window renders inside its own error boundary. A crashing app shows "Try again / Close window" and the desktop keeps running. | Code review. Boundary is in `src/os/AppBoundary.jsx`. A forced crash was not run in the browser yet. |
| Keyboard | Escape closes the top window only when focus is not in a text field, so typing in Terminal or VOID.CODE does not close windows. | Chrome, scripted: terminal stays open after Esc in its input. |
| Keyboard | Visible focus ring for every control (`:focus-visible`). | CSS. Not yet checked with a screen reader. |
| Help menu | "Help" opens the Welcome window (it used to do nothing). | Chrome, scripted. |
| Narrow screens | Windows take the full width below 700 px, dragging is off, the market table drops the volume column. | Chrome mobile emulation at 390 × 844. |
| Engine caption | The galaxy's minimap caption is hidden on the desktop. | Screenshot. |
| Browser | Fixed a false "blocked the tab" message caused by `noopener`. Tabs, Ctrl+T, Ctrl+W, Ctrl+L work. | Chrome: a real tab opens, no false warning. |
| Market | Filters by trend and by pool age, search, expandable rows with 1h/6h moves, liquidity, FDV, market cap, buy/sell ratio, launch date. Missing values show a dash, not 0. | Chrome, screenshots. 21 unit tests pass. |

Known gaps in what was just done:

- The error boundary has not been exercised with a real crash.
- Only Chrome was used. Safari and Firefox were not tested.
- No automated end-to-end test exists yet. All checks so far were scripted by hand with puppeteer.

---

## 2. Priorities

Ranked by how much each item hurts the story or the user. P0 blocks the story, P1 is needed before showing it to people, P2 is polish, P3 is later.

### P0: blocks the story

1. **Websites inside the window.** Needs a remote browser service (decision and budget). See `VOID-OS-GAPS.md` section 1. Until then the browser is honest about it and opens sites in real tabs.
2. **Server routes.** X callback, `/api/os-ai` (VOID.AI on Gemini), and a server cache for market data. The public GeckoTerminal endpoint returns 429 under load, and the desktop falls back to demo data.
3. **Real `$VOID` pool.** `DEFAULT_POOL` is empty, so the `$VOID` stats are blank.

### P1: needed before a demo to strangers

4. **Russian and English.** The landing has both languages, the desktop is English only. Use the same dictionary approach as the landing.
5. **First run.** The Welcome window is generic. A short scripted first run would explain what is real and what is simulated, in one screen.
6. **Honest labels audit.** Every simulated feature needs a visible label on the screen where it appears (VPN, Tor, SSH, MAC changer, VOID.AI, the demo banner). Most do. Walk every window once and list the ones that do not.
7. **End-to-end smoke test in the repo.** The puppeteer scripts used so far should become one `scripts/os-smoke.mjs` that boots the desktop, opens every app, runs one terminal command, connects the VPN, and checks for page errors. Run it before each release.
8. **Persisted layout.** Reloading the page closes every window. Saving open apps and positions in `localStorage` is small and makes the desktop feel like a real OS.

### P2: polish

9. **Dock keyboard navigation.** Arrow keys move between dock items, Enter opens. Today the items are only reachable with Tab.
10. **Window stacking on open.** Windows cascade and overlap heavily when many are open. Options: a smaller offset, or open the new window at the last cursor position.
11. **Minimize.** There is no minimize. Close is the only exit. A minimize animation into the dock (a genie-style move) would fit the Mac direction and makes the dock meaningful.
12. **Mobile dock.** On phones the dock scrolls sideways. A bottom tab bar with five fixed apps would be easier to reach.
13. **Hardcoded colours.** Some apps still use literal hex values instead of the `--os-*` tokens. Move them to tokens so a palette change is one edit.
14. **Empty states.** Several screens show a plain line when there is no data (Market with no matches, Pulse while waiting for the first block). Give each one a short, specific message.

### P3: later

15. **Sounds.** Optional, off by default, for boot and window open. Only if the team wants it.
16. **Multiple desktops.** Not needed for the story.
17. **Theme switch.** The landing has aurora and night themes. The desktop has one look. A matching switch in Settings would tie them together.

---

## 3. Design system

### 3.1 What exists

- **Colour.** Void `#050505`, panel `#0b0b0d`, raised `#131316`, lime `#ccff00` as the single accent, ink `#f0f0f0`, muted `#9a9aa2`. Status colours: ok `#4fd1a5`, warn `#f2994a`, error `#ff5c5c`.
- **Type.** Syne for titles and the brand, IBM Plex Mono for everything else. Titles are rare and large, labels are small uppercase with wide tracking.
- **Shape.** Windows 12 px radius, buttons fully rounded, tiles 14 px radius on the dock and 4 px in title bars.
- **App tiles.** Each app has a two-colour gradient and a white line glyph (`AppTile.jsx`, `icons.jsx`). This is the Mac direction from the references.
- **Motion.** One set of easing curves (`--os-ease-out`, `--os-ease-spring`, `--os-ease-in`). Only `transform` and `opacity` are animated.

### 3.2 Inconsistencies to fix

- Radii are not on a scale. Panels use 10, 12, 14, 16 and 18 px. Pick three: small 8, medium 12, large 16.
- Spacing uses ad-hoc values (6, 8, 10, 12, 14, 16 px). Use a four-step scale: 4, 8, 12, 16.
- The terminal and VOID.CODE use their own monospace sizes (12 and 12.5 px). Use one size for code, one for UI.
- The "chip" control has two looks (desktop chips and VOID.AI chips). Make them one component.

### 3.3 Design review checklist (run before each release)

- Every window fits at 1280 × 800 without a scrollbar on its first screen.
- Every control has a hover, a focus ring and a pressed state.
- No text is smaller than 11 px.
- Muted text on the panel background reaches at least 4.5:1 contrast. Check `#9a9aa2` on `#0b0b0d` with a contrast tool before shipping, the numbers are close.

---

## 4. Animation

### 4.1 What exists

- Boot: logo rise, scanline, a short RGB-split flicker, then the boot curtain fades out before the desktop appears.
- Galaxy: a short zoom-in and fade when the desktop arrives.
- Desktop chrome: menu bar drops in, widgets arrive one after another, dock rises.
- Dock: proximity magnification (scales each icon by its distance from the pointer).
- Windows: spring open, quick close.
- VOID.AI: replies type out character by character.
- VPN: a ripple around the status orb while connected.
- Market: row details fade in, buy/sell bar animates.

### 4.2 Rules we keep

- Animate `transform` and `opacity` only. Anything that changes layout causes jank on weak machines.
- Entrances use the spring curve, exits use the ease-in curve and are shorter than entrances.
- Everything is off under the system reduced-motion setting and under the Motion switch in Settings.
- No animation loops while the window is hidden or the tab is in the background.

### 4.3 Next animation work

- **Minimize into the dock.** Window shrinks toward its dock icon. Needs the icon position, which the dock already has through its refs.
- **Galaxy reacts to the pointer.** A slight pull of nearby grains toward the cursor. Must be cheap: sample at 30 fps and only inside the galaxy window.
- **Window focus.** A very short lift on focus, instead of only a colour change.
- **Matrix rain on SSH connect** is in place. Consider a faint glitch on the terminal text right after it finishes.

Budget: nothing above should cost more than 2 ms per frame on a mid-range laptop. Measure before adding.

---

## 5. Performance

- The galaxy is the heaviest thing on the desktop (tens of thousands of grains on a canvas). It is off by default on devices with 4 cores or fewer, or 4 GB RAM or less.
- Next: pause the galaxy while a window covers most of the screen, and resume when it is visible again. This is a measured win on laptops, not a guess.
- The VOID.CODE editor (about 190 KB gzip) loads only when its window opens.
- Market and Pulse poll public endpoints. Both stop when their window closes. Keep it that way.
- Measure: first paint of `/os`, time from boot end to interactive dock, frame time with the galaxy on and with 4 windows open. Record the numbers in this file once measured.

---

## 6. Accessibility

Done: focus rings, Escape that respects text fields, reduced motion.

To do:

- Screen reader pass. The galaxy canvas has a label, but the grains are not described. A short text summary (number of constellations, the hovered one) would help.
- Dock arrow keys (see P2 item 9).
- Every icon-only button needs an accessible name. Most have one. Run an automated check (axe) on each window.
- Tabs in the browser and VOID.CODE use `role="tab"`. Add arrow-key switching, as the ARIA pattern expects.
- Respect the system text-size setting. Some fixed pixel sizes ignore it.

---

## 7. Reliability

Done: a crash in one app no longer takes the desktop down.

To do:

- Error reporting for real users (for example Sentry). Without it we only see failures we reproduce ourselves.
- Retry and backoff for the market and RPC feeds. Today a failure shows demo data and does not retry until the next open.
- A clear message when the browser blocks pop-ups for external sites (already in place) and when the RPC is unreachable (in place for Pulse and Network).
- A `localStorage` quota check before saving VOID.CODE files, so a full storage shows a message, not a silent loss.

---

## 8. Testing

Current: 21 unit tests (`node --test`) covering addresses, market mapping, formatting, password scoring, MAC helpers, block parsing, and the code app's file, secret, command and palette logic. Build and lint are clean.

Next:

1. `scripts/os-smoke.mjs`: the end-to-end smoke test from P1 item 7. It needs `puppeteer-core` as a dev dependency and a `CHROME_PATH` variable.
2. A test that forces a crash inside one window and checks that the rest of the desktop still responds.
3. A visual check: one screenshot per window at the standard size, compared with the previous run by a simple pixel diff.
4. Browser matrix: Chrome, Edge, Firefox, Safari (iOS and macOS), at desktop and phone sizes.

---

## 9. Product honesty

Rules that apply to every change:

- Anything simulated is labelled where the user sees it: VPN, Tor, SSH, MAC changer, VOID.AI, the demo banner.
- No feature claims security it does not have. The landing already avoids "unhackable" wording; the desktop follows the same rule.
- The Wi-Fi tool checks the user's own password and router settings. It does not scan networks or guess passwords. That boundary stays.
- Robinhood is named only as the chain and the wallet. Nothing suggests a partnership without an agreement.
- Market data is labelled with its source and with demo status. Rankings are not advice.

---

## 10. Success measures

These are proposals. Pick the ones that match the story and start recording them.

- Time from opening `/os` to the first usable window (target: under 3 seconds on a mid-range laptop).
- Share of visitors who open at least two apps (a sign the desktop is more than a teaser).
- Crash rate per session (target: below 0.5% once error reporting exists).
- Share of visitors who reach the Market or VOID.CODE and come back.

---

## 11. Suggested order for the next round

1. Smoke test (P1 item 7) and a crash test. Protects everything below.
2. Persisted layout (P1 item 8). Small, visible, makes the desktop feel real.
3. Russian strings and the first-run screen (P1 items 4 and 5).
4. Honest-label audit (P1 item 6). Cheap, important for trust.
5. Dock keyboard navigation and minimize into the dock (P2 items 9 and 11).
6. Design token clean-up (P2 item 13 and section 3.2).

Items from P0 are decisions for the team, not engineering tasks for this list: the remote browser, the server routes, and the `$VOID` pool.

---

## 12. Round: live browser, connection status, settings

Done in this round:

- **Live pages in the browser window.** A gateway (`gateway/`) runs Chromium and streams the page into the window. Clicks, scrolling, typing and navigation reach the real page. Checked with `example.com`. See `VOID-BROWSER.md`.
- **Safety for the gateway.** Private and local addresses are refused, both typed and after DNS. Every request is checked. 7 tests.
- **Connection card.** The browser start page says whether the gateway is connected, what the site and the gateway can see, and offers a retry.
- **Settings in the Apple System Settings style.** Sidebar with coloured section tiles and search. Grouped cards with switches and segmented controls. Sections: About, Appearance, Accessibility (text size, animations, focus), Desktop & Dock (wallpaper, widgets, magnification), Browser (start page, gateway status), Privacy (what is stored, clear buttons), Network, Wallet, Code.
- **Settings take effect at once.** Text size, reduced transparency, dock magnification, widgets, wallpaper, animations and the browser start page all apply without a reload. Reset returns to the defaults.
- **Bug fixed.** The browser window crashed when a live tab mounted, because one import was missing. The window's error boundary caught it and showed the "app stopped" message, as designed.

Decided not to build: anti-detect profiles (per-profile fingerprint spoofing, profile rotation, proxies per profile). See `VOID-BROWSER.md`, section 8.

Next, from the plan above: first-run screen and Russian strings (P1), persisted window layout (P1), tracker blocking in the gateway (`VOID-BROWSER.md`, section 9), and the end-to-end smoke test (P1).

---

## 13. Round: windows, protection warning, layout memory

Done:

- **Window motion.** Yellow minimizes the window into its dock icon with a flight, and clicking the icon flies it back. Green (or double-clicking the title bar) toggles full screen, which glides and leaves the dock visible. Dragging stays instant. The app keeps its state while hidden. Verified: the window hides after the flight, returns, and toggles full screen and back to its size.
- **Layout memory.** Open windows, their positions, full-screen state and minimized state are saved on this device and restored after a reload.
- **Protection warning in the browser.** While neither the VPN nor an SSH session is active, a yellow bar reads "You are not protected!" with "Turn on VPN", "Connect over SSH" and "Check again". The check reports the result. When protection is on, the bar turns green. This is a simulated state: the VPN and SSH sessions publish it, and nothing touches the network.
- **Bug fixed.** Desktop widgets sat above the windows, so the clock covered the full-screen buttons. Widgets now sit beneath windows, like wallpaper.

Notes:

- Verified in headless Chrome with scripted clicks. The flight itself was confirmed by inspecting running transitions, not by watching frames.
- Only Chrome was tested.

Next, from the plan above: the first-run screen, Russian strings, and the end-to-end smoke test.
