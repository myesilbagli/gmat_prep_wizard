# Word tracking & stack structure

A reference for how words live in the app today and how stacks become words on a user's account. Written as the foundation for an upcoming **"I know this"** feature — the closing section maps the seams where that feature will plug in, but does not design it.

Cross-references:
- [`docs/SESSION_STRUCTURE.md`](./SESSION_STRUCTURE.md) — daily session flow on top of these primitives
- [`docs/USER_JOURNEY_AND_LEARNING.md`](./USER_JOURNEY_AND_LEARNING.md) — learner-facing narrative
- [`docs/MOBILE_APP_STRUCTURE.md`](./MOBILE_APP_STRUCTURE.md) — overall app map

---

## 1. TL;DR

- Every saved word is a Firestore document at `users/{uid}/words/{wordId}`.
- A word's **lifecycle** is driven by a single integer: `exposureScore`. Other state (`status`, the four-bucket UI label, what shows up in a session) is **derived** from it.
- A **curated stack** is a static TS module (`shared/stacks/<id>.ts`) exporting `STACK_PACK` — an array of pre-generated word cards. The catalog of seven stacks is `CANONICAL_STACK_ORDER` in `shared/canonicalStacks.ts`.
- A **user stack** (the lower-case "my stacks" feature) is a separate concept: a user-created folder, stored at `users/{uid}/myStacks/{stackId}`, referenced from words via the `userStackIds` array.
- **Importing a stack** = looping over `STACK_WORDS_BY_ID[stackId]` and calling `saveWordFromStackImport` once per row. There is no batch path. Each call resolves the cached `GeneratedResult`, optionally injects a native-language gloss, and writes a fresh word doc with `exposureScore: 0, status: 'learning'`.
- Words with `bucketFromWord(w) === 'mastered'` are still session-eligible (as `'review'` after ≥10 days unseen). The session planner does **not** read any "I know this" flag today — that's why the new feature has to add one.

---

## 2. Where data lives

### Firestore layout

```
users/{uid}/
├── words/{wordId}                ← every saved word, the unit we care about
├── myStacks/{stackId}            ← user-created folders ("my stacks")
├── settings/{document=**}        ← user profile, preferences
└── daily/{YYYY-MM-DD}            ← per-day session snapshots
```

### Security rules

Defined in `firestore.rules`:

