@echo off
REM ============================================================
REM  Lamby Bridge Connector — Windows Launcher
REM  Edit the values below, then double-click to run.
REM  Ctrl+C to stop. It auto-reconnects if the relay drops.
REM ============================================================

REM Dev server URL — connects directly to the live Replit dev session
REM (no deployment interruptions, changes reflect instantly)
set RELAY_URL=wss://35c4f698-dc00-400a-9452-39eaf17279c0-00-31k27xn7snnel.janeway.replit.dev

REM Required: unique key for this desktop connection (use any random string)
set BRIDGE_KEY=YOUR_BRIDGE_KEY_HERE

REM Required: your relay snapshot key (shown on the relay dashboard)
set SNAPSHOT_KEY=92781fb690e47d110da1458cbe03ac9a

REM Required: the project name Grok uses (e.g. groks-app)
set PROJECT_NAME=groks-app

REM Required: path to your project root (the folder containing projects\)
set PROJECT_DIR=C:\Users\Aiden\Desktop\guardian-ai

REM Optional: fallback port for screenshots if dev server port can't be auto-detected
set PREVIEW_PORT=5196

REM ============================================================
echo.
echo  Starting Lamby Bridge Connector...
echo  Relay: %RELAY_URL%
echo  Project: %PROJECT_NAME%  Dir: %PROJECT_DIR%
echo.

node "%~dp0desktop-connector.js"

echo.
echo  Connector stopped. Press any key to close.
pause >nul
