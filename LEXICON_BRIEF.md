# LEXICON — App Brief

## 1. What Lexicon is (brand + positioning)
- **One-sentence definition.**: Lexicon is a GMAT-verbal vocabulary system that lets you generate high-quality “word cards,” store them in a personal deck, and drill them through guided sessions, practice quizzes, and reading-in-context paragraphs (web: `src/pages/HomePage.tsx`, mobile: `mobile/src/screens/TodayScreen.tsx`, backend: `functions/src/index.ts`).
- **Core problem it solves (be specific about the user and the pain).**: For GMAT learners who keep encountering unfamiliar “academic-register” words but don’t retain them, Lexicon turns ad‑hoc lookups into a repeatable deck + practice loop where progress is tracked by a single exposure score that updates from actual study behavior (score logic: `shared/exposureScore.ts`, persistence updates: `src/lib/vocab.ts`, `mobile/src/lib/vocab.ts`).
- **Brand voice / tone.**: Exam-focused, serious, “tutor” voice in AI generation and quizzes (prompt copy explicitly enforces serious tone in `functions/src/index.ts`), with premium/academic marketing tone on the web landing (`src/pages/LandingPage.tsx`).
- **North-star outcome for the user.**: The user steadily converts “Learning” items into “Mastered” items (mastery threshold: `shared/exposureScore.ts`) by repeatedly seeing and being tested on their own deck in GMAT-like contexts (session selection: `shared/sessionPlanner.ts`, test selection: `src/pages/TestPage.tsx`, `mobile/src/screens/TestScreen.tsx`).

## 2. The user experience in one minute (core loop)
- **Daily/session loop (user view).**
  - Sign in (web routes: `src/pages/SignInPage.tsx`, `src/pages/SignUpPage.tsx`; mobile auth shell: `mobile/src/App.tsx`).
  - On **Today**, type a word/phrase and tap **Generate** to get a structured card; then **Save** it to your deck (web: `src/pages/HomePage.tsx`; mobile: `mobile/src/screens/TodayScreen.tsx`; save logic: `src/lib/words.ts`, `mobile/src/lib/words.ts`).
  - Tap **Start session** to run a guided daily flow on up to five learning words: Learn (swipe strong/weak) → Match → Quiz (MCQ) → Summary (web: `src/pages/SessionPage.tsx`; mobile: `mobile/src/screens/SessionScreen.tsx`; batch picking: `shared/sessionPlanner.ts`).
  - The app updates your streak + session count and pushes exposure score updates back into your word docs (streak/session count: `src/lib/userProfile.ts`, `mobile/src/lib/userProfile.ts`; exposure score updates: `src/lib/vocab.ts`, `mobile/src/lib/vocab.ts`).
  - In **Learn**, browse the deck (default emphasis on Learning), open flashcards, flag items, regenerate a card, or generate a paragraph from eligible words (web: `src/pages/LearnPage.tsx`; mobile: `mobile/src/screens/LearnScreen.tsx`).
  - In **Test**, pick a mode and question count, run a section, see explanations, and have each answer update exposure score (web: `src/pages/TestPage.tsx`; mobile: `mobile/src/screens/TestScreen.tsx`).
- **Secondary loops.**
  - **Streak**: increments when a full daily session completes; idempotent per day in user timezone (web: `src/lib/userProfile.ts`; mobile: `mobile/src/lib/userProfile.ts`; date logic: `shared/dateInTimezone.ts`).
  - **Spaced-ish prioritization** (not a full SRS): daily session selection prioritizes learning-only, “recently wrong,” low score, and long-unseen items (logic: `shared/sessionPlanner.ts`); paragraph selection prefers “seen before,” not too recent, and score near a center band (logic: `shared/paragraphPicker.ts`).
  - **Freemium gating (mobile)**: limits saved words and session starts/day for non-Pro; triggers paywall (limits: `shared/freemium.ts`; gating/checks: `mobile/src/App.tsx`, `mobile/src/screens/TodayScreen.tsx`).

