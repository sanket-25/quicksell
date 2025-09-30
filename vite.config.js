import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages project site: https://<user>.github.io/quicksell/
  // Use repo name as base when running on CI to ensure assets resolve correctly
  base: process.env.GITHUB_ACTIONS ? '/quicksell/' : '/',
})
