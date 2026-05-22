# GMAT Lexicon — Web design system (authenticated surfaces)

**Status:** Specification only. Tokens and components are documented here first; implementation in `src/index.css` and `src/components/ui/` happens during screen-by-screen migration.

**Scope:** Authenticated app under `AppLayout`, full-screen `SessionPage`, Exam hub, RC setup / practice / review, My Words, Word Detail. **Out of scope:** landing (`/`), legal, sign-in/sign-up, Learn flashcard CSS (`.learnFlash*` in `index.css`).

**Goal:** Consistency, not reskin. Preserve dark navy + lavender primary + emerald success + gradient card surfaces. Unify scattered values identified in the authenticated-surface design audit (pre-system).

**Hybrid migration:** Full token layer in CSS + five extracted React components (`PrimaryButton`, `SelectableTile`, `McqOption`, `Alert`, `StatBlock`). Everything else stays inline but **must reference tokens**.

---

## Principles

1. **One primary CTA per screen** — pill gradient (`PrimaryButton` / `.btnPrimary`). No flat indigo exam buttons after migration.
2. **Tokens over literals** — no `#22C55E`, `#FCA5A5`, or `rgba(99, 102, 241, 0.18)` in page code; use semantic variables.
3. **Two card padding tiers only** — 16px compact, 20px comfortable. Retire 14px and 18px.
4. **Serif is scoped** — Crimson Pro only where the system says (`text-academic`); do not spread to lists or exam UI.
5. **Do not modify** `.learnFlash*` styles when migrating Learn; flashcard modal may use tokens for overlay only.

---

## 1. Color tokens

### 1.1 Foundation (existing — keep)

Defined in `src/index.css` today. Semantic roles and usage:

| Token | Dark | Light | Role | Use |
|-------|------|-------|------|-----|
| `--bg` | `#0b1326` | `#f5f5fb` | App canvas | Page background (with radial gradients on `:root`) |
| `--surface` | `#131b2e` | `#ffffff` | Raised surface | Cards, modals, panels |
| `--surface-2` | `#171f33` | `#f3f4ff` | Surface gradient end | `.card` gradient bottom stop |
| `--text` | `#dae2fd` | `#0b1220` | Primary text | Headings, body, inputs |
| `--muted` | `#c7c4d7` | `rgba(11, 18, 32, 0.68)` | Secondary text | Subtitles, captions, `.muted` |
| `--border` | `rgba(255,255,255,0.1)` | `rgba(11,18,32,0.12)` | Borders | Cards, inputs, dividers |
| `--accent` | `#7c3aed` | *(same)* | Brand violet | Flag active state, accents |
| `--accent-gradient-start` | `#7b81f5` | *(same)* | Primary gradient start | `.btnPrimary`, progress fills, badges |
| `--accent-gradient-end` | `#6366f1` | *(same)* | Primary gradient end | Selection border color, links, streak pill |
| `--accent-2` | `#22c55e` | *(same)* | Success (legacy name) | **Deprecated name** — prefer `--success` |
| `--danger` | `#ef4444` | *(same)* | Danger | Errors, wrong answers, destructive hints |
| `--header-bg` | `rgba(45,52,73,0.6)` | `rgba(245,245,251,0.88)` | Sticky chrome | `AppLayout` header, Session top bar |
| `--shadow` | `rgba(0,0,0,0.35) 0 14px 40px -20px` | `rgba(0,0,0,0.12) 0 14px 40px -20px` | Card elevation | Default `.card` |
| `--shadow-glow` | `0 0 24px rgba(99,102,241,0.25)` | `0 0 20px rgba(99,102,241,0.18)` | Primary glow | `.btnPrimary`, completion glow |

**Layout tokens (unchanged):** `--content-max: 1280px`, `--content-pad-x: 24px`.

### 1.2 New semantic tokens (add on migration)

Add to `:root` and `:root[data-theme='light']` in `src/index.css`. Values below are the **canonical** choices; they replace audit hardcodes.

