---
description: Web authenticated UI — design tokens and components (GMAT Lexicon)
globs: src/**/*.{ts,tsx,css}
---

# Web design system (authenticated surfaces)

**Full specification:** [`docs/DESIGN_SYSTEM_WEB.md`](../../docs/DESIGN_SYSTEM_WEB.md)

Use that document for every UI task on web (Today, Learn, Test, Exam, Session, My Words). **Out of scope:** landing, legal, sign-in/sign-up. **Do not change** `.learnFlash*` CSS unless explicitly asked.

## Locked rules

- **Primary CTA:** pill gradient only — `PrimaryButton` or `.btnPrimary`. No flat indigo exam-style buttons.
- **Colors:** CSS variables only — no `#22C55E`, `#FCA5A5`, or ad-hoc `rgba(99,102,241,0.18)` in pages.
- **Card padding:** `16px` compact or `20px` comfortable only.
- **Selection:** `2px` `--selection-border` + `--selection-fill`.
- **One primary button per screen.**

## Five shared components (when implemented)

`src/components/ui/` — `PrimaryButton`, `SelectableTile`, `McqOption`, `Alert`, `StatBlock`. Specs are in the design doc; prefer these over re-implementing inline.

## Mobile

Mobile uses [`.cursor/rules/desing.md`](desing.md) (`mobile/**`) — not this file.
