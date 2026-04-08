# TestFlight (iOS) — step by step

Your app is linked to EAS: **[@myesilbagli/gmat-vocab-wizard](https://expo.dev/accounts/myesilbagli/projects/gmat-vocab-wizard)**.  
Bundle ID: **`com.gmatwizard.mobile`**

## 1. Apple Developer — App ID

1. Open [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list).
2. **Register** an App ID (if it does not exist):
   - Type: **App IDs** → App
   - **Bundle ID**: explicit → `com.gmatwizard.mobile`
   - Enable any capabilities you need (Push, Sign in with Apple, etc.) — optional for a first build.

## 2. App Store Connect — new app

1. Open [App Store Connect](https://appstoreconnect.apple.com/) → **My Apps** → **+** → **New App**.
2. **Platforms**: iOS  
3. **Name**: e.g. GMAT Lexicon  
4. **Bundle ID**: pick `com.gmatwizard.mobile` (must match Apple Developer).  
5. **SKU**: any unique string (e.g. `gmat-lexicon-ios`).  
6. **User access**: Full Access (or as you prefer).

You can leave metadata (screenshots, description) for later; TestFlight only needs a processed build.

## 3. Environment variables on EAS (production)

If the app uses `EXPO_PUBLIC_*` (Firebase, API URLs, Google OAuth client IDs), add them for **production** builds so TestFlight matches your dev app:

1. [expo.dev](https://expo.dev) → your project → **Environment variables** (or use CLI: `eas env:create`).
2. Mirror the values from `mobile/.env` / `.env.example` for the **production** / **preview** scope as appropriate.

## 4. Build the iOS binary (cloud)

From the **repo root**:

```bash
npm run mobile:eas:build:ios
```

Or from **`mobile/`**:

```bash
npm run eas:build:ios
```

- First time: EAS will ask to **log in to Apple** or use an **App Store Connect API key** (recommended for repeat submits).
- Choose **Let Expo handle credentials** unless you manage certs yourself.
- Wait for the build on [expo.dev → Builds](https://expo.dev). When it succeeds, you get an `.ipa` (downloadable from the build page).

**Versioning**

- User-facing version: `expo.version` in `app.json` (currently `1.0.0`).
- iOS build number: `ios.buildNumber` starts at `1`; **`production` + `autoIncrement`** in `eas.json` bumps it on each **successful** store build.

## 5. Submit to App Store Connect

After a successful build:

```bash
npm run mobile:eas:submit:ios
```

Or from **`mobile/`**:

```bash
npm run eas:submit:ios
```

- Pick the **latest** production iOS build when prompted (or the script uses `--latest`).
- Authenticate with Apple (API key or Apple ID).  
- The build appears under your app in App Store Connect → **TestFlight** (processing often takes **10–30+ minutes**).

## 6. TestFlight testers

1. App Store Connect → your app → **TestFlight**.
2. Complete **Export compliance** if asked (you already set `ITSAppUsesNonExemptEncryption` to `false` in `app.json` for the standard “no custom encryption” case; Apple may still ask you to confirm).
3. **Internal testing**: add users with App Store Connect access — available soon after processing.
4. **External testing**: create a group, add testers’ emails, submit for **Beta App Review** the first time.

## 7. Subscriptions (RevenueCat) and App Privacy

1. Configure **App Store Connect** subscription products and **RevenueCat** as described in [`mobile/docs/SUBSCRIPTIONS.md`](docs/SUBSCRIPTIONS.md).
2. Add **`EXPO_PUBLIC_REVENUECAT_API_KEY`** to EAS **production** (and preview if you test IAP there). Do not set `EXPO_PUBLIC_IAP_USE_MOCK=1` on store builds.
3. **Expo Go** uses a Metro **mock** for `react-native-purchases` in development; use a **development build** or **TestFlight** for real StoreKit + sandbox purchases.
4. After shipping IAP, update **App Store Connect → App Privacy** for purchase/subscription data and third parties (e.g. RevenueCat) so it matches your hosted Privacy Policy.

## 8. Common issues

| Issue | What to do |
|--------|------------|
| “No bundle identifier” / mismatch | Bundle ID in Apple Developer, App Store Connect, and `app.json` must all be `com.gmatwizard.mobile`. |
| Submit fails | Create an [App Store Connect API key](https://appstoreconnect.apple.com/access/api) (App Manager) and run `eas credentials` / configure submit with the key. |
| Missing env in release build | Add `EXPO_PUBLIC_*` (and any secrets) in EAS environment variables for production. |
| Google Sign-In broken on device | iOS needs the correct OAuth client IDs and URL scheme; confirm [Expo + Google auth](https://docs.expo.dev/guides/google-authentication/) for your bundle ID. |
| IAP / paywall empty on device | Confirm RevenueCat offering **`default`** with **monthly** + **annual** packages and product IDs match `lexicon_pro_monthly` / `lexicon_pro_yearly`. |

## Quick reference

| Command | Purpose |
|---------|---------|
| `npm run mobile:eas:build:ios` | Production iOS build (TestFlight / App Store) |
| `npm run mobile:eas:submit:ios` | Upload latest production iOS build to App Store Connect |
| `cd mobile && npx eas-cli whoami` | Check Expo login |
| `cd mobile && npx eas-cli credentials` | Manage iOS certs / profiles |
