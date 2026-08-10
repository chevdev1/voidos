# VOID.OS / ExoMind — production deploy

Full client handoff (done / **діри / checklist / keys**): see **[HANDOFF.md](./HANDOFF.md)**.

## Quick deploy (Vercel)

1. Import GitHub repo → Framework **Vite** · Build `npm run build` · Output `dist`
2. Set env vars from [HANDOFF.md](./HANDOFF.md) (Gemini, Google Client ID ×2, WalletConnect, Turso, RH Chain RPC)
3. Redeploy after any `VITE_*` change

## Minimal env checklist

| Var | Link |
|-----|------|
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey (then Redeploy; check `GET /api/health` → `gemini: true`) |
| `VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_ID` | https://console.cloud.google.com/apis/credentials |
| `VITE_WALLETCONNECT_PROJECT_ID` | https://cloud.reown.com |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | https://turso.tech (**P0** — without it server DB can reset) |
| `VITE_RH_CHAIN_ID` / `RH_RPC_URL` / `VITE_RH_RPC_URL` | Robinhood Chain (`4663` default) |
| `EXO_TOKEN` / `VITE_EXO_TOKEN` / `VITE_EXO_CA` | when ERC-20 live on RH Chain |
| `VITE_CLAIM_CONTRACT` | when claim/burn contract live → on-chain claims |
| `VITE_X_URL` / social | optional; without → footer “soon” |

P0 left for client: **Turso** + Google OAuth **Publish**. Full gaps table + smoke tests → [HANDOFF.md](./HANDOFF.md).


## Local

```bash
npm install
npm run mind
npm run dev
```

Template: `.env.example`
