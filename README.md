# ExoMind / VOID.OS

Interactive void map + constellation claims + ExoMind chat with durable accounts.

## Quick start

```bash
npm install
npm run mind   # local API + SQLite file (server/data/void.db)
npm run dev    # Vite (proxies /api → :8787)
```

Open → **account** (optional register) → **Open full map** → claim lots → **ask me**.

## Production

See **[DEPLOY.md](DEPLOY.md)** — Vercel + `GEMINI_API_KEY` + **Turso** for persistent clients.

## What persists

| Data | Where |
|------|--------|
| Guest / account | `users` (+ cookie `void_sid`) |
| Claimed constellations | `ownerships` |
| Chat history | `messages` |
| Small memories (e.g. name) | `memories` |

Offline: browser `localStorage` cache; syncs when API is up.

## Scripts

| Script | What |
|--------|------|
| `npm run dev` | Vite frontend |
| `npm run build` | Production bundle |
| `npm run mind` | Local mind API |
| `npm run mind:seed` | Reseed prompts |
