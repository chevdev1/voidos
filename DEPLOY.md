# VOID.OS / ExoMind — production deploy

Full client handoff: **[HANDOFF.md](./HANDOFF.md)**.

## Quick deploy (Vercel)

1. Import GitHub repo → Framework **Vite** · Build `npm run build` · Output `dist`
2. Set env: Gemini, WalletConnect, Turso, RH Chain RPC
3. Redeploy after any `VITE_*` change

## Minimal env checklist

| Var | Link |
|-----|------|
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey → check `GET /api/chat` → `gemini: true` |
| `VITE_WALLETCONNECT_PROJECT_ID` | https://cloud.reown.com |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | https://turso.tech |
| `SESSION_SECRET` | Long random secret used to sign HttpOnly sessions |
| `APP_ORIGINS` | Comma-separated trusted frontend origins when frontend/API are on different hosts |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Optional distributed rate-limit store for serverless |
| `VITE_RH_CHAIN_ID` / `RH_RPC_URL` | Robinhood Chain (`4663`) |
| `EXO_TOKEN` / `VITE_EXO_CA` | live `$TEST` CA |
| `VITE_CLAIM_CONTRACT` + `CLAIM_CONTRACT` | ExoClaim on RH Chain — locks each lot to the buyer wallet |
| `VITE_X_URL` / social | optional |

### ExoClaim (on-chain lot lock)

Until this address is set, claim only burns $TEST to `dEaD` and writes Turso. After deploy, `claim()` also sets `claimedBy[lot] = buyer` — second wallet cannot take that lot on chain.

1. Remix → compiler 0.8.24 → `contracts/ExoClaim.sol`
2. Environment: Injected Provider, network **Robinhood Chain (4663)**
3. Deploy `ExoClaim` with:
   - token: `0x26feef8a105b282377102308d3769bf9C9E60e76`
   - defaultPriceWei: `1000000000000000` (0.001 $TEST)
4. Put the new address in Vercel: `VITE_CLAIM_CONTRACT` **and** `CLAIM_CONTRACT` → Redeploy
5. Owner calls `seedClaimed` for the 15 lots already in Turso (same ids `c27`, `c99`, … and their wallets) so they stay locked on chain too

Auth is **wallet-only** (Robinhood) — no Google Client ID needed.

## Local

```bash
npm install
npm run mind
npm run dev
```

Template: `.env.example`