## 3. Product goals
- **What success looks like (user behavior, not vanity metrics).**
  - The user repeatedly completes the full **session** flow (not just generating cards), since streak and “sessionCount” are tied to full completion (`recordDailySessionCompletion` and `applyStreakAfterSessionComplete` in `src/lib/userProfile.ts` / `mobile/src/lib/userProfile.ts`).
  - The user’s deck migrates from mostly exposureScore < 20 to exposureScore ≥ 20 (mastery threshold: `shared/exposureScore.ts`; UI uses that to label Learning/Mastered across web/mobile).
  - The user uses **Test** and sees explanations, which drives exposure score up/down based on correctness (`applyQuizAnswerExposure` in `src/lib/vocab.ts` / `mobile/src/lib/vocab.ts`).
- **Principles / constraints (what the app refuses to do).**
  - **No client-side AI secrets**: OpenAI calls are server-side only; clients call Functions with Firebase ID token (`functions/src/index.ts`, clients: `src/pages/*` fetch calls, `mobile/src/lib/api.ts`).
  - **No complex mastery model**: mastery is derived from a single integer score with fixed deltas (+1 shown, +2 correct, −1 wrong) and a single threshold (20) (`shared/exposureScore.ts`).
  - **No “AI conversation” product**: there is no chat UI and no conversation memory store in the repo; AI is used for content generation only (Functions endpoints in `functions/src/index.ts`).

## 4. App structure (front-end)
- **Tech stack (framework, router, state, styling, auth, database).**
  - **Web**: React + Vite (`package.json` scripts), React Router (`react-router-dom` in `package.json`, routing in `src/App.tsx`), Firebase Auth/Firestore (`src/lib/firebase.ts`, plus usage throughout `src/pages/*`), CSS via classnames + inline styles (e.g. `src/pages/HomePage.tsx`, `src/components/AppLayout.tsx`).
  - **Mobile**: Expo + React Native (`mobile/package.json`), in-file tab switching (not React Navigation tabs) inside `mobile/src/App.tsx`, Firebase Auth/Firestore client modules in `mobile/src/lib/*`, styling via RN styles + “glass” component system (`mobile/src/components/GlassUi.tsx`).
  - **Auth**: Firebase Auth (web: `src/lib/auth.ts` referenced from `src/pages/SignInPage.tsx`; mobile: `mobile/src/context/AuthContext` in `mobile/src/App.tsx`).
  - **Database**: Cloud Firestore (web: `src/lib/vocab.ts`, `src/lib/words.ts`, `src/lib/userProfile.ts`; mobile analogs in `mobile/src/lib/*`).
- **Entry/routing logic: which file decides what the user sees first.**
  - **Web**: `src/App.tsx` is the router switch; `/` is `src/pages/LandingPage.tsx`, and authenticated app routes are wrapped by `src/components/AppLayout.tsx`.
  - **Mobile**: `mobile/src/App.tsx` is the root shell. It gates between auth (`AuthNavigator`), onboarding (`mobile/src/onboarding/OnboardingFlow.tsx`), and the main tab UI (`MainTabs`).
- **Primary navigation: list every tab/screen with its file path and one-line purpose.**
  - **Mobile (bottom tabs via local state in `mobile/src/App.tsx`)**
    - `mobile/src/screens/TodayScreen.tsx`: Daily hub: generate + save cards, see deck counts, start session, show GMAT countdown from profile.
    - `mobile/src/screens/LearnScreen.tsx`: Deck browsing + filters + flashcards + paragraph generation + word actions; gateway to word stacks.
    - `mobile/src/screens/TestScreen.tsx`: Configure and run a practice quiz section powered by AI-generated questions.
  - **Web (top nav in `src/components/AppLayout.tsx`)**
    - `src/pages/HomePage.tsx` (route `APP_HOME` from `src/lib/routes`): Today hub for streak + session start + quick lookup/generate/save.
    - `src/pages/LearnPage.tsx` (`/learn`): Deck list + filters + study modal + paragraph generation (hover glossary) + actions.
    - `src/pages/TestPage.tsx` (`/test`): Practice section configuration + running flow + review; uses AI quiz endpoint.
    - `src/pages/MyWordsPage.tsx` (`/words`): Legacy-ish “My Words” list view (uses `listWords()` and shows `result.definitions?.[0]`).
