#!/bin/bash
set -e

echo "[Deploy] Installing full dependencies for build..."
npm install --ignore-scripts 2>/dev/null || npm install 2>/dev/null

echo "[Deploy] Building frontend..."
npm run build

echo "[Deploy] Cleaning up non-essential files..."
rm -rf projects/ electron-browser/ test/ supabase/ attached_assets/ references/ .git/ docs/ tests/ drift-protocol-perp-trading/ path/ src/ public/ .cache/ .config/ .upm/ 2>/dev/null

echo "[Deploy] Pruning node_modules to ws only..."
rm -rf node_modules/
npm install --no-package-lock --ignore-scripts ws 2>/dev/null

echo "[Deploy] Done. dist/ ready, node_modules contains only ws."
