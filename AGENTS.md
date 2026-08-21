<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Package manager/runtime is **Bun** (lockfile is `bun.lock`). Bun lives at `~/.bun/bin/bun` (added to `PATH` for login shells via `~/.bashrc`); use a full path if it's not on `PATH`. Standard scripts live in `package.json` and `README.md`.
- Run the app with `bun run dev` (Next.js 16 + Turbopack, http://localhost:3000). It's local-first: the SQLite DB at `data/quillsmith.db` (gitignored) is auto-created, migrated, and seeded on the first request via `getDb()` — no manual DB setup needed.
- Do **not** rely on `bun run db:seed`: it aborts under Bun with a `better-sqlite3` NAPI fatal error (the `bun -e` path). It is unnecessary because startup auto-seeds; ignore it.
- `bun run typecheck` is clean. `bun run lint` runs but currently reports pre-existing errors/warnings in the source (mostly `react-hooks` rules) — these are not environment issues.
- AI features (Expand/Coach/chat) call OpenRouter and need an API key: set it in the in-app Settings page, or `OPENROUTER_API_KEY` before first seed. Non-AI flows (create novel, plan acts/chapters, write scenes) work fully without a key.