- **Key flows outside main navigation (auth, onboarding, modals, etc.) with file paths.**
  - **Web**
    - Landing/marketing: `src/pages/LandingPage.tsx` (`/`)
    - Auth: `src/pages/SignInPage.tsx` (`/sign-in`), `src/pages/SignUpPage.tsx` (`/sign-up`)
    - Session (full-screen route, outside `AppLayout` wrapper): `src/pages/SessionPage.tsx` (`/session`)
    - Word detail: `src/pages/WordDetailPage.tsx` (`/words/:wordId`)
    - “How to Use?” modal: inside `src/components/AppLayout.tsx`
    - Legal: `src/pages/PrivacyPolicyPage.tsx`, `src/pages/TermsOfServicePage.tsx`
  - **Mobile**
    - Auth shell: `AuthNavigator` in `mobile/src/App.tsx` using `mobile/src/screens/WelcomeScreen.tsx`, `mobile/src/screens/SignInScreen.tsx`, `mobile/src/screens/SignUpScreen.tsx`
    - Onboarding: `mobile/src/onboarding/OnboardingFlow.tsx` (invoked from `PostAuthApp` in `mobile/src/App.tsx`)
    - Session overlay: `mobile/src/screens/SessionScreen.tsx` (opened by `sessionOpen` in `mobile/src/App.tsx`)
    - Profile modal: `mobile/src/components/ProfileSheet.tsx` (opened from `mobile/src/App.tsx`)
    - Learn flashcards modal: `mobile/src/components/LearnFlashcardModal.tsx` (opened from `mobile/src/screens/LearnScreen.tsx`)
    - Subscription paywall: `mobile/src/components/SubscriptionPaywall.tsx` (mounted in `mobile/src/App.tsx`)
    - Word stacks browse/detail: `mobile/src/screens/WordStackBrowseScreen.tsx`, `mobile/src/screens/WordStackDetailScreen.tsx`

## 5. Data model
- **Database**: Cloud Firestore (client paths are explicit in code; server uses Admin SDK reads for quiz generation).

### Stable (profile/settings)
- **`users/{uid}/settings/profile`**
  - **Schema/type**: `shared/userProfile.ts` (`UserProfileDoc`)
  - **Written/read by**:
    - Web: `src/lib/userProfile.ts` (`ensureUserProfileDefaults`, `saveUserProfilePatch`, streak/session updates)
    - Mobile: `mobile/src/lib/userProfile.ts` (same responsibilities + onboarding completion + freemium session starts)
  - **Fields that matter** (from `shared/userProfile.ts` + usage):
    - **`timezone`**: drives “today” boundary for streak and daily docs (`formatDateKeyInTimezone` / `getYesterdayKeyInTimezone` in `shared/dateInTimezone.ts` used by `src/lib/userProfile.ts` / `mobile/src/lib/userProfile.ts`).
    - **`mainLanguage`**: controls whether to show/store non-English short glosses (`shared/vocab.ts#getNativeGloss`, translations merge in `shared/vocab.ts#mergeTranslationsForSave`).
    - **`examDateIso` / `examTarget`**: exam countdown and planning (mobile countdown uses `shared/examDate.ts` in `mobile/src/screens/TodayScreen.tsx`).
    - **`onboardingCompletedAt` / `onboardingFirstStackId`**: mobile onboarding gate (`mobile/src/App.tsx`, `mobile/src/lib/userProfile.ts`).
    - **`streakCurrent` / `streakLongest` / `lastActiveDate`**: streak behavior (web: `src/lib/userProfile.ts`, mobile: `mobile/src/lib/userProfile.ts`).
    - **`sessionCount`**: lifetime completed sessions (incremented in `recordDailySessionCompletion` in web/mobile libs).

### Behavioral (raw logs)
- **`users/{uid}/daily/{dateKey}`**
  - **Schema/type**: `shared/userProfile.ts` (`DailyDoc`)
  - **Written/read by**:
    - Web: `src/lib/userProfile.ts#recordDailySessionCompletion` writes `sessionsCompleted[]`
    - Mobile: `mobile/src/lib/userProfile.ts` writes `sessionsCompleted[]` and increments `sessionStartsCount` for freemium gating
  - **Fields that matter**:
    - **`sessionsCompleted`**: arrayUnion of session ids (default `daily_vocab`)
    - **`sessionStartsCount`**: mobile-only gating counter (incremented by `mobile/src/lib/userProfile.ts#recordSessionStart`)

### Derived (computed)
- **N/A — derived state is computed on read from word docs + profile docs, not stored as separate collections.**