| Token | Dark | Light | Role | Replaces (audit) |
|-------|------|-------|------|------------------|
| `--success` | `#22c55e` | `#16a34a` | Success text, borders, icons | `#22C55E`, `#86EFAC` (as *text* on soft bg use `--success-on-soft`), `var(--accent-2)` inline |
| `--success-soft` | `rgba(34, 197, 94, 0.08)` | `rgba(22, 163, 74, 0.12)` | Success panel background | `rgba(34, 197, 94, 0.08)` in `RcReviewPage` |
| `--success-on-soft` | `#86efac` | `#15803d` | Success label on `--success-soft` | `#86EFAC` in RC review “correct” label |
| `--danger-soft` | `rgba(239, 68, 68, 0.08)` | `rgba(239, 68, 68, 0.1)` | Error/info alert background | `rgba(239, 68, 68, 0.08)` RC error boxes |
| `--danger-text` | `#fca5a5` | `#b91c1c` | Error text on `--danger-soft` | `#FCA5A5` RC error copy (theme-aware) |
| `--selection-border` | `var(--accent-gradient-end)` | `var(--accent-gradient-end)` | Active tile/option border | `2px solid var(--accent-gradient-end)` scattered in Test/Learn/RC |
| `--selection-fill` | `rgba(99, 102, 241, 0.12)` | `rgba(99, 102, 241, 0.1)` | Active tile/option background | `0.12` / `0.18` / `0.04` indigo rgba — **one fill: 0.12 dark, 0.10 light** |
| `--fill-subtle` | `rgba(255, 255, 255, 0.03)` | `rgba(11, 18, 32, 0.04)` | Inactive tile, list row, option default | `rgba(255,255,255,0.02–0.04)` inline fills |
| `--fill-muted` | `rgba(255, 255, 255, 0.06)` | `rgba(11, 18, 32, 0.06)` | Hover/secondary fills | AppLayout close btn `0.06`, synonym chips |
| `--text-tertiary` | `rgba(199, 196, 215, 0.72)` | `rgba(11, 18, 32, 0.52)` | De-emphasized meta | `opacity: 0.9–0.92` on `.muted`, hint lines |
| `--scrim` | `rgba(0, 0, 0, 0.65)` | `rgba(0, 0, 0, 0.45)` | Modal overlay | `0.6` vs `0.72` scrims → **one: 0.65 dark, 0.45 light** |
| `--on-primary` | `#ffffff` | `#ffffff` | Text on gradient buttons | `#fff` on primaries |

**Aliases (document only):**

```css
--success: var(--accent-2); /* until --accent-2 removed from call sites */
```

Prefer `--success` in new code and migrated files.

### 1.3 Resolved inconsistencies (audit catalog)

| Issue | Resolution |
|-------|------------|
| **#6 Error presentation** | Inline `color: var(--danger)` for single-line errors; **boxed** errors use `Alert` variant `error` with `--danger-soft` + `--danger-text`. No `#FCA5A5` literals. |
| **#7 Success/correct colors** | All correct states use `--success`, `--success-soft`, `--success-on-soft`. No `#22C55E` / `#86EFAC` literals. |
| **#3 / #17 Primary button** | Only pill gradient `PrimaryButton` / `.btnPrimary`. Exam/RC `primaryButtonStyle()` removed. |
| **#4 / #5 Selection chips** | Active: `2px solid var(--selection-border)` + `background: var(--selection-fill)`. Inactive: `1px solid var(--border)` + `var(--fill-subtle)`. |

### 1.4 CSS block to add (implementation reference)

When starting token migration, append to `:root` / light theme:

```css
:root {
  --success: #22c55e;
  --success-soft: rgba(34, 197, 94, 0.08);
  --success-on-soft: #86efac;
  --danger-soft: rgba(239, 68, 68, 0.08);
  --danger-text: #fca5a5;
  --selection-border: var(--accent-gradient-end);
  --selection-fill: rgba(99, 102, 241, 0.12);
  --fill-subtle: rgba(255, 255, 255, 0.03);
  --fill-muted: rgba(255, 255, 255, 0.06);
  --text-tertiary: rgba(199, 196, 215, 0.72);
  --scrim: rgba(0, 0, 0, 0.65);
  --on-primary: #ffffff;
}

:root[data-theme='light'] {
  --success: #16a34a;
  --success-soft: rgba(22, 163, 74, 0.12);
  --success-on-soft: #15803d;
  --danger-soft: rgba(239, 68, 68, 0.1);
  --danger-text: #b91c1c;
  --selection-fill: rgba(99, 102, 241, 0.1);
  --fill-subtle: rgba(11, 18, 32, 0.04);
  --fill-muted: rgba(11, 18, 32, 0.06);
  --text-tertiary: rgba(11, 18, 32, 0.52);
  --scrim: rgba(0, 0, 0, 0.45);
}
```

