# GMAT Lexicon — UI / UX overview

This document maps **screens**, **sections**, and **purpose** for the web app (Vite + React Router) and the mobile app (Expo / React Native). Routing uses a **hash router** on web (`#/app`, etc.).

---

## Design language (high level)

| Surface | Approach |
|---------|----------|
| **Web — marketing (`/`)** | Dedicated landing aesthetic: aurora blobs, violet palette (`landingPalette`), hero “word deck” animation, dark/light toggle stored in `localStorage` (`data-theme`). |
| **Web — authenticated shell** | Shared `AppLayout`: sticky header, muted vs primary text (`--muted`, `--text`), cards (`--surface`, `--border`), pill buttons (`btn`, `btnPrimary`). Theme toggle + docs live in auth/profile affordances. |
| **Mobile** | “Lexicon” shell: navy / glass-inspired surfaces (`theme.learnScreenBg`, `learnGlass*` tokens), rounded cards, pill tab bar at bottom (**Today · Learn · Test**), optional **ProfileSheet** modal from header avatar. Subscription / paywall wraps Pro features where applicable. |

Sessions (daily drill) open **fullscreen** over the shell on mobile; on web **`/session`** is a standalone route outside `AppLayout`.

---

## Web — routes & pages

### `/` — **LandingPage** (marketing)

- Fixed header: branding, Sign in/up, optional light/dark.
- Hero: headline, CTAs (open app vs sign up), **`LandingHeroWordDeck`** showcase.
- Additional sections: value props, imagery, footer links (**Privacy**, **Terms**).
- Signed-in users are typically steered toward **`/app`** (`APP_HOME`).

### `/sign-in`, `/sign-up`

- Firebase email auth forms; gateway into the authenticated product.

### `/privacy`, `/terms`

- **`LegalPageLayout`**: readable legal content, consistent typography.

### `/session` — **SessionPage** (no main nav chrome)

 Full-screen flow: load deck → optional **Intro** cards (new words: definition / simple meaning / memory hook → **Got it**) → **MCQ** verbal quiz per word → **Summary** (quiz stats, bucket before/after, streak). Header: Exit + step counter.

### Authenticated shell — **`AppLayout`** wraps:

| Route | Page | Sections & behavior |
|-------|------|---------------------|
| **`/app`** (`APP_HOME`) | **HomePage** (“Today”) | Title + subtitle; **Streak card** (days, sessions completed, **Start session** → `/session`); **Your Deck** card (counts by learning bucket + today’s planned session composition); **Quick lookup** bar (generate analysis via Cloud Function); expandable **generated word** preview + save to deck when ready. |
| **`/learn`** | **LearnPage** | Search; **filter pills** (All / New / Learning / Familiar / Mastered); scrollable **vocab cards** (definition, Study, flags, regenerate, expand details); **Reading practice**: paragraph generator from filtered pool (targets embedded in prose). Optional URL `?filter=`. |
| **`/test`** | **TestPage** | Configure **quiz mode** (meaning in context vs GMAT-style verbal), question count; **run** loads questions via API; phase **idle → running (MCQ + feedback) → finished** with score summary. Exposure updates via `applyQuizAnswerExposure`. |
| **`/words`** | **MyWordsPage** | Legacy/simple list of raw saved **WordDoc** rows — search; links to **`/words/:wordId`**. |
| **`/words/:wordId`** | **WordDetailPage** | Detail view for one saved/generated word doc (back nav to **My Words** list). |

**App chrome:** Top nav links **Today · Learn · Test · About** (`About` → `/` landing). Right side: **How to use?** (modal with usage copy), **`AuthButton`** (profile dropdown: theme, exam settings, sign out).

---

## Mobile — navigation model

After sign-in (and optional **OnboardingFlow**):

- **Header**: LEXICON title + **profile** icon → **`ProfileSheet`** (timezone, exam, language, theme, subscription hooks, onboarding replay).
- **Bottom tabs**: **Today | Learn | Test**.
- **Daily session**: **`SessionScreen`** full-screen overlay (same conceptual phases as web: intro → MCQ → summary); closes back to tabs and refreshes deck data.

### Today tab — **TodayScreen**

- **Quick lookup**: input → generate (`generateWord`) → modal sheet with rich analysis → save caps for free tier.
- Optional **exam countdown** when profile has exam date.
- **Daily objective card**: deck totals by bucket (New / Learning / Familiar / Mastered), flagged count, **today’s session** size + composition line, **Start Session** (respects session-start limits / paywall).
- Free-tier banner for saved-word limits where applicable.

### Learn tab — **LearnScreen** (+ stacks)

- **Main**: search, filter pills (**All · New · Learning · Familiar · Mastered**), flashcard/modal study flows, paragraph practice, flags/actions per card.
- From Learn: navigate to **Word stacks** → **`WordStackBrowseScreen`** → **`WordStackDetailScreen`** for curated stacks.

### Test tab — **TestScreen**

- Parallel to web Test: timed/quiz-style practice against saved vocab; uses shared scoring hooks.

### Auth (logged out)

- **`AuthNavigator`**: **Welcome → Sign in → Sign up** stack with branded backgrounds.

---

## Cross-cutting UX

- **Streak & daily completion**: Updating profile streak after a completed session (`applyStreakAfterSessionComplete`, daily completion record).
- **Exposure & buckets**: Dashboards derive **four buckets** from scores + optional intro / correct-days data; sessions pick **twelve-word** mixes (intro slice + full-batch MCQ).
- **Consistency**: Mobile favors touch targets, bottom tabs, modals; web favors persistent nav and inline expansion. Both share **shared/** logic for vocab model, planner, and quiz payloads.

---

## Files (quick reference)

| Concern | Web | Mobile |
|---------|-----|--------|
| Router | [`src/App.tsx`](src/App.tsx) | [`mobile/src/App.tsx`](mobile/src/App.tsx) (`AppChrome` → `PostAuthApp` → `MainTabs`) |
| Shell layout | [`src/components/AppLayout.tsx`](src/components/AppLayout.tsx) | Inline header + `ProfileSheet` + tab bar |
| Today | [`src/pages/HomePage.tsx`](src/pages/HomePage.tsx) | [`mobile/src/screens/TodayScreen.tsx`](mobile/src/screens/TodayScreen.tsx) |
| Learn | [`src/pages/LearnPage.tsx`](src/pages/LearnPage.tsx) | [`mobile/src/screens/LearnScreen.tsx`](mobile/src/screens/LearnScreen.tsx) |
| Test | [`src/pages/TestPage.tsx`](src/pages/TestPage.tsx) | [`mobile/src/screens/TestScreen.tsx`](mobile/src/screens/TestScreen.tsx) |
| Session | [`src/pages/SessionPage.tsx`](src/pages/SessionPage.tsx) | [`mobile/src/screens/SessionScreen.tsx`](mobile/src/screens/SessionScreen.tsx) |

---

*Generated from the codebase structure; refine as features evolve.*
