---
name: Quillsmith
description: Ink Ledger — calm manuscript workspace with editorial craft chrome
colors:
  bg: "#f3efe6"
  bg-dark: "#141210"
  surface: "#ebe4d6"
  surface-dark: "#1e1b18"
  surface-2: "#e2d8c4"
  surface-2-dark: "#2a251f"
  text: "#1a1612"
  text-dark: "#ebe4d6"
  muted: "#6b6358"
  muted-dark: "#9a9184"
  accent: "#2f5d50"
  accent-dark: "#6fa894"
  accent-soft: "#d7e6e0"
  accent-soft-dark: "#24352f"
  border: "#d4cbb8"
  border-dark: "#2e2924"
  rewrite: "#8b3a2a"
  rewrite-dark: "#d4897a"
  original: "#8a8278"
  original-dark: "#6e675e"
  danger: "#8b3a2a"
  danger-dark: "#d4897a"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2.25rem, 5vw, 3rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  rail-kb: "280px"
  rail-beats: "260px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.accent-dark}"
    textColor: "{colors.bg-dark}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  input-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-segment-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
---

# Design System: Quillsmith

## Overview

**Creative North Star: "The Ink Ledger"**

Quillsmith looks like a calm editorial desk: warm parchment, charcoal ink, and ledger side rails that hold working notes while the manuscript column stays quiet. The interface is dense enough for planning and lore management, but the writing surface never competes with the prose. Chrome is craft tooling, not SaaS marketing.

Depth is mostly tonal — stepped surfaces and hairline borders — with subtle lift reserved for sticky header chrome (`backdrop-blur-md`, translucent `bg-bg/90`). Motion is weighty and brief: soft fade/slide on panel reveals (`panel-enter`, 280ms ease), never bounce or candy physics. The brand wordmark **Quillsmith** reads at hero scale in display type wherever the app chrome allows.

**Key Characteristics:**

- Warm parchment backgrounds with muted teal-ink accents
- Three-font stack: Fraunces (brand), Source Serif 4 (manuscript), IBM Plex Sans (controls)
- Wide-rail Write layout: 280px Codex/Actions | fluid chapter | 240px Beats | 260px Summary | 320px Chat
- Bordered, modest-radius controls; accent used sparingly on primary actions and selection
- Flat surfaces at rest; hairline shadows and backdrop blur only on elevated chrome
- Revision diffs use rewrite/original semantic colors, not generic highlight yellow

## Colors

The palette reads as ink on paper: warm neutrals carry most of the UI; teal ink accents mark action and selection; rewrite red marks AI diff changes.

### Primary

- **Muted Teal Ink** (`#2f5d50` light / `#6fa894` dark): Primary actions, active nav segments, links, and status emphasis. Rare enough to feel intentional.
- **Teal Wash** (`#d7e6e0` light / `#24352f` dark): Selected list items, active mode toggles, command menu hover — accent presence without filling buttons.

### Neutral

- **Warm Parchment** (`#f3efe6` / `#141210`): Page background. Subtle radial accent wash on `body` via `color-mix`.
- **Ledger Surface** (`#ebe4d6` / `#1e1b18`): Panels, section cards, Action and chat shells.
- **Ledger Step** (`#e2d8c4` / `#2a251f`): Hover states on sidebar list items.
- **Charcoal Text** (`#1a1612` / `#ebe4d6`): Primary reading color.
- **Faded Ink** (`#6b6358` / `#9a9184`): Secondary labels, placeholders, metadata, chapter chrome.
- **Ruled Border** (`#d4cbb8` / `#2e2924`): Dividers, input strokes, panel edges, list separators.

### Tertiary

- **Rewrite Red** (`#8b3a2a` / `#d4897a`): AI rewrite additions, diff-new highlights, destructive beat delete.
- **Struck Original** (`#8a8278` / `#6e675e`): Superseded text in diff review.

### Named Rules

**The One Accent Rule.** Teal ink appears on primary buttons, active toggles, and key links — not as page-wide fills or gradient washes. Its scarcity is the point.

**The Parchment Not Cream Rule.** Background warmth is editorial parchment (`#f3efe6`), not generic cream SaaS (`#F4F1EA` alone). Avoid drifting into terracotta/cream AI cliché pairings.

