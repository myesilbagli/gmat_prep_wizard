# GMAT Lexicon (mobile)

Expo + React Native app that mirrors the web app structure and reuses the same Firebase backend.

## Setup

1. Install dependencies from repo root:
   - `npm install`
2. Create `mobile/.env` from `mobile/.env.example`.
   - For Google auth, set:
     - `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`
     - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
     - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
3. Run:
   - `npm run mobile:start`
   - `npm run mobile:ios`
   - `npm run mobile:android`

## Structure

- `src/App.tsx`: auth gate + tab navigation (`Dashboard`, `Learn`, `Test`)
- `src/screens`: screen implementations
- `src/lib`: Firebase + backend calls
- `../shared`: shared types and normalizers used by web and mobile

## Notes

- Backend is shared with web (`Auth`, `Firestore`, `Functions`).
- Dashboard includes lookup + stats.
- Learn includes list, flashcards, and paragraph modes.
- Test includes meaning/GMAT modes with configurable counts.
- **Lexicon Pro** uses **RevenueCat** (`react-native-purchases`). In **development**, Metro aliases the native module to a **JS mock** by default (set `EXPO_PUBLIC_IAP_USE_MOCK=0` to use the real SDK with a dev client). **Production** bundles always use the real native module. Real purchases need **`expo run:ios`** or an **EAS** build with `EXPO_PUBLIC_REVENUECAT_API_KEY`. See [`docs/SUBSCRIPTIONS.md`](docs/SUBSCRIPTIONS.md).
