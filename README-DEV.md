# Local development

## Prereqs

- Node.js (20+ recommended)
- Firebase project already created (you did this)
- Firebase CLI available via `npx firebase`

## 1) Configure frontend env

Create `.env.local` in the repo root:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Leave this empty for now (we’ll set it after deploying the function):

- `VITE_FUNCTIONS_BASE_URL=`

## 2) Set the OpenAI key for Functions

From repo root:

```bash
npx firebase login
npx firebase functions:secrets:set OPENAI_API_KEY
```

Optional model override:

```bash
export OPENAI_MODEL="gpt-4.1-mini"
```

## 3) Run emulators (recommended)

In one terminal:

```bash
npm run emulators
```

This starts Auth + Firestore + Functions emulators and opens the Emulator UI.

## 4) Run the frontend

In another terminal:

```bash
npm run dev
```

## 5) Point the frontend to the emulator function (local)

While running emulators, set this in `.env.local`:

```bash
VITE_FUNCTIONS_BASE_URL=http://127.0.0.1:5001/gmat-prep-36738/us-central1/api
```

Restart `npm run dev` after changing env vars.

## Deploying

### Important: Functions requires Blaze plan

Deploying Cloud Functions requires upgrading the Firebase project to the **Blaze (pay-as-you-go)** plan. You can still use emulators locally without upgrading.

### Firestore rules

```bash
npm run deploy:rules
```

### Functions

```bash
npm run deploy:functions
```

After deploy, set:

- `VITE_FUNCTIONS_BASE_URL=https://us-central1-gmat-prep-36738.cloudfunctions.net/api`

## Mobile app (Expo)

Mobile lives in `mobile/` and shares backend + selected domain logic from `shared/`.

### Mobile env

Create `mobile/.env` from `mobile/.env.example`:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FUNCTIONS_BASE_URL`

Use the same Firebase project values as web.

### Run mobile locally

```bash
npm install
npm run mobile:start
```

Optional platform launch:

```bash
npm run mobile:ios
npm run mobile:android
```

### Internal beta prep

- Expo build config: `mobile/eas.json`
- QA checklist: `mobile/BETA-CHECKLIST.md`