Also add spacing, radius, and typography variables (sections 2–5) in the same pass.

---

## 2. Typography

### 2.1 Font families

| Token | Stack | Usage |
|-------|-------|-------|
| `--sans` | Manrope, system-ui, … | **All** authenticated UI by default |
| `--font-academic` | Crimson Pro, Georgia, serif | **Only** Learn flashcard headword (`.learnFlashWord`) and future explicit `text-academic` utility — **do not** use on Exam, Test, Session, My Words, or list cards |
| `--mono` | ui-monospace, … | Deck stats line, inline synonym/tag chips in Word Detail |

Loaded in `index.html` (Manrope 400/600/700/800, Crimson Pro 600/700 italic).

### 2.2 Line height

| Token | Value | Use |
|-------|-------|-----|
| `--leading-tight` | `1.15` | Page titles, hero headwords |
| `--leading-normal` | `1.5` | Body, definitions, MCQ options |
| `--leading-relaxed` | `1.7` | Long passages (RC passage pane) |

Retire ad-hoc `1.45`, `1.55` → map to `--leading-normal` unless passage (use relaxed).

### 2.3 Type scale

| Step | CSS vars | Size | Weight | Letter-spacing | Role |
|------|----------|------|--------|----------------|------|
| `text-micro` | `--text-micro-size` etc. | **10px** | 700–800 | `0.06em` uppercase optional | Eyebrows (STREAK, QUIZ), flashcard hints |
| `text-label` | | **12px** | 700 | `0.04em` optional | Section labels, meta, nav hints, stat labels |
| `text-body-sm` | | **13px** | 400–600 | 0 | Secondary body, errors, captions |
| `text-body` | | **14px** | 400–600 | 0 | Default body, option text, deck copy |
| `text-body-lg` | | **15px** | 400 | 0 | Subtitles under page title, definitions |
| `text-section` | | **16px** | 700–800 | 0 | In-card section titles (“Reading practice”) |
| `text-card-title` | | **18px** | 700 | `-0.02em` | RC question stem, modal titles |
| `text-title` | | **20px** | 800 | `-0.02em` | **List row headword** (Learn vocab card) |
| `text-headword` | | **24px** | 800 | `-0.03em` | **Word detail** page title only |
| `text-headword-emphasis` | | **28px** | 800 | `-0.03em` | **Analysis / lookup result** headword (Today card) |
| `text-page-title` | | **28px** | 800 | `-0.03em` | Screen `h1` (Today, Learn, Test, Exam, RC) |
| `text-hero` | | **32px** | 800 | `-0.03em` | **Session intro** new-word display |

**Utility classes (add during token migration):** `.text-micro`, `.text-label`, … each sets `font-size`, `font-weight`, `line-height: var(--leading-*)`.

### 2.4 Headword conventions (fixes audit #9)

| Context | Scale step | Example surfaces |
|---------|------------|------------------|
| List row | `text-title` (20px) | Learn `VocabCard` |
| Word detail | `text-headword` (24px) | `WordDetailPage` (migrate from 24 — already correct) |
| Lookup / analysis result | `text-headword-emphasis` (28px) | Today `WordAnalysisCard` |
| Full-screen intro | `text-hero` (32px) | `SessionPage` intro |
| Flashcard | `.learnFlashWord` (existing CSS) | Learn study modal — **unchanged** |

Do not use 28px on list rows or 20px on detail pages.

### 2.5 Section label convention (fixes audit #10)

One pattern everywhere:

- `text-label` (12px / 700)
- `color: var(--muted)`
- `margin-bottom: var(--space-sm)` (8px)
- Uppercase only for **category** labels (STREAK, QUIZ, SETTINGS); sentence case for field labels (“Difficulty”, “Meaning”)

---

## 3. Spacing scale

8-point base. **Do not use 14 or 18** in new code; map to **16** or **20**.

