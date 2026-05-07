# Reading paragraph generation (mobile)

This document describes how **Practice → Reading** builds passages, how **words** and **length** are chosen, how requests hit **`/generateParagraph`**, and what changed when we fixed **repetitive paragraphs** and **weak theme adherence**.

---

## End-to-end flow

1. **Practice tab** (`mobile/src/App.tsx`): `practiceFlow` drives in-tab navigation (`hub` → `readingSetup` → `reading` → `review`).
2. **Reading setup** (`mobile/src/screens/ReadingSetupScreen.tsx`): user picks **length**, **word pool**, optional **theme**, then **Start reading**.
3. **Session blob** (`mobile/src/reading/readingSession.ts`): `createReadingSession(config)` stores:
   - `config`: `{ length, pool, theme? }`
   - `totalPassages`: `1` for Quick/Timed, `3` for Focused
   - `currentIndex`, `passages[]`, `usedWordIds[]`
4. **Reading screen** (`mobile/src/screens/ReadingScreen.tsx`): for the current passage index, if there are no `parts` yet, it **picks words**, calls **`generateParagraph`**, applies **exposure**, reloads items, then writes the passage into `passages[currentIndex]`.
5. **Review** (`mobile/src/screens/ReadingReviewScreen.tsx`): shows timing and targets; **Continue** advances `currentIndex` in Focused mode; **Another round** clears the session and returns to setup.

Session state is **in-memory only** in v1 (see comment in `readingSession.ts`).

---

## Length selection (`ReadingLengthMode`)

| Mode      | `totalPassages` | Timer (`useReadingCountdown`) | Notes |
|-----------|-----------------|-------------------------------|--------|
| **Quick** | 1               | No                            | Single passage, self-paced. |
| **Focused** | 3             | No (per passage)              | Three sequential passages; same optional **theme** across all three when set. |
| **Timed** | 1               | **90s** from `readingStartedAt` | Glossary locked until timer hits 0. |

`ReadingSetupScreen` maps UI choices into `ReadingSessionConfig.length` and passes that into `createReadingSession`.

---

## Word pool selection (`ReadingPoolMode`)

| UI label          | `pool` value   | Meaning (`bucketFromWord` in `shared/learningBuckets.ts`) |
|-------------------|----------------|------------------------------------------------------------|
| From Learning     | `learning`     | Bucket **`learning` only** (excludes **`new`**).           |
| From Familiar     | `familiar`     | Bucket **`familiar`**.                                    |
| Mixed             | `mixed`        | **`learning` ∪ `familiar`**.                               |

**Mastered** words never match these buckets (they are not `learning` or `familiar`).

---

## Word picking (`shared/paragraphPicker.ts`)

`pickParagraphWords(items, nowMs, max = 5, options?)`

### Inputs

- **`items`**: full deck from Firestore (mobile `listVocabItems`).
- **`nowMs`**: typically `Date.now()` (used for “seen in last 24h” deprioritization in ranking).
- **`options.pool`**: `learning` | `familiar` | `mixed` | **omit** (legacy web behavior: all non-mastered via `exposureScore < MASTERED_MIN_SCORE`).
- **`options.excludeIds`**: word ids already used in this reading session so passages 2/3 in **Focused** do not reuse the same lemmas.

### Steps (high level)

1. **Exclude** any id in `excludeIds`.
2. **Pool filter** using `bucketFromWord` (or legacy `isLearning` when `pool` omitted).
3. **Stack cohesion** (`applyStackCohesion`):
   - Among words with `exposureScore > 0` and `lastSeenAt` set, count **`userStackIds`** membership.
   - If some user stack has **≥3** eligible words, **restrict** the universe to words that contain that stack id.
   - Else if **no** user stacks on those candidates, optionally group by lore **`stackId`** with the same **≥3** rule.
4. **Ranked list** `ranked`:
   - Append all words from `rankForUpper(universe, nowMs, 15)` (scores roughly 3–15, plus recency rules),
   - then add new words from `rankForUpper(universe, nowMs, 20)` (scores up to 20),
   - then append remaining eligible from `universe` (exposure &gt; 0, `lastSeenAt` set), sorted by distance of `exposureScore` from an “ideal center” (~8).
5. **Random pool + shuffle (post-fix)**  
   Previously the code took **`ranked.slice(0, 25)`** and shuffled—so the **same 25** head words were always the candidate pool whenever the deck was large enough.  
   **Now:** build a pool of up to **50** entries; if `ranked.length > 50`, choose a **random starting index** and take a **50-word sliding window** along `ranked`, then **Fisher–Yates shuffle** and return **5** words. That varies *which* words can appear across runs while still drawing from the ranked quality ordering.

---

## Optional theme

