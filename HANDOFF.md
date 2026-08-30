# VOID.OS / ExoMind — handoff for client

Live: https://ashy-gamma-42.vercel.app  
Repo: https://github.com/mishashish/-.git  
Branch: `main` (auto-deploy via Vercel recommended)

Last code note: **wallet-only auth** (no Google) — Robinhood Wallet on **Robinhood Chain (4663)**. Claim needs wallet connect; on-chain when contract+token env are set.

---

## Діри / gaps (що ще не закрито)

| Діра | Статус у коді | Що зробити клієнту |
|------|---------------|-------------------|
| **Turso DB** | Підключено / код готовий | Тримати `TURSO_*` на Vercel. Без цього guest-сесії на сервері можуть злітати. |
| **Свої ключі** | Працює на ключах білдера | Замінити Gemini / Reown на акаунти клієнта. |
| **`$VOID` ERC-20 / CA** | Hero: `CA TBA` | Коли токен на RH Chain: `EXO_TOKEN` + `VITE_EXO_TOKEN` / `VITE_EXO_CA` → Redeploy. |
| **RH RPC** | Default placeholder | Set `RH_RPC_URL` / `VITE_RH_RPC_URL`. |
| **Реальний burn / claim** | Test claim після connect | Set `VITE_CLAIM_CONTRACT` + token. |
| **Реальний training burn** | `Train patch (test)` | Після token — палити $VOID. |
| **Соцмережі / Dex** | Footer `soon` | `VITE_X_URL` … на Vercel. |
| **Audit / CA** | FAQ: audit ще немає | Оновити FAQ коли буде. |
| **Custom domain** | Vercel default | Підключити домен; оновити Reown. |

---

## Що вже зроблено

- Wallet = account (Robinhood connect) — no Google
- Map claim on Robinhood Chain (test until contract)
- CABINET, Mind (Gemini), Turso persistence
- Solana removed; viem + WalletConnect ethereum

---

## Priority left

| Priority | Task |
|----------|------|
| **P0** | Свої Gemini / Reown ключі |
| **P1** | RH RPC + social URLs |
| **P2** | `EXO_TOKEN` + `VITE_CLAIM_CONTRACT` коли токен live |
| **P3** | Custom domain |

---

## Keys (Vercel env)

| Env | Required |
|-----|----------|
| `GEMINI_API_KEY` | Yes for live Mind |
| `VITE_WALLETCONNECT_PROJECT_ID` | Yes for QR wallet |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | Yes for durable guests |
| `RH_RPC_URL` / `VITE_RH_RPC_URL` | Recommended |
| `EXO_TOKEN` / `VITE_EXO_TOKEN` / `VITE_EXO_CA` | When token live |
| `VITE_CLAIM_CONTRACT` | When claim live |

Google Client ID vars are **unused** (wallet-only).

---

## Local

```bash
npm install
npm --prefix server install
npm run mind
npm run dev
```

---

## Code map

| Area | Path |
|------|------|
| Guest / session | `src/lib/mindClient.js`, `api/session.js` |
| Wallet | `src/lib/rhWallets.js`, `WalletPanel.jsx` |
| Account UI | `AccountMenu.jsx` (guest) |
| DB | `shared/voidDb.js` + Turso |
| Mind | `api/chat.js`, `shared/mindLogic.js` |
