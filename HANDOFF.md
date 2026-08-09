# VOID.OS / ExoMind — handoff for client

Live: https://ashy-gamma-42.vercel.app  
Repo: https://github.com/mishashish/-.git  
Branch: `main` (auto-deploy via Vercel recommended)

Last code note: site gaps filled in repo (CA TBA, footer soon, FAQ, Train patch test, Mind on-topic). Infra below is still on the client.

---

## Діри / gaps (що ще не закрито)

Це не баги в UI — це те, чого **немає без ключів / токена / дій клієнта**.

| Діра | Статус у коді | Що зробити клієнту |
|------|---------------|-------------------|
| **Turso DB** | Код готовий (`shared/voidDb.js`) | Додати `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` на Vercel → Redeploy. Без цього акаунти/чат на сервері можуть злітати після cold start. Лоти в браузері лишаються. |
| **Google OAuth Publish** | Кнопка є | OAuth consent → **Publish** (External → Production). Інакше логін лише для Test users. |
| **Свої ключі** | Працює на ключах білдера | Замінити Gemini / Google / Reown на акаунти клієнта. |
| **Google JS origins** | — | Додати фінальний домен + `localhost:5173` в Authorized JavaScript origins. |
| **`$EXO` mint / CA** | Hero: `CA TBA · mint not live` | Коли токен є: `EXO_MINT` + `VITE_EXO_MINT` / `VITE_EXO_CA` → Redeploy. |
| **Реальний burn / claim** | Test mode (безкоштовний claim) | Після mint — вимкнути test claim і підключити реальний burn. |
| **Реальний training burn** | `Train patch (test)` у CABINET | Після mint — брати $EXO як fuel замість free train. |
| **Соцмережі / Dex** | Footer `soon`, Follow hidden | `VITE_X_URL`, `VITE_GITHUB_URL`, `VITE_DEX_URL`, `VITE_TELEGRAM_URL` на Vercel. |
| **Audit / CA на сайті** | FAQ чесно: audit ще немає | Коли буде звіт — оновити FAQ + лінк. |
| **Автономний X ExoMind** | Лише в лорі docs | Окремий продукт/бот — не в цьому репо. |
| **Custom domain** | Vercel default | Підключити домен; оновити Google origins + Reown. |

---

## Що вже зроблено в коді (не діри)

### Product
- Fullsite VOID.OS: map, claim constellations (**test mode** — no real $EXO burn yet)
- **CABINET / ЛК** — owned lots, 6 kinds (Spire / Coil / Crown / Lattice / Vein / Halo)
- Lot viewer: rotate, tap stars, per-star lore
- **Train patch (test)** in CABINET — marks lot trained / fed on the map (free until mint)
- **Google-only** account (register = login)
- **Robinhood Wallet** link via WalletConnect QR (+ in-app Web3 browser)
- SOL balance; `$EXO` balance when mint is set
- **Ask the mind** — live Gemini; stays on VOID topics; no wish-games; language match; degraded ≠ FAQ script
- Claims sync to browser ledger + server (Mind sees your lots)
- Footer / Hero CA env-driven — no fake `#` / dummy `0xEXO…DEAD`

### Infra / fixes shipped
- Google OAuth wired on Vercel
- WalletConnect Project ID wired on Vercel
- Gemini key wired on Vercel (`GET /api/health` → `gemini: true`)
- DB migrate bug fixed (`users` table)
- Mind no longer wipes local lots when server DB is empty
- Phantom removed (Robinhood only)
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
| **P2** | Set `EXO_MINT` / `VITE_EXO_CA` when token launches | Real CA + balance. |
| **P2** | Turn off claim/train test-mode / wire real burn | When mint + payment flow are ready. |
| **P3** | Custom domain on Vercel | Update Google + Reown allowlists. |

---

## Що перевірити (smoke checklist)

### Mind / API
1. `GET https://ashy-gamma-42.vercel.app/api/health` → `{ "ok": true, "gemini": true }`
2. Ask the mind: звичайне питання → жива відповідь (не FAQ, не `signal thinned`)
3. «давай поиграем» / wish-game → короткий отказ по темі VOID, без error-static
4. Питання укр/рус → відповідь тією ж мовою

### Map / Cabinet
5. Open full map → select lots → claim (test) → toast / ledger
6. CABINET → lot rotate / tap ★ / ask mind about star
7. **Train patch (test)** → badge trained; reload → still trained in localStorage; map filter “trained/fed” if engine loaded
8. Phone: demo map usable; Explore не кричить лаймом; full map dock не їсть галактику

### Account / wallet
9. Google sign-in (якщо ти в Test users або app Published)
10. Robinhood connect QR (або in-app browser)
11. Reload: session + lots (жорстко на сервері — лише з Turso)

