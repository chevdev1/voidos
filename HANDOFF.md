# VOID.OS / ExoMind — handoff for client

Live: https://ashy-gamma-42.vercel.app  
Repo: https://github.com/mishashish/-.git  
Branch: `main` (auto-deploy via Vercel recommended)

---

## What is already done

### Product
- Fullsite VOID.OS: map, claim constellations (test mode — no real $EXO burn yet)
- **CABINET / ЛК** — owned lots, 6 kinds (Spire / Coil / Crown / Lattice / Vein / Halo)
- Lot viewer: rotate, tap stars, per-star lore
- **Google-only** account (register = login)
- **Robinhood Wallet** link via WalletConnect QR (+ in-app Web3 browser)
- SOL balance; `$EXO` balance when mint is set
- **Ask the mind** — Gemini ExoMind chat; auto-briefs owned lots on open; tools for lot/star stories
- Claims sync to browser ledger + server (Mind sees your lots)

### Infra / fixes shipped
- Google OAuth wired on Vercel
- WalletConnect Project ID wired on Vercel
- Gemini key wired on Vercel
- DB migrate bug fixed (`users` table)
- Mind no longer wipes local lots when server DB is empty
- Phantom removed (Robinhood only)

---

## What is left / recommended next

| Priority | Task | Why |
|----------|------|-----|
| **P0** | Add **Turso** DB (`TURSO_*`) | Without it Vercel uses ephemeral `/tmp` — accounts/history can reset after cold starts. Client browser ledger still keeps lots. |
| **P0** | Google OAuth → **Publish app** (External → Production) | Until published, only Test users can sign in. |
| **P1** | Replace all keys below with **client’s own** accounts | Current keys are on the builder’s Google / Reown / Gemini — client should own them. |
| **P1** | Confirm Google **Authorized JavaScript origins** include final domain | Add production + any custom domain + `http://localhost:5173` for local. |
| **P2** | Set `EXO_MINT` when token launches | Shows real $EXO balance; later gate real burns. |
| **P2** | Turn off claim test-mode / wire real burn | When mint + payment flow are ready. |
| **P3** | Optional: custom domain on Vercel | Update Google origins + Reown allowlist if any. |

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

### 6) Optional frontend

| Env | Required | Notes |
|-----|----------|--------|
| `VITE_MIND_API_URL` | No | Leave empty on Vercel (same origin `/api`) |
| `VITE_HASH_ROUTER` | No | Only if host has no SPA rewrites |

---

## Current builder Vercel status (replace with client keys)

Already set on this project (do **not** share raw secrets in chat/docs):

| Env | Status |
|-----|--------|
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Set |
| `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` | Set |
| `VITE_WALLETCONNECT_PROJECT_ID` | Set |
| `TURSO_*` | **Not set** ← client should add |
| `EXO_MINT` | Not set (token TBA) |

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

## Quick smoke test for client

1. Open live site → **account** → Continue with Google  
2. Map → claim a constellation (test) → open **CABINET** → rotate / tap stars  
3. **Ask the mind** → should name owned lots immediately  
4. CABINET → **connect Robinhood** → QR scan  
5. Reload → still signed in + lots still there (needs Turso for hard server persistence)

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
