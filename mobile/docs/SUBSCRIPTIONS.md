# Lexicon Pro (RevenueCat + App Store)

Do these steps in **App Store Connect** and **RevenueCat** before expecting real purchases in a **dev client** or **TestFlight** build.

## 1. App Store Connect

1. Open your app → **Subscriptions** → create a **Subscription Group** (e.g. “Lexicon Pro”).
2. Add two **auto-renewable** products with these **Product IDs** (must match code in [`src/lib/iap/constants.ts`](../src/lib/iap/constants.ts)):
   - `lexicon_pro_monthly`
   - `lexicon_pro_yearly`
3. Set prices, localizations, and review information.
4. Submit subscription metadata for review with the app version that includes IAP.

## 2. RevenueCat (app.revenuecat.com)

1. Create a project and add an **iOS app** with bundle ID `com.gmatwizard.mobile` (see [`app.json`](../app.json)).
2. Under **Products**, import or enter the same App Store product IDs.
3. Create an **Entitlement**: identifier **`lexicon_pro`** (must match `LEXICON_PRO_ENTITLEMENT` in code).
4. Create an **Offering** identifier **`default`** with two packages:
   - **Monthly** → `lexicon_pro_monthly` (RevenueCat often labels this `$rc_monthly`).
   - **Annual** → `lexicon_pro_yearly` (`$rc_annual`).

## 3. EAS environment variables

For **production** and **preview** builds (not Expo Go):

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | RevenueCat **public** SDK key (iOS). |
| Do **not** set `EXPO_PUBLIC_IAP_USE_MOCK=1` | Production `NODE_ENV` already disables the Metro mock; avoid forcing mock in release. |

Optional local dev:

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_IAP_USE_MOCK=1` | Force mock module (Expo Go). |
| `EXPO_PUBLIC_IAP_MOCK_ENTITLED=0` | Mock starts **without** Pro so you can test the paywall in Expo Go. |

## 4. App Store Connect — App Privacy

After enabling subscriptions, update the **App Privacy** questionnaire to reflect:

- **Purchase history** (or equivalent) for subscription status.
- **Third-party partners** involved in purchases (e.g. **RevenueCat**), consistent with your [Privacy Policy](../../src/pages/PrivacyPolicyPage.tsx) hosted at `/#/privacy`.

This step is manual in Apple’s UI; align answers with RevenueCat’s App Store disclosure guidance. Your hosted policy should match: see repo root `src/pages/PrivacyPolicyPage.tsx`.