## Typography

**Display Font:** Fraunces (with Georgia, serif)
**Manuscript Font:** Source Serif 4 (with Georgia, serif)
**UI Font:** IBM Plex Sans (with sans-serif)

**Character:** Expressive serif brand voice against a readable manuscript serif and a neutral grotesque for controls. Never Inter, Roboto, Arial, or system-ui as display.

### Hierarchy

- **Display** (400, `text-5xl` / `text-4xl` / `text-3xl`, line-height 1): Brand wordmark on home, novel titles, act headers. Hero-level, never whispered in nav.
- **Headline** (400, `text-2xl`–`text-4xl`, tight tracking): Page titles (Settings, Design lab), act names in Write mode.
- **Title** (400, `text-xl`–`text-2xl`, Source Serif 4): Chapter headings, sidebar section titles.
- **Body** (400, 1.125rem / 1.75 line-height, Source Serif 4): Manuscript prose in `.manuscript` / `.ProseMirror`. Target ~65–75ch in the writing column (`max-w-3xl`).
- **Label** (400–600, 0.75rem–0.875rem, IBM Plex Sans): Controls, metadata, uppercase tracking on act labels (`tracking-[0.2em]`) and command menus.

### Named Rules

**The Manuscript Column Rule.** Long-form prose uses Source Serif 4 at 1.125rem. UI chrome and sidebars use IBM Plex Sans. Fraunces is for brand and structural headings only.

**The Monumental Mark Rule.** "Quillsmith" in app chrome uses `font-display` at `text-2xl` minimum in the header and `text-5xl` on the home hero — never reduced to a tiny logotype.

## Layout

**Write mode shell:** full-height flex column — sticky header, then Codex/Actions `280px` | manuscript `flex-1 min-w-0` | Beats `240px` | Summary `260px` | Chat `320px`. Each right rail collapses independently to a 40px strip. Side rails use `bg-surface/70` with `border-r` / `border-l`. Default on typical widths: Codex + Chat open; Beats and Summary collapsed.

**Manuscript column:** one chapter at a time, `max-w-3xl` centered with `px-6`. Quiet prose column; highlight BubbleMenu for Send to chat — not card soup.

**Review mode:** single column `max-w-3xl`, stats and suggestion lists. Sibling of Write, not a Write drawer.

**Home & App settings:** single column, `max-w-3xl` or `max-w-5xl`, `px-4 py-12`. Novel list uses divided rows, not card grid.

**Header:** `h-14`, `max-w-[1600px]`, sticky with `border-b`, `bg-bg/90 backdrop-blur-md`. Mode toggle is Write | Review. Write desk tools (manuscript tree menu, model) sit between the toggle and export. The manuscript menu is a compact ledger popover: acts as collapsible groups, chapters as rows, add act/chapter and reorder in the window.

**Spacing rhythm:** 4px base; common gaps `gap-2` (8px), `gap-3` (12px), `gap-4` (16px); section breaks `mt-8`–`mt-12`.

## Elevation & Depth

Flat-by-default tonal layering. Surfaces step from `bg` → `surface` → `surface-2` to imply depth without drop shadows on cards. The only persistent shadow token is a **hairline rim** (`0 1px 0 rgba(...)`) on `:root` / `.dark`.

Sticky header chrome gets **subtle lift**: semi-transparent background plus `backdrop-blur-md`. Selection BubbleMenu and rewrite review panels use `border` + `bg-surface` with optional `panel-enter` motion — not floating card stacks.

### Shadow Vocabulary

- **Hairline rim** (`0 1px 0 rgba(26, 22, 18, 0.06)` light / `rgba(0, 0, 0, 0.35)` dark): Implicit page edge separation; not used as card elevation.

### Named Rules

**The Flat Ledger Rule.** Panels are bordered ledger sheets, not elevated cards. No card soup in the writing surface.

**The Chrome Lift Rule.** Only sticky header and transient command shells may use backdrop blur or translucency. Everything else stays opaque and flat.

## Shapes

