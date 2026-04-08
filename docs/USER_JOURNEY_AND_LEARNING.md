# Lexicon — User journeys & how people learn in the app

This report describes **how a real person moves through the mobile app**: what they see, what they tap, and how **Today**, **Learn**, **Test**, and **Profile** fit together as a study habit. It complements the technical map in [`MOBILE_APP_STRUCTURE.md`](./MOBILE_APP_STRUCTURE.md).

---

## What the app is trying to be (learner’s view)

Lexicon is a **personal GMAT vocabulary workspace**. The learner:

- **Adds words** (typed or pasted) and gets AI-generated definitions, examples, and GMAT-flavored notes.
- **Stores everything in one deck** that syncs to their account.
- **Practices in two different ways**:
  - A **guided daily session** (fixed flow: see words → match meanings → answer meaning questions) tuned to what they still need.
  - **Self-serve study** on the **Learn** tab (**Deck** library, optional **Paragraph** reading, flashcards opened from a deck card) and **Test** tab (GMAT-style verbal sections).

The emotional goal is: *open the app, do something concrete in a few minutes, and feel progress*—counts on Today, a finished session, and optional quizzes.

---

## Persona (composite)

**Alex** is preparing for the GMAT, reads articles and Official Guide passages, and keeps a list of tricky words. Alex wants **one place** to capture those words, **short daily practice**, and **occasional harder checks** without managing spreadsheets or separate flashcard apps.

---

## Journey 1 — First open: account and landing

1. Alex opens the app and sees **Welcome** (sign in / sign up).
2. After **email** or **Google** / **Apple** sign-in, the app loads vocabulary from the cloud.
3. Alex lands on **Today** by default—the **home base** with three ideas: *capture a word*, *start today’s session*, *glance at the deck*.

**First-time feeling:** The deck may be empty or small. Today’s session may show **zero** learning/flagged items until Alex saves words. That’s expected: the app becomes richer after the first saves.

---

## Journey 2 — Building the deck (Today → Quick Capture)

This is how vocabulary **enters** the system.

1. On **Today**, Alex types a word or phrase in **Quick Capture**.
2. Alex taps **Generate Card**. The app calls the backend; a **modal** opens with the generated card (definitions, example, notes, etc.).
3. Alex reads it; if it looks right, they tap **Save to deck** (or close without saving).
4. The **Active Deck** strip and **stats** update after save—Alex sees the word count grow.

**Interaction pattern:** *Type → generate → review → commit.* The modal is the “quality gate” so junk doesn’t flood the deck.

---

## Journey 3 — The core habit: “Today’s session”

This is the **main learning loop** the product nudges toward.

### Starting

1. On **Today**, Alex checks **Today’s Session** (copy + numbers: how much is **learning**, **flagged**, etc.).
2. Alex taps **Start Session**. The main tabs disappear; **full-screen session** takes over.

### What happens inside (user-visible story)

The app picks a **small batch of words** (up to five) that deserve attention—things still in play, with extra weight on **flagged** items and words Alex seemed unsure about earlier.

**Phase 1 — Learn (flashcards + swipe)**  
For each word in the batch, Alex sees a **rich card** (headword, gloss, context). They **swipe** to signal “I know this” vs “I don’t” (or equivalent affordance). This isn’t just animation: it **feeds** how hard the next phases feel and how words get ordered.

**Phase 2 — Match**  
Alex sees **definitions or glosses with blanks** and a **bank of words** to assign. It’s active recall in a different shape than swipe—more like “which word fits this meaning?”

**Phase 3 — Multiple choice**  
**GMAT-style verbal** items for the same batch (same generator as Test’s *Meaning in Context* mode). Questions are **ordered** so words that felt weaker in the swipe phase tend to come **earlier**—a subtle way to give the hardest items more attention while Alex is still fresh.

**Phase 4 — Summary**  
Alex sees **how it went** (correct/incorrect flavor, completion). Finishing **updates** word progress in the deck and can affect **streak / daily completion** tracking in the profile layer.

### Leaving early

If Alex exits from the session header **before** finishing, the app treats that as **not** a completed daily run (as reflected in messaging)—so the “daily ritual” stays honest.

### Empty batch

If there’s **nothing eligible** to study (e.g. brand-new user with no cards, or everything filtered out by rules), Alex sees an **empty session** state instead of a broken flow.

