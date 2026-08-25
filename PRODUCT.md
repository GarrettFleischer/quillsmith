# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Serious hobbyist and aspiring novelists planning and drafting long-form fiction locally. They need structure (acts, chapters, beats) without leaving the manuscript, plus a story bible that stays aligned as they write and use AI assistance.

## Product Purpose

Quillsmith is a local-first novel writing workspace. Authors plan top-down — acts, chapters, beats — then draft each chapter as one prose document with a persistent Codex and AI tools that respect lore and prior drafts. Success means finishing a coherent manuscript with planning and prose in one private environment, not juggling separate outliners, editors, and chat tools.

## Positioning

Three mechanisms together, not one gimmick:

1. **Stay in the chapter** — Write is a chapter desk: Codex and Actions on the left, the chapter in the center, Beats / Summary / Chat on the right. Planning artifacts live beside the prose, not in a wizard.
2. **Lore-aware AI drafting** — A per-novel Codex plus OpenRouter tool-calling loops keep generated prose aligned with characters, lore, places, items, and prior chapters.
3. **Craft-writer AI, not ghostwriting** — Expand runs a craft pipeline (curated chapter context, narrative-physics sliders, multi-model layering, plan-then-apply checks). Review is for inspection. The human stays in charge of thinking and art.
4. **Local-first and private** — Manuscripts, lore, and revisions live in a local SQLite database on disk. The user brings their own OpenRouter API key; Quillsmith does not bundle model billing or cloud manuscript storage.

## Operating Context

- **Home** (`/`) — Create and open novels. A new novel starts with Act 1 / Chapter 1 on the Write desk.
- **Write** (`/novel/[id]`) — Chapter-first desk: Codex | Actions on the left; one chapter editor in the center; collapsible Beats, Summary, and chapter Chat on the right. Highlight **Send to chat**; Action chips attach saved prompts.
- **Review** (`/novel/[id]/review`) — Autocrit-shaped sibling tab: chapter or book stats (pattern density) and generated check suggestions. Not a panel inside Write.
- **Settings** (`/settings`) — OpenRouter API key, author voice (three-sample style guide), default model, per-task model routing, model compare, density thresholds, drafting pipeline. Saved Actions are edited in Write → Actions, not here.
- **Design lab** (`/design/lab`) — Internal aesthetic exploration surface for the Ink Ledger direction.

`/novel/[id]/overview` redirects to Write. The Overview wizard is retired.

Data persists in `data/quillsmith.db` (gitignored). Dev server: `bun run dev` at `http://localhost:3000`.

## Capabilities and Constraints

**Confirmed capabilities**

- Novel CRUD with metadata (premise, genre, tone, themes, stakes, protagonist focus, ending intention) editable as a **Story** item in Codex.
- Hierarchical structure: Novel → Acts → Chapters → Beats. One prose document per chapter.
- Chapter editing with TipTap; revision history with hunk review for rewrites.
- Codex entries (typed: character, lore, location, item, other) with appearance tracking across chapters.
- Chapter chat: per-chapter history, tools to update summary and beats, Codex search, queued manuscript rewrite (hunks, never silent overwrite).
- Saved Actions (prompt templates with variable inserter: `mentionedCodex`, `selection`, chapter fields) invoked as chat chips, not inline slash menus.
- Per-task model routing and a small model-compare tool (BYOK).
- Chapter summaries and beats as structured AI context (story-so-far instead of dumping the manuscript).
- Author voice: Settings takes three fiction samples (action, dialogue, quiet/interior), extracts a style guide, and injects the approved guide into writing prompts (Expand, Rewrite, Layer, checks, chapter chat). Codex Story can add a book-specific overlay.
- Review: pattern-density counts and check suggestions against the current chapter or whole book. Not an “AI score.”
- Optional multi-model layering is the Expand path (brief → dialogue → connective prose → climax polish), then plan-then-apply checks on the new prose. Turn the pipeline off in Settings for a single-shot expand.
- Comparison-book analysis as genre grammar — not a plot to copy.
- Light/dark theme via `next-themes`.