| Token | px | Typical use |
|-------|-----|-------------|
| `--space-2xs` | 4 | Tight gaps, pill padding micro |
| `--space-xs` | 8 | Chip gaps, label→content, list row gap |
| `--space-md` | 12 | Inner card grids, compact stacks |
| `--space-lg` | 16 | Card padding compact, page section gaps |
| `--space-xl` | 20 | Card padding comfortable, container vertical padding component |
| `--space-2xl` | 24 | Title block margin-bottom, page padding-top |
| `--space-3xl` | 32 | Page padding-bottom, section breaks |
| `--space-4xl` | 48 | Rare footer spacing (RC review bottom) |

**Simplified ladder:** `4, 8, 12, 16, 20, 24, 32, 48`.

### 3.1 Page rhythm

| Convention | Value | Notes |
|------------|-------|-------|
| `.container` padding | `var(--space-xl)` vertical, `var(--content-pad-x)` horizontal | **20px** top/bottom inside container (replace mixed 18/24/32) |
| Page extra top | `var(--space-2xl)` (24px) | Optional on main tabs if container padding isn’t enough — prefer **one** approach: container `padding: var(--space-2xl) var(--content-pad-x) var(--space-3xl)` |
| Page bottom | `var(--space-3xl)` (32px) | Replaces `paddingBottom: 18` on Learn/My Words |
| Below page `h1` | `var(--space-2xl)` (24px) | Replaces ad-hoc 24 margin-bottom |
| List gap | `var(--space-xs)` (8px) or `var(--space-md)` (12px) | Vocab list: **12px** (`--space-md`) |

### 3.2 Container max-width overrides

| Surface | max-width |
|---------|-----------|
| Default | `var(--content-max)` 1280px |
| Session content | 560px |
| RC setup | 720px |
| RC review | 880px |
| Study modal inner | 520px |

---

## 4. Card padding tiers

| Tier | Token | px | Use |
|------|-------|-----|-----|
| **Compact** | `--card-pad-compact` | **16** | Filter/search card, vocab list cards, quiz running card, My Words rows card, stat strip items, deck stats |
| **Comfortable** | `--card-pad-comfortable` | **20** | Primary panels: Today streak/lookup/analysis, Test setup, Exam hub cards, RC setup, RC review stats, reading practice block |

`.card` does not set padding — pages/components set `padding: var(--card-pad-*)`.

### 4.1 Migration map (audit cards → tier)

| Was | Screen | Tier |
|-----|--------|------|
| 14 | Learn filter card | **16** compact |
| 14 | Test idle stat cards | **16** compact |
| 16 | VocabCard, My Words, Word Detail, Quiz card | compact |
| 18 | Home streak, Learn reading | **20** comfortable |
| 20 | Home analysis, Test setup, RC setup, RC stats | comfortable |

---

## 5. Radius scale

| Token | px | Replaces | Use |
|-------|-----|----------|-----|
| `--radius-sm` | **8** | 6, 8, 10 → **8** for small controls | Exit buttons, small badges, alert boxes, MCQ letter circle (if 24px circle use 50% / 999) |
| `--radius-md` | **12** | 10, 12 | `.btn`, `.input`, selectable tiles, option rows, bucket stat mini-cards |
| `--radius-lg` | **14** | `var(--radius)` | `.card` default — keep `--radius: var(--radius-lg)` |
| `--radius-pill` | **999** | 999 | Chips, primary button, streak pill |

**Mapping:** old **10** → `--radius-sm` (8) or `--radius-md` (12): use **md** for tappable rows, **sm** for compact chrome.

---

## 6. Elevation / shadow

| Token | When |
|-------|------|
| `--shadow` | Default `.card` — standard panels |
| `--shadow-glow` | **Only** primary CTA (`PrimaryButton` / `.btnPrimary`) and celebratory session complete glow (existing `.sessionCompleteGlow`) |

**Do not** add extra box-shadow to list rows or selectable tiles (border-only elevation).

**Premium exception:** `.learnFlashPremium` and ambient blur — leave as-is; not the default card language.

---

## 7. Extracted components (spec only — do not implement in this task)

Location (future): `src/components/ui/PrimaryButton.tsx`, etc.

### 7.1 `PrimaryButton`

**Replaces:** `.btnPrimary`, Exam hub Link-as-button, `RcSetupPage` / `RcPracticePage` / `RcReviewPage` `primaryButtonStyle()`, audit **#3, #17**.