### Client (`ReadingSetupScreen` → session → `ReadingScreen`)

- Single-line `TextInput`, **max 120** characters (aligned with server).
- On start: `theme` is **trimmed**; empty string is omitted from `ReadingSessionConfig`.
- **Reading** screen shows **`Theme: …`** when set so the user can confirm what was captured.

### Request (`mobile/src/lib/api.ts` → `generateParagraph`)

Optional body fields (when set): `domain`, `difficulty`, `lengthHint`, `theme`, `focusedIndex`, `totalPassages`, **`nonce`** (short string; see “Repetition fix” below).

`buildParagraphRequestOptions` in `ReadingScreen.tsx`:

- Builds a **`lengthHint`** from Quick/Focused/Timed.
- If **`userTheme`** is set, appends a **THEME LOCK-IN** sentence to `lengthHint` so the model is steered not to swap in unrelated subjects.
- If **no** theme, sends a **rotating `domain`** string (hash of seed + passage index) for variety when the server TOPIC branch is “no theme”.
- For **Focused** (`totalPassages > 1`), sends **`focusedIndex`** / **`totalPassages`** so the server can add the “passage N of M / different angle” line.

### Server (`functions/src/index.ts` → `handleGenerateParagraph`)

- **`theme`**: trimmed; **&gt; 120** chars → **400** error (no silent truncate).
- **`lengthHint`**: max length raised to **480** so theme + length instructions can coexist.
- **Locked RC prompt** (`buildLockedParagraphPrompt`): TOPIC is **either** theme **or** default—never both.
- **`THEME ENFORCEMENT`** block appended when `theme` is present (adds binding without relaxing JSON/target rules).
- **`REQUEST_NONCE`** when client sends `nonce` (see below).
- **`temperature`** for this endpoint raised (e.g. **0.68**) for more lexical variety when targets are similar.
- **Validation**: JSON shape, each target exactly once, no target substring inside `text` parts, **one** stricter retry on failure.

---

## Exposure (`applyParagraphExposure`)

In `ReadingScreen.tsx`, **immediately after a successful `generateParagraph`** (before the user finishes reading), the app calls **`applyParagraphExposure`** on the picked word ids. Comment in code documents the policy: credit is tied to **successful generation**, not verifiable “did they read,” including Focused multi-passage runs.

---

## Timer and glossary (Timed)

- **`mobile/src/hooks/useReadingCountdown.ts`**: `deadlineMs = anchorMs + 90_000`, `setInterval` ~500ms.
- **Glossary**: `Modal`; targets are tappable only when `!timed || remainingSec <= 0`.

---

## Bugs we fixed (summary)

### 1) Same words / same passage feel on every run

**Cause:** Word selection was **almost deterministic** for a large deck: only the **first 25** ranked words were ever shuffled, so the model often saw the **same five targets** (or a heavily overlapping set). With similar prompts and moderate temperature, completions felt repetitive.

**Mitigations:**

- **Picker:** random **50-word window** along the full ranked list when `ranked.length > 50`, then shuffle and take **5** (`paragraphPicker.ts`).
- **Client:** send a fresh **`nonce`** on every `generateParagraph` call (`ReadingScreen.tsx` + `api.ts`).
- **Server:** append **`REQUEST_NONCE`** to the prompt and **raise temperature** for this route (`functions/src/index.ts`).

### 2) Theme not matching user intent

**Cause:** The locked TOPIC copy frames the theme as a **hint** and allows **broadening**; vocabulary **targets** can also pull the subject away from the user’s phrase.

**Mitigations:**

- **Client `lengthHint`:** **THEME LOCK-IN** sentence when a theme is set.
- **Server:** **`THEME ENFORCEMENT`** block when `theme` is set; **`lengthHint`** max length increased so the client can send richer hints without 400s.

---

## File map (primary)

| Area | Path |
|------|------|
| Practice navigation + session | `mobile/src/App.tsx` |
| Session types | `mobile/src/reading/readingSession.ts` |
| Setup UI | `mobile/src/screens/ReadingSetupScreen.tsx` |
| Generate + UI | `mobile/src/screens/ReadingScreen.tsx` |
| Review UI | `mobile/src/screens/ReadingReviewScreen.tsx` |
| Timer hook | `mobile/src/hooks/useReadingCountdown.ts` |
| API client | `mobile/src/lib/api.ts` |
| Word picker | `shared/paragraphPicker.ts` |
| Buckets | `shared/learningBuckets.ts` |
| Cloud function | `functions/src/index.ts` (`handleGenerateParagraph`) |

---

## Deploy note

Any change under **`functions/src/index.ts`** requires **`npm run deploy:functions`** (or your usual Firebase deploy) before Expo clients see updated server behavior. Mobile/Metro changes reload with the app bundle.