### AI memory (if any)
- **N/A — no persistent LLM “memory” store exists; prompts are stateless per request (`functions/src/index.ts`).**

### Conversation (if any)
- **N/A — no chat/conversation feature or storage exists in the repo.**

### Primary content (deck)
- **`users/{uid}/words/{wordId}`**
  - **Schema/type**:
    - Normalized UI shape: `shared/types.ts` (`VocabItem`)
    - Raw document normalization: `shared/vocab.ts#normalizeRawVocabDoc`
    - Web “word doc” write payload shape: `src/lib/types.ts` (`WordDoc`) referenced by `src/lib/words.ts` and `src/pages/WordDetailPage.tsx`
  - **Written/read by**:
    - Web: list/update transactions in `src/lib/vocab.ts`; create/update in `src/lib/words.ts`
    - Mobile: list/update transactions in `mobile/src/lib/vocab.ts`; create/update in `mobile/src/lib/words.ts`
    - Backend (read): quiz generation reads `users/{uid}/words/{id}` via Admin SDK (`functions/src/index.ts#handleGenerateQuiz`)
  - **Fields that matter** (as actually used by app logic):
    - **Identity + dedupe**: `text`, `textLower` (dedupe query in `src/lib/words.ts` / `mobile/src/lib/words.ts`)
    - **Card content**: `definition`, `simpleDefinition`, `examples` (two-sentence new shape), legacy `exampleSentence`, `synonyms`, `wordTags`, `contrastWord`, `nuanceNote`, `memoryHook`, optional `translations` (merge logic in `shared/vocab.ts`)
    - **Progress**: `exposureScore` + derived `status` (`learning`/`mastered`) (score and status rules: `shared/exposureScore.ts`; updated by transactions in `src/lib/vocab.ts` / `mobile/src/lib/vocab.ts`)
    - **Behavior hints**: `lastSeenAt`, `lastAnsweredAt`, `lastCorrect` (session batch picker uses `lastCorrect`, `lastAnsweredAt`, `lastSeenAt`: `shared/sessionPlanner.ts`)
    - **User actions**: `flagged` (used in deck stats: web `src/pages/HomePage.tsx`, mobile `mobile/src/screens/TodayScreen.tsx`)
    - **Source/stack**: `wordSource`, `stackId`, `stackPosition` exist in shared type (`shared/types.ts`) and are used by stack flows (mobile screens reference `stackId`; stack content is in `shared/wordStackContent.ts`).

## 6. Derived metrics / computed state (if any)
- **What gets computed from raw behavior.**
  - **Mastery/status**: `statusFromExposureScore(score)` maps exposureScore to `learning|mastered` at threshold 20 (`shared/exposureScore.ts`).
  - **Deck stats**: total/learning/mastered/flagged counts are computed from the current list of vocab items (web: `src/pages/HomePage.tsx#loadDeckStats`; mobile: `mobile/src/screens/TodayScreen.tsx#computeDashboardStats`).
  - **Paragraph eligibility**: derived from exposureScore and timestamps: must be learning-only, score > 0, and previously seen (`shared/paragraphPicker.ts`).
  - **Daily session batch**: derived selection from learning pool with priorities (recent wrong, lowest score/oldest, longest unseen) (`shared/sessionPlanner.ts`).
- **Where it’s stored, how it’s read by the UI, and how often it updates.**
  - Exposure score and status are **stored on each word doc** (`users/{uid}/words/{wordId}`) via Firestore transactions (`src/lib/vocab.ts`, `mobile/src/lib/vocab.ts`). Updates occur whenever the user:
    - views a flashcard / study exposure (`recordWordExposure`)
    - answers a quiz (`applyQuizAnswerExposure`)
    - completes a session batch (`applySessionBatchOutcome`)
    - successfully generates a paragraph (`applyParagraphExposure`)
  - Streak/session count are **stored on the profile doc** and updated after a full session completes (`applyStreakAfterSessionComplete`, `recordDailySessionCompletion` in `src/lib/userProfile.ts` / `mobile/src/lib/userProfile.ts`).