```1:24:firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/words/{wordId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/settings/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/daily/{dateKey} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/myStacks/{stackId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

A user can only read/write their own subtree. Curated stack content does **not** live in Firestore — it's bundled into the app binary as TS modules (see §5).

---

## 3. The word document

Defined as `VocabItem` in `shared/types.ts`:

```56:105:shared/types.ts
export type VocabItem = {
  id: string
  text: string
  textLower?: string
  type: 'word' | 'phrase'
  definition: string
  simpleDefinition: string
  /** New shape: two sentences. */
  examples?: string[]
  /** @deprecated Old docs only. */
  exampleSentence?: string
  synonyms: string[]
  wordTags?: string[]
  contrastWord?: ContrastWord
  nuanceNote?: string
  memoryHook?: string
  /** @deprecated Old docs only. */
  gmatUsageNote?: string
  /** From generated cards; optional on legacy docs. */
  partOfSpeech?: PartOfSpeech | string
  /** Short meanings keyed by main language code (e.g. `tr`); English stays in `definition` / `simpleDefinition`. */
  translations?: Record<string, string>
  status: VocabStatus
  flagged: boolean
  /** Weighted exposure count; drives `status` with `MASTERED_MIN_SCORE` in exposureScore.ts */
  exposureScore: number
  /** YYYY-MM-DD (user timezone) when MCQ was answered correctly; deduped ascending */
  correctDaysCount?: string[]
  /** Set when user completes intro in session; null/omit = not introduced */
  lastIntroducedAt?: unknown | null
  /** Total exposures (legacy); optional on old docs */
  seenCount?: number
  /** Legacy session fields; optional */
  meaningQuizStreak?: number
  lastSessionSwipe?: 'weak' | 'strong'
  /** When the word was last shown in any surface */
  lastSeenAt?: unknown
  /** When the user last answered a quiz (session MCQ, test, etc.) */
  lastAnsweredAt?: unknown
  /** Whether the most recent quiz answer was correct */
  lastCorrect?: boolean | null
  /** Where the word was first saved */
  wordSource?: WordSource
  stackId?: string | null
  stackPosition?: number | null
  /** User-created stack membership; canonical `stackId` is separate. */
  userStackIds?: string[]
  createdAt?: unknown
  updatedAt?: unknown
}
```

### Field groups

| Group | Fields | Notes |
|---|---|---|
| **Identity / content** | `id`, `text`, `textLower`, `type`, `definition`, `simpleDefinition`, `examples[]`, `synonyms[]`, `partOfSpeech`, `nuanceNote`, `memoryHook`, `contrastWord`, `wordTags[]`, `translations` | The card payload. `result` (raw `GeneratedResult`) is also nested for backward compatibility. |
| **Learning state** | `exposureScore`, `status`, `correctDaysCount[]`, `lastIntroducedAt`, `lastSeenAt`, `lastAnsweredAt`, `lastCorrect`, `seenCount`, `meaningQuizStreak`, `lastSessionSwipe` | Driven by the deltas in §4. `seenCount`/`meaningQuizStreak`/`lastSessionSwipe` are legacy and not read by the modern planner. |
| **User intent** | `flagged: boolean`, `tags: string[]` | `flagged` is wired to a star toggle (`toggleVocabFlagged`). `tags` is **persisted but currently unused** — see §9. |
| **Provenance** | `wordSource` (`'lookup' \| 'word_stack' \| 'onboarding'`), `stackId`, `stackPosition`, `userStackIds[]` | `stackId`/`stackPosition` are the *canonical* origin (e.g. `stack_arg_architecture`, position 12). `userStackIds[]` is the user's folder membership. |
| **Bookkeeping** | `createdAt`, `updatedAt` | `serverTimestamp()` on write. |

### Reading the doc back

Raw Firestore data is normalized through `normalizeRawVocabDoc(id, data)` in `shared/vocab.ts`. This function:

- Rebuilds `definition`, `simpleDefinition`, `examples`, etc. from either top-level fields or the nested `result` blob (handles older docs).
- Recomputes `exposureScore` from legacy `seenCount` + `status` if the field is missing.
- Always derives `status` via `statusFromExposureScore(exposureScore)` — so `status` on the wire is informational; the integer is source of truth.
- Filters `translations` to non-empty string values.
- Coerces `userStackIds` to a clean string array.

If you ever read a word elsewhere (script, function, screen), route it through `normalizeRawVocabDoc` so legacy docs behave the same as new ones.

---

## 4. Lifecycle: how a word's state changes

### The single number that matters

`exposureScore: number` is a non-negative integer that grows as the user interacts with a word.

```1:17:shared/exposureScore.ts
import type { VocabStatus } from './types'

/** Score at or above this value is stored as `mastered`. */
export const MASTERED_MIN_SCORE = 20

export const DELTA_SHOWN = 1
export const DELTA_QUIZ_CORRECT = 2
export const DELTA_QUIZ_WRONG = -1
export const MIN_SCORE = 0

export function applyDelta(current: number, delta: number): number {
  return Math.max(MIN_SCORE, current + delta)
}

