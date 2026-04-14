import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    hmr: { overlay: true },
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  plugins: [react()],
})
