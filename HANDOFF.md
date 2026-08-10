# VOID.OS / ExoMind — handoff for client

Live: https://ashy-gamma-42.vercel.app  
Repo: https://github.com/mishashish/-.git  
Branch: `main` (auto-deploy via Vercel recommended)

Last code note: stack is **Robinhood Chain (EVM, chainId 4663)** — not Solana SPL. Claim requires wallet connect; on-chain burn when contract+token env are set.

---

## Діри / gaps (що ще не закрито)

Це не баги в UI — це те, чого **немає без ключів / токена / дій клієнта**.

| Діра | Статус у коді | Що зробити клієнту |
|------|---------------|-------------------|
| **Turso DB** | Код готовий (`shared/voidDb.js`) | Додати `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` на Vercel → Redeploy. Без цього акаунти/чат на сервері можуть злітати після cold start. Лоти в браузері лишаються. |
| **Google OAuth Publish** | Кнопка є | OAuth consent → **Publish** (External → Production). Інакше логін лише для Test users. |
| **Свої ключі** | Працює на ключах білдера | Замінити Gemini / Google / Reown на акаунти клієнта. |
| **Google JS origins** | — | Додати фінальний домен + `localhost:5173` в Authorized JavaScript origins. |
| **`$EXO` ERC-20 / CA** | Hero: `CA TBA · mint not live` | Коли токен на RH Chain: `EXO_TOKEN` + `VITE_EXO_TOKEN` / `VITE_EXO_CA` → Redeploy. |
| **RH RPC** | Default placeholder URL | Set `RH_RPC_URL` / `VITE_RH_RPC_URL` to a real Robinhood Chain RPC. |
| **Реальний burn / claim** | Test claim після connect (без tx) | Set `VITE_CLAIM_CONTRACT` + token → on-chain `claim` + `/api/claim-verify`. |
| **Реальний training burn** | `Train patch (test)` у CABINET | Після token — брати $EXO як fuel замість free train. |
| **Соцмережі / Dex** | Footer `soon`, Follow hidden | `VITE_X_URL`, `VITE_GITHUB_URL`, `VITE_DEX_URL`, `VITE_TELEGRAM_URL` на Vercel. |
| **Audit / CA на сайті** | FAQ чесно: audit ще немає | Коли буде звіт — оновити FAQ + лінк. |
| **Автономний X ExoMind** | Лише в лорі docs | Окремий продукт/бот — не в цьому репо. |
| **Custom domain** | Vercel default | Підключити домен; оновити Google origins + Reown. |

---

## Що вже зроблено в коді (не діри)

### Product
- Fullsite VOID.OS: map, claim constellations on **Robinhood Chain**
- Claim UX: **connect Robinhood wallet required**; without `VITE_CLAIM_CONTRACT` → **test claim** (+ ledger); with contract+token → on-chain then `/api/claim-verify`
- **CABINET / ЛК** — owned lots, 6 kinds (Spire / Coil / Crown / Lattice / Vein / Halo)
- Lot viewer: rotate, tap stars, per-star lore
- **Train patch (test)** in CABINET — marks lot trained / fed on the map (free until token)
- **Google-only** account (register = login)
- **Robinhood Wallet** (EVM) via WalletConnect QR (+ in-app Web3 browser)
- **ETH** balance + `$EXO` ERC-20 when `EXO_TOKEN` is set
- **Ask the mind** — live Gemini; stays on VOID topics; no wish-games; language match; degraded ≠ FAQ script
- Claims sync to browser ledger + server (Mind sees your lots)
- Footer / Hero CA env-driven — no fake `#` / dummy `0xEXO…DEAD`

### Infra / fixes shipped
- Google OAuth wired on Vercel
- WalletConnect Project ID wired on Vercel
- Gemini key wired on Vercel (`GET /api/health` → `gemini: true`)
- DB migrate bug fixed (`users` table)
- Mind no longer wipes local lots when server DB is empty
- Solana packages removed; **viem** + `@walletconnect/ethereum-provider`
- `/api/health` for Mind diagnostics

---

## What is left / recommended next (priority)

| Priority | Task | Why |
|----------|------|-----|
| **P0** | Add **Turso** DB (`TURSO_*`) | Without it Vercel uses ephemeral `/tmp` — accounts/history can reset after cold starts. |
| **P0** | Google OAuth → **Publish app** | Until published, only Test users can sign in. |
| **P1** | Replace keys with **client’s own** | Builder keys should not stay long-term. |
| **P1** | Confirm Google **Authorized JavaScript origins** | Production + custom domain + local. |
| **P1** | Set social URLs (`VITE_X_URL` …) | Footer / Follow stop showing “soon”. |
| **P1** | Confirm **RH RPC** (`RH_RPC_URL`) | Reliable balance / claim-verify. |
| **P2** | Set `EXO_TOKEN` / `VITE_EXO_CA` when token launches | Real CA + ERC-20 balance. |
| **P2** | Deploy claim contract → `VITE_CLAIM_CONTRACT` | Turns on on-chain claim path. |
| **P3** | Custom domain on Vercel | Update Google + Reown allowlists. |

---

## Що перевірити (smoke checklist)

### Mind / API
1. `GET https://ashy-gamma-42.vercel.app/api/health` → `{ "ok": true, "gemini": true }`
2. Ask the mind: звичайне питання → жива відповідь (не FAQ, не `signal thinned`)
3. «давай поиграем» / wish-game → короткий отказ по темі VOID, без error-static
4. Питання укр/рус → відповідь тією ж мовою

