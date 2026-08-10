# VOID.OS / ExoMind — production deploy

Full client handoff: **[HANDOFF.md](./HANDOFF.md)**.

## Quick deploy (Vercel)

1. Import GitHub repo → Framework **Vite** · Build `npm run build` · Output `dist`
2. Set env: Gemini, WalletConnect, Turso, RH Chain RPC
3. Redeploy after any `VITE_*` change

## Minimal env checklist

| Var | Link |
|-----|------|
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey → check `GET /api/health` → `gemini: true` |
| `VITE_WALLETCONNECT_PROJECT_ID` | https://cloud.reown.com |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | https://turso.tech |
| `VITE_RH_CHAIN_ID` / `RH_RPC_URL` | Robinhood Chain (`4663`) |
| `EXO_TOKEN` / `VITE_EXO_CA` / `VITE_CLAIM_CONTRACT` | when token + claim live |
| `VITE_X_URL` / social | optional |

Auth is **wallet-only** (Robinhood) — no Google Client ID needed.

## Local

```bash
npm install
npm run mind
npm run dev
```

Template: `.env.example`
