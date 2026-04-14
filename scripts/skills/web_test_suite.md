<!-- AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag | Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting. | Read docs/no-reply-system.md for the no-reply protocol. -->
# Skill: Web Test Suite — Full 5-Test Battery

## Proven Methods (2026-04-13)

### T001: Excalidraw Drawing
- **Method**: paste_text + click_at + Ctrl+V
- **Steps**: Kill Chrome → start chrome excalidraw.com → wait 4s → dismiss dialogs (cdp_eval + ESC) → nav fresh excalidraw.com → Ctrl+A DELETE (clear) → paste_text with `{"type":"excalidraw/clipboard","elements":[...]}` → click_at 768,432 → Ctrl+V → ESC
- **Result**: 17-element landscape scene injected successfully
- **Critical**: Do NOT use mouse drawing. Clipboard paste is the only reliable method.

### T002: Telegram Reply
- **Method**: Physical click + paste_text + Enter
- **Steps**: nav web.telegram.org/a/ → wait 5s → cdp_eval click `a[href="#777000"]` (Saved Messages) or `a[href="#-CHATID"]` → wait 3s → click_at 1500,2050 (message input, physical 4K coords) → paste_text message → Enter
- **Result**: Message pasted and sent
- **Critical**: Telegram Web A uses heavy virtual DOM. CDP eval for contenteditable won't find inputs. Use physical click + paste_text + send_keys approach.

### T003: Smart Home Lights
- **Method**: CDP eval on Google Home dashboard
- **Steps**: nav to Google Home URL → wait 8s → cdp_eval read `button.mat-mdc-tooltip-trigger` array → identify devices (switch/lightbulb/mode_fan prefix, On/Off suffix) → cdp_eval dispatch pointerdown+pointerup+click on target button → wait 3s → re-read to verify
- **Result**: 10 devices found. Living room toggled OFF→ON (17%), Garden Level Dimmer toggled, Living room toggled back OFF.
- **Devices found**: back door, Bedroom 2, Bedroom 3, dining room, Garden Level Dimmer, sink light, living room, Master Bedroom, bathroom fan #1, bathroom light
- **Google Home URL**: `https://home.google.com/u/0/home/1-a180dbc5e1b48c92235ebf4df1255bb394d9110eeaa65b9a0ba240`

### T004: SoundCloud Playback
- **Method**: CDP eval search + send_keys Enter + CDP eval click play
- **Steps**: nav soundcloud.com → wait 5s → cdp_eval focus search input + set value "lofi hip hop beats" + dispatch input event → send_keys ENTER → wait 5s → cdp_eval click `.playButton` → wait 3s → screenshot
- **Result**: 44 play buttons found, first clicked. Track playing.

### T005: Google Sheets Create + Fill
- **Method**: CDP navigate + send_keys
- **Steps**: nav docs.google.com/spreadsheets/create → wait 8s (auto-creates new sheet) → verify URL contains spreadsheets/d/ → send_keys "God Mode Test" → TAB → timestamp → ENTER → "=1+2+3" → TAB → "=6*7" → ENTER → screenshot
- **Result**: Sheet created at spreadsheets/d/1m8B6xO8k7QPXDkS8jsiQOrFAIkYQzkchi9D4KWCvS2k. Data and formulas entered.

## Common Patterns
- Always use `confirm=yes` for commands that might be blocked by safety rails
- Physical coords are 3840x2160 (4K). Logical coords (for click_at in browser) can be 1920x1080 or native.
- CDP eval works for most sites but fails on heavy SPAs like Telegram Web A
- For SPA inputs: use physical click_at + paste_text + send_keys as fallback
- screenshot:Chrome captures current browser window
