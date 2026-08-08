# VOID.OS / ExoMind — production deploy

## What users get

- Landing + fullscreen cosmos map (claim constellations → durable ledger)
- Optional register/login (name + password) — guest works immediately
- Mind chat with persistent history + ownership memory
- Gemini + function calling when `GEMINI_API_KEY` is set

## Deploy (Vercel)

1. Import the GitHub repo
2. Framework: **Vite** · Build: `npm run build` · Output: `dist`
3. Environment variables:

| Var | Required | Notes |
|-----|----------|--------|
| `GEMINI_API_KEY` | recommended | [AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | no | default `gemini-flash-latest` |
| `TURSO_DATABASE_URL` | **yes for persistence** | `libsql://…` from [Turso](https://turso.tech) |
| `TURSO_AUTH_TOKEN` | **yes with Turso** | Turso auth token |
| `VITE_GOOGLE_CLIENT_ID` | for Google login | Google Cloud OAuth Web client ID |
| `GOOGLE_CLIENT_ID` | for Google login | same value as above (server verify) |
| `SOLANA_RPC_URL` | no | default mainnet public RPC |
| `EXO_MINT` | when $EXO live | SPL token mint for balance |
| `VITE_WALLETCONNECT_PROJECT_ID` | for Robinhood | [Reown Cloud](https://cloud.reown.com) Project ID |

### Google OAuth setup

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth Client ID (Web)
2. Authorized JavaScript origins: `https://ashy-gamma-42.vercel.app` and `http://localhost:5173`
3. Put the client ID in `VITE_GOOGLE_CLIENT_ID` **and** `GOOGLE_CLIENT_ID`, then redeploy

### Wallet (Phantom + Robinhood)

1. Create a Project ID at [cloud.reown.com](https://cloud.reown.com) → set `VITE_WALLETCONNECT_PROJECT_ID` → redeploy
2. Cabinet → **connect Robinhood** → QR → open Robinhood Wallet → Scan → approve + sign
3. Or **Phantom** / other injected wallets on desktop
4. Or open the site inside Robinhood Wallet **Web3 browser** and use the injected connect button
5. SOL balance shows live; `$EXO` when `EXO_MINT` is set

4. Deploy / Redeploy after setting env

`vercel.json` rewrites non-API routes to `index.html`.

## Local

```bash
npm install
npm run mind   # API on :8787 (uses server/data/void.db via libSQL file)
npm run dev    # Vite, proxies /api → 8787
```

Optional `server/.env`:

```
GEMINI_API_KEY=…
GEMINI_MODEL=gemini-flash-latest
# or point local mind at Turso:
# TURSO_DATABASE_URL=…
# TURSO_AUTH_TOKEN=…
```

## Checklist

- [ ] Register account → reload → still signed in (cookie + guest_key)
- [ ] Claim constellation → reload → lots still yours on map + in chat
- [ ] Ask mind → reload → conversation history returns
- [ ] Free-lot / jailbreak prompts refused in-character
- [ ] `/docs` works after refresh

## Mind prompts

Edit [`shared/mind-prompts.json`](shared/mind-prompts.json), redeploy (or reseed local DB).
