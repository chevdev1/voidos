# VOID.OS browser: live pages through a gateway

Written for: the team. Covers how websites open inside the VOID.OS browser window, what runs where, the safety rules, how to run it, and what we deliberately do not build.

## 1. What works today

- Type a web address in the browser window. The page is drawn in the window, and clicks, scrolling, typing and back, forward, reload all reach the real page (checked end to end: `example.com` loads inside the window, and a click on the page navigates it).
- Tabs, Ctrl+T, Ctrl+W, Ctrl+L, a start page, and a connection card that says plainly whether the gateway is connected.
- Without a gateway, a web address opens in a real browser tab, and the browser says so.

## 2. Why a gateway, not an iframe

Most websites send `X-Frame-Options` or `frame-ancestors`, which forbids showing them inside another page. No client-side code can override that, so a page can only appear inside our window if a server fetches it and streams the picture. That is what the gateway does.

## 3. Architecture

```
  VOID.OS (browser window)                    gateway (Node + Chromium)
  ─────────────────────────                   ──────────────────────────
  RemoteBrowser (canvas)  ── WebSocket ──►    one headless Chromium
    draws JPEG frames      ◄── frames ──      one page per connection
    sends mouse, keys,     ── input ──►       Page.screencast → JPEG
    scroll, navigation                        puppeteer input calls
                                              every request checked
```

- `gateway/index.mjs`: the WebSocket server, sessions, screencast, input.
- `gateway/safety.mjs`: the rules for which addresses may be loaded.
- `src/os/RemoteBrowser.jsx`: the client canvas.
- `src/os/ConnectionCard.jsx`: the status shown on the browser start page.
- `src/os/gateway.js`: the gateway URL (build-time `VITE_BROWSER_GATEWAY`) and the health check.

## 4. Safety rules (enforced in code, tested)

The gateway must never become a way into a server's own network, and must not become an open proxy for abuse.

- Only `http` and `https`. No `file:`, `javascript:` or other schemes. `data:` and `blob:` pass through because they never leave the server.
- No credentials in the address, and only the standard ports (80 and 443).
- No `localhost`, `*.local`, `*.internal` and single-label names.
- No private, loopback, link-local or reserved IP addresses, both as typed and after DNS resolution. A name that resolves to any private address is refused.
- Every request the page makes (redirects and sub-resources included) is checked the same way, not only the first address.
- Sessions are capped (`MAX_SESSIONS`, default 4) and idle sessions close after 5 minutes.
- The WebSocket only accepts the origins in `GATEWAY_ORIGINS`, so other sites cannot use the gateway from a visitor's browser.
- Tests: `cd gateway && npm test` (7 tests for the address and DNS rules).

## 5. Running it

```
cd gateway
npm install
npm start                       # listens on ws://localhost:8788/browser
```

Then build the desktop with the gateway URL:

```
VITE_BROWSER_GATEWAY=ws://localhost:8788/browser npm run build
```

The desktop reads the URL at build time. Without it, the browser opens web addresses in real tabs and the connection card says "Not connected".

Environment for the gateway: `PORT`, `CHROME_PATH` (the path to Chrome or Chromium), `MAX_SESSIONS`, `IDLE_MS`, `GATEWAY_ORIGINS`.

## 6. Privacy: what changes and what does not

- The website sees the gateway's IP address, not the visitor's. That is a real change for the visitor.
- The gateway operator can see every page loaded through it, and can log them. The card and the browser note say so. Operating a gateway means being trusted with that.
- Cookies and logins live on the gateway's browser profile for the length of the session. They are not kept after the session closes (the page is closed).
- A visitor's IP is still visible to the gateway. This is not a substitute for Tor or a VPN, and the desktop does not claim it is.

## 7. Production

The gateway is a long-running process with Chromium. It does not fit Vercel's serverless model. For a deployment:

1. A small VM or container with Chromium, behind TLS (`wss://`), with `GATEWAY_ORIGINS` set to the production desktop origin only.
2. Rate limits per visitor and a global session cap that matches the machine.
3. Logging with a short retention period. Do not log page contents.
4. Abuse handling: a way to block addresses and report misuse, and a published terms page.
5. Monitoring of memory, because each Chromium page costs memory.

## 8. What we deliberately do not build

- **Anti-detect profiles.** No per-profile fingerprint spoofing, no profile rotation, no proxy per profile. That combination is how multi-accounting and ban evasion are done, and it harms the sites and people on the other side. The browser has one consistent profile for everyone.
- **Proxy switching for the visitor.** A visitor's own traffic routing belongs to the native app's tunnel, where it can be shown honestly. The gateway itself already sits between the visitor and the sites.

## 9. Next steps

1. Tracker blocking in the gateway, with a published list and a visible counter (a privacy feature that reduces tracking for everyone).
2. Clipboard and file download handling, both off by default.
3. Multi-tab sessions sharing one Chromium, to lower memory per tab.
4. A production deployment as described in section 7.
