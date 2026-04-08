# GMAT Lexicon — Mobile app structure

For **simulated user flows and how people learn** in the product (narrative report), see [`USER_JOURNEY_AND_LEARNING.md`](./USER_JOURNEY_AND_LEARNING.md).

This document describes how the **Expo / React Native** app is organized: navigation, the **Today**, **Learn**, and **Test** tabs, the **daily session** overlay, and the **Profile** sheet. Use it as a map for UX and engineering work (including a future profile redesign).

**Primary entry:** `mobile/src/App.tsx`  
**Shared logic (web + mobile):** `shared/` (types, session planner, quiz helpers, languages, etc.)  
**Backend:** Firebase (Auth, Firestore) + Cloud Functions for AI (`generate`, `generateQuiz`, `generateParagraph`, etc.).

---

## High-level architecture

```
App
├── SafeAreaProvider
├── ThemeProvider          → light/dark, AppTheme tokens
├── AuthProvider           → Firebase auth listener
├── AppStatusBar
└── RootNavigation
        ├── (loading)      → spinner
        ├── (no user)      → AuthNavigator: Welcome → Sign in / Sign up
        └── (signed in)    → MainTabs
```

- **Auth:** Email/password plus **native Google Sign-In** and **Sign in with Apple** (iOS). Tokens feed Firebase `signInWithCredential`.
- **Vocab** lives in Firestore per user; the app loads the list with `listVocabItems()` and keeps a single **`items`** array in `MainTabs`, passed into Today / Learn / Test so all tabs stay in sync after reloads.

---

## Signed-in shell (`MainTabs`)

When `sessionOpen` is **false**, the user sees:

| Layer | Role |
|--------|------|
| **Top bar** | “LEXICON” branding + **Profile** affordance (opens `ProfileSheet`) |
| **Body** | One of three tabs: **Today** \| **Learn** \| **Test** |
| **Bottom bar** | Same three labels as tab switches |

When `sessionOpen` is **true**, the main chrome is replaced by **full-screen `SessionScreen`** (wrapped in `GestureHandlerRootView` for gestures). Closing the session runs **`reloadItems()`** so Today / Learn / Test reflect new progress.

---

## Today tab (`TodayScreen`)

**File:** `mobile/src/screens/TodayScreen.tsx`  
**Visual shell:** `GlassScreenRoot` + learn-themed colors (`theme.learn*`).

### Purpose

Daily **hub**: quick word capture, start the **structured session**, and skim the **active deck**.

### Sections (top → bottom)

1. **Quick Capture**  
   - Text field + **Generate Card** → calls Cloud Function `generate` → modal with analysis → **Save to deck** (Firestore via `saveWord`).  
   - On save, parent **`onSavedWord`** triggers **`reloadItems()`**.

2. **Today’s Session**  
   - Copy + stats: **Learning** / **Flagged** counts (from `computeDashboardStats(items)`).  
   - **Start Session** → `onStartSession()` → `MainTabs` sets `sessionOpen`.

3. **Active Deck**  
   - Horizontal list of saved words (preview slice of `items`): compact cards with status tag, headword, short gloss.

### Layout note

Scroll content uses **`useSafeAreaInsets()`** and a computed **`scrollMinHeight`** so the three blocks fit a typical phone viewport above the tab bar; small devices or keyboard may still scroll slightly.

---

## Daily session (`SessionScreen`)

**File:** `mobile/src/screens/SessionScreen.tsx`  
**Opened from:** Today → **Start Session**.

### Flow (single batch, shared rules with web)

1. **Load** — `listVocabItems()` → `pickSessionBatchFive()` (`shared/sessionPlanner.ts`) picks up to **5** eligible words (learning, plus flagged mastered for review; priority: flagged, last weak swipe, lower exposure).  
2. **Fetch quizzes** — `fetchMeaningQuestionsForBatch` calls `/generateQuiz` with mode **`context`** (GMAT-style stems); client shuffles options.  
3. **Phases:**  
   - **Learn** — Full flashcard per word; swipe right = know, left = don’t know (signals stored for ordering and Firestore hints).  
   - **Match** — Gloss blanks + word bank (`shared/matchPhase.ts`).  
   - **MCQ** — Meaning questions, weak-first order after learn (`shared/sessionQuiz.ts`).  
   - **Summary** — Stats; **`applySessionBatchOutcome`** + streak / session completion (`applyStreakAfterSessionComplete`, `recordDailySessionCompletion`).

**Exit** from header leaves without counting incomplete runs toward completion (as implemented in UI copy).

---

## Learn tab (`LearnScreen`)

**File:** `mobile/src/screens/LearnScreen.tsx`  
**Modal:** `mobile/src/components/LearnFlashcardModal.tsx`  
**Visual:** Glass UI components (`GlassTitleHeader`, `GlassPanel`, blur, etc.).

### Purpose

**Study library:** browse/manage the deck and run immersion reading outside the fixed daily session.

### Behaviors