### Content
12. Hero CA = `CA TBA · mint not live` (поки немає `VITE_EXO_CA`)
13. Footer X/GitHub/Dex = **soon** (поки немає URL)
14. FAQ / Docs згадують test mode

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

- **Who:** client creates their own Google AI Studio key  
- **Vercel:** Project → Settings → Environment Variables → add `GEMINI_API_KEY` (Production + Preview) → **Redeploy**  
- **Check:** `GET /api/health` should return `{ "ok": true, "gemini": true }`  
- **Note:** without this key Mind answers with a short “signal degraded” line — it will not fake a smart FAQ script

### 2) Google login — same Client ID twice

| Env | Required | Where to get |
|-----|----------|----------------|
| `VITE_GOOGLE_CLIENT_ID` | **Yes** for Google button | https://console.cloud.google.com/apis/credentials |
| `GOOGLE_CLIENT_ID` | **Yes** (same value) | same Web OAuth Client ID |

**Setup steps for client:**
1. Google Cloud → create/select project  
2. OAuth consent screen → **External** → fill app name → **Publish** when ready for all users  
3. Credentials → **OAuth client ID** → type **Web application**  
4. Authorized JavaScript origins:
   - `https://ashy-gamma-42.vercel.app` (or final domain)
   - `http://localhost:5173`
5. Copy **Client ID** (`….apps.googleusercontent.com`) into **both** env vars above  
6. Client Secret is **not** used by this app (GIS popup) — do not put secret in `VITE_*`

### 3) Robinhood / WalletConnect

| Env | Required | Where to get |
|-----|----------|----------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | **Yes** for QR connect | https://cloud.reown.com → Create Project → Project ID |

- **Who:** client creates their own Reown project  
- Fallback without ID: open site inside Robinhood Wallet → Web3 browser

### 4) Durable database (strongly recommended)

| Env | Required | Where to get |
|-----|----------|----------------|
| `TURSO_DATABASE_URL` | **Yes for real persistence** | https://turso.tech → create DB → `libsql://…` |
| `TURSO_AUTH_TOKEN` | **Yes with Turso** | Turso dashboard → token |

Without Turso: works for demos; serverless `/tmp` DB can reset.

### 5) Solana / token (optional until launch)

| Env | Required | Where to get |
|-----|----------|----------------|
| `SOLANA_RPC_URL` | No | default public mainnet, or Helius/QuickNode later |
| `EXO_MINT` | When `$EXO` exists | SPL mint address of the token |
| `VITE_EXO_MINT` / `VITE_EXO_CA` | When live | Public Hero CA / balance UI |

### 6) Optional frontend

| Env | Required | Notes |
|-----|----------|--------|
| `VITE_MIND_API_URL` | No | Leave empty on Vercel (same origin `/api`) |
| `VITE_HASH_ROUTER` | No | Only if host has no SPA rewrites |
| `VITE_EXO_CA` / `VITE_EXO_MINT` | When live | Hero CA box; without → **CA TBA · mint not live** |
| `VITE_X_URL` / `VITE_GITHUB_URL` / `VITE_DEX_URL` / `VITE_TELEGRAM_URL` | No | Footer / Follow; without → **soon** (no fake `#`) |

---

## Current builder Vercel status (replace with client keys)

Already set on this project (do **not** share raw secrets in chat/docs):

| Env | Status |
|-----|--------|
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Set |
| `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` | Set |
| `VITE_WALLETCONNECT_PROJECT_ID` | Set |
| `TURSO_*` | **Not set** ← client should add |
| `EXO_MINT` / `VITE_EXO_*` | Not set (token TBA) |
| `VITE_X_URL` / social | Not set → footer **soon** |

When handing off: client creates fresh keys → paste into Vercel → remove builder keys → Redeploy.

---

## How to run locally

```bash
npm install
npm run mind   # API :8787
npm run dev    # Vite :5173, proxies /api
```

Copy `.env.example` → `.env.local` / `server/.env` and fill keys.

---

## Quick smoke test for client (short)

1. Open live site → **account** → Continue with Google  
2. Map → claim a constellation (test) → open **CABINET** → rotate / tap stars / **Train patch (test)**  
3. **Ask the mind** → should name owned lots; refuse games on-topic  
4. CABINET → **connect Robinhood** → QR scan  
5. Reload → still signed in + lots still there (needs Turso for hard server persistence)  
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
| DB | `shared/voidDb.js`, `shared/schema.sql` |
| Google UI | `src/components/GoogleSignIn.jsx`, `AccountMenu.jsx` |
| Wallet | `src/components/WalletPanel.jsx`, `src/lib/solanaWallets.js` |
| Cabinet | `src/pages/Cabinet.jsx` |
| Chat UI | `src/components/MindChat.jsx` |
| Vercel APIs | `api/*.js` |
| Health | `api/health.js` |