**Mental model for Alex:** *One session = one short workout on a handful of words, in three formats, then a clear stop.*

---

## Journey 4 — Deepening and browsing (Learn tab)

When Alex doesn’t want the fixed session—or wants to **focus a subset**—they use **Learn**.

1. Alex switches to **Learn** (**Study library**) in the bottom tabs.
2. They choose **Deck** or **Paragraph**, then **search** and use **filter pills**: All, **Do Not Know**, **Learning**, **Mastered**, **Flagged** (plus **word vs phrase** if needed).
3. **Deck** — Scan cards, manage status/flags/delete; **tap a card** (or **Study** on web) to open a **focused flashcard** flow that walks the **filtered list in order** (swipe horizontally on mobile).
4. **Paragraph** — Generates a formal paragraph from **up to five Learning items** in the current filter (list order); target words are **highlighted**.

**Mental model:** *Learn = my library (deck + immersion reading); Today = my daily entry point.*

---

## Journey 5 — Self-test (Test tab)

When Alex wants **exam-style pressure** or a **longer block**:

1. Open **Test** (**GMAT practice**).
2. Choose **Meaning in Context** or **GMAT-Style Verbal**.
3. Set **how many questions** (e.g. 10).
4. **Begin section** — answer, read the **explanation**, tap **Continue**, then a **score summary** at the end.

The app **prefers words still in “learning”** for the quiz pool; if there aren’t enough, it **fills** with **mastered** items so the section can still run.

**Mental model:** *Test = optional GMAT verbal practice; Session = structured daily loop; Learn = library.*

---

## Journey 6 — Profile and “how the app speaks to me”

Alex opens **Profile** from the header (modal sheet).

Typical tasks:

- Switch **light / dark** for reading comfort.
- Set **main language** so short glosses and generation match how Alex thinks (e.g. native language support).
- Set **exam window** (month/year/part of month) and **timezone** so deadlines feel real in the product (and for any future time-aware UX).

After saving, language preferences flow back into **generation and labels** elsewhere.

**Design note:** Today this is a **single sheet** with several blocks. A future redesign might separate **Account**, **Study preferences**, and **Appearance**—but **behaviorally**, it’s “tune the app once in a while, not every session.”

---

## How “learning” works in the learner’s head (statuses)

Without naming every field in the database, Alex effectively has:

| Idea | What Alex sees |
|------|----------------|
| **New / unsure** | Words that haven’t “clicked” yet—often under **Do Not Know** or **Learning**. |
| **In progress** | **Learning** — showing up in sessions and quizzes until they stick. |
| **Confident** | **Mastered** — known well enough to deprioritize, but can still appear if the deck is thin. |
| **Come back to this** | **Flagged** — Alex explicitly marked something important or confusing; sessions can **prioritize** these. |

The **daily session** and **Test** both **consume** this state; **Learn** is where Alex **curates** it.

---

## Typical week (simulated)

| Day | Alex does |
|-----|-----------|
| **Mon** | Signs in; Quick Capture adds 3 words from reading; **Start Session** once. |
| **Tue** | **Start Session** only—deck is building, numbers on Today move. |
| **Wed** | Opens **Learn → Deck**, taps into **study** on a few cards on the bus; flags two hard words. |
| **Thu** | **Start Session**; those flagged words feel “heavier” in the batch. |
| **Fri** | **Test** with 15 questions (**GMAT-Style Verbal**)—confidence check. |
| **Sat** | **Learn → Paragraph** on a filtered **Learning** set. |
| **Sun** | Opens **Profile**, adjusts exam month; light theme for outdoor reading. |

---

## Summary — which surface for which intent

| Intent | Best place |
|--------|------------|
| “I just met a new word” | **Today → Quick Capture** |
| “I want my daily routine” | **Today → Start Session** |
| “I want to browse or fix my deck” | **Learn → Deck** |
| “I want focused flashcards from my filters” | **Learn → Deck** → tap card (**Study** on web) |
| “I want immersion reading” | **Learn → Paragraph** |
| “I want a scored GMAT-style block” | **Test** |
| “I want theme / language / exam context” | **Profile** |

---

*This document is narrative and UX-oriented; implementation details may evolve while these journeys stay the product’s backbone.*