- **How it maps to anything the user actually sees.**
  - “Learning vs Mastered” labels and filters are driven by exposureScore compared to 20 (web: `src/pages/LearnPage.tsx`, `src/pages/HomePage.tsx`; mobile: `mobile/src/screens/LearnScreen.tsx`, `mobile/src/screens/TodayScreen.tsx`).
  - Session “batch of five” feels personalized because the picker uses wrong/recency/score (`shared/sessionPlanner.ts`).
  - Test questions target learning items first (web: `src/pages/TestPage.tsx`, mobile: `mobile/src/screens/TestScreen.tsx`).

## 7. AI / LLM behavior (if any)
- **What the AI does in this app (roles, entrypoints).**
  - **Generate card**: turns a user-entered word/phrase into a structured “tutor card” JSON (endpoint `/generate` in `functions/src/index.ts`; called from web `src/pages/HomePage.tsx`, `src/pages/LearnPage.tsx` regenerate, mobile `mobile/src/screens/TodayScreen.tsx`, `mobile/src/screens/LearnScreen.tsx` regenerate).
  - **Generate paragraph**: returns a paragraph split into text/target parts, guaranteeing each target is used exactly once for highlighting in UI (endpoint `/generateParagraph` in `functions/src/index.ts`; called from web `src/pages/LearnPage.tsx`, mobile `mobile/src/screens/LearnScreen.tsx`).
  - **Generate quiz**: returns multiple-choice questions (4 options + explanation) for a set of wordIds (endpoint `/generateQuiz` in `functions/src/index.ts`; called from web `src/pages/TestPage.tsx` and session prep `src/lib/quizClient.ts`, mobile `mobile/src/lib/api.ts` + test/session screens).
- **Front-end client wrapper: file path + what it calls.**
  - **Mobile**: `mobile/src/lib/api.ts` exports `generateWord`, `generateParagraph`, `generateQuiz`, and `fetchMeaningQuestionsForBatch`; it adds Firebase ID token in `Authorization: Bearer …` and calls `${baseUrl}/generate*`.
  - **Web**: web pages call fetch directly (e.g. `src/pages/HomePage.tsx` and `src/pages/LearnPage.tsx` call `${VITE_FUNCTIONS_BASE_URL}/generate` and `${VITE_FUNCTIONS_BASE_URL}/generateParagraph`), and `src/lib/quizClient.ts` wraps `/generateQuiz` for session prep.
- **Backend function(s): file path + what they do step by step.**
  - **Single router function**: `functions/src/index.ts` exports `api = onRequest(...)` which:
    - sets CORS headers (`corsHeaders`)
    - handles OPTIONS
    - requires POST
    - extracts bearer token (`getBearerToken`)
    - verifies token with Admin SDK (`admin.auth().verifyIdToken`)
    - routes by `req.url` prefix:
      - `/generate` → `handleGenerate(body, ipKey, res)`
      - `/generateParagraph` → `handleGenerateParagraph(body, uid, res)`
      - `/generateQuiz` → `handleGenerateQuiz(body, uid, res)`
- **Prompt structure: exact section headers the model sees, and the rules the prompt enforces.**
  - There are **no literal “section headers”**; prompts are plain text blocks assembled as strings in `functions/src/index.ts`. The highest-signal “headers/rules” (verbatim-leading lines) are:
    - **`/generate`** prompt starts with:
      - `You are a GMAT verbal tutor.`
      - `Return a single JSON object ONLY (no markdown, no code fences) with exactly these keys:`
      - A line-by-line required schema for: `definition`, `simpleDefinition`, `examples` (exactly two), `synonyms`, `wordTags` (allowlist), `contrastWord`, `nuanceNote`, `memoryHook`, plus conditional `translationSimple`.
      - Language rule block (`langLine`) that enforces English for most fields and optionally adds a short native-language gloss.
      - Term metadata lines: `Term: ...`, `Term type: ...`
      - Output validation is enforced server-side by `validateGeneratedResult` in `shared/wordGeneration.ts`.
    - **`/generateParagraph`** prompt includes:
      - `Write ONE coherent, formal paragraph (about 80-140 words).`
      - `You MUST use each target exactly once, spelled exactly as provided...`
      - `CRITICAL: Targets must appear ONLY as {"kind":"target","text":"..."} parts...`
      - Required JSON shape: `{"parts":[{"kind":"text","value":"..."},{"kind":"target","text":"<exact target>"}...]}`
      - Then a numbered “Targets” list.
      - The server validates structure with `isValidParagraphResponse`, target counts, and “no target inside text parts” checks.
    - **`/generateQuiz`** prompt includes:
      - `OUTPUT: Return JSON ONLY. No markdown, no code fences, no commentary...`
      - `Shape: {"questions":[{"itemId":"string",...}]}`
      - `GLOBAL RULES:` bullet list enforcing serious academic tone, exactly four options, one unambiguously correct, explanation requirements, and order alignment with input items.
      - A mode block (“MODE: context” or “MODE: verbal”) which changes stem guidance.
      - Then a numbered list of `ITEMS` with `id`, `text`, and `definition` reference.
