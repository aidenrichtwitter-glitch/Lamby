@echo off
title grok-keyboard
cd /d "C:\Users\Aiden\Desktop\Lamby\projects\grok-keyboard"
echo.
echo [Lamby] Running: npx vite --host 0.0.0.0 --port 5197
echo.
npx vite --host 0.0.0.0 --port 5197
echo.
echo [Lamby] Command finished. Press any key to close.
pause >nul
