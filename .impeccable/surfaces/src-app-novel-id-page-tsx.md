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

Chapter desk with independently collapsible ledger rails. Default: Codex + Chat open; Beats and Summary collapsed to 40px strips. Highlight BubbleMenu **Send to chat** (Selection chip, not paste). Action chips open Write → Settings on that prompt.

## Memorable moment

Highlight a passage, Send to chat, attach Expand, review hunks in the chapter — the page never yields to Overview or a Coach drawer.

## Boundaries

- Preserve Ink Ledger; no floating dashboard panels
- Mobile: Manuscript / Codex / Chat / Plan (summary + beats stacked)
- Header is Write | Review; Overview wizard retired
- No “scene” language in UI copy

## Resolved in build

- Left rail tabs: Codex (Story + character/lore/location/item/other) and Settings (Actions + variable inserter)
- Center: act/chapter switcher, add act/chapter, one TipTap chapter body
- Right inner → outer: Beats 240 / Summary 260 / Chat 320
- Chapter chat API: summary, beats, Codex search, propose rewrite as hunks
