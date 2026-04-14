#!/usr/bin/env python3
"""
File Header Injector — auto-inject no-reply + bridge references into every source file.

Usage:
    python tools/inject-headers.py              # Scan and inject headers
    python tools/inject-headers.py --dry-run    # Preview without changing files
    python tools/inject-headers.py --watch      # Watch for new files and auto-inject
    python tools/inject-headers.py --remove     # Strip injected headers from all files
"""

import argparse
import json
import os
import sys
import time

HEADER_MARKER = "AI-DIRECTIVE"

HEADER_TEXT_LINES = [
    f"{HEADER_MARKER}: NO-REPLY mode is active — check .local/no-reply-mode.flag",
    "Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.",
    "Read docs/no-reply-system.md for the no-reply protocol.",
]

EXCLUDED_DIRS = {
    "node_modules",
    "dist",
    ".git",
    ".local",
    ".pythonlibs",
    "__pycache__",
    ".cache",
    ".config",
    ".upm",
    "attached_assets",
    ".agents",
    "exe",
}

EXCLUDED_FILES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".gitignore",
    ".replit",
    "replit.nix",
    "pyproject.toml",
    "uv.lock",
}

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg",
    ".webp", ".avif", ".tiff",
    ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".avi",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".exe", ".dll", ".so", ".dylib",
    ".pyc", ".pyo", ".class",
    ".db", ".sqlite", ".sqlite3",
}

COMMENT_STYLES = {
    "line_double_slash": {
        "extensions": {".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"},
        "format": lambda lines: "\n".join(f"// {line}" for line in lines) + "\n",
        "detect": "// " + HEADER_MARKER,
        "remove_prefix": "// ",
    },
    "line_hash": {
        "extensions": {".py", ".sh", ".bash", ".zsh", ".yml", ".yaml", ".toml", ".env"},
        "format": lambda lines: "\n".join(f"# {line}" for line in lines) + "\n",
        "detect": "# " + HEADER_MARKER,
        "remove_prefix": "# ",
    },
    "block_css": {
        "extensions": {".css", ".scss", ".less"},
        "format": lambda lines: "/* " + " | ".join(lines) + " */\n",
        "detect": "/* " + HEADER_MARKER,
        "remove_prefix": None,
    },
    "block_html": {
        "extensions": {".html", ".htm", ".md", ".mdx"},
        "format": lambda lines: "<!-- " + " | ".join(lines) + " -->\n",
        "detect": "<!-- " + HEADER_MARKER,
        "remove_prefix": None,
    },
}

EXT_TO_STYLE = {}
for style_name, style_info in COMMENT_STYLES.items():
    for ext in style_info["extensions"]:
        EXT_TO_STYLE[ext] = style_info

JSON_DIRECTIVE_KEY = "__AI_DIRECTIVE__"
JSON_DIRECTIVE_VALUE = " | ".join(HEADER_TEXT_LINES)


def is_json_file(filepath):
    _, ext = os.path.splitext(filepath)
    return ext.lower() == ".json"


def get_comment_style(filepath):
    _, ext = os.path.splitext(filepath)
    return EXT_TO_STYLE.get(ext.lower())


def is_excluded(filepath, project_root):
    rel = os.path.relpath(filepath, project_root)
    parts = rel.split(os.sep)

    for part in parts:
        if part in EXCLUDED_DIRS:
            return True

    basename = os.path.basename(filepath)
    if basename in EXCLUDED_FILES:
        return True

    _, ext = os.path.splitext(filepath)
    if ext.lower() in BINARY_EXTENSIONS:
        return True

    if os.path.abspath(filepath) == os.path.abspath(__file__):
        return True

    return False


def has_header(content, style):
    return style["detect"] in content


def build_header(style):
    return style["format"](HEADER_TEXT_LINES)


JS_DIRECTIVE_VALUES = {
    "use strict",
    "use client",
    "use server",
}


