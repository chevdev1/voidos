# VOID.OS / ExoMind — production deploy

## What users get

- Landing + fullscreen cosmos map (claim constellations)
- Mind chat (**ask me**) — works without Gemini (local/mock voice)
- On Vercel: `/api/chat` + optional `GEMINI_API_KEY` for live ExoMind

## Deploy (Vercel)

1. Import the GitHub repo
2. Framework preset: **Vite** · Build: `npm run build` · Output: `dist`
3. Environment variables:
   - `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/apikey) (optional)
   - `GEMINI_MODEL` — default `gemini-2.0-flash`
4. Deploy

`vercel.json` rewrites non-API routes to `index.html` (BrowserRouter /docs works on refresh).

### Without Gemini

Chat still answers in **mock** mode. Claims + history live in the browser (`localStorage`).

### With Gemini

Same UI; replies come from Gemini Flash using prompts in [`shared/mind-prompts.json`](shared/mind-prompts.json).

Gemini uses **function calling** (same pattern as [Google’s codelab](https://codelabs.developers.google.com/codelabs/gemini-function-calling)): tools `get_project_overview`, `get_visitor_lots`, `get_map_guide` so answers stay on real VOID facts.

Without `GEMINI_API_KEY`, chat stays in **mock** mode (templates only — not a real conversation).

## Local DIY SQLite mind (optional)

```bash
cd server
npm install
copy .env.example .env
# set GEMINI_API_KEY in server/.env
npm run dev
```

In another terminal:

```bash
npm run dev
```

Vite proxies `/api` → `localhost:8787`. DB file: `server/data/void.db`.

Reseed prompts from shared JSON:

```bash
npm run mind:seed
```

## Production checklist

- [ ] `npm run build` succeeds
- [ ] Vercel deploy OK
- [ ] Full map fullscreen on phone; bottom bar tappable
- [ ] Claim shows toast (no blocking alert)
- [ ] **ask me** opens; replies (mock or gemini)
- [ ] `/docs` works after hard refresh

## Edit mind voice

Edit [`shared/mind-prompts.json`](shared/mind-prompts.json), then redeploy (Vercel) or `npm run mind:seed` (local SQLite).