- **Model, token budget, cost notes.**
  - Models are configured by environment variables with fallbacks in `functions/src/index.ts`:
    - `/generate`: `OPENAI_GENERATE_MODEL` default `'gpt-4.1'`, `max_output_tokens: 600`.
    - `/generateParagraph`: `OPENAI_MODEL` default `'gpt-4.1-mini'`, `max_output_tokens: 700`.
    - `/generateQuiz`: `OPENAI_MODEL` default `'gpt-4.1-mini'`, `max_output_tokens: 2200`.
  - Cost is **not computed or logged** in this repo (no billing instrumentation in `functions/src/index.ts`).
- **How conversation history / memory is stored and trimmed.**
  - N/A — each request is single-turn; no conversation history is stored or passed.

## 8. What’s implemented vs what’s aimed at
- **Implemented today (what actually works in the repo right now).**
  - Web app with landing + auth + Today/Learn/Test + Session flows (`src/App.tsx`, `src/pages/*`).
  - Mobile Expo app with Today/Learn/Test tabs, full-screen session overlay, onboarding gate, profile sheet, and paywall wiring (`mobile/src/App.tsx` + `mobile/src/screens/*` + `mobile/src/components/*`).
  - Firestore-backed deck storage and exposure score progression with transactions (`src/lib/vocab.ts`, `mobile/src/lib/vocab.ts`, score rules in `shared/exposureScore.ts`).
  - AI-backed generation endpoints for cards, paragraphs, and quizzes via a single Firebase Functions router (`functions/src/index.ts`), with server-side validation for `/generate` (`shared/wordGeneration.ts`).
  - Word stacks content and access control for freemium vs pro (catalog/limits: `shared/freemium.ts`; word lists: `shared/wordStackContent.ts`; mobile stack screens: `mobile/src/screens/WordStackBrowseScreen.tsx`, `mobile/src/screens/WordStackDetailScreen.tsx`).
- **Known broken / messy areas (be honest about what’s half-done or architecturally weak).**
  - **Duplicate “word doc” concepts**: web has both a newer normalized deck surface (`listVocabItems` in `src/lib/vocab.ts` returning `VocabItem`) and a more direct “WordDoc” listing (`listWords` in `src/lib/words.ts`, used by `src/pages/MyWordsPage.tsx`) that still expects legacy `result.definitions?.[0]`. This is a real schema drift risk: the newer generator schema focuses on `examples` and `simpleDefinition`, while `definitions` is described as legacy (`shared/types.ts`, `shared/wordGeneration.ts`).
  - **Session outcome ignores swipe strength** for exposure score: swipe is collected and used for ordering quiz questions (`shared/sessionQuiz.ts` used in `src/pages/SessionPage.tsx` / `mobile/src/screens/SessionScreen.tsx`), but the Firestore write delta during `applySessionBatchOutcome` is MCQ-only (`src/lib/vocab.ts`, `mobile/src/lib/vocab.ts`). If the product intent was “swipe affects mastery,” it currently does not.
  - **Web vs mobile nav is structurally different**: web uses React Router routes; mobile uses local state tabs, so “deep links” and history behaviors are not symmetrical (web: `src/App.tsx`, mobile: `mobile/src/App.tsx`).
  - **Freemium enforcement is primarily mobile**: saved-word/session-start gating is implemented in mobile UX (`mobile/src/screens/TodayScreen.tsx`, `mobile/src/App.tsx`), but the web UI does not show the same gating logic in the files reviewed (web generation and save paths in `src/pages/HomePage.tsx` / `src/lib/words.ts`).
