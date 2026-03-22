import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from "vite";
import react from '@vitejs/plugin-react-swc';
import path from "path";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  server: {
    hmr: { overlay: true },
    watch: {
      usePolling: true,
      interval: 500,
    },
    host: "0.0.0.0",
    port: 5106,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
});
