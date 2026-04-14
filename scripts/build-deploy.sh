#!/bin/bash
# AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
# Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
# Read docs/no-reply-system.md for the no-reply protocol.
set -e

echo "[Deploy] Installing dependencies for build..."
npm install 2>/dev/null

echo "[Deploy] Building frontend..."
npm run build

echo "[Deploy] Cleaning workspace for deployment..."
rm -rf node_modules/ projects/ electron-browser/ test/ supabase/ attached_assets/ references/ .cache/ .config/ .upm/ docs/ tests/ src/ public/ 2>/dev/null

echo "[Deploy] Done. Zero npm dependencies needed."