- **Contradictions between code and docs (flag explicitly).**
  - `APPLICATION_OVERVIEW.md` claims “No gamification fluff” in landing copy (`src/pages/LandingPage.tsx`), but **streak** is implemented and shown (web `src/pages/HomePage.tsx`, mobile profile + session completion in `src/lib/userProfile.ts` / `mobile/src/lib/userProfile.ts`). This is a positioning contradiction, not a code bug.
  - `APPLICATION_OVERVIEW.md` describes mobile Learn filters including “Flagged / Do Not Know / Phrases” (see that doc’s “How to use” section), but current `mobile/src/screens/LearnScreen.tsx` defines only `all|learning|mastered` pills. (This may be historical drift.)
- **Near-term direction (next logical steps, not a wishlist).**
  - Consolidate on **one canonical Firestore word schema** and remove/modernize the legacy “My Words” surface (`src/pages/MyWordsPage.tsx`) or update it to use normalized fields from `shared/types.ts`.
  - Decide whether swipe signals should affect exposure score or remain only a quiz-ordering hint; if they should matter, the only current persisted updates are MCQ deltas (`applySessionBatchOutcome`).
  - Unify freemium enforcement across clients (web vs mobile) or explicitly document that web is “unrestricted” in product terms; today the limit constants exist (`shared/freemium.ts`) but enforcement in reviewed code is mostly mobile.

## 9. Glossary
- **Exposure score**: Integer progress counter per word; updated by +1 shown, +2 correct, −1 wrong; floors at 0 (`shared/exposureScore.ts`).
- **Learning / Mastered**: Status derived from exposure score; mastered is score ≥ 20 (`shared/exposureScore.ts`).
- **Daily session**: Guided practice run over up to five learning items (web: `src/pages/SessionPage.tsx`; mobile: `mobile/src/screens/SessionScreen.tsx`; picker: `shared/sessionPlanner.ts`).
- **Match phase**: Session step where the user matches words to short glosses (shared helper: `shared/matchPhase.ts`, consumed by session screens).
- **MCQ**: Multiple-choice quiz questions with four options + explanation; generated by `/generateQuiz` (`functions/src/index.ts`) and consumed by `Test` + session quiz phases.
- **Paragraph practice**: AI-generated paragraph split into text/target parts so the UI can highlight target words/phrases; generated by `/generateParagraph` (`functions/src/index.ts`).
- **Word stack**: Curated bundle of vocabulary items defined in code, not in Firestore; catalog in `shared/freemium.ts` and word lists in `shared/wordStackContent.ts`; mobile screens under `mobile/src/screens/WordStack*`.
- **Main language**: User preference controlling whether the app stores a short native-language gloss per word in `translations[lang]` (`shared/vocab.ts`).
- **Profile doc**: Firestore doc `users/{uid}/settings/profile` containing timezone, exam date, onboarding, streak, and sessionCount (`shared/userProfile.ts`).
- **Daily doc**: Firestore doc `users/{uid}/daily/{YYYY-MM-DD}` containing daily completion and (mobile) session start count (`shared/userProfile.ts`).

## 10. Repo map
- **`src/` (Web app)**
  - **Routing**: `src/App.tsx`
  - **Layout + nav + “How to Use” modal**: `src/components/AppLayout.tsx`
  - **Pages**: `src/pages/*.tsx` (Today: `HomePage.tsx`; Learn: `LearnPage.tsx`; Test: `TestPage.tsx`; Session: `SessionPage.tsx`; Words: `MyWordsPage.tsx`, `WordDetailPage.tsx`; marketing/auth/legal pages also here)
  - **Firestore + auth client logic**: `src/lib/firebase.ts`, `src/lib/vocab.ts`, `src/lib/words.ts`, `src/lib/userProfile.ts`, `src/lib/auth.ts`
- **`mobile/` (Expo mobile app)**
  - **App shell + navigation + gating**: `mobile/src/App.tsx`
  - **Screens**: `mobile/src/screens/*.tsx` (Today/Learn/Test/Session + auth + word stacks)
  - **Components (modals/sheets/cards)**: `mobile/src/components/*` (e.g. `ProfileSheet.tsx`, `LearnFlashcardModal.tsx`, `VocabWordCardContent.tsx`, `SubscriptionPaywall.tsx`)
  - **Context providers**: `mobile/src/context/*` (auth, subscription, theme)
  - **Firestore/API libs**: `mobile/src/lib/api.ts`, `mobile/src/lib/vocab.ts`, `mobile/src/lib/words.ts`, `mobile/src/lib/userProfile.ts`
  - **Onboarding**: `mobile/src/onboarding/*`