export function statusFromExposureScore(score: number): VocabStatus {
  return score >= MASTERED_MIN_SCORE ? 'mastered' : 'learning'
}
```

### Where the deltas come from

Each is implemented as a transactional update in `mobile/src/lib/vocab.ts`:

| Trigger | Function | Δ exposure | Side effects |
|---|---|---|---|
| Flashcard / passive view | `recordWordExposure` | +1 | `lastSeenAt` |
| Session intro completed (first time per session) | `markWordIntroduced` | +1 | `lastIntroducedAt`, `lastSeenAt` |
| Test screen MCQ — correct | `applyQuizAnswerExposure(_, true)` | +2 | `lastAnsweredAt`, `lastCorrect=true`, `lastSeenAt`, push to `correctDaysCount` |
| Test screen MCQ — wrong | `applyQuizAnswerExposure(_, false)` | −1 (floor 0) | `lastAnsweredAt`, `lastCorrect=false`, `lastSeenAt` |
| Reading paragraph generation success | `applyParagraphExposure([ids])` | +1 each | `lastSeenAt` |
| End-of-session MCQ batch | `applySessionBatchOutcome(map, outcomes[])` | +2/−1 per word | same as above, also pushes correct days |

Note: in the daily session, the **swipe** does not change exposure — only the **MCQ** answer does (`applySessionBatchOutcome`).

### `status` (persisted, two values)

```42:42:shared/types.ts
export type VocabStatus = 'learning' | 'mastered'
```

Computed every write by `statusFromExposureScore`: `≥20 → 'mastered'`, else `'learning'`. It exists mainly so old code paths and indexes can filter without recomputing.

### Bucket (UI label, four values, **not persisted**)

`bucketFromWord(w)` in `shared/learningBuckets.ts` is the labeling used by Today, the deck filters, and the session planner:

```12:21:shared/learningBuckets.ts
function hasIntroducedAt(w: VocabItem): boolean {
  return w.lastIntroducedAt != null
}

export function bucketFromWord(w: VocabItem): LearningBucket {
  if (w.exposureScore === 0 && !hasIntroducedAt(w)) return 'new'
  if (w.exposureScore >= 26 && (w.correctDaysCount?.length ?? 0) >= 3) return 'mastered'
  if (w.exposureScore >= 11) return 'familiar'
  return 'learning'
}
```

So a word's bucket transitions look like:

```
new (score 0, never introduced)
  └─ first session intro → +1 → learning (1 ≤ score ≤ 10)
       └─ correct MCQs/exposures push score up
            ├─ score ≥ 11   → familiar
            └─ score ≥ 26 AND correct on ≥3 distinct days → mastered
```

`status === 'mastered'` (score ≥ 20) and `bucket === 'mastered'` (score ≥ 26 AND 3+ correct days) are **different thresholds**. A word at score 22 is `status='mastered'` but bucket-wise still `'familiar'`. The bucket is a stricter, UX-friendly idea ("genuinely owned"); the status is a coarser DB filter.

---

## 5. Curated stacks (the seven shipped packs)

### Catalog

The seven stacks ship with the app, ordered:

```5:41:shared/canonicalStacks.ts
export const CANONICAL_STACK_ORDER = [
  {
    id: 'stack_arg_architecture',
    title: 'The Argument Architecture Lexicon',
    description: 'Connectors, evidence, and argument-move vocabulary.',
  },
  {
    id: 'stack_academic_register',
    title: 'Academic Register Essentials',
    description: 'Dense academic phrasing and journal-style usage.',
  },
  {
    id: 'stack_discriminator',
    title: 'The Near-Synonym Discriminator — Sorted by Difficulty',
    description: 'Fine-grained verbal distinctions by difficulty band.',
  },
  {
    id: 'stack_tone_stance',
    title: 'Attitude, Tone & Author Stance',
    description: 'Tone, stance, and rhetorical posture.',
  },
  {
    id: 'stack_business_policy',
    title: 'Business, Economics & Policy Terrain',
    description: 'Markets, policy, and institutional vocabulary.',
  },
  {
    id: 'stack_science',
    title: 'Science & Natural-World Passages',
    description: 'Scientific reasoning and nature-passage wording.',
  },
  {
    id: 'stack_advanced_reserve',
    title: 'The Advanced & Literary Reserve',
    description: 'Rare, literary, and high-difficulty lexicon.',
  },
] as const
```

### Stack content modules

For each canonical id there's a TS module at `shared/stacks/<id>.ts`. After running `npm run promote:stacks`, each module exports `STACK_PACK: readonly StackPackRow[]`:

```5:18:shared/stackPackTypes.ts
export type StackLevelBand = 'foundation' | 'intermediate' | 'advanced'

