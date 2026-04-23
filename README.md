# GMAT Lexicon

Mobile-first vocab lookup, learning, and testing for GMAT prep.

**Live site:** [https://gmat-prep-36738.web.app](https://gmat-prep-36738.web.app)

---

## How to use the website

1. **Sign in**  
   Use **Sign in with Google** (top right). You need to be signed in to save words and use Learn/Test.

2. **Today (home)**  
   - See your **streak** and sessions completed (streak updates when you **finish a full daily session**).  
   - **Exam window** and **timezone** live under **Profile** (top right); save from there.  
   - **Start session** runs the same guided flow as mobile: a **batch of up to five** prioritized words, then **learn** (swipe) → **match** → **GMAT-style multiple choice** (meaning-in-context), then a short summary.  
   - **Lookup:** enter a **word or phrase** (e.g. *obdurate*) and tap **Generate** → **Save** to add it (**Learning** by default).  
   - **Deck stats** (total, learning, mastered, flagged)—no extra shortcuts; use **Learn** to drill by filter.

3. **Learn**  
   - Open **Learn** from the nav.  
   - Your deck uses an **exposure score** (and **Learning** vs **Mastered** at score 20+). Filters (**All**, **Learning**, **Mastered**) and search refine the list; the default view emphasizes words still in **Learning**.  
   - **Study** opens a focused flashcard flow through the **current filtered list** (order preserved).  
   - **Paragraph:** **Generate paragraph** picks up to **five** words by score (words must have been seen in study at least once), builds a formal paragraph, and **highlights** targets. **Hover** a bold word to see its meaning (web).

4. **Test**  
   - Open **Test**, choose **Meaning in Context** or **GMAT-Style Verbal**, pick how many questions, and run the section.  
   - After each answer you see an **explanation**, then **Continue**.  
   - Questions prefer words still **Learning**; if there aren’t enough, **Mastered** words can fill the rest.

---

## Mobile app

The **Today** tab mirrors the home hub: streak, exam window, **Start session** (full-screen flow), and lookup. **Learn** and **Test** match the web behavior.

---

## Word stacks (ready-to-use packs)

The app ships with **curated word stacks** you can import into your deck. Stacks are **production TypeScript packs** under [`shared/stacks/`](shared/stacks/) (no JSON imports in app code).

### Pages and buttons (mobile)

- **Learn** (`mobile/src/screens/LearnScreen.tsx`)
  - **Button**: **Word stacks** → opens the stacks flow.
- **Word stacks (browse)** (`mobile/src/screens/WordStackBrowseScreen.tsx`)
  - **Button**: **Back** → returns to Learn
  - **List**: stacks from [`WORD_STACK_CATALOG`](shared/freemium.ts)
  - **Tap a stack row**:
    - if locked → opens **paywall**
    - if unlocked → opens stack detail
- **Stack detail** (`mobile/src/screens/WordStackDetailScreen.tsx`)
  - **Button**: **Back** → returns to stacks browse
  - **Primary CTA**: **Add _N_ to my deck** (or **Unlock with Pro** / **All words in deck**)
  - **List**: words in the pack, with a **Saved** check if already in your deck

### Data flow (how stacks become “ready-to-use”)

- **Source of truth (curated list):** [`data/gmat_vocab_stacks.json`](data/gmat_vocab_stacks.json)
- **Generate (staging):** `npm run generate:stacks` writes reviewed JSON to [`data/stacks/staging/`](data/stacks/staging/)
- **Promote (production TS packs):** `npm run promote:stacks` writes TypeScript modules to [`shared/stacks/`](shared/stacks/)

### How the app consumes stacks

- `shared/wordStackContent.ts` imports each `shared/stacks/{id}.ts` module.
  - If a module exports **`STACK_PACK`** (promoted), `getWordsForStack(stackId)` lists the texts from that pack.
  - `getStackImportResult(stackId, stackPosition)` returns the **full generated `result`** for imports.
- `mobile/src/lib/words.ts` uses `getStackImportResult(...)` inside `saveWordFromStackImport(...)`, so stack imports can save **fully generated cards** (definition, examples, nuance note, memory hook, etc.).

### Developer quick start (stacks)

```bash
# 1) Ensure OPENAI_API_KEY exists in repo-root .env (gitignored)

# 2) Generate staging JSON (shows cost/time estimate; confirm y/N)
npm run generate:stacks -- --stack=all

# 3) Promote approved staging → production TS packs
npm run promote:stacks
```

## For developers

Setup, env vars, emulators, and deploy: see **[README-DEV.md](README-DEV.md)**.

After changing Firestore structure or **[firestore.rules](firestore.rules)** (e.g. `users/{uid}/settings/**`, `users/{uid}/daily/**`), deploy rules:

`npm run deploy:rules` (or `firebase deploy --only firestore:rules`).
