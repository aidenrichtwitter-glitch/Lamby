import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: "/__preview/5176/",
  server: {
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
	plugins: [sveltekit()]
});
