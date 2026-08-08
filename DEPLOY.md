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

Without Turso on Vercel the API falls back to an ephemeral `/tmp` DB (lost on cold start). Create a free Turso DB and paste URL + token.

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