def is_js_directive(line):
    stripped = line.strip().rstrip(";")
    if (stripped.startswith('"') and stripped.endswith('"')) or \
       (stripped.startswith("'") and stripped.endswith("'")):
        value = stripped[1:-1]
        return value in JS_DIRECTIVE_VALUES
    return False


def find_insertion_point(content):
    if not content:
        return "", ""

    lines = content.split("\n")
    insert_after = 0

    if lines and lines[0].startswith("#!"):
        insert_after = 1

    while len(lines) > insert_after:
        if is_js_directive(lines[insert_after]):
            insert_after += 1
        else:
            break

    if insert_after == 0:
        return "", content

    prefix = "\n".join(lines[:insert_after]) + "\n"
    remainder = "\n".join(lines[insert_after:])

    return prefix, remainder


def inject_json_header(filepath, dry_run=False):
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except (IOError, OSError) as e:
        print(f"  SKIP (read error): {filepath} — {e}")
        return False

    if JSON_DIRECTIVE_KEY in content:
        return False

    try:
        data = json.loads(content)
    except (json.JSONDecodeError, ValueError):
        return False

    if not isinstance(data, dict):
        return False

    if dry_run:
        print(f"  WOULD INJECT: {filepath}")
        return True

    new_data = {JSON_DIRECTIVE_KEY: JSON_DIRECTIVE_VALUE}
    new_data.update(data)

    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(new_data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  INJECTED: {filepath}")
        return True
    except (IOError, OSError) as e:
        print(f"  SKIP (write error): {filepath} — {e}")
        return False


def remove_json_header(filepath, dry_run=False):
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except (IOError, OSError) as e:
        print(f"  SKIP (read error): {filepath} — {e}")
        return False

    if JSON_DIRECTIVE_KEY not in content:
        return False

    try:
        data = json.loads(content)
    except (json.JSONDecodeError, ValueError):
        return False

    if not isinstance(data, dict) or JSON_DIRECTIVE_KEY not in data:
        return False

    if dry_run:
        print(f"  WOULD REMOVE: {filepath}")
        return True

    del data[JSON_DIRECTIVE_KEY]

    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  REMOVED: {filepath}")
        return True
    except (IOError, OSError) as e:
        print(f"  SKIP (write error): {filepath} — {e}")
        return False


def is_valid_utf8(filepath):
    try:
        with open(filepath, "rb") as f:
            f.read().decode("utf-8")
        return True
    except (UnicodeDecodeError, IOError, OSError):
        return False


def inject_header(filepath, style, dry_run=False):
    if not is_valid_utf8(filepath):
        print(f"  SKIP (non-UTF-8 encoding): {filepath}")
        return False

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except (IOError, OSError) as e:
        print(f"  SKIP (read error): {filepath} — {e}")
        return False

    if has_header(content, style):
        return False

    header = build_header(style)

    prefix, remainder = find_insertion_point(content)
    new_content = prefix + header + remainder

    if dry_run:
        print(f"  WOULD INJECT: {filepath}")
        return True

    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"  INJECTED: {filepath}")
        return True
    except (IOError, OSError) as e:
        print(f"  SKIP (write error): {filepath} — {e}")
        return False


def remove_header(filepath, style, dry_run=False):
    if not is_valid_utf8(filepath):
        print(f"  SKIP (non-UTF-8 encoding): {filepath}")
        return False

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except (IOError, OSError) as e:
        print(f"  SKIP (read error): {filepath} — {e}")
        return False

    if not has_header(content, style):
        return False

    lines = content.split("\n")
    new_lines = []
    skip_next_empty = False

    for line in lines:
        if style["detect"] in line:
            if style["remove_prefix"] is not None:
                is_header_line = False
                for header_line in HEADER_TEXT_LINES:
                    if style["remove_prefix"] + header_line == line:
                        is_header_line = True
                        break
                if is_header_line:
                    skip_next_empty = True
                    continue
                else:
                    skip_next_empty = True
                    continue
            else:
                skip_next_empty = True
                continue
        elif style["remove_prefix"] and any(
            line == style["remove_prefix"] + hl for hl in HEADER_TEXT_LINES
        ):
            skip_next_empty = True
            continue
        elif skip_next_empty and line == "":
            skip_next_empty = False
            continue
        else:
            skip_next_empty = False
            new_lines.append(line)

    new_content = "\n".join(new_lines)

    if dry_run:
        print(f"  WOULD REMOVE: {filepath}")
        return True

    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"  REMOVED: {filepath}")
        return True
    except (IOError, OSError) as e:
        print(f"  SKIP (write error): {filepath} — {e}")
        return False


