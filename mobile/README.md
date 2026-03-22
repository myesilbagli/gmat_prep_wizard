# GMAT Vocab Wizard Mobile

Expo + React Native app that mirrors the web app structure and reuses the same Firebase backend.

## Setup

1. Install dependencies from repo root:
   - `npm install`
2. Create `mobile/.env` from `mobile/.env.example`.
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
