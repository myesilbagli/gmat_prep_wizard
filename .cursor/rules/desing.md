---
description: Lexicon design system — visual rules and patterns for all UI work
globs: mobile/**/*.{ts,tsx}
---

# Lexicon — Design System

## Philosophy

Lexicon is a focused study tool. The UI must feel like a premium productivity app — calm, confident, never noisy. The user is preparing for a high-stakes exam; they don't need decoration, they need clarity.

Three principles, in priority order:

1. **Constraint over creativity.** Every visual choice picks from the system below. No freestyle values. If a need doesn't fit, propose extending the system, don't work around it.
2. **The content is the design.** Words, definitions, examples, scores — these are the product. Design exists to serve them, not compete with them.
3. **Calm under pressure.** Dark backgrounds that don't fatigue. Restrained color usage. Motion that's brief or absent. Reference apps: Linear, Things, Cron Calendar, Cash App. Never: educational/tutorial apps, gaming UIs, marketing landing pages.

## Hard rules

These are non-negotiable. Violations are bugs.

- **Never use literal color values in components.** Always reference `theme.X` or imported color helpers. The only exception is one-off translucent overlays where opacity is the point.
- **Never use freestyle spacing values.** Use the spacing scale tokens. If you find yourself writing `padding: 14`, you're wrong — use `padding: spacing.lg` (16) or `spacing.md` (12).
- **Never use freestyle font sizes.** Use the typography scale. If a value isn't in the scale, you don't need it.
- **Never use pure white (#FFFFFF) on dark backgrounds.** Always slightly off-white. The whitepoint is `#F0F0F5`.
- **Never use pure black (#000000) backgrounds.** The deepest background is `#0A0A0F`.
- **Never have more than one primary button visible per screen.** Multiple primaries = no primary.
- **Never use shadows AND borders together on the same element.** Pick one elevation strategy.
- **Never animate longer than 250ms** unless it's a deliberate dramatic moment.

## Color system

All colors live in `mobile/src/theme.ts`. Bucket-specific colors live in `mobile/src/theme/bucketColors.ts`.

### Backgrounds

- `theme.bg` — `#0A0A0F` — base of every screen
- `theme.bgElevated` — `#13131A` — cards, modals, anything raised above bg
- `theme.bgSubtle` — `#1A1A22` — subtle highlight, e.g. selected list rows, expanded sections

### Text

- `theme.textPrimary` — `#F0F0F5` — primary reading text, the word being studied
- `theme.textSecondary` — `#A8A8B0` — secondary info, descriptions, examples
- `theme.textMuted` — `#7A7A82` — tertiary, captions, metadata, "Show more" links. Lifted from `#6B6B73` to clear WCAG AA 4.5:1 on `theme.bg` (`#0A0A0F`) and `theme.bgElevated` (`#13131A`). Do not darken below this without re-checking contrast.
- `theme.textInverse` — `#0A0A0F` — for use on light backgrounds (rare)

### Brand

- `theme.primary` — `#6B5BFF` — main interactive lavender, primary CTAs, links, focused states
- `theme.primaryDim` — `rgba(107, 91, 255, 0.15)` — translucent primary for subtle backgrounds (e.g. button hover, pill bg)

### Status

- `theme.success` — `#22C55E` — positive feedback, FAMILIAR bucket
- `theme.warning` — `#F59E0B` — cautions, NEW bucket
- `theme.danger` — `#EF4444` — destructive actions, errors
- `theme.info` — `#38BDF8` — informational states, REVIEW bucket

### Borders

- `theme.border` — `rgba(255, 255, 255, 0.08)` — default borders, dividers
- `theme.borderStrong` — `rgba(255, 255, 255, 0.16)` — emphasized boundaries, focused inputs
- `theme.borderSubtle` — `rgba(255, 255, 255, 0.04)` — barely visible separators

### Bucket colors

For any UI tagging a word's bucket or session role (NEW, LEARNING, FAMILIAR, REVIEW, MASTERED), use `getBucketColors(theme, role)` from `mobile/src/theme/bucketColors.ts`. Returns `{ bg, text, border, label }`. Use the `BucketPill` component, never inline pill styling.

## Typography

Mobile uses Inter for body and Manrope for display moments. Both via Expo Google Fonts.

### Type scale

Always use these named sizes. Pick the closest match to your need.

- `typography.display` — 48px / weight 700 / lineHeight 56 — hero numbers, single-screen moments (streak count, session complete number)
- `typography.hero` — 36px / weight 700 / lineHeight 44 — the word being studied, single-focus screens
- `typography.title` — 24px / weight 700 / lineHeight 32 — screen titles, "Today's session"
- `typography.heading` — 18px / weight 600 / lineHeight 24 — section headers, list item titles
- `typography.subheading` — 16px / weight 600 / lineHeight 22 — emphasized body, list metadata
- `typography.body` — 15px / weight 400 / lineHeight 22 — primary reading text, descriptions
- `typography.bodyEmphasis` — 15px / weight 600 / lineHeight 22 — emphasized inline text
- `typography.label` — 13px / weight 500 / lineHeight 18 — buttons, form labels
- `typography.caption` — 11px / weight 600 / lineHeight 14 / letterSpacing 0.8 / textTransform 'uppercase' — small section labels ("DEFINITION", "EXAMPLE")
- `typography.micro` — 11px / weight 400 / lineHeight 14 — timestamps, very tiny metadata

### Specialized

- **Reading prose:** 16px / weight 400 / lineHeight 26 — for Reading Practice passages where line height is more generous than the body default
- **Code/monospace:** Menlo, 11px / weight 400 / lineHeight 16 — debug output, code samples (rare)

### Section labels

When a content section has a small uppercase label above it ("DEFINITION", "EXAMPLE"), use `typography.caption` with `theme.textMuted` color. Always uppercase, always letter-spaced, always muted. This pattern is consistent across the app.

When you don't need a section label, don't add one. Implicit hierarchy via spacing and typography weight is preferred to explicit labels.

## Spacing

4px base unit. Every spacing value is a multiple of 4.

- `spacing.xs` — 4
- `spacing.sm` — 8
- `spacing.md` — 12
- `spacing.lg` — 16
- `spacing.xl` — 20
- `spacing.2xl` — 24
- `spacing.3xl` — 32
- `spacing.4xl` — 48
- `spacing.5xl` — 64

### Application guide

- **Screen edge padding:** `spacing.lg` (16) horizontal
- **Card internal padding:** `spacing.lg` (16) horizontal, `spacing.lg` (16) vertical
- **Section gaps within a screen:** `spacing.2xl` (24) for major sections, `spacing.xl` (20) for sub-sections
- **List item internal padding:** `spacing.md` (12) vertical
- **Gap between list items:** `spacing.sm` (8) when items are visually distinct cards, 0 when they share a continuous list with dividers
- **Gap between a label and its content:** `spacing.sm` (8)
- **Gap between content and the section above:** `spacing.lg` to `spacing.xl` (16-20) depending on density
- **Vertical rhythm above CTA buttons:** `spacing.xl` (20) minimum

If a number isn't in the scale, pick the closest one. There is no `padding: 14`.

## Radius

- `radius.sm` — 6 — small pills, tags, tiny inputs
- `radius.md` — 12 — cards, list rows, standard inputs, buttons
- `radius.lg` — 20 — large containers, modals, sheets
- `radius.xl` — 28 — hero cards, single-focus content
- `radius.full` — 9999 — circles, true pills

## Shadows

Mobile shadows are subtle. Heavy shadows look amateur on iOS.

- `shadow.none` — no shadow
- `shadow.sm` — `{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }` — gentle lift for cards
- `shadow.md` — `{ shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 8 }` — modals, sheets, floating menus
- `shadow.lg` — `{ shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.24, shadowRadius: 32, elevation: 16 }` — full-screen overlays only

For glass UI panels, use the existing helpers in `mobile/src/components/GlassUi.tsx` (`learnGlassBorder`, `glassScreenShadow`). Don't reinvent.

## Components

### Buttons

Three variants × two sizes. Anything outside this set is wrong.

**Primary** — the main CTA on a screen. Only ONE visible per screen at a time.
- Background: `theme.primary`
- Text: `theme.textPrimary` (white-ish, but on lavender it appears full white-ish white)
- Font: `typography.label`, weight 600
- Padding: vertical `spacing.lg` (16), horizontal `spacing.xl` (20)
- Radius: `radius.md` (12)
- Shadow: `shadow.none`
- Min height: 48 (tap target)
- Disabled state: `opacity: 0.4`, no other change

**Secondary** — less important actions.
- Background: transparent
- Border: 1px solid `theme.borderStrong`
- Text: `theme.textPrimary`
- Same padding, radius, font as primary

**Tertiary / Text** — minor inline actions, "Show more" links.
- Background: transparent
- Border: none
- Text: `theme.primary` for actionable links, `theme.textMuted` for less important
- Padding: minimal but tap target must be at least 44×44

**Sizes:**
- Default: as specified above
- Compact: vertical `spacing.sm` (8), horizontal `spacing.md` (12)

**Destructive variant:** any of the above with text color `theme.danger`. Use sparingly. Confirmation dialogs preferred for irreversible actions.

### Cards

Default card pattern:
- Background: `theme.bgElevated`
- Border: 1px solid `theme.border` (or none if using shadow)
- Radius: `radius.md` (12)
- Padding: `spacing.lg` (16) all around
- Shadow: `shadow.sm` if elevated, `shadow.none` if inline

For glass treatment (Learn screen, premium surfaces), use `GlassPanel` from `GlassUi.tsx`.

### List rows

Used for vocabulary words, stack rows, etc.

- Background: transparent (parent provides)
- Padding: `spacing.md` (12) vertical, `spacing.lg` (16) horizontal
- Bottom border: 1px solid `theme.border`, removed on last item
- Tap state: subtle bg change to `theme.bgSubtle`
- Min height: 56 (tap target + breathing room)

When list items have a left accent bar (e.g. learning indicator), use 3px wide bar with appropriate bucket color, full row height, on the left edge.

### Inputs

- Background: `theme.bgElevated`
- Border: 1px solid `theme.border`
- Border (focused): 1px solid `theme.primary`
- Padding: `spacing.md` (12) vertical, `spacing.lg` (16) horizontal
- Radius: `radius.md` (12)
- Text: `typography.body`, color `theme.textPrimary`
- Placeholder: `theme.textMuted`
- Min height: 48

### Pills / Tags

For bucket tags, use `BucketPill`. For other tag-like elements:

- Background: subtle, usually `rgba(255,255,255,0.06)` or a tinted variant via `theme.primaryDim`
- Border: optional, 1px in same color family
- Text: `typography.label` or `typography.caption`
- Radius: `radius.sm` (6) for soft rectangles, `radius.full` for true pills
- Padding: `spacing.sm` (8) horizontal, `spacing.xs` (4) vertical

### Modals and bottom sheets

- Background: `theme.bgElevated`
- Top radius: `radius.lg` (20), bottom edge of sheet extends to screen edge
- Drag handle: 4px tall, 32px wide, `theme.borderStrong`, top center, `spacing.sm` from top
- Backdrop: `rgba(0, 0, 0, 0.6)`
- Content padding: `spacing.lg` (16) horizontal, varying vertical

### Loading states

- Spinner color: `theme.primary` for primary loading, `theme.textMuted` for inline
- Skeleton bars: `theme.bgSubtle` background, animated opacity (0.5 → 1.0 → 0.5, 1500ms loop)
- Loading text: `typography.body`, `theme.textSecondary`

### Empty states

When a section has no content, show:

- Centered vertically in available space
- Optional icon: 48×48, `theme.textMuted` color
- Title: `typography.heading`, `theme.textPrimary`
- Description: `typography.body`, `theme.textSecondary`, max width 280
- Optional CTA below

Empty states must teach, not just state absence.
- Bad: "No words yet."
- Good: "Save a few words and complete your first session to start practicing."

## Layout patterns

### Screen header

Two variants:

**Title header** — top-level screens (Today, Learn, Practice):
- Logo or app name on left
- Profile/settings icon on right
- Below: screen title (`typography.title`)
- Optional subtitle (`typography.body`, `theme.textSecondary`)

**Sub-screen header** — nested screens (User Stack Detail, Reading Setup, Session intro):
- Back chevron + parent screen name on left, in `theme.primary`
- Right side: optional action or counter ("1 / 10")
- Below: optional screen title (only if it adds info)

Both use `spacing.lg` horizontal padding, `spacing.md` vertical.

### Section pattern

Within a screen, content groups into sections. Each section:

- Optional caption label (uppercase, `typography.caption`, `theme.textMuted`)
- Section content
- `spacing.2xl` (24) gap before next section

Don't use heavy dividers between sections by default. Spacing alone should provide separation. Add subtle dividers (`borderTopWidth: 1, borderColor: theme.border`) only when sections feel mushy without them.

### Form pattern

For setup screens (Reading Setup, Quick Assessment, Create Stack):

- Vertical stack of form sections
- Each: caption label + input/selector
- `spacing.xl` (20) gap between sections
- Primary CTA at bottom, full-width with `spacing.lg` horizontal margin
- CTA disabled until form is valid; on disabled-tap, show what's missing

### Hero / single-focus pattern

For session intro cards, post-session summary, hero moments:

- Single dominant element (the word, the streak number)
- That element is at least 50% larger than any other text on screen
- Generous whitespace above and below the hero
- Supporting content scales down severely (don't compete with hero)
- One primary CTA at bottom

This pattern is for moments where the user should focus on ONE thing.

### List + detail pattern

When a screen lists items that open detail views:

- List uses list row component
- Tap → navigates to detail screen via local state navigation (LearnFlow / PracticeFlow pattern)
- Detail screen has back-chevron header
- Back returns to list with previous scroll position preserved

## Motion

Subtle and short. Long animations feel slow on second use.

- **Tap response:** 150ms ease-out (subtle scale or opacity)
- **Modal entry:** 250ms ease-out, slide up from bottom
- **Modal exit:** 200ms ease-in, slide down
- **Tab switch:** instant, no transition
- **Card transitions in session:** instant or 100ms cross-fade max
- **Glass blur:** native iOS blur, no animation overlay needed
- **Loading skeletons:** 1500ms opacity loop (0.5 → 1.0 → 0.5)

Never animate opacity from 0 to 1 over more than 200ms unless it's a deliberate dramatic moment (session complete celebration, streak achievement).

## Don'ts

- Don't use icons gratuitously. Most labels don't need icons. Words usually communicate better.
- Don't use red except for destructive actions or errors.
- Don't use more than 2 font weights on a single screen.
- Don't add gradients except for the app icon, hero moments, and rare accent backgrounds.
- Don't use more than 3 levels of visual hierarchy on a single screen.
- Don't add box-shadows on iOS without verifying they render correctly.
- Don't use card shadows AND borders together. Pick one.
- Don't pile on every available bucket of content for a single piece of information. Progressive disclosure is your friend.
- Don't make every screen feel important. Most screens are routine. Save visual weight for moments that matter.
- Don't ship UI that hasn't been seen on a real device. Simulator and design tools lie about font rendering, shadow, and color.

## Decision tree for new UI

When adding a new screen or component, walk through these questions:

1. **What pattern is this?** Header, list, form, hero, detail. Reuse the existing pattern; don't invent.
2. **What's the primary action?** Exactly one primary CTA per screen.
3. **What's the hierarchy?** Pick at most 3 levels. Hero + body + supporting. Or Title + body + caption. Not all four.
4. **What spacing tokens?** Always pick from the scale. No freestyle.
5. **What colors?** Semantic names only. No literal hex values in components.
6. **What components?** Reuse existing buttons, cards, inputs. Don't restyle.
7. **What's the empty state?** Every list or section that can be empty needs one.
8. **What's the loading state?** Spinner, skeleton, or "generating..." text.
9. **What's the error state?** What happens if data fails to load?
10. **What does it look like on a phone?** Test on real device before declaring done.

## Working with Cursor

When asking Cursor to build UI:

- Reference design tokens explicitly, don't say "make it look nice"
- Bad: "Add a button at the bottom"
- Good: "Add a primary button at the bottom using the standard primary button component, full width, with `spacing.lg` margin"

When Cursor proposes UI that violates the system:

- Reject and reference this file
- Don't accept "creative" deviations unless they extend the system intentionally
- If a real need can't fit the system, propose adding to this file rather than working around it

## When the system needs to grow

If you encounter a UI need that doesn't fit, propose adding to the system rather than freestyling. Update this file. The system grows; it doesn't get bypassed.

Examples of when to extend:
- A new component variant (e.g. a new button type)
- A new color need (e.g. a fourth bucket bucket color)
- A new pattern for an unprecedented screen type

Examples of when NOT to extend:
- "I just want to use a different shade here" — no, use existing tokens
- "This font size is almost the right size" — use existing scale
- "I want to try something different" — no