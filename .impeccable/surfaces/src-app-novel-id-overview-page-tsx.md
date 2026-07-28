---
version: 1
slug: "src-app-novel-id-overview-page-tsx"
primary_target: "src/app/novel/[id]/overview/page.tsx"
related_targets: ["route:/novel/[id]/overview"]
---

# Overview surface

## Scope & mode

- **Visitor mode:** Operate
- **Route:** `/novel/[id]/overview`
- **Visual authority:** Ink Ledger (DESIGN.md) — polish incumbent split layout; do not replace world

## Audience & job

Serious hobbyist novelist planning top-down structure. Primary job is **balanced**: direct outline editing and conversational AI fill/review are equal peers.

## Outcome

Build and audit acts → chapters → beats that feed Write mode. No "ready for Write" gate — user switches whenever they want.

## Direction

Outline ledger (left) + planning clerk (right). Progressive act metadata; full beat editing in Overview; human-readable question bank; assistant rail hierarchy: mode → progress → checklist → messages → compose.

## Memorable moment

Expand an act, edit beats inline, then ask the assistant to review that act — outline and AI feel like one workspace.

## Boundaries

- Preserve two-column split on `lg+`; mobile uses Outline / Assistant tabs
- No layout restructure, no new visual world
- Beat editing stays in sync with Write via same API
- Untouched: header, APIs, question bank content, tool-calling behavior

## Open decisions resolved in build

- First act expanded by default; others collapsed until toggled
- Beat reorder: Up/Down buttons (match Write)
- Mobile assistant: tab switcher
