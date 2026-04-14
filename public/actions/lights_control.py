"""
FRACTURE: Google Home Light Control — Autonomous Python Script
Usage from Grok:
  GET {RELAY}/api/grok-do?task=google-home&action=off              ← All lights off
  GET {RELAY}/api/grok-do?task=google-home&action=off&rooms=dining  ← Dining room off
  GET {RELAY}/api/grok-do?task=google-home&action=on&rooms=master   ← Master bedroom on
  GET {RELAY}/api/grok-do?task=google-home&action=status            ← Check all states
  GET {RELAY}/api/grok-do?task=lights&action=off&rooms=all          ← Same (alias)

Or run this script directly on the desktop:
  python lights_control.py off                    ← All off
  python lights_control.py off dining,master      ← Specific rooms
  python lights_control.py on living               ← Living room on
  python lights_control.py status                  ← Status check

DOM SELECTOR: button.mat-mdc-tooltip-trigger
  title="Turn off" → device is currently ON
  title="Turn on"  → device is currently OFF
CLICK METHOD: PointerEvent(pointerdown) + PointerEvent(pointerup) + MouseEvent(click)
  All with {bubbles:true} — regular .click() does NOT work on Google Home tiles.
"""

import sys, json, time

TUNNEL = None
GHOME_URL = "https://home.google.com/home/1-a180dbc5e1b48c92235ebf4df1255bb394d9110eeaa65b9a0ba2405135dc474a/devices"

ROOM_MAP = {
    "back door": 2, "back_door": 2, "backdoor": 2,
    "bedroom 2": 3, "bedroom2": 3,
    "bedroom 3": 4, "bedroom3": 4,
    "dining room": 5, "dining": 5, "diningroom": 5,
    "garden level": 6, "garden": 6, "dimmer": 6,
    "sink light": 7, "sink": 7, "kitchen light": 7, "kitchen": 7,
    "living room": 8, "living": 8, "livingroom": 8,
    "master bedroom": 9, "master": 9, "masterbedroom": 9,
    "bathroom fan": 10, "fan": 10, "bath fan": 10,
    "bathroom light": 11, "bathroom": 11, "bath light": 11,
}

DEVICE_NAMES = {
    2: "back door", 3: "Bedroom 2", 4: "Bedroom 3",
    5: "dining room", 6: "Garden Level Dimmer", 7: "sink light",
    8: "living room", 9: "Master Bedroom",
    10: "bathroom fan", 11: "bathroom light",
}

JS_STATUS = """Array.from(document.querySelectorAll('button.mat-mdc-tooltip-trigger')).map(function(b,i){return i+':'+b.title+'|'+b.textContent.replace(/\\s+/g,' ').trim().substring(0,40)}).join('||')"""

def js_click_tiles(indices, desired_action):
    title_filter = "Turn off" if desired_action == "off" else "Turn on" if desired_action == "on" else None
    if indices == "all" and title_filter:
        return f"""(function(){{var tiles=document.querySelectorAll('button.mat-mdc-tooltip-trigger');var r=[];for(var i=0;i<tiles.length;i++){{var t=tiles[i];if(t.title==='{title_filter}'){{t.dispatchEvent(new PointerEvent('pointerdown',{{bubbles:true}}));t.dispatchEvent(new PointerEvent('pointerup',{{bubbles:true}}));t.dispatchEvent(new MouseEvent('click',{{bubbles:true,cancelable:true}}));r.push(i+':'+t.textContent.replace(/\\s+/g,' ').trim().substring(0,30))}}}}return r.length?'Toggled: '+r.join(', '):'No devices needed toggling — all already {desired_action}'}})()"""
    if indices == "all":
        return """(function(){var tiles=document.querySelectorAll('button.mat-mdc-tooltip-trigger');var r=[];for(var i=2;i<tiles.length;i++){var t=tiles[i];t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));t.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));r.push(i+':'+t.title)}return'Toggled: '+r.join(', ')})()"""
    idx_arr = indices if isinstance(indices, list) else [indices]
    idx_str = json.dumps(idx_arr)
    if title_filter:
        return f"""(function(){{var tiles=document.querySelectorAll('button.mat-mdc-tooltip-trigger');var idx={idx_str};var r=[];idx.forEach(function(i){{var t=tiles[i];if(t&&t.title==='{title_filter}'){{t.dispatchEvent(new PointerEvent('pointerdown',{{bubbles:true}}));t.dispatchEvent(new PointerEvent('pointerup',{{bubbles:true}}));t.dispatchEvent(new MouseEvent('click',{{bubbles:true,cancelable:true}}));r.push(i+':toggled')}}else if(t){{r.push(i+':already_{desired_action}')}}}});return r.length?r.join(', '):'no tiles found'}})()"""
    return f"""(function(){{var tiles=document.querySelectorAll('button.mat-mdc-tooltip-trigger');var idx={idx_str};var r=[];idx.forEach(function(i){{var t=tiles[i];if(t){{t.dispatchEvent(new PointerEvent('pointerdown',{{bubbles:true}}));t.dispatchEvent(new PointerEvent('pointerup',{{bubbles:true}}));t.dispatchEvent(new MouseEvent('click',{{bubbles:true,cancelable:true}}));r.push(i+':'+t.title)}}}});return'Toggled: '+r.join(', ')}})()"""


