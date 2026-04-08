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

## Firebase Authentication (sign-in methods)

In the [Firebase Console](https://console.firebase.google.com) for your project, open **Authentication → Sign-in method** and enable:

- **Email/Password** (required for web `#/sign-in` and `#/sign-up` email flows, and for mobile email auth).
- **Google** (web uses popup; mobile uses native Google where configured).
- **Apple** (web uses **Sign in with Apple** in the browser; requires an Apple Developer **Services ID**, **Sign in with Apple** for the web, and the **Return URLs** / domains Firebase documents for the Apple provider).

If a method is disabled, the app surfaces `auth/operation-not-allowed` via `mapAuthError` in `src/lib/auth.ts`.

### Same user across providers (account linking)

Firebase does not automatically merge two different providers unless emails match and your project settings allow it. If a user sees **account-exists-with-different-credential**, they should sign in with the method they used originally, or you can add a future **link providers** flow in profile using `linkWithCredential`. See [Firebase account linking](https://firebase.google.com/docs/auth/web/account-linking).

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

## Stitch (optional): export landing HTML/screenshot

The marketing page at `#/landing` is implemented in React. To **download the canonical Stitch screen** (project `4820344346457111791`, screen `8fb46089527c41dcae6075d13b4c0644`) for reference or diffing:

1. Add your Google Stitch API key to **the repo root** `.env.local` (same folder as `package.json`):

   ```bash
   STITCH_API_KEY=your_key_here
   ```

   Use that exact name (not only `VITE_*` unless you use `VITE_STITCH_API_KEY`, which the fetch script also reads). No spaces around `=`. Don’t wrap the line in quotes unless the whole value is quoted.

2. From the repo root:

   ```bash
   npm run stitch:fetch
   ```

This writes `.stitch/designs/landing.html`, `landing.png`, and `.stitch/metadata.json` (the `.stitch/` folder is gitignored). Uses `@google/stitch-sdk` and the same MCP-backed API as Cursor’s Stitch integration.

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

