#!/usr/bin/env python3
"""Manage a local HTTP server that serves `.claude/mockups/` from the current project.

Subcommands:
  ensure   Start the server if not already running. Print the base URL on stdout.
  status   Print the base URL if the server is running, else exit 1.
  stop     Kill the running server and remove its state file.
  reindex  Regenerate `.claude/mockups/index.html` with cards linking to every mockup.

State lives at `<project>/.claude/mockups/.server.json` so multiple Claude sessions in
the same project share one server. The server binds to 127.0.0.1 on a random free port.
"""

from __future__ import annotations

import html
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path


def project_root() -> Path:
    """Walk up from cwd looking for a .git directory or CLAUDE.md as the project marker."""
    cur = Path.cwd().resolve()
    while cur != cur.parent:
        if (cur / ".git").exists() or (cur / "CLAUDE.md").exists():
            return cur
        cur = cur.parent
    return Path.cwd().resolve()


ROOT = project_root()
MOCKUPS_DIR = ROOT / ".claude" / "mockups"
STATE_FILE = MOCKUPS_DIR / ".server.json"
LOG_FILE = MOCKUPS_DIR / ".server.log"


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def read_state() -> dict | None:
    if not STATE_FILE.exists():
        return None
    try:
        return json.loads(STATE_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def write_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2))


def server_alive(state: dict) -> bool:
    pid = state.get("pid")
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    # Also verify the port still answers — covers cases where the PID got recycled.
    port = state.get("port")
    if not port:
        return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.2)
        try:
            s.connect(("127.0.0.1", port))
            return True
        except OSError:
            return False


def ensure_gitignore() -> None:
    """Make sure `.claude/mockups/` is gitignored so previews never get committed."""
    gi = ROOT / ".gitignore"
    entry = ".claude/mockups/"
    if gi.exists():
        content = gi.read_text()
        lines = {line.strip().rstrip("/") for line in content.splitlines()}
        if entry.rstrip("/") in lines or ".claude" in lines:
            return
        if not content.endswith("\n"):
            content += "\n"
        content += entry + "\n"
        gi.write_text(content)
    else:
        gi.write_text(entry + "\n")


def start_server() -> dict:
    MOCKUPS_DIR.mkdir(parents=True, exist_ok=True)
    port = find_free_port()
    log = open(LOG_FILE, "ab")
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=str(MOCKUPS_DIR),
        stdout=log,
        stderr=log,
        start_new_session=True,
    )
    # Give the server a beat to bind before we hand back the URL.
    for _ in range(20):
        time.sleep(0.05)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.1)
            try:
                s.connect(("127.0.0.1", port))
                break
            except OSError:
                continue
    state = {"pid": proc.pid, "port": port, "started_at": time.time(), "root": str(ROOT)}
    write_state(state)
    return state


def cmd_ensure() -> int:
    MOCKUPS_DIR.mkdir(parents=True, exist_ok=True)
    ensure_gitignore()
    state = read_state()
    if state and server_alive(state):
        print(f"http://localhost:{state['port']}")
        return 0
    state = start_server()
    print(f"http://localhost:{state['port']}")
    return 0


def cmd_status() -> int:
    state = read_state()
    if state and server_alive(state):
        print(f"http://localhost:{state['port']}")
        return 0
    print("not running", file=sys.stderr)
    return 1


def cmd_stop() -> int:
    state = read_state()
    if state and state.get("pid"):
        try:
            os.kill(state["pid"], 15)
        except OSError:
            pass
    if STATE_FILE.exists():
        STATE_FILE.unlink()
    return 0


def _format_mtime(ts: float) -> str:
    t = time.localtime(ts)
    # %-I is non-portable but works on macOS/Linux. Fallback to %I if it errors.
    try:
        return time.strftime("%b %-d, %Y · %-I:%M %p", t)
    except ValueError:
        return time.strftime("%b %d, %Y · %I:%M %p", t)


def cmd_reindex() -> int:
    MOCKUPS_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[tuple[str, float]] = []
    for child in MOCKUPS_DIR.iterdir():
        if not child.is_dir() or child.name.startswith("."):
            continue
        index = child / "index.html"
        if index.exists():
            entries.append((child.name, index.stat().st_mtime))
    entries.sort(key=lambda x: -x[1])

    if entries:
        cards = "\n".join(
            (
                f'      <a href="./{html.escape(name)}/" '
                'class="block rounded-xl border border-slate-200 bg-white p-5 '
                'hover:border-slate-400 hover:shadow-sm transition">'
                f'<div class="font-medium text-slate-900">{html.escape(name)}</div>'
                f'<div class="text-xs text-slate-500 mt-1">{_format_mtime(mtime)}</div>'
                "</a>"
            )
            for name, mtime in entries
        )
    else:
        cards = '      <p class="text-slate-500 text-sm">No mockups yet.</p>'

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Mockups — {html.escape(ROOT.name)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-900 antialiased">
  <main class="max-w-3xl mx-auto p-8">
    <header class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight">Mockups</h1>
      <p class="text-sm text-slate-500 mt-1">Prototypes for <span class="font-mono">{html.escape(ROOT.name)}</span></p>
    </header>
    <div class="grid gap-3">
{cards}
    </div>
  </main>
</body>
</html>
"""
    (MOCKUPS_DIR / "index.html").write_text(page)
    return 0


COMMANDS = {
    "ensure": cmd_ensure,
    "status": cmd_status,
    "stop": cmd_stop,
    "reindex": cmd_reindex,
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f"usage: {sys.argv[0]} {{{'|'.join(COMMANDS)}}}", file=sys.stderr)
        sys.exit(2)
    sys.exit(COMMANDS[sys.argv[1]]())


if __name__ == "__main__":
    main()