def resolve_rooms(room_str):
    if not room_str or room_str in ("all", "everything", "house"):
        return "all"
    names = [r.strip().lower() for r in room_str.replace("+", ",").replace(";", ",").replace("&", ",").split(",") if r.strip()]
    indices = []
    not_found = []
    for rn in names:
        if rn in ROOM_MAP:
            indices.append(ROOM_MAP[rn])
        else:
            fuzzy = next((k for k in ROOM_MAP if rn in k or k in rn), None)
            if fuzzy:
                indices.append(ROOM_MAP[fuzzy])
            else:
                not_found.append(rn)
    if not indices and not_found:
        available = sorted(set(ROOM_MAP.values()))
        avail_names = [DEVICE_NAMES.get(i, f"idx:{i}") for i in available]
        return {"error": f"Unknown rooms: {not_found}. Available: {', '.join(avail_names)}"}
    return indices


def relay_call(chain):
    import urllib.request, urllib.parse
    enc = urllib.parse.quote(chain, safe='')
    url = f"{TUNNEL}/api/grok-do?chain={enc}&project=__system__"
    req = urllib.request.Request(url, headers={"User-Agent": "Lamby/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def parse_status(raw):
    devices = []
    for part in raw.split("||"):
        if not part or ":" not in part:
            continue
        idx_str, rest = part.split(":", 1)
        try:
            idx = int(idx_str)
        except ValueError:
            continue
        if idx < 2:
            continue
        title_and_text = rest.split("|", 1)
        title = title_and_text[0] if len(title_and_text) > 0 else ""
        text = title_and_text[1] if len(title_and_text) > 1 else ""
        is_on = "Turn off" in title
        name = DEVICE_NAMES.get(idx, text.strip()[:30])
        devices.append({"index": idx, "name": name, "on": is_on})
    return devices


def run_via_relay(action, rooms_str=None):
    global TUNNEL
    if not TUNNEL:
        print("ERROR: No tunnel URL set. Set TUNNEL variable or pass via env.")
        sys.exit(1)

    indices = resolve_rooms(rooms_str)
    if isinstance(indices, dict) and "error" in indices:
        return indices

    nav_chain = f"nav:{GHOME_URL}|wait:7000"
    result = relay_call(nav_chain)

    if action == "status":
        result = relay_call(f"eval:{JS_STATUS}")
        data = result.get("data", {})
        raw = ""
        for r in data.get("results", []):
            d = r.get("data", {})
            raw = d.get("output", d.get("result", d.get("value", "")))
        devices = parse_status(raw)
        return {"action": "status", "devices": devices,
                "summary": ", ".join(f"{d['name']}: {'ON' if d['on'] else 'OFF'}" for d in devices)}

    click_js = js_click_tiles(indices, action)
    result = relay_call(f"eval:{click_js}")
    click_output = ""
    for r in result.get("data", {}).get("results", []):
        d = r.get("data", {})
        click_output = d.get("output", d.get("result", d.get("value", "")))

    time.sleep(2.5)

    result = relay_call(f"eval:{JS_STATUS}")
    raw = ""
    for r in result.get("data", {}).get("results", []):
        d = r.get("data", {})
        raw = d.get("output", d.get("result", d.get("value", "")))
    devices = parse_status(raw)

    still_wrong = []
    target_on = action == "on"
    check_indices = list(range(2, 12)) if indices == "all" else indices
    for d in devices:
        if d["index"] in check_indices and d["on"] != target_on:
            still_wrong.append(d)

    if still_wrong:
        retry_indices = [d["index"] for d in still_wrong]
        retry_js = js_click_tiles(retry_indices, action)
        relay_call(f"eval:{retry_js}")
        time.sleep(2.5)
        result = relay_call(f"eval:{JS_STATUS}")
        raw = ""
        for r in result.get("data", {}).get("results", []):
            d = r.get("data", {})
            raw = d.get("output", d.get("result", d.get("value", "")))
        devices = parse_status(raw)

    return {"action": action, "clicked": click_output, "devices": devices,
            "summary": ", ".join(f"{d['name']}: {'ON' if d['on'] else 'OFF'}" for d in devices)}


def run_via_task_macro(action, rooms_str=None):
    import urllib.request
    params = f"task=google-home&action={action}"
    if rooms_str and rooms_str != "all":
        params += f"&rooms={urllib.parse.quote(rooms_str)}"
    url = f"{TUNNEL}/api/grok-do?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "Lamby/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


if __name__ == "__main__":
    import os
    TUNNEL = os.environ.get("LAMBY_TUNNEL", os.environ.get("TUNNEL", ""))
    if not TUNNEL:
        TUNNEL = "https://eliminate-messaging-establishing-responsibility.trycloudflare.com"

    action = sys.argv[1].lower() if len(sys.argv) > 1 else "status"
    rooms = sys.argv[2] if len(sys.argv) > 2 else None

    if action in ("off", "on", "toggle", "status"):
        result = run_via_relay(action, rooms)
        print(json.dumps(result, indent=2))
    else:
        print(f"Unknown action: {action}")
        print("Usage: python lights_control.py [off|on|toggle|status] [room1,room2,...]")
        print(f"Rooms: {', '.join(sorted(set(DEVICE_NAMES.values())))}")