| Prop | Type | Notes |
|------|------|-------|
| `children` | `ReactNode` | Label |
| `onClick` | `() => void` | |
| `disabled` | `boolean` | |
| `loading` | `boolean` | Shows loading label; disables click |
| `icon` | `ReactNode` | Optional leading icon (e.g. `IconPlay`) |
| `type` | `'button' \| 'submit'` | Default `button` |
| `as` | `'button' \| 'link'` | If `link`, render `Link` with same styles (Exam hub CTA) |

**Styles (token-only):**

- `background: linear-gradient(135deg, var(--accent-gradient-start), var(--accent-gradient-end))`
- `color: var(--on-primary)`
- `border-radius: var(--radius-pill)`
- `padding: var(--space-md) var(--space-xl)` (12px 20px)
- `font-weight: 700`; `font-size: var(--text-body-lg-size)` (15px)
- `box-shadow: var(--shadow-glow)`
- Hover: `filter: brightness(1.08)` (match `.btnPrimary`)
- Disabled/loading: `opacity: 0.6`, no hover

**States:** default, hover, disabled, loading.

**Rule:** Max **one** `PrimaryButton` per viewport (same as mobile design rule).

---

### 7.2 `SelectableTile`

**Replaces:** Learn `FilterChip`, Test mode/count buttons, RC difficulty cards, audit **#4, #5**.

| Prop | Type | Notes |
|------|------|-------|
| `label` | `string` | Primary line |
| `sublabel` | `string` | Optional second line (`text-body-sm`, muted) |
| `selected` | `boolean` | |
| `onClick` | `() => void` | |
| `disabled` | `boolean` | |
| `layout` | `'pill' \| 'tile'` | See below |

**Shared selected styles:**

- `border: 2px solid var(--selection-border)`
- `background: var(--selection-fill)`

**Shared default styles:**

- `border: 1px solid var(--border)`
- `background: var(--fill-subtle)`

| Layout | Radius | Padding | Notes |
|--------|--------|---------|-------|
| `pill` | `--radius-pill` | `var(--space-sm) var(--space-lg)` (10px 16px → use **8px 16px**) | Count chips (5/10/20/50), filter chips |
| `tile` | `--radius-md` | `var(--space-lg)` (16px) | Mode/difficulty cards, text-align left |

**Typography:** label `text-body` 14px/600; sublabel `text-body-sm` 13px muted.

---

### 7.3 `McqOption`

**Replaces:** Test quiz options, Session `McqStepWeb` rows, RC `QuestionPane` choices, audit **#8**.

**Canonical chrome:** Letter prefix **A–D** in a 24×24 circle (RC style) for Exam and Test; Session may use same component with `showLetter={false}` only if layout too tight — default **`showLetter={true}`** for new exam UI.

| Prop | Type | Notes |
|------|------|-------|
| `label` | `string` | Option text |
| `letter` | `'A' \| 'B' \| 'C' \| 'D' \| …` | Display in circle |
| `state` | `'default' \| 'selected' \| 'correct' \| 'incorrect' \| 'dimmed'` | |
| `onClick` | `() => void` | Undefined when not clickable |
| `disabled` | `boolean` | |

**State styles (tokens only):**

| State | Border | Background | Text |
|-------|--------|------------|------|
| `default` | `1px var(--border)` | `var(--fill-subtle)` | `var(--text)` |
| `selected` | `2px var(--selection-border)` | `var(--selection-fill)` | `var(--text)` |
| `correct` | `2px var(--success)` | `color-mix(in srgb, var(--success) 20%, transparent)` | `var(--text)` |
| `incorrect` | `2px var(--danger)` | `color-mix(in srgb, var(--danger) 20%, transparent)` | `var(--text)` |
| `dimmed` | `1px transparent` | `var(--fill-subtle)` | `var(--muted)`; opacity **0.6** |

Letter circle:

- Default: `border 1px var(--border)`, bg transparent, `color: var(--muted)`
- Selected: bg `var(--selection-border)`, `color: var(--on-primary)`
- Correct: bg `var(--success)`, `color: var(--on-primary)`
- Incorrect: bg `var(--danger)`, `color: var(--on-primary)`

