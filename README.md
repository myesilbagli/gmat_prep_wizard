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
   - Open **Learn** from the nav (**Study library**).  
   - Switch **Deck** vs **Paragraph**. **Deck** lists your saved words; use filters (**All**, **Learning**, **Mastered**, **Flagged**), **Do Not Know**, and **Words** / **Phrases**, plus search.  
   - **Study** opens a focused flashcard flow through the **current filtered list** (order preserved).  
   - **Paragraph:** **Generate paragraph** uses up to **five Learning items in your current filter** (list order), builds a formal paragraph, and **highlights** targets. **Hover** a bold word to see its meaning (web).

4. **Test**  
   - Open **Test**, choose **Meaning in Context** or **GMAT-Style Verbal**, pick how many questions, and run the section.  
   - After each answer you see an **explanation**, then **Continue**.  
   - Questions prefer words still **Learning**; if there aren’t enough, **Mastered** words can fill the rest.

---

## Mobile app

The **Today** tab mirrors the home hub: streak, exam window, **Start session** (full-screen flow), and lookup. **Learn** and **Test** match the web behavior.

---

## For developers

Setup, env vars, emulators, and deploy: see **[README-DEV.md](README-DEV.md)**.

After changing Firestore structure or **[firestore.rules](firestore.rules)** (e.g. `users/{uid}/settings/**`, `users/{uid}/daily/**`), deploy rules:

`npm run deploy:rules` (or `firebase deploy --only firestore:rules`).
