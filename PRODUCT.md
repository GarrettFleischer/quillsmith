# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Serious hobbyist and aspiring novelists planning and drafting long-form fiction locally. They need structure (acts, chapters, beats) without leaving the manuscript, plus a story bible that stays aligned as they write and use AI assistance.

## Product Purpose

Quillsmith is a local-first novel writing workspace. Authors plan top-down — acts, chapters, beats — then draft scenes with a persistent knowledge base and AI tools that respect lore and prior drafts. Success means finishing a coherent manuscript with planning and prose in one private environment, not juggling separate outliners, editors, and chat tools.

## Positioning

Three mechanisms together, not one gimmick:

1. **Top-down planning that feeds drafting** — Overview mode structures the novel (acts → chapters → beats) and connects directly to Write mode scenes under each chapter.
2. **Lore-aware AI drafting** — A per-novel knowledge base plus OpenRouter tool-calling loops keep generated prose aligned with characters, places, and prior scenes.
3. **Craft-writer AI, not ghostwriting** — Expand runs a craft pipeline (curated scene context, narrative-physics sliders, multi-model layering, plan-then-apply checks). Coach is for inspection. The human stays in charge of thinking and art.
4. **Local-first and private** — Manuscripts, lore, and revisions live in a local SQLite database on disk. The user brings their own OpenRouter API key; Quillsmith does not bundle model billing or cloud manuscript storage.

## Operating Context

- **Home** (`/`) — Create and open novels.
- **Overview** (`/novel/[id]/overview`) — Fill and review a top-down outline via structured question bank and AI overview chat. Style guide, outline variants, comparison-book analysis, and chapter summaries live here.
- **Write** (`/novel/[id]`) — Manuscript shell: knowledge sidebar, scene editor (TipTap), Coach panel, beats sidebar. Slash commands trigger AI generation with revision history.
- **Settings** (`/settings`) — OpenRouter API key, default model, per-task model routing, model compare, density thresholds, customizable slash commands.
- **Design lab** (`/design/lab`) — Internal aesthetic exploration surface for the Ink Ledger direction.

Data persists in `data/quillsmith.db` (gitignored). Dev server: `npm run dev` at `http://localhost:3000`.

## Capabilities and Constraints

**Confirmed capabilities**

- Novel CRUD with metadata (premise, genre, tone, themes, stakes, protagonist focus, ending intention).
- Hierarchical structure: acts, chapters, beats, scenes.
- Scene editing with TipTap; scene revision history with diff support.
- Knowledge entries (typed: character, place, etc.) with appearance tracking across scenes.
- Overview question bank across novel / act / chapter / beat / review layers.
- AI overview chat and prose generation via OpenRouter with configurable slash commands.
- Per-task model routing and a small model-compare tool (BYOK).
- Chapter/act summaries for structured AI context (story-so-far instead of dumping the manuscript).
- Per-novel living style guide (author-approved rules injected into drafting).
- Coach panel: interview, critique, practice, reverse outline, simulated beta readers, AI-tell scrubbers, plan-then-apply checks, narrative-physics sliders, and pattern-density counts (not an “AI score”).
- Optional multi-model layering is the Expand path (brief → dialogue → connective prose → climax polish), then plan-then-apply checks on the new prose. Scene-scoped lore is curated per draft. Turn the pipeline off in Settings for a single-shot expand.
- Comparison-book analysis as genre grammar — not a plot to copy.
- Light/dark theme via `next-themes`.

**Durable constraints**

- **Local-only for now** — No accounts, cloud sync, or multi-user. SQLite on disk.
- **BYOK AI** — OpenRouter key stored in app settings; no bundled model billing.
- **Fiction / novel scope** — Not general-purpose notes, non-fiction, or collaborative editing.
- **Ink Ledger brand direction is binding** — See `design/inspiration/BRIEF.md` and `/design/lab`.

**Terminology**

- *Overview* — Top-down planning mode.
- *Write* — Scene drafting mode.
- *Coach* — Write-mode panel for interview, critique, practice, reverse outline, beta readers, AI-tell cleanup, checks, and narrative physics. Feedback only; it does not write the manuscript.
- *Checks* — Narrow improvement plans (adverbs, tags, logic, contrast crutches). Expand applies them to new prose automatically (change only the plan). Coach can still run them by hand.
- *Narrative physics* — Numbered scene/character sliders injected into drafting. Expand proposes them when a scene has none.
- *Layering* — Multi-model scene pipeline used by Expand, not only a slash command.
- *Drafting pipeline* — Settings toggle. On: Expand curates context, sets sliders, layers models, then checks. Off: single-shot expand.
- *Style guide* — Author-edited voice rules, approved before they affect `/expand`.
- *Chapter summaries* — Short rollups (what happens, who is in the chapter, promises) used as distant context. Prefer these over dumping prior books.
- *AI tell scrubbers* — Single-pattern cleanup detectors (metaphor stacking, brochure language, etc.).
- *Pattern density* — Counts of those tells in a passage. Occasional craft techniques are fine; stacked repetition is the warning. Not detector software and not a “human %.”
- *Knowledge base (KB)* — Per-novel story bible entries.
- *Beats* — Chapter-level story beats in the outline.
- *Slash commands* — User-configurable AI prompt templates invoked from the editor (`/expand`, `/rewrite`, `/density`, `/scrub-*`, `/check-*`, `/layer`).

**Open / undecided**

- Distribution beyond local personal use (installer, hosted SaaS, sync).
- Multi-user or collaboration features.
- Bundled or offline AI models.

## Brand Commitments

- Product name: **Quillsmith** — must read as hero-level in app chrome, not a tiny nav whisper.
- Locked aesthetic direction: **Ink Ledger** — calm manuscript workspace, editorial craft chrome, ink-on-paper feel. Documented in `design/inspiration/BRIEF.md`, `design/inspiration/families.md`, and `README.md`.
- Typography stack: Fraunces (display/brand), Source Serif 4 (manuscript), IBM Plex Sans (sidebars/controls).
- Voice on home: *"Plan top-down — acts, chapters, beats — then draft scenes with a knowledge base that stays with the story."*

## Evidence on Hand

- Working local app with routes and features described above.
- Aesthetic brief and exploration notes: `design/inspiration/BRIEF.md`, `design/inspiration/families.md`, `design/inspiration/README.md`.
- Design lab surface at `/design/lab`.
- No customer testimonials, case studies, press, pricing pages, or deployment claims — future marketing work must not fabricate these.

## Product Principles

1. **Structure serves the manuscript** — Planning and drafting live in one workspace; outline changes should stay connected to scenes and lore.
2. **Lore is first-class** — The knowledge base is not an afterthought; AI tools should read it before generating prose.
3. **Local trust** — Manuscripts stay on the user's machine unless they explicitly choose otherwise in a future version.
4. **Bring your own intelligence** — AI is powerful but optional and user-controlled via OpenRouter key and slash-command templates.
5. **Calm over clever** — The writing surface stays quiet; chrome and panels support the work without SaaS theatrics.

## Accessibility & Inclusion

No product-specific accessibility standard confirmed yet. Future work should preserve keyboard access in the editor, readable contrast in both light and dark Ink Ledger themes, and semantic structure in app chrome.