/** One row after LLM generation + promotion (production TS). */
export type StackPackRow = {
  text: string
  stackPosition: number
  level: StackLevelBand
  result: GeneratedResult
  /**
   * Optional curated short glosses keyed by main language code (e.g. `tr`, `fr`, `es`).
   * Mirrors the runtime shape of `VocabItem.translations`. When a user imports this row
   * with a matching `mainLanguage`, the value is copied into `result.translationSimple`
   * so `mergeTranslationsForSave` persists `translations[lang]` on their word doc.
   */
  translations?: Record<string, string>
}
```

So a row carries: the word string (`text`), its 0-indexed position in the pack (`stackPosition`), a difficulty band, the full pre-generated card (`result: GeneratedResult` — same shape the LLM returns for `/generate`), and optional curated translations.

### Resolver: stack row → import payload

`shared/wordStackContent.ts` aggregates all seven modules and exposes two helpers:

- `STACK_WORDS_BY_ID[stackId]` / `getWordsForStack(stackId)` → just the list of word strings (used to render the catalog).
- `getStackImportResult(stackId, stackPosition, mainLanguage?)` → the `GeneratedResult` to write, with the curated native gloss spliced into `result.translationSimple` when applicable:

```50:66:shared/wordStackContent.ts
/** Resolved card for Firestore when importing from a stack row. */
export function getStackImportResult(
  stackId: string,
  stackPosition: number,
  mainLanguage?: string,
): GeneratedResult {
  const mod = MODULES[stackId]
  const row = mod?.STACK_PACK?.find((r) => r.stackPosition === stackPosition)
  const base = row?.result ?? stackImportPlaceholderResult()
  if (!row || !mainLanguage) return base
  const lang = normalizeMainLanguageCode(mainLanguage)
  if (lang === 'en') return base
  const gloss = row.translations?.[lang]
  if (typeof gloss !== 'string' || !gloss.trim()) return base
  // Clone defensively so we never mutate the cached STACK_PACK row.
  return { ...base, translationSimple: gloss.trim() }
}
```

If the row is missing entirely (defensive), it returns a placeholder so the import doesn't crash — the word is saved with empty content and can be regenerated later.

### Important property: snapshot at import time

Each user gets a **copy** of the stack row's `result` written into their word doc. After import, the user's data has no live link to the source row. Editing `shared/stacks/<id>.ts` later does **not** retroactively update users' words. This matters for the upcoming "I know this" feature: we don't need to touch stack modules, only how we materialize them on import.

---

## 6. User stacks ("my stacks") — the other thing called a stack

This is a **separate concept** from the seven curated stacks. It's a user-created folder for organizing their own deck.

### Schema (`UserStack`)

```46:54:shared/types.ts
/** User-created stack metadata under `users/{uid}/myStacks/{id}`. */
export type UserStack = {
  id: string
  name: string
  description: string | null
  wordCount: number
  createdAt: unknown
  updatedAt: unknown
}
```

Stored at `users/{uid}/myStacks/{stackId}`. `wordCount` is a denormalized counter maintained inside transactions in `mobile/src/lib/userStacks.ts`. The source of truth for membership is the `userStackIds[]` field on each word doc, not this counter — `deleteUserStack` even comments that the counter is irrelevant once you have membership on words.

### How a word gets into a user stack

Three entrypoints, all in `mobile/src/lib/userStacks.ts`:

| Function | Purpose |
|---|---|
| `addWordToUserStacks(wordId, stackIds)` | Add to one or more stacks (preserves existing). |
| `removeWordFromUserStack(wordId, stackId)` | Remove a single membership. |
| `replaceWordUserStackMembership(wordId, nextStackIds)` | Set exact membership (used by `StackAssignmentSheet`). |

All three update the word's `userStackIds[]` and adjust each affected myStacks doc's `wordCount` inside one transaction.

A word can belong to up to `MAX_USER_STACKS_PER_WORD = 10` user stacks (`mobile/src/lib/words.ts:25`).

### Disambiguation

| Concept | Where it lives | Set via | Used for |
|---|---|---|---|
| **Curated stack** | `shared/stacks/<id>.ts` (bundled), `stackId` + `stackPosition` on the word doc | Set on first save by `saveWordFromStackImport` | Identifies the *origin* of a word; immutable history |
| **User stack** | `users/{uid}/myStacks/{stackId}`, referenced in `userStackIds[]` on the word doc | `addWordToUserStacks`, `replaceWordUserStackMembership` | User-organized folders ("Hard from yesterday", "Tone words", etc.) |

For the "I know this" feature, you almost certainly only care about **curated stacks** during import (that's where the user is bulk-adding many words at once). User stacks are organizational and aren't typically the first-touch surface.

---

## 7. The import flow, end-to-end

Two surfaces import curated stacks today. Both use the same primitive: one `saveWordFromStackImport` call per row, in a sequential `for` loop.

### Surface A — Onboarding

The user toggles "Add the Argument Architecture stack" during setup. After they finish, `OnboardingFlow.finishSetup` runs:

```108:135:mobile/src/onboarding/OnboardingFlow.tsx
  const finishSetup = useCallback(async () => {
    setSubmitError(null)
    setSubmitting(true)
    try {
      if (addArgStackToVocabs) {
        const words = getWordsForStack(ONBOARDING_STACK_ID)
        if (words.length === 0) throw new Error('Argument Architecture stack is empty.')
        for (let i = 0; i < words.length; i++) {
          await saveWordFromStackImport({
            text: words[i]!,
            mainLanguage,
            stackId: ONBOARDING_STACK_ID,
            stackPosition: i,
          })
        }
      }
      await completeOnboardingProfile({
        examDateIso,
        firstStackId: addArgStackToVocabs ? ONBOARDING_STACK_ID : null,
      })
      await onReloadWords()
      onComplete()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }, [addArgStackToVocabs, examDateIso, mainLanguage, onComplete, onReloadWords])
```

There is no UI between "tap toggle" and "all words saved." If we want to surface "I know this" markers during onboarding, a new step has to land *before* this loop runs.

### Surface B — Learn → Word stacks → stack detail

The user opens a stack from the Learn tab, sees the word list, and taps **"Add N to my deck"**:

```41:88:mobile/src/screens/WordStackDetailScreen.tsx
  async function addAllToDeck() {
    if (!stack || !unlocked) {
      openPaywall()
      return
    }
    setAdding(true)
    let added = 0
    let skippedDup = 0
    let stoppedForLimit = false

    try {
      let deckCount = items.length
      for (let idx = 0; idx < words.length; idx++) {
        const w = words[idx]!
        const key = w.trim().toLowerCase()
        if (inDeck(w)) {
          skippedDup++
          continue
        }
        if (!isPro && deckCount >= FREE_MAX_SAVED_WORDS) {
          openPaywall()
          stoppedForLimit = true
          break
        }
        await saveWordFromStackImport({ text: w, mainLanguage, stackId, stackPosition: idx })
        deckCount += 1
        added++
      }
```

Note the per-row `inDeck(w)` check that already skips duplicates — this is the natural neighbor for an "I know this" bulk action. The list itself just shows word strings with a "Saved" indicator, no per-row interaction.

### What `saveWordFromStackImport` does

```32:46:mobile/src/lib/words.ts
export async function saveWordFromStackImport(params: {
  text: string
  mainLanguage?: string
  stackId: string
  stackPosition: number
}) {
  return saveWord({
    text: params.text,
    result: getStackImportResult(params.stackId, params.stackPosition, params.mainLanguage),
    mainLanguage: params.mainLanguage,
    source: 'stack',
    stackId: params.stackId,
    stackPosition: params.stackPosition,
  })
}
```

It's a thin wrapper. The real work is `saveWord` in the same file. Two paths:

**Existing word (looked up by `textLower`):** `transaction.update` merges new content but **preserves all learning state** — `exposureScore`, `flagged`, `lastSeenAt`, `lastAnsweredAt`, `lastCorrect`, `correctDaysCount`, `seenCount`, `meaningQuizStreak`, `lastSessionSwipe`, `status`, and the `tags[]` array. So re-importing a stack does not reset progress.

**New word:** `transaction.set` writes the canonical first-write payload:

```223:237:mobile/src/lib/words.ts
    transaction.set(wordRef, {
      ...contentPayload,
      status: 'learning',
      exposureScore: 0,
      lastSeenAt: null,
      lastAnsweredAt: null,
      lastCorrect: null,
      flagged: false,
      wordSource,
      ...(params.stackId != null ? { stackId: params.stackId } : {}),
      ...(params.stackPosition != null ? { stackPosition: params.stackPosition } : {}),
      userStackIds: nextUserStackIds,
      tags: [],
      createdAt: serverTimestamp(),
    })
```

So **every freshly imported word starts at `exposureScore: 0`, `status: 'learning'`, `tags: []`, no introduction timestamp** → bucket = `'new'`.

---

## 8. What sessions consume

The daily session reads the entire deck, partitions by bucket, and picks up to 10 with caps:

```272:278:shared/sessionPlanner.ts
  const poolNew = items.filter((w) => bucketFromWord(w) === 'new')
  const poolLearning = items.filter((w) => bucketFromWord(w) === 'learning')
  const poolFamiliar = items.filter((w) => bucketFromWord(w) === 'familiar')
  const poolReview = items.filter((w) => {
    const b = bucketFromWord(w)
    return (b === 'familiar' || b === 'mastered') && daysSinceLastSeenMs(w) >= 10
  })
```

```310:313:shared/sessionPlanner.ts
  const NEW_CAP = 2
  const LEARN_CAP = 5
  const FAM_CAP = 2
  const REV_CAP = 1
```

Important consequences for the new feature:

- **`new`** = `exposureScore === 0 && lastIntroducedAt == null`. A freshly imported word lives here until its first session intro.
- **`mastered`** is **not** a permanent exclusion — words re-enter sessions as `'review'` after 10 unseen days. So if "I know this" shoehorns the word into the mastered bucket, it will *eventually* still appear.
- The planner has **no concept of `tags`, `flagged`, or any "user-asserted skip" flag today.** Adding any kind of "skip from sessions" filter is an explicit opt-in change to the pool builders above (and to `pickSessionBatchFive` for the legacy 5-pick path).

The `flagged` boolean is read by `countDeckBuckets` for the deck filter UI, but *not* by the session planner.

---

## 9. Existing tagging affordances

Before designing anything, here's what's already in the schema you can lean on:

### `tags: string[]` — written, never read

The save path always touches it:

- New word: `tags: []` (`mobile/src/lib/words.ts:235`).
- Updated word: `preservedTags = Array.isArray(prev.tags) ? prev.tags : []` then echoed back (`mobile/src/lib/words.ts:186, 218`).

But **no surface in the mobile app currently reads or writes `tags`**. Only `src/lib/words.ts` (the older web/server module) accepts `params.tags`. So `tags` is a free, persisted, never-used array on every word doc — perfect candidate for a `'known'` marker (or whatever vocabulary you choose) without a schema migration.

### `flagged: boolean` — toggleable, used for filter only

`toggleVocabFlagged` writes it; `countDeckBuckets` reads it for the "Flagged" tab count. It is **not** consulted by the session planner. Reusing `flagged` for "I know this" would conflate two different intents (star vs. skip), so I'd avoid it.

### `wordTags?: string[]` — content metadata, not user state

This is the LLM-supplied tag array on the *generated card itself* (e.g. `["academic", "connector"]`). It describes the word, not the user's relationship to it. Don't repurpose.

### `status: VocabStatus`

Setting `status: 'mastered'` (and bumping `exposureScore` to 20) is what `updateVocabStatus` already does for legacy admin paths. But that won't keep the word out of sessions long-term — it'll re-enter as `'review'` after 10 days unseen (§8).

---

## 10. Where the "I know this" feature plugs in

Not a design — just the seams you'll touch when building it.

### Read seams (where session eligibility is decided)

- `bucketFromWord` in `shared/learningBuckets.ts:16` — the only place "what bucket is this in?" is computed. If a known-marker should mean "no bucket / hide from deck," the cleanest insertion is here, returning a new bucket value (and updating `LearningBucket`'s union type in `shared/types.ts:39`).
- The four pool filters in `pickSessionBatchTen` (`shared/sessionPlanner.ts:272-278`) and the equivalents in `pickSessionBatchTwelve` (lines 128-134) and `pickSessionBatchFive` (`isLearning` filter on line 20). Anything that should be excluded from sessions has to be filtered out at these sites. The tightest implementation is to add `.filter((w) => !isKnown(w))` once at the top of each picker.
- `countDeckBuckets` in `shared/learningBuckets.ts:39` — drives the deck-tab counts. Decide whether known words show up in any bucket count or in their own pill.

### Write seams (where the marker gets set)

- **During stack import (the user's primary surface for the new feature):**
  - `WordStackDetailScreen.addAllToDeck` (`mobile/src/screens/WordStackDetailScreen.tsx:41`) — replace the bare loop with a per-row picker UI.
  - `OnboardingFlow.finishSetup` (`mobile/src/onboarding/OnboardingFlow.tsx:108`) — same loop, would need an interstitial step.
  - Both call `saveWordFromStackImport`. Either:
    - (a) Add a `markKnown?: boolean` param that flows into `saveWord` and stamps the marker on first write, **or**
    - (b) Skip `saveWordFromStackImport` entirely for known words and write a minimal "stub" doc, **or**
    - (c) Don't write anything for known words and only persist the negative list.
  - Each of these has trade-offs (deck count, future "show me what I skipped" view, re-import behavior). Worth its own design pass.
- **Manual "I know this" toggle on an existing deck word:** a new function alongside `toggleVocabFlagged` in `mobile/src/lib/vocab.ts`.

### Schema seams (cheapest place to store the marker)

- **Reuse `tags: string[]`** by reserving a value like `'known'`. Zero migration; nothing reads it today; you control the contract end-to-end. You'd also start *actually using* `tags`, which sets a precedent — fine if intentional.
- **Add a new boolean** like `knownByUser: boolean` on `VocabItem`. More explicit, slightly more surface to update in `normalizeRawVocabDoc`, save paths, and any code that recreates a word.
- **Add a new `LearningBucket` value** like `'known'`. The most invasive option (bucket type, color tokens, all bucket-aware UI) but gives you the cleanest filter semantics in the planner.

The planner-side change (§10 read seams) and the marker storage (above) are the two real decisions; everything else (UI for the per-row picker, interstitial onboarding step) is downstream rendering.

---

## Appendix — Quick file map

| Concern | File |
|---|---|
| Word doc shape | `shared/types.ts` (`VocabItem`, `VocabStatus`, `LearningBucket`) |
| Exposure math, status threshold | `shared/exposureScore.ts` |
| Bucket derivation | `shared/learningBuckets.ts` |
| Session pickers (5 / 10 / 12) | `shared/sessionPlanner.ts` |
| Read normalization, native gloss, translation merge | `shared/vocab.ts` |
| Curated stack catalog | `shared/canonicalStacks.ts` |
| Curated stack content (per id) | `shared/stacks/*.ts` |
| Stack import resolver | `shared/wordStackContent.ts` |
| `StackPackRow` shape | `shared/stackPackTypes.ts` |
| User stack metadata + validation | `shared/userStacks.ts` |
| Mobile word save / save-from-stack | `mobile/src/lib/words.ts` |
| Mobile word reads + exposure deltas | `mobile/src/lib/vocab.ts` |
| Mobile user-stack CRUD | `mobile/src/lib/userStacks.ts` |
| Onboarding stack import | `mobile/src/onboarding/OnboardingFlow.tsx` |
| Manual stack import (Learn) | `mobile/src/screens/WordStackDetailScreen.tsx` |
| Firestore security rules | `firestore.rules` |
