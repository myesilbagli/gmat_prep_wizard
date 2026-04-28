# Session structure (Daily vocab + MCQs)

This document describes how a **daily study session** is built in the mobile app: how words are selected, what each **intro card** shows before MCQs, how MCQs are generated, and what is persisted back to Firestore.

## High-level flow (mobile)

- **Entry point**: `mobile/src/App.tsx` opens `SessionScreen` (modal) when the user starts a session.
- **Session implementation**: `mobile/src/screens/SessionScreen.tsx`

### Phases

`SessionScreen` runs a small state machine:

- **`loading`**: initial fetch/setup (not shown long in UI; internal).
- **`intro`**: intro cards for **every word in session order** (one screen per word, then MCQs).
- **`mcq`**: multiple-choice questions for all words in the session batch.
- **`summary`**: deck movement + promotions + streak.
- **`empty`**: shown when there aren’t enough eligible words.

## Word selection (batch composition)

### Data source

`SessionScreen` loads the full user deck via:

- `listVocabItems()` (mobile Firestore fetch) from `mobile/src/lib/vocab.ts`

### Picker (mobile)

The mobile daily batch (up to **10** words, caps **2 / 5 / 2 / 1** for new / learning / familiar / review) is picked by:

- `pickSessionBatchTen(allItems, { nowMs, userTimezone })` from `shared/sessionPlanner.ts`

(Web and other callers may still use `pickSessionBatchTwelve` until migrated.)

It returns:

- **`ids`**: ordered list of word ids for this session (all “new” items first)
- **`slots`**: list of `{ id, role }`, where role is one of:
  - `new` | `learning` | `familiar` | `review`

The UI also shows a composition preview string like:

- `formatSessionBatchComposition(slots)` → e.g. `"2 new · 5 learning · 2 familiar · 1 review"` (exact counts depend on deck and caps)

### Ordering

`SessionScreen` builds an ordered batch array by mapping the chosen ids back to the full deck map:

- `const ordered: VocabItem[] = pick.ids.map(id => byIdAll.get(id)).filter(Boolean)`

## Intro cards (before MCQs)

`SessionScreen` walks **all** session ids in picker order:

- `introIds = [...pick.ids]`
- `introRoleById = Map` from `pick.slots` (`id` → `role`)

Phase always starts at **`intro`** (even if the batch is smaller than 10 words).

### What fields are shown to the user

The intro UI is `SessionIntroCard` in `mobile/src/components/SessionIntroCard.tsx`.

For the current word (`word: VocabItem`), it shows (omitting empty sections):

- **Bucket pill** for the session slot role (`BucketPill` + `getBucketColors` from `mobile/src/theme/bucketColors.ts`)
- **Word text**: `word.text`
- **Part of speech** (optional): `word.partOfSpeech`
- **Simple definition** (optional): trimmed `simpleDefinition`
- **Full definition** (optional): `definition`
- **Example** (optional): first of `examples[0]` or `exampleSentence`
- **Contrast** (optional): both `contrastWord.word` and `contrastWord.explanation`
- **Memory hook** (optional): `memoryHook`

Synonyms, nuance, tags, and translations are **not** shown here; they remain in `VocabWordCardContent` / learn flows.

### What is persisted when user taps “Got it”

On “Got it”, `SessionScreen` calls `markWordIntroduced(word.id)` **only when** the slot role is **`new`** (so familiar/review/learning intros do not write `lastIntroducedAt`).

For those **new** slots, this sets `lastIntroducedAt` on the word doc before quizzing.

## MCQs (Meaning / context questions)

### Generation source

MCQs are fetched from the backend:

- `fetchMeaningQuestionsForBatch(itemIds)` in `mobile/src/lib/api.ts`
  - internally calls `POST /generateQuiz` via `generateQuiz(itemIds, 'context', count)`

The expected MCQ shape is:

- `QuizQuestion` (`shared/types.ts`)
  - `itemId`
  - `questionText`
  - `options` (4 strings)
  - `correctIndex` (0–3)
  - `explanation`

### Client-side shuffling

After fetch, the client shuffles answer options so the correct answer isn’t always index 0:

- `shuffleQuizQuestions(raw)` from `shared/quizShuffle.ts`

### Ordering of questions

The app expects the backend returns one question per requested id.

`SessionScreen` reorders fetched questions to match the original session order:

- build `byId` map from questions
- `orderedQs = pickIds.map(id => byId.get(id)).filter(Boolean)`

### Answering + feedback

For each question:

- user picks an option → app enters **feedback** state
- app records correctness in `mcqCorrectById: Map<itemId, boolean>`

The feedback view shows:

- correctness banner (“Correct” / “Not quite”)
- the explanation: `question.explanation`

## What gets saved at the end of the session

When the last MCQ finishes, `SessionScreen` calls `finishSession()`.

It creates outcomes per word:

- `SessionWordOutcome` includes:
  - `id`
  - `swipe` (currently hard-coded to `'strong'` in `SessionScreen`)
  - `mcqCorrect` (from `mcqCorrectById`)

Then it persists:

- `applySessionBatchOutcome(itemsById, outcomes)` (updates words’ learning/exposure fields)
- `applyStreakAfterSessionComplete()` (updates streak fields in the profile)
- `recordDailySessionCompletion('daily_vocab')` (tracks completed session id in `users/{uid}/daily/{YYYY-MM-DD}`)

Finally it reloads the full deck again (`listVocabItems()`) to compute:

- deck bucket counts **before vs after**
- “promotions” list (words that moved to a higher bucket)

## What word data exists (VocabItem fields)

The word object used across session/learn is `VocabItem` from `shared/types.ts`. Key content fields relevant to “what we show”:

- **Core text**: `text`, `type`, `partOfSpeech?`
- **Meanings**: `simpleDefinition`, `definition`
- **Examples**: `examples?` (preferred, exactly 2 for new generates), legacy `exampleSentence?`
- **Synonyms**: `synonyms`
- **Tags**: `wordTags?`
- **Contrast**: `contrastWord? { word, explanation }`
- **Memory**: `memoryHook?`
- **Nuance**: `nuanceNote?`
- **Translations**: `translations?` (native gloss surfaced via `getNativeGloss`)

The learn/flashcard UI that shows most of these is:

- `mobile/src/components/VocabWordCardContent.tsx`
- `mobile/src/components/LearnFlashcardModal.tsx`

## Related paywall gating (session starts)

Daily sessions can be paywalled by a “starts per day” cap when not Pro:

- `FREE_MAX_SESSION_STARTS_PER_DAY` in `shared/freemium.ts`
- check is performed in `mobile/src/App.tsx` before opening `SessionScreen`

