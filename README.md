# Quillsmith

**Plan top-down — acts, chapters, beats — then draft each chapter with a Codex that stays with the story.**

Quillsmith is a local-first novel writing workspace. Authors plan in the Write desk (acts, chapters, beats beside the prose), draft each chapter as one document, and keep a per-novel Codex that AI tools can read while generating. Everything lives in a SQLite database on your machine — no accounts, no cloud manuscript storage.

## Features

- **Chapter desk** — One chapter at a time. Codex and Actions on the left; Beats, Summary, and Chat as collapsible rails. Focus hides every rail.
- **Manuscript tree** — Acts and chapters in a compact menu: add, rename, reorder, delete. Titles and goals also edit in the chapter heading.
- **Chapter drafting** — TipTap editor with autosave, word count, and revision history. Expand runs the craft pipeline (curate lore, sliders, layered models, checks) unless you turn it off in Settings.
- **Chat + Actions** — Highlight **Send to chat**, attach Expand or another saved Action, review rewrite hunks in the chapter. Custom Actions live under Write → Actions.
- **Codex** — Typed lore (characters, places, items, and more) with appearance tracking; the Story sheet holds premise, style, and the novel title.
- **Review** — Pattern-density counts and check suggestions for a chapter or the whole book. Not an AI score.
- **Export** — Markdown and JSON from the header.
- **Local-first** — SQLite at `data/quillsmith.db` (gitignored). Bring your own OpenRouter API key.

## Quick start

**Requirements:** [Bun](https://bun.sh/) 1.1+ (recommended) or Node.js 20+

```bash
git clone https://github.com/GarrettFleischer/quillsmith.git
cd quillsmith
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), create a novel, and add your [OpenRouter](https://openrouter.ai/) API key under **Settings**.

Optional: seed the database on first run (happens automatically when the app starts):

```bash
bun run db:seed
```

## Project structure

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Home — create and open novels |
| `src/app/novel/[id]` | Write mode — manuscript, Codex, Chat, beats, summary |
| `src/app/novel/[id]/review` | Review mode — density stats and check suggestions |
| `src/app/settings` | OpenRouter key, models, drafting pipeline |
| `src/app/api/ai/*` | OpenRouter generation, coach, summaries, comps |
| `src/lib/ai-tasks.ts` | Single-job AI task registry |
| `src/lib/novels.ts` | Novel tree, chapters, Codex CRUD |
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
bun run dev      # development server
bun run typecheck # tsc --noEmit
bun run build    # production build
bun run start    # run production server
bun run lint     # ESLint
bun run db:seed  # initialize SQLite database
```

## Privacy & AI

- Manuscripts and lore are stored locally only.
- AI requests go to OpenRouter using **your** API key (configured in Settings or via `OPENROUTER_API_KEY` env var on first seed).
- Quillsmith does not bundle model billing or send your work to a proprietary backend.

## License

MIT — see [LICENSE](LICENSE).

## Contributing

Issues and pull requests welcome. This is an early MVP — expect rough edges around large manuscripts and performance with many open editors.
