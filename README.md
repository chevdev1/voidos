# ExoMind / VOID.OS

Interactive void map + constellation claims + ExoMind chat.

## Quick start

```bash
npm install
npm run dev
```

Open the site → **Open full map** → stack constellations → **ask me**.

## Production

See **[DEPLOY.md](DEPLOY.md)** — Vercel one-click, Gemini key optional, SPA rewrites included.

```bash
npm run build
```

## Mind AI

| Mode | When |
|------|------|
| Vercel `/api/chat` | Deployed site + optional `GEMINI_API_KEY` |
| Local SQLite server | `npm run mind` (port 8787) for DIY DB editing |
| Offline local | Automatic fallback in the browser if API is down |

Prompts live in [`shared/mind-prompts.json`](shared/mind-prompts.json).

## Scripts

| Script | What |
|--------|------|
| `npm run dev` | Vite frontend |
| `npm run build` | Production bundle |
| `npm run mind` | Local SQLite mind API |
| `npm run mind:seed` | Reseed prompts into `server/data/void.db` |
