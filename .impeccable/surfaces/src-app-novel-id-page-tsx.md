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

Serious hobbyist novelist drafting scenes. Primary job: **lore-aware AI in the scene** — slash commands, diffs, and KB feel native to writing.

## Outcome

Draft/revise scenes with chapter beats visible, KB on demand, chapter jump via mini TOC. No Overview redesign.

## Direction

Manuscript desk with collapsible lore drawer + chapter beat rail. KB starts collapsed; beats follow active chapter; chapter picker in manuscript header.

## Memorable moment

Type `/`, run rewrite, review diffs in-scene; beats stay on the right; KB stays out of the way until expanded.

## Boundaries

- Preserve Ink Ledger; no floating dashboard panels
- Mobile: Manuscript / Knowledge / Beats tabs
- Untouched: header Overview/Write toggle, tool-calling semantics, Settings templates

## Resolved in build

- TOC: chapter `<select>` in manuscript header
- KB: collapsed strip + Show/Hide; Hide in sidebar
- Scene titles editable via `updateSceneTitle`