**Container:** `border-radius: var(--radius-md)`, padding `var(--space-md) var(--space-lg)`, `text-body` 14px, `line-height: var(--leading-normal)`.

**Feedback banner** (Session “Correct” / “Not quite”): separate row above options, not part of `McqOption` — use `--success-soft` / `--danger-soft` with `color-mix` 17.5% like current Session (token-aligned).

---

### 7.4 `Alert`

**Replaces:** RC error boxes, scattered danger text blocks, audit **#6**.

| Prop | Type | Notes |
|------|------|-------|
| `variant` | `'error' \| 'success' \| 'info'` | |
| `children` | `ReactNode` | Message body |
| `role` | `'alert' \| 'status'` | Default `alert` for error |

| Variant | Background | Border | Text |
|---------|------------|--------|------|
| `error` | `--danger-soft` | `1px solid color-mix(in srgb, var(--danger) 40%, transparent)` | `--danger-text` |
| `success` | `--success-soft` | `1px solid color-mix(in srgb, var(--success) 40%, transparent)` | `--success-on-soft` |
| `info` | `var(--fill-subtle)` | `1px solid var(--border)` | `var(--text)` |

**Layout:** `padding: var(--space-md)`, `border-radius: var(--radius-sm)`, `font-size: text-body-sm` (13px).

**Single-line errors** without box: `color: var(--danger)` + `text-body-sm` is still allowed.

---

### 7.5 `StatBlock`

**Replaces:** Home streak numbers, Test placeholder stats, RC review stats, audit **#12**.

| Prop | Type | Notes |
|------|------|-------|
| `label` | `string` | Uppercase micro or label style |
| `value` | `string \| number` | |
| `sublabel` | `string` | Optional |

**Layout:** Parent uses compact card padding **16px**; center or left align per context.

| Element | Type step |
|---------|-----------|
| Label | `text-label` (12px/700), `var(--muted)` |
| Value | **20px** / 800 (`--text-stat-value` — between title and page title) |
| Sublabel | `text-body-sm`, `var(--text-tertiary)` |

**One value size everywhere:** **20px / 800** (Test placeholders and RC stats currently 20–22 → unify to 20).

---

## 8. Inline patterns (token conventions)

No shared component yet; must follow tokens.

### 8.1 Page header block

```text
h1.text-page-title  → 28px / 800 / leading-tight / letter-spacing -0.03em / color var(--text)
p.subtitle          → text-body-lg (15px) / var(--muted) / margin-top var(--space-xs)
section gap below   → var(--space-2xl)
```

Exception: `SessionPage` empty state title uses `text-section` (16px) for secondary empty copy — not the main tab pattern.

### 8.2 Card container

- Class: `.card`
- Padding: `var(--card-pad-compact)` or `var(--card-pad-comfortable)` only
- Do not override gradient/border except `Alert`-like nested panels inside review (use `--fill-subtle`)

### 8.3 Search / lookup row

