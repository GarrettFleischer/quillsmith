<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Package manager/runtime is **Bun** (lockfile is `bun.lock`). Bun lives at `~/.bun/bin/bun` (added to `PATH` for login shells via `~/.bashrc`); use a full path if it's not on `PATH`. Standard scripts live in `package.json` and `README.md`.
- Run the app with `bun run dev` (Next.js 16 + Turbopack, http://localhost:3000). It's local-first: the SQLite DB at `data/quillsmith.db` (gitignored) is auto-created, migrated, and seeded on the first request via `getDb()` — no manual DB setup needed.
- Do **not** rely on `bun run db:seed`: it aborts under Bun with a `better-sqlite3` NAPI fatal error (the `bun -e` path). It is unnecessary because startup auto-seeds; ignore it.
- `bun run typecheck` is clean. `bun run lint` runs but currently reports pre-existing errors/warnings in the source (mostly `react-hooks` rules) — these are not environment issues.
- AI features (Expand/Coach/chat/summaries) call OpenRouter. The key lives in the `OPENROUTER_KEY` secret. `openRouterChat()` reads `settings.openrouterApiKey || process.env.OPENROUTER_API_KEY` at request time, so start the dev server as `OPENROUTER_API_KEY="$OPENROUTER_KEY" bun run dev` to power server-side calls. Note the AI *UI* gates on the settings key (`hasApiKey = Boolean(settings.openrouterApiKey)`), so to enable the in-app AI buttons you must also paste the key once in Settings; the env var alone powers the API but leaves the UI showing "add a key".
- Model policy for this project: always use the `openrouter/free` model for every task (set Settings → default model to `openrouter/free`; the frontend passes it as the request model and internal pipeline steps fall back to it). The provided key has a $0 spend limit, so only free models work — paid models return a `403 Key limit exceeded`, which the app surfaces as a clean SSE `error` event (useful for testing error handling).
- Caveat: the multi-step **Craft pipeline** (Settings → craft toggle, on by default) is unreliable with `openrouter/free` because the router picks a different free model per step and can hit classifier/tiny models (e.g. a content-safety model returned `"User Safety: safe"` as the "draft"). Single-call generations (craft off) with `openrouter/free` are reliable and produce good prose.
- Non-AI flows (create novel, plan acts/chapters/beats, write, knowledge base, export) work fully without a key. There is currently no manual UI to rename an act/chapter (titles/goals are set by the planning AI via `upsert_act`/`upsert_chapter` tools, or via the `PATCH /api/novels/[id]` `upsertChapter`/`upsertAct` actions).