### Map / Cabinet
5. Full map claim **без** wallet → просить connect / CABINET
6. З wallet, без контракту → **test claim** → toast / ledger / CABINET
7. CABINET → lot rotate / tap ★ / ask mind about star
8. **Train patch (test)** → badge trained; reload → still trained in localStorage

### Account / wallet
9. Google sign-in (якщо ти в Test users або app Published)
10. Robinhood connect QR (або in-app) → кабінет показує `0x…`
11. Баланс **ETH** (і $EXO якщо token set)
12. Reload: session + lots (жорстко на сервері — лише з Turso)

### Content
13. Hero CA = `CA TBA · mint not live` (поки немає `VITE_EXO_CA` / `VITE_EXO_TOKEN`)
14. Footer X/GitHub/Dex = **soon** (поки немає URL)
15. Docs: Robinhood Chain, not Solana SPL

---

## Keys & env vars (give this list to the client)

Put these in **Vercel → Project → Settings → Environment Variables**  
(Production + Preview). After any `VITE_*` change → **Redeploy**.

Never commit real secrets into git. Use `.env.example` as the template.

### 1) Gemini (Mind AI) — server only

| Env | Required | Where to get |
|-----|----------|----------------|
| `GEMINI_API_KEY` | **Yes** for smart Mind | https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | No (default ok) | e.g. `gemini-2.0-flash` |

- **Check:** `GET /api/health` → `{ "ok": true, "gemini": true }`

### 2) Google login — same Client ID twice

| Env | Required | Where to get |
|-----|----------|----------------|
| `VITE_GOOGLE_CLIENT_ID` | **Yes** for Google button | https://console.cloud.google.com/apis/credentials |
| `GOOGLE_CLIENT_ID` | **Yes** (same value) | same Web OAuth Client ID |

Authorized JavaScript origins: production domain + `http://localhost:5173`.

### 3) Robinhood / WalletConnect

| Env | Required | Where to get |
|-----|----------|----------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | **Yes** for QR connect | https://cloud.reown.com → Project ID |

Fallback: open site inside Robinhood Wallet → Web3 browser.

### 4) Durable database (strongly recommended)

| Env | Required | Where to get |
|-----|----------|----------------|
| `TURSO_DATABASE_URL` | **Yes for real persistence** | https://turso.tech |
| `TURSO_AUTH_TOKEN` | **Yes with Turso** | Turso dashboard → token |

### 5) Robinhood Chain / token (EVM)

| Env | Required | Notes |
|-----|----------|--------|
| `VITE_RH_CHAIN_ID` | No (default `4663`) | Testnet optional `46630` |
| `RH_RPC_URL` / `VITE_RH_RPC_URL` | Recommended | RH Chain JSON-RPC |
| `EXO_TOKEN` / `VITE_EXO_TOKEN` | When `$EXO` live | ERC-20 address |
| `VITE_EXO_CA` | When live | Hero CA (falls back to `VITE_EXO_TOKEN`) |
| `VITE_CLAIM_CONTRACT` / `CLAIM_CONTRACT` | When claim live | Enables on-chain claim + `/api/claim-verify` |

Solana `EXO_MINT` / `SOLANA_RPC_URL` are **deprecated** (ignored by wallet stack).

### 6) Optional frontend

| Env | Required | Notes |
|-----|----------|--------|
| `VITE_MIND_API_URL` | No | Leave empty on Vercel |
| `VITE_HASH_ROUTER` | No | Only if host has no SPA rewrites |
| `VITE_X_URL` / `VITE_GITHUB_URL` / `VITE_DEX_URL` / `VITE_TELEGRAM_URL` | No | Footer / Follow; without → **soon** |

---

## Current builder Vercel status (replace with client keys)

| Env | Status |
|-----|--------|
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Set |
| `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` | Set |
| `VITE_WALLETCONNECT_PROJECT_ID` | Set |
| `TURSO_*` | **Not set** ← client should add |
| `EXO_TOKEN` / `VITE_EXO_*` / `VITE_CLAIM_CONTRACT` | Not set (token / contract TBA) |
| `RH_RPC_URL` | Confirm / set |
| `VITE_X_URL` / social | Not set → footer **soon** |

---

## How to run locally

```bash
npm install
npm --prefix server install
npm run mind   # API :8787
npm run dev    # Vite :5173, proxies /api
```

Copy `.env.example` → `.env.local` / `server/.env` and fill keys.

---

## Quick smoke test for client (short)

1. Open live site → **account** → Continue with Google  
2. CABINET → **connect Robinhood** → QR → `0x…` + ETH  
3. Map → claim without wallet → blocked; with wallet → **test** claim → CABINET  
4. **Ask the mind** → should name owned lots  
5. Reload → still signed in + lots (needs Turso for hard server persistence)  
6. `/api/health` → `gemini: true`

---

## Code map (if they hire a new dev)

| Area | Path |
|------|------|
| Env template | `.env.example` |
| Deploy notes | `DEPLOY.md` (short) + this file |
| Mind prompts | `shared/mind-prompts.json` |
| Mind logic / tools | `shared/mindLogic.js` |
| Lot kinds + star lore | `shared/lotLore.js` |
| RH Chain helpers | `shared/rhChain.js`, `shared/rhVerify.js` |
| DB | `shared/voidDb.js`, `shared/schema.sql` |
| Google UI | `src/components/GoogleSignIn.jsx`, `AccountMenu.jsx` |
| Wallet | `src/components/WalletPanel.jsx`, `src/lib/rhWallets.js` |
| Cabinet | `src/pages/Cabinet.jsx` |
| Vercel APIs | `api/*.js` (`wallet-link`, `wallet-balance`, `claim-sync`, `claim-verify`) |
| Health | `api/health.js` |
