# VOID.OS: what is missing before the story is real

Written for: the team deciding what to build next. Status is as of the current `feat/void-os-demo` branch.

## 1. Websites in the browser

**Why most sites do not open.** Most sites send `X-Frame-Options` or a `frame-ancestors` CSP rule. That tells the browser never to show them inside another page, so an iframe stays blank or refuses. Our Browser therefore shows built-in pages and opens everything else in a real tab. That is honest, but it is not "a browser".

**Options for real sites inside the desktop**

| Option | How it works | Pros | Cons |
|---|---|---|---|
| A. Remote browser (recommended) | Headless Chromium runs on our server. Its frames stream to the window over WebSocket, and clicks and keys go back to the server. | Works for almost every site, including logins and JS-heavy pages. Keeps the user's IP off the page. | Server cost per open tab. Needs a session manager, a frame encoder and an input relay. Latency of a few hundred ms. |
| B. Rewriting proxy | Our server fetches the page, strips the frame headers and rewrites links. | Looks native. | Breaks logins and JS-heavy sites. Turns us into an open proxy, which is an abuse and legal risk. Not recommended. |
| C. Hosted remote-browser service | A third-party service provides option A as an API. | Fastest to ship. | Recurring cost, and their logs see every page. Check their privacy terms first. |

**Recommendation.** Option A, starting with an allowlist of sites (docs, explorers, X, the Robinhood Chain explorer). Add a blocklist and rate limits from day one. Estimated first milestone: 1–2 weeks for one session, streaming and basic input. Decision needed: budget for a server and which sites go on the first allowlist.

## 2. X (Twitter) sign-in

Built: the X window with PKCE code generation and a link to x.com. It is disabled until a client id is set.

Still needed:
- An X developer app with the scopes `tweet.read users.read offline.access`. Check the current endpoint and scope names in X's docs before shipping.
- A callback route `/os/x-callback` on the server. It exchanges the code for a token using the PKCE verifier kept in `sessionStorage`. The client secret lives only on the server.
- Token storage on the server, refresh handling, and a timeline endpoint that reads only what the user is allowed to read.
- Set `VITE_X_CLIENT_ID` in Vercel.

## 3. VOID.AI (Gemini)

Built: a pretest chat with canned answers and a placeholder. Nothing is sent anywhere.

Still needed:
- `POST /api/os-ai` on the server. It reuses `callGemini` from `shared/mindLogic.js` and the `GEMINI_API_KEY` that voidos already uses.
- Rate limits per IP and per session, and a system prompt written for VOID.OS (not the landing persona).
- Only then change the note in the UI. Right now it says nothing is sent, which is true only until this route exists.

## 4. Market data

- `DEFAULT_POOL` in `shared/rhChain.js` is empty, so the `$VOID` pool stats are blank. Set the real pool id.
- Trending and token logos call GeckoTerminal from the browser. Under load it returns 429 without CORS headers, and the UI falls back to demo data. Fix: a server cache (30–60 s) that the desktop calls instead.
- Token logos and names come from a third party. Show a "not verified" label for tokens we have not reviewed.

## 5. Tunnels, VPN, Tor and SSH (native build)

The VPN panel, the Tor status and the SSH session are simulated in the browser. A browser tab cannot route traffic or hold a real SSH key safely.

- **VPN.** Native app with a real WireGuard or similar tunnel, and a server fleet with an account system that does not need personal data.
- **Tor.** Either bundle the Tor client (for example `arti`) or integrate with a system Tor. Route the app's own traffic through SOCKS5.
- **SSH.** A WebSocket gateway on our server (for example `ssh2`) so the browser never sees the private key. Host keys must be checked and pinned.
- **MAC changer.** Real changes need system privileges, so this lives in the native build only, with a clear warning and a rollback.

## 6. Wallets

- The Wallet app connects through the browser's injected provider only. WalletConnect needs a project id in `VITE_WALLETCONNECT_PROJECT_ID`.
- Signing flows are not built. Before they are, we need a review of exactly what each message says, plus protection against phishing-style prompts.
- Check whether the Robinhood Wallet app supports WalletConnect for web apps. This is still an open question.

## 7. Product and story

- **Language.** The desktop is English only. The landing has EN and RU. Move OS strings into the same i18n approach.
- **Onboarding.** The Welcome window is generic. A short scripted first-run (the "narrative") would make the story land: why the desktop exists, what is simulated, what is real.
- **Honest copy everywhere.** Every simulated feature needs a visible label. Today most do, but not all. Audit every screen.
- **Mobile.** The desktop assumes a wide screen. Phones need a single-window mode and a bottom dock.
- **Accessibility.** Keyboard focus rings, screen-reader labels on the galaxy canvas, reduced-motion coverage.
- **Legal.** Terms and privacy for the OS, the demo banner, and a review of every anonymity claim. The landing already avoids "unhackable" wording, keep that rule.
- **Brand.** Robinhood is used as the name of a chain and a wallet only. Before any co-marketing, we need an agreement. Nothing in the UI should suggest a partnership.

## 8. Performance and quality

- Done: the galaxy wallpaper is off by default on low-end devices (4 cores or less, or 4 GB RAM or less) and can be turned on in Settings. Still to do: measure the galaxy on a real weak laptop and tune the grain count.
- Done: motion respects the system reduced-motion setting and the Motion switch in Settings.
- Add end-to-end tests for: boot, open each app, terminal commands, VPN connect, Settings reset. Today this is manual plus scripted screenshots.
- Error reporting for the client (for example Sentry), so we see real failures from real users.
- Security review of the OS before any real key or account touches it.

## 9. Suggested order

1. Decide on the remote browser (option A) and its budget. This is the largest visible gap.
2. Server routes: X callback, `/api/os-ai`, market cache. Small, unlocks three apps at once.
3. Set the `$VOID` pool and the X client id in Vercel.
4. Scripted first-run and Russian strings, so the story can be shown to people.
5. Native build plan (VPN, Tor, SSH gateway, MAC changer) as a separate document.
