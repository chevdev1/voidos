# VOID.OS / ExoMind — production deploy

Full client handoff (done / todo / **all keys + links**): see **[HANDOFF.md](./HANDOFF.md)**.

## Quick deploy (Vercel)

1. Import GitHub repo → Framework **Vite** · Build `npm run build` · Output `dist`
2. Set env vars from [HANDOFF.md](./HANDOFF.md) (Gemini, Google Client ID ×2, WalletConnect, Turso)
3. Redeploy after any `VITE_*` change

## Minimal env checklist

| Var | Link |
|-----|------|
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey (then Redeploy; check `GET /api/health` → `gemini: true`) |
| `VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_ID` | https://console.cloud.google.com/apis/credentials |
| `VITE_WALLETCONNECT_PROJECT_ID` | https://cloud.reown.com |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | https://turso.tech |
| `EXO_MINT` | when token live |

## Local

```bash
npm install
npm run mind
npm run dev
```

Template: `.env.example`
