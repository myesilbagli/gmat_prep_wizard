# GMAT Lexicon

Mobile-first vocab lookup, learning, and testing for GMAT prep.

**Live site:** [https://gmat-prep-36738.web.app](https://gmat-prep-36738.web.app)

---

## How to use the website

1. **Sign in**  
   Use **Sign in with Google** (top right). You need to be signed in to save words and use Learn/Test.

2. **Today (home)**  
   - See your **streak** (updated when you **finish a full daily session** — review → new → quiz).  
   - Set a fuzzy **exam window** (month, year, early/mid/late) and **timezone** (IANA), then **Save**.  
   - Tap **Start session** for the guided flow (~5–10 min): **5 review** (lowest exposure first), **5 new** (`seenCount === 0`), then a **5-question meaning quiz**. Progress shows as *n / total* (total adjusts if you have fewer words).  
   - **Lookup:** enter a **word or phrase** (e.g. *obdurate*) and tap **Generate**.  
   - The app generates a definition, simple definition, example, synonyms, and GMAT usage notes.  
   - Tap **Save** to add it to your library (new words start as **Learning**).  
   - **Deck stats** (total, learning, mastered, flagged) and shortcuts to **Review learning** / **Review flagged** on Learn.

3. **Learn**  
   - Open **Learn** from the nav.  
   - Each word is either **Learning** (still practicing) or **Mastered** (confident / deprioritized in drills).  
   - Use filters: **All**, **Learning**, **Mastered**, **Flagged**, plus **Words** / **Phrases** by type.  
   - Search by text.  
   - On each card you can set status, flag, delete, or expand details.  
   - **Flashcards:** flip through the current list (reveal definition, Prev/Next).  
   - **Paragraph:** **Generate paragraph** uses up to **5 random words marked Learning**, builds a short paragraph, and **bolds** those words. **Hover** a bold word to see its meaning in a tooltip.

4. **Test**  
   - Open **Test**, choose **Meaning** or **GMAT-style**, pick how many questions, and run the quiz.  
   - Questions prefer words still **Learning**; if there aren’t enough, **Mastered** words can fill the rest.  
   - After finishing you get a score and can review correct answers.

---

## Mobile app

The **Today** tab mirrors the home hub: streak, exam window, **Start session** (full-screen flow), and lookup. **Learn** and **Test** match the web behavior.

---

## For developers

Setup, env vars, emulators, and deploy: see **[README-DEV.md](README-DEV.md)**.

After changing Firestore structure or **[firestore.rules](firestore.rules)** (e.g. `users/{uid}/settings/**`, `users/{uid}/daily/**`), deploy rules:

`npm run deploy:rules` (or `firebase deploy --only firestore:rules`).