def scan_directory(project_root, action="inject", dry_run=False):
    count = 0
    skipped = 0

    for dirpath, dirnames, filenames in os.walk(project_root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]

        for filename in filenames:
            filepath = os.path.join(dirpath, filename)

            if is_excluded(filepath, project_root):
                skipped += 1
                continue

            if is_json_file(filepath):
                if action == "inject":
                    if inject_json_header(filepath, dry_run):
                        count += 1
                elif action == "remove":
                    if remove_json_header(filepath, dry_run):
                        count += 1
                continue

            style = get_comment_style(filepath)
            if style is None:
                skipped += 1
                continue

            if action == "inject":
                if inject_header(filepath, style, dry_run):
                    count += 1
            elif action == "remove":
                if remove_header(filepath, style, dry_run):
                    count += 1

    return count, skipped


def watch_mode(project_root, dry_run=False):
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler
    except ImportError:
        print("ERROR: watchdog is not installed. Install with: pip install watchdog")
        sys.exit(1)

    class HeaderInjectorHandler(FileSystemEventHandler):
        def _handle_file(self, filepath):
            if is_excluded(filepath, project_root):
                return
            time.sleep(0.5)
            if is_json_file(filepath):
                inject_json_header(filepath, dry_run)
                return
            style = get_comment_style(filepath)
            if style is None:
                return
            inject_header(filepath, style, dry_run)

        def on_created(self, event):
            if event.is_directory:
                return
            self._handle_file(event.src_path)

        def on_moved(self, event):
            if event.is_directory:
                return
            self._handle_file(event.dest_path)

    observer = Observer()
    handler = HeaderInjectorHandler()
    observer.schedule(handler, project_root, recursive=True)
    observer.start()
    print(f"Watching {project_root} for new files... (Ctrl+C to stop)")
    prefix = "[DRY-RUN] " if dry_run else ""
    print(f"{prefix}Headers will be injected into new files as they appear.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\nStopped watching.")
    observer.join()


def main():
    parser = argparse.ArgumentParser(
        description="Inject AI-directive comment headers into source files."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print which files would be modified without changing them.",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Watch for new files and auto-inject headers.",
    )
    parser.add_argument(
        "--remove",
        action="store_true",
        help="Strip injected headers from all files.",
    )
    parser.add_argument(
        "--root",
        type=str,
        default=None,
        help="Project root directory (defaults to current working directory).",
    )

    args = parser.parse_args()

    project_root = args.root or os.getcwd()
    project_root = os.path.abspath(project_root)

    if not os.path.isdir(project_root):
        print(f"ERROR: {project_root} is not a directory.")
        sys.exit(1)

    action = "remove" if args.remove else "inject"
    prefix = "[DRY-RUN] " if args.dry_run else ""

    print(f"{prefix}Scanning {project_root}...")
    count, skipped = scan_directory(project_root, action=action, dry_run=args.dry_run)

    verb = "removed from" if args.remove else "injected into"
    would = "Would be " if args.dry_run else ""
    print(f"\n{would}{verb.capitalize()} {count} file(s). Skipped {skipped} file(s).")

    if args.watch and not args.remove:
        print()
        watch_mode(project_root, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