- **`functions/` (Firebase Cloud Functions)**
  - **Single HTTPS API router**: `functions/src/index.ts` (routes `/generate`, `/generateParagraph`, `/generateQuiz`)
  - **Config**: `functions/package.json`, `functions/tsconfig.json`
- **`shared/` (shared logic + types)**
  - **Types/schemas**: `shared/types.ts`, `shared/userProfile.ts`
  - **Normalization + helpers**: `shared/vocab.ts`, `shared/wordGeneration.ts`, `shared/exposureScore.ts`
  - **Session & quiz logic**: `shared/sessionPlanner.ts`, `shared/sessionQuiz.ts`, `shared/sessionOutcome.ts`, `shared/matchPhase.ts`, `shared/quizShuffle.ts`
  - **Word stacks and freemium**: `shared/wordStackContent.ts`, `shared/freemium.ts`
- **Docs**
  - High-level overview (existing): `APPLICATION_OVERVIEW.md`
  - User + developer docs: `README.md`, `README-DEV.md`

## 11. How to explain Lexicon to another LLM
- Lexicon is a GMAT vocab deck app where each word has an `exposureScore` stored in Firestore (`users/{uid}/words/*`) and “mastery” is score ≥ 20 (`shared/exposureScore.ts`).
- Users add words by calling a backend `/generate` endpoint (Firebase Function) that uses OpenAI to return a strict JSON “tutor card” validated server-side (`functions/src/index.ts`, `shared/wordGeneration.ts`), then save it to Firestore (`src/lib/words.ts`, `mobile/src/lib/words.ts`).
- The core practice loop is a daily session over up to five learning items: swipe learn → match → MCQ quiz, then apply score deltas and update streak (`shared/sessionPlanner.ts`, session screens, `src/lib/vocab.ts`, `src/lib/userProfile.ts`).
- AI is used only for content generation (cards, paragraphs, quizzes); there is no chat/memory system (all endpoints in `functions/src/index.ts` are stateless per request).

## 12. Honest self-assessment (CRITICAL — do not skip)
- **What’s the single weakest part of Lexicon architecturally right now?**
  - The app has **two parallel representations** of “a word” (normalized `VocabItem` and legacy-ish `WordDoc` usage), plus back-compat fields that still surface in UI (`src/pages/MyWordsPage.tsx` expects `result.definitions?.[0]` while new generation schema emphasizes `examples` + `simpleDefinition`). This increases drift risk across web/mobile/functions (`shared/types.ts`, `src/lib/words.ts`, `shared/vocab.ts`).
- **What’s the single weakest part of Lexicon as a product (user-facing)?**
  - Progress/memory model is intentionally thin (one score and threshold), but the UX implies richer pedagogy (swipe strength, match phase) while only MCQ correctness directly changes score in sessions (`applySessionBatchOutcome` in `src/lib/vocab.ts` / `mobile/src/lib/vocab.ts`). That mismatch can confuse “what matters” to the user.
- **Which features exist because the user needs them vs because they were fun to build?**
  - **User-need driven**: generate/save cards (`/generate`), daily session, test mode, and exposure score tracking (core learning loop across `shared/exposureScore.ts`, session/test screens).
  - **Likely “fun to build” / optional** (based on code emphasis, not intent claims): paragraph generator with strict part-structuring and hover/highlight UX (`/generateParagraph` + UI in web/mobile Learn), and the word stacks catalog (`shared/wordStackContent.ts` + stack screens).
- **If forced to delete 50% of the codebase, what would survive?**
  - The shared types + scoring/session pickers (`shared/types.ts`, `shared/exposureScore.ts`, `shared/sessionPlanner.ts`, `shared/vocab.ts`), the Functions endpoints (`functions/src/index.ts`), and one client implementation (mobile or web) for Today/Learn/Test/Session plus Firestore persistence (`mobile/src/screens/*` + `mobile/src/lib/*` or `src/pages/*` + `src/lib/*`). The marketing landing, duplicate word listing (`MyWordsPage`), and stack flows are the first candidates to cut because they are not required for the core “generate → save → drill → update score” loop.

