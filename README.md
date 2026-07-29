# Quillsmith

**Plan top-down — acts, chapters, beats — then draft scenes with a knowledge base that stays with the story.**

Quillsmith is a local-first novel writing workspace. Authors structure a manuscript in Overview mode, draft scenes in Write mode, and keep a per-novel story bible that AI tools can read while generating prose. Everything lives in a SQLite database on your machine — no accounts, no cloud manuscript storage.

## Features

- **Top-down planning** — Acts, chapters, and beats in Overview mode, with a structured question bank and AI overview chat to flesh out premise, stakes, and arc.
- **Scene drafting** — TipTap editor with autosave, revision history, and slash commands for AI-assisted expand/rewrite.
- **Knowledge base** — Typed lore entries (characters, places, etc.) with appearance tracking across scenes; `@` mentions pull relevant context into drafts.
- **Lore-aware AI** — OpenRouter tool-calling loops let the model search knowledge, read outline context, and stay aligned with prior scenes.
- **Customizable commands** — Edit slash-command prompts, temperatures, and per-model overrides in Settings.
- **Export / import** — JSON and Markdown export for backup and migration.
- **Local-first** — SQLite at `data/quillsmith.db` (gitignored). Bring your own OpenRouter API key.

## Quick start

**Requirements:** Node.js 20+, npm

```bash
git clone https://github.com/GarrettFleischer/quillsmith.git
cd quillsmith
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create a novel, and add your [OpenRouter](https://openrouter.ai/) API key under **Settings**.

Optional: seed the database on first run (happens automatically when the app starts):

```bash
npm run db:seed
```

## Project structure

| Path | Purpose |
|------|---------|
| `src/app/novel/[id]/overview` | Top-down planning UI |
| `src/app/novel/[id]` | Write mode — manuscript, knowledge sidebar, beats |
| `src/app/api/ai/*` | OpenRouter generation and summarization |
| `src/lib/novels.ts` | Novel tree, scenes, knowledge CRUD |
| `src/lib/tools.ts` | Agent tool definitions for lore-aware drafting |
| `src/db/` | SQLite schema, migrations, seed |
| `design/inspiration/` | Ink Ledger aesthetic brief |

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [TipTap](https://tiptap.dev/) + React 19
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) + [Drizzle ORM](https://orm.drizzle.team/)
- [OpenRouter](https://openrouter.ai/) for LLM access
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Zustand](https://zustand-demo.pmnd.rs/) for editor state

## Design

Quillsmith uses the **Ink Ledger** direction: calm manuscript workspace, editorial craft chrome, ink-on-paper feel. Typography: Fraunces (display), Source Serif 4 (manuscript), IBM Plex Sans (UI). See `design/inspiration/BRIEF.md` and `/design/lab` for exploration.

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # run production server
npm run lint     # ESLint
npm run db:seed  # initialize SQLite database
```

## Privacy & AI

- Manuscripts and lore are stored locally only.
- AI requests go to OpenRouter using **your** API key (configured in Settings or via `OPENROUTER_API_KEY` env var on first seed).
- Quillsmith does not bundle model billing or send your work to a proprietary backend.

## License

MIT — see [LICENSE](LICENSE).

## Contributing

Issues and pull requests welcome. This is an early MVP — expect rough edges around large manuscripts and performance with many open scene editors.
