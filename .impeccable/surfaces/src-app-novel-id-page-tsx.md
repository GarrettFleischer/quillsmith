---
version: 1
slug: "src-app-novel-id-page-tsx"
primary_target: "src/app/novel/[id]/page.tsx"
related_targets: ["route:/novel/[id]"]
---

# Write surface

## Scope & mode

- **Visitor mode:** Operate
- **Route:** `/novel/[id]`
- **Visual authority:** Ink Ledger — restructure rails/nav within world; production-ready states

## Audience & job

Serious hobbyist novelist already in flow. Primary job: **stay in the chapter** — Codex and Actions on the left, one chapter in the center, Beats / Summary / Chat on the right.

## Outcome

Draft and revise one chapter at a time. Lore, saved Actions, beats, summary, and chapter chat never replace the manuscript with a wizard.

## Direction

Chapter desk with independently collapsible ledger rails. Default: Codex + Chat open; Beats and Summary collapsed to 40px strips. Highlight BubbleMenu **Send to chat** (Selection chip, not paste). Action chips attach a prompt; the attached chip opens that Action's editor sheet.

Codex and Actions are searchable indexes. Clicking an item or New Entry / New Action opens a draggable, pinnable ledger sheet over the manuscript.

## Memorable moment

Highlight a passage, Send to chat, attach Expand, review hunks in the chapter — the page never yields to Overview or a Coach drawer. Pin a Codex or Action sheet beside the prose while drafting.

## Boundaries

- Preserve Ink Ledger. Codex and Action edit sheets are the only floating panes; they are ledger sheets (border, opaque surface), not dashboard cards.
- Mobile: Manuscript / Codex / Chat / Plan (summary + beats stacked); sheets go full inset.
- Header is Write | Review, plus Settings (gear) for API key and models
- No “scene” language in UI copy
- Do not invent Snippets, Series, or Book-scope filters that the product does not have

## Resolved in build

- Left rail tabs: Codex | Actions (horizontal). Codex grouped by type with search, New Entry, and per-group add. Actions list with search and New Action.
- Click/add opens a draggable pinnable editor. Unpinned inspector is reused per family (Codex vs Actions); pin to keep several open
- Settings lives in the header and at `/settings`, not in the left rail
- Center: act/chapter switcher, add act/chapter, one TipTap chapter body
- Right inner → outer: Beats 240 / Summary 260 / Chat 320
- Chapter chat API: summary, beats, Codex search, propose rewrite as hunks