- **Top modes** — **Deck** (default) \| **Paragraph** — segmented control under the title.  
- **Search** — Filters the in-memory list by query.  
- **Filter pills** — All, Do Not Know, Learning, Mastered, Flagged.  
- **Kind filter** — All / word / phrase.  
- **Deck** — Tappable cards (main column opens study); flag, sync, status chips, delete — see `lib/vocab.ts`.  
- **Flashcard study** — Full-screen **`LearnFlashcardModal`**: opens at the tapped card’s index in the **current `filtered` order** (no random shuffle); horizontal paging, reveal/hide, `recordWordExposure` on visible card.  
- **Paragraph** — First **up to five** items in **`filtered`** with `status === 'learning'`, in order; **`generateParagraph`**; render API **`parts`** with highlighted **target** spans.  
- **Profile** — Header can open profile (`onOpenProfile`).

Data refreshes when **`onReload()`** runs (after mutations or parent reload).

---

## Test tab (`TestScreen`)

**File:** `mobile/src/screens/TestScreen.tsx`

### Purpose

**Ad-hoc quizzes** (not the same as the daily session MCQ block): user picks mode, count, and runs a batch.

### Configuration

- **Mode:** **`context`** (Meaning in Context) or **`verbal`** (GMAT-Style Verbal), passed to `generateQuiz`. Legacy API values `meaning` / `gmat` are still accepted server-side.  
- **Count** (e.g. 10).  
- **Candidate pool:** Prefer **`learning`** words; if not enough, fill with **`mastered`** (shuffled).

### Phases

**Idle** → configure → **Begin section** → **Running** — per question: **MCQ** → **Feedback** (correct/incorrect + **explanation** + **Continue**) → next or **Finished** (“Section complete”).  
While a question is active, **`recordWordExposure`** is called for that item’s word.

---

## Profile (`ProfileSheet`)

**File:** `mobile/src/components/ProfileSheet.tsx`  
**Presentation:** **Modal** (fade + dimmed backdrop), not a separate route.

### Current contents (baseline for a future redesign)

| Block | Behavior |
|--------|-----------|
| **Header** | Title “Profile”, optional **email** (from Firebase user). |
| **Settings** | **Light / Dark** — toggles `colorScheme` via `ThemeProvider`. |
| **Main language** | Scrollable list from `MAIN_LANGUAGE_OPTIONS` (`shared/languages.ts`). Drives short glosses / generation language; saved with profile patch. |
| **Exam window** | Month, year (range), **early / mid / late** part; **IANA timezone** text field. |
| **Save profile** | `saveUserProfilePatch` + `saveExamTarget` → Firestore; **`onProfileSaved`** refreshes language in `MainTabs`. |
| **Sign out** | `signOutUser()` then `onClose()`. |

### Design direction (for your “design it really well” pass)

- **Information architecture:** Split **Account** (identity, sign out) vs **Study preferences** (language, exam) vs **Appearance** (theme) vs **About / legal** if needed.  
- **Navigation pattern:** Today the profile is a single modal sheet; alternatives include a **stack screen**, **half-sheet** with sections, or **settings list** pushing subpages — keep parity with how often users change each setting.  
- **Visual hierarchy:** Exam window + timezone are dense; consider stepped forms or collapsible sections.  
- **Entry points:** Top bar **Profile**; Today also passes **`onOpenProfile`** if you add inline entry later.  
- **Accessibility:** Large touch targets, clear focus order in modal, reduce nested `ScrollView` friction where possible.

---

## Theming & tokens

- **`ThemeProvider`** / **`useAppTheme()`** — `theme` includes both generic (`bg`, `text`, `primary`) and **learn** tokens (`learnScreenBg`, `learnAccent`, `learnGlass`, …).  
- **Today** leans on learn tokens inside `GlassScreenRoot`.  
- **Learn / Test** mix **Glass** components with the same theme.

---

## Related web parity

The **Vite** app under `src/` mirrors many flows (e.g. `SessionPage`, `LearnPage`, `TestPage`) using the same **`shared/`** modules where possible. Mobile-specific pieces: native auth, `SessionScreen` gestures, and Metro / EAS build config (`mobile/app.json`, `mobile/app.config.js`).

---

## Quick file index

| Area | Key files |
|------|-----------|
| App shell & tabs | `mobile/src/App.tsx` |
| Today | `mobile/src/screens/TodayScreen.tsx` |
| Session | `mobile/src/screens/SessionScreen.tsx` |
| Learn | `mobile/src/screens/LearnScreen.tsx`, `mobile/src/components/LearnFlashcardModal.tsx` |
| Test | `mobile/src/screens/TestScreen.tsx` |
| Profile | `mobile/src/components/ProfileSheet.tsx` |
| Session planning / quiz helpers | `shared/sessionPlanner.ts`, `shared/sessionQuiz.ts`, `shared/matchPhase.ts`, `shared/sessionOutcome.ts` |
| Vocab CRUD + session apply | `mobile/src/lib/vocab.ts` |
| User profile | `mobile/src/lib/userProfile.ts`, `shared/userProfile.ts` |

---

*Last updated to reflect the repo structure; adjust this doc when you change navigation or profile UX.*
