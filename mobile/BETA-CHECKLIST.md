# Mobile Beta Checklist

## Functional parity

- [ ] Auth flow works (`Sign Up`, `Sign In`, `Sign out`)
- [ ] Dashboard lookup can generate analysis
- [ ] Save button transitions (`Save` -> `Saving...` -> `Saved`)
- [ ] Learn tab supports list filtering and status changes
- [ ] Learn flashcards next/prev/reveal works
- [ ] Learn paragraph generation works
- [ ] Test tab can start quiz and finish scoring
- [ ] Dark/light theme is legible on both platforms

## Backend integration

- [ ] Mobile uses same Firebase project as web
- [ ] Firestore reads/writes appear in same user document path
- [ ] Cloud Function endpoints (`generate`, `generateParagraph`, `generateQuiz`) succeed with auth token

## Device QA

- [ ] iOS simulator smoke test complete
- [ ] Android emulator smoke test complete
- [ ] Small-screen layout validated (e.g., iPhone SE / small Android)
- [ ] Keyboard and submit behavior validated for auth + lookup

## Subscriptions (Lexicon Pro)

- [ ] **Expo Go**: Quick Capture + Start Session work with mock IAP (default: entitled); set `EXPO_PUBLIC_IAP_MOCK_ENTITLED=0` in `.env` to verify paywall opens when gated
- [ ] **Dev client / TestFlight**: `EXPO_PUBLIC_REVENUECAT_API_KEY` set on EAS; App Store + RevenueCat configured per [`docs/SUBSCRIPTIONS.md`](docs/SUBSCRIPTIONS.md)
- [ ] Sandbox purchase monthly/yearly, **Restore purchases**, and **Manage in App Store** from Profile
- [ ] App Store Connect **App Privacy** updated for purchases + RevenueCat (manual)

## Internal distribution prep

- [ ] `eas login` completed
- [ ] iOS and Android bundle identifiers confirmed
- [ ] `eas build --profile preview --platform ios`
- [ ] `eas build --profile preview --platform android`
- [ ] Internal tester list prepared and build links shared
