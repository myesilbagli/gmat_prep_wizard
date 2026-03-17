import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // HashRouter avoids 404s on GitHub Pages deep links.
  plugins: [react()],
})