Modest editorial corners — `rounded` (4px) for small controls, `rounded-md` (6px) for inputs and primary buttons, `rounded-lg` (8px) for Review stat panels. No `rounded-full` pill clusters for primary navigation.

Borders are 1px `border-border` on inputs, panels, and list dividers. Form fields use filled `bg-bg` inside `border-border` strokes, not underline-only inputs.

Sidebar list items use full-width rectangular hit targets with `rounded` corners on hover/selection, not floating chips.

## Components

Editorial and tactile: confident borders, ledger panels, quiet manuscript column.

### Buttons

- **Shape:** Modest radius (`rounded-md`, 6px)
- **Primary:** `bg-accent` fill, `text-bg`, `px-3 py-1.5` to `px-4 py-2`, `font-medium`
- **Secondary / Ghost:** `border border-border`, `text-muted`, `hover:text-text`, transparent background
- **Hover / Focus:** Color shift on text or `hover:bg-accent-soft` in menus; primary uses `ring-accent focus:ring-2` on home input
- **Disabled:** `disabled:opacity-50`

### Chips / Segmented Nav

- **Style:** Bordered container `rounded-md border border-border bg-surface p-0.5`; active segment `bg-accent-soft text-accent`
- **State:** Used for Write/Review toggle and composer Action/Selection chips — not for global primary nav pills

### Cards / Containers

- **Corner Style:** `rounded-lg` for Review report panels; `rounded-md` for inline panels
- **Background:** `bg-surface` or `bg-surface/50` with `border border-border`
- **Shadow Strategy:** None at rest; refer to Elevation section
- **Border:** Always present on containers
- **Internal Padding:** `p-3`–`p-4`

### Inputs / Fields

- **Style:** `rounded-md border border-border bg-bg px-3 py-2` (or `px-2 py-1` compact)
- **Focus:** `outline-none ring-accent focus:ring-2` on primary home input; elsewhere transparent outline with border carry
- **Placeholder:** `text-muted` via CSS or TipTap `::before` pseudo

### Navigation

- **Header:** Sticky bar; brand link `font-display text-2xl`; utility links as bordered ghost buttons
- **Novel context:** Breadcrumb `/` + truncated serif title + segmented Write/Review control
- **Mobile:** Write/Review stays visible; Write panes are Manuscript / Codex / Chat / Plan

### Ledger Sidebar (signature)

- **Codex / Actions rail:** `w-[280px]`, `border-r`, `bg-surface/70`, searchable grouped list with `accent-soft` selection; Story item at top
- **Beats rail:** `w-[240px]`, `border-l`, beat items as bordered `bg-bg` textareas with reorder controls
- **Summary rail:** `w-[260px]`, `border-l`, chapter summary textarea
- **Chat rail:** `w-[320px]`, `border-l`, messages + Selection/Action chips + composer
- **Character:** Working notes pinned beside the manuscript, not a floating dashboard

### Diff Review (signature)

- **New text:** `.diff-new` — `color-mix` rewrite tint background, rewrite underline
- **Original:** `.diff-original` — smaller muted struck line below
- **Shell:** Bordered `bg-surface` panel with Accept all / Reject all / Apply decisions

## Do's and Don'ts

### Do:

- **Do** use the three-font stack: Fraunces (display), Source Serif 4 (manuscript), IBM Plex Sans (UI).
- **Do** keep the manuscript column quiet — prose flows without card wrappers per paragraph.
- **Do** use teal accent on primary actions and selected states only.
- **Do** use ledger side rails at 280 / 240 / 260 / 320 in Write mode.
- **Do** animate panel reveals with soft `rise` (280ms ease), opacity + 6px translateY.
- **Do** render **Quillsmith** at display scale in chrome.

### Don't:

- **Don't** use purple/indigo gradients, glassmorphism stacks, glow orbs, or 3D SaaS blobs.
- **Don't** use Inter, Roboto, Arial, or system-ui as the display face.
- **Don't** use `rounded-full` pill clusters for primary navigation.
- **Don't** fill the writing surface with card grids or dashboard widgets.
- **Don't** use warm cream + terracotta + generic sans — the anti-slop pairing called out in the aesthetic brief.
- **Don't** add bounce or playful motion to panel transitions.