**Durable constraints**

- **Local-only for now** — No accounts, cloud sync, or multi-user. SQLite on disk.
- **BYOK AI** — OpenRouter key stored in app settings; no bundled model billing.
- **Fiction / novel scope** — Not general-purpose notes, non-fiction, or collaborative editing.
- **Ink Ledger brand direction is binding** — See `design/inspiration/BRIEF.md` and `/design/lab`.
- **No scene as a user concept** — Internal storage may still use a prose row per chapter; UI and prompt copy say chapter, not scene.

**Terminology**

- *Write* — Chapter drafting desk. The only in-flow workspace.
- *Review* — Separate Autocrit-style mode for density stats and check suggestions.
- *Codex* — Per-novel story bible (characters, lore, locations, items, other) plus a Story item for premise and style.
- *Actions* — Saved prompt templates (formerly slash commands) edited in Write → Actions as draggable sheets and attached as chat chips.
- *Settings* — Global settings route for API key, author voice, models, and pipeline. Header control is Settings.
- *Checks* — Narrow improvement plans (adverbs, tags, logic, contrast crutches). Expand can apply them to new prose automatically.
- *Narrative physics* — Numbered chapter/character sliders injected into drafting. Expand proposes them when a chapter has none.
- *Layering* — Multi-model chapter pipeline used by Expand, not only an Action slug.
- *Drafting pipeline* — Settings toggle. On: Expand curates context, sets sliders, layers models, then checks. Off: single-shot expand.
- *Style guide* — Author-edited voice rules extracted from three writing samples in Settings, approved before they affect writing prompts. Codex Story can add a book overlay.
- *Chapter summaries* — Short rollups (what happens, who is in the chapter, promises) used as distant context.
- *AI tell scrubbers* — Single-pattern cleanup detectors (metaphor stacking, brochure language, etc.).
- *Pattern density* — Counts of those tells in a passage. Occasional craft techniques are fine; stacked repetition is the warning. Not detector software and not a “human %.”
- *Beats* — Chapter-level story beats, extracted or edited beside the manuscript.

**Open / undecided**

- Distribution beyond local personal use (installer, hosted SaaS, sync).
- Multi-user or collaboration features.
- Bundled or offline AI models.
- Full Autocrit feature parity (pacing graphs, every report type).

## Brand Commitments

- Product name: **Quillsmith** — must read as hero-level in app chrome, not a tiny nav whisper.
- Locked aesthetic direction: **Ink Ledger** — calm manuscript workspace, editorial craft chrome, ink-on-paper feel. Documented in `design/inspiration/BRIEF.md`, `design/inspiration/families.md`, and `README.md`.
- Typography stack: Fraunces (display/brand), Source Serif 4 (manuscript), IBM Plex Sans (sidebars/controls).
- Voice on home: *"Plan top-down — acts, chapters, beats — then draft each chapter with a Codex that stays with the story."*

## Evidence on Hand

- Working local app with routes and features described above.
- Aesthetic brief and exploration notes: `design/inspiration/BRIEF.md`, `design/inspiration/families.md`, `design/inspiration/README.md`.
- Design lab surface at `/design/lab`.
- No customer testimonials, case studies, press, pricing pages, or deployment claims — future marketing work must not fabricate these.

## Product Principles

1. **Stay in the chapter** — The manuscript never yields to a wizard or a Coach drawer. Planning artifacts sit in rails.
2. **Lore is first-class** — Codex is not an afterthought; AI tools should read it before generating prose.
3. **Local trust** — Manuscripts stay on the user's machine unless they explicitly choose otherwise in a future version.
4. **Bring your own intelligence** — AI is powerful but optional and user-controlled via OpenRouter key and Action templates.
5. **Calm over clever** — The writing surface stays quiet; chrome and panels support the work without SaaS theatrics.

## Accessibility & Inclusion

No product-specific accessibility standard confirmed yet. Future work should preserve keyboard access in the editor, readable contrast in both light and dark Ink Ledger themes, and semantic structure in app chrome.