One convention (fixes audit **#11**):

- Outer: `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)` (14px), `background: var(--surface)`, padding `var(--space-md) var(--space-lg)`
- Inner `input`: borderless, `background: transparent`, uses `.input` focus styles when focused

### 8.4 Modal overlay

- `background: var(--scrim)`
- `padding: var(--space-lg)`
- Centered panel: `.card` + comfortable padding
- Learn study modal: same scrim; flashcard content unchanged

### 8.5 Fullscreen flow header (Session + RC practice)

| Property | Value |
|----------|-------|
| Background | `var(--header-bg)` |
| Border bottom | `1px solid var(--border)` |
| Padding | `var(--space-md) var(--space-lg)` (12px 16px) |
| Title | `text-body` 14px / 700 |
| Step/progress | `text-body-sm` / `var(--muted)` |
| Exit control | `.btn` with `text-body-sm`, `radius-sm` |

RC practice currently omits `header-bg` — migrate to match Session.

### 8.6 Secondary button

Keep `.btn` class; overrides use `radius-md`, `padding: var(--space-sm) var(--space-md)`, `background: color-mix(in srgb, var(--surface) 70%, transparent)`.

### 8.7 Nav active state (preserve)

`AppLayout` NavLink: `color: var(--text)` when active, `var(--muted)` otherwise; `border-bottom: 2px solid var(--text)` active. Do not change.

### 8.8 Type / category pill (non-selectable)

Synonym/tag chips: `border: 1px solid var(--border)`, `background: var(--fill-subtle)` or `var(--selection-fill)` for accent tags, `border-radius: var(--radius-pill)`, `padding: var(--space-xs) var(--space-md)`, `text-body-sm`.

RC question type badge: `background: var(--selection-fill)`, `color: var(--muted)` on dark / use `color-mix` toward `--accent-gradient-end` for text — migrate `#A5B4FC` to `color: color-mix(in srgb, var(--accent-gradient-end) 75%, var(--text))`.

---

## 9. Migration order

Implement **tokens in `index.css` first**, then **five components**, then screens.

| Phase | Screen / area | Components | Inconsistencies resolved |
|-------|---------------|------------|---------------------------|
| **0** | `src/index.css` | — | Add all CSS variables; utility classes optional |
| **1** | `ExamHubPage` | `PrimaryButton` | #3, #17 primary style |
| **2** | `RcSetupPage` | `PrimaryButton`, `SelectableTile`, `Alert` | #3, #4, #6, flat primary, error box |
| **3** | `RcPracticePage` | `PrimaryButton`, `McqOption`, `Alert` | #8, #13 header, #6, #7 hardcoded greens/reds |
| **4** | `RcReviewPage` | `PrimaryButton`, `StatBlock`, `McqOption` (read-only), `Alert` | #7, #12, #6, hardcoded review colors |
| **5** | `TestPage` | `PrimaryButton`, `SelectableTile`, `McqOption`, `StatBlock` | #4, #5, #8, #12 |
| **6** | `SessionPage` | `McqOption`, `PrimaryButton`, `Alert` (errors) | #8 — align Test/Session/RC; keep Session feedback quality |
| **7** | `HomePage` | `PrimaryButton`, `StatBlock`, `Alert` | Card tiers, headword 28, stat styling |
| **8** | `LearnPage` | `SelectableTile`, tokenized search row; **no flashcard CSS changes** | #11, #4, filter chips; paragraph tooltip → theme-aware tokens in inline `<style>` |
| **9** | `MyWordsPage`, `WordDetailPage` | — (inline tokens only) | Card tiers, headword 24, list rows |
| **10** | `AppLayout`, `AuthButton` | — | Scrim #14, modal padding |

**CR / new exam UI:** Build only after phase **1–4** complete so new surfaces use `PrimaryButton`, `SelectableTile`, `McqOption`, `Alert`, `StatBlock` from day one.

---

## 10. Explicitly preserved (do not change)

| Asset | Reason |
|-------|--------|
| Theme foundation (`--bg`, lavender gradients, navy surfaces) | Brand identity |
| `.card` gradient surface + `--shadow` | Core authenticated look |
| Pill gradient primary CTA | Locked product decision |
| `.learnFlash*` subsystem | Best-built UI; isolated premium pattern |
| `src/components/Icons.tsx` | Shared stroke icons |
| Nav active underline pattern | Already consistent |
| Session MCQ semantic colors | Already uses `--accent-2` / `--danger` — migrate names to `--success` / `--danger` only |
| Body radial gradients on `:root` | Atmosphere |
| `index.html` font loading | Manrope + Crimson Pro |

---

## Quick reference — locked decisions

| Topic | Decision |
|-------|----------|
| Primary button | Pill gradient only |
| Selection | 2px `--selection-border` + `--selection-fill` |
| Card padding | 16 compact / 20 comfortable only |
| Page padding bottom | 32px (`--space-3xl`) |
| Screen h1 | 28px `text-page-title` |
| List headword | 20px `text-title` |
| Detail headword | 24px `text-headword` |
| MCQ letter circles | Canonical for Test + Exam; Session uses shared component |
| Error boxes | `Alert` + `--danger-soft` / `--danger-text` |
| Success in review | `--success*` tokens only |

---

## Related files

| File | Role |
|------|------|
| `src/index.css` | Tokens + `.card` / `.btn` / `.btnPrimary` |
| `.cursor/rules/design-web.md` | Cursor rule pointer to this doc |
| `.cursor/rules/desing.md` | **Mobile only** (Expo) — do not mix with web |
| `UI_UX_OVERVIEW.md` | Product route map (not visual spec) |
