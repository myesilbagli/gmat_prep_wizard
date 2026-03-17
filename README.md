# GMAT Vocab Wizard

Mobile-first vocab lookup + saving for GMAT prep.

## Dev

See `[README-DEV.md](README-DEV.md)`.

## Deploy (GitHub Pages)

- Push to a GitHub repo with default branch `main`
- In GitHub repo settings:
  - **Pages → Build and deployment → Source: GitHub Actions**
- Add these as **GitHub Actions secrets** (Repo → Settings → Secrets and variables → Actions):
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FUNCTIONS_BASE_URL` (after Functions deploy)
