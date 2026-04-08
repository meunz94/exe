import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Actions sets VITE_BASE: "/" for user/org pages, "/repo/" for project pages.
const base = process.env.VITE_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
