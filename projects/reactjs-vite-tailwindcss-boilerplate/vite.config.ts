import tsconfigPaths from 'vite-tsconfig-paths'
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  server: {
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: '.vitest/setup',
    include: ['**/test.{ts,tsx}']
  }
})
