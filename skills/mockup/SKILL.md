---
name: mockup
description: Use whenever the user wants to *see* a prototype, mockup, preview, sketch, or visual concept of something being discussed — including phrases like "mock this up", "show me what that would look like", "preview this", "let's prototype the X", "/mockup", or any time the conversation reaches a point where an HTML/CSS preview would be more useful than more talking. Spins up (or reuses) a background local HTTP server in `.claude/mockups/`, generates a Tailwind v4 HTML page rendering the idea, and opens it in the connected Chrome browser. Lean toward triggering rather than away from it — half the value is jumping straight from conversation to visual.
---

# Mockup

Turn the current conversation into a visual prototype the user can look at in their browser. The deliverable is a single static HTML page (Tailwind v4 via CDN) served from a long-lived local server in the project, opened automatically in the user's connected Chrome tab.

The point is speed and feel. These are throwaway design explorations, not production code — they should *look* real (good copy, plausible data, real-feeling layout) without doing anything real (no forms, no JS frameworks, no backend wiring).

The scripts live at `~/.claude/skills/mockup/scripts/` and the starter template at `~/.claude/skills/mockup/assets/template.html`. All commands below reference these paths directly.

## Workflow

### 1. Decide what to mock up

- If the user passed an argument (e.g. `/mockup hero redesign`), use that as the topic.
- If not, look back at the recent conversation for the most concrete visual idea — a layout, a component, a page redesign, a comparison — and mock that.
- If the conversation is too vague to make something convincing, ask one clarifying question before continuing. A mockup that hedges with "Lorem ipsum" everywhere is wasted effort.

Pick a short kebab-case slug for the folder: `hero-redesign`, `pricing-three-tier`, `footer-sitemap`, etc. The user will see this in the URL and the index, so make it descriptive.

### 2. Start (or reuse) the server

```bash
python3 ~/.claude/skills/mockup/scripts/mockup_server.py ensure
```

This is idempotent — call it every time. It prints the base URL on stdout (e.g. `http://localhost:54213`). Behind the scenes it:

- Creates `.claude/mockups/` in the project root if needed
- Adds `.claude/mockups/` to `.gitignore` if not already covered
- Reuses an existing server if one is alive, or starts a new `python3 -m http.server` on a free port bound to 127.0.0.1
- Persists PID + port in `.claude/mockups/.server.json` so future sessions in this project share the server

Capture the printed URL — you'll need it in step 5.

### 3. Write the mockup HTML

Create `.claude/mockups/<slug>/index.html`. Use the starter at `~/.claude/skills/mockup/assets/template.html` as a base — it's a minimal Tailwind v4 CDN setup. Read it if you want to see the shape, but feel free to depart from it entirely if the mockup calls for something different (a full-bleed hero, a dark theme, a side-by-side comparison view, etc.).

What makes a good mockup:

- **Real-feeling copy.** Names, numbers, dates, headlines that someone could actually believe. "Acme Corp" and "Lorem ipsum" cost you nothing to replace with something plausible.
- **Real-feeling content density.** A pricing card with three features doesn't sell the idea — eight does. Err on the side of more.
- **Placeholder images** via `https://placehold.co/<w>x<h>` or, if you know a fitting Unsplash image, link directly. If the mockup is for *this* project, peek at existing assets first.
- **Match the project's aesthetic** when you have signal — check `STYLE.md`, recent templates, or the live site's design language.
- **Lean on CSS, not JS.** Tailwind v4 covers almost everything. Inline `<style>` is fine for the occasional custom thing.

If you need additional files (images, secondary pages), put them under `.claude/mockups/<slug>/` and reference relatively.

### 4. Regenerate the index page

```bash
python3 ~/.claude/skills/mockup/scripts/mockup_server.py reindex
```

This rewrites `.claude/mockups/index.html` with cards for every mockup folder, most-recently-modified first. The user can browse from `http://localhost:<port>/` to find earlier mockups in this project.

### 5. Open it in the connected Chrome browser

Use the Claude in Chrome MCP to open `http://localhost:<port>/<slug>/` in a new tab so the user sees it immediately and you can screenshot/inspect it too if needed. The tool requires schema loading first:

```
ToolSearch query="select:mcp__claude-in-chrome__tabs_create_mcp"
mcp__claude-in-chrome__tabs_create_mcp url=http://localhost:<port>/<slug>/
```

Then tell the user — briefly — what's in the mockup and the URL.

## Iterating on a mockup

If the user wants to tweak the mockup you just made, edit `.claude/mockups/<slug>/index.html` in place. Tell them to refresh the tab; no need to restart the server or reopen anything.

If they want to compare two directions, create a sibling folder (`<slug>-alt`, `<slug>-v2`, or a more descriptive name like `hero-bold` vs `hero-quiet`) so both render side-by-side in the index. Run `reindex` after.

## Things to avoid

- Don't start a new server when one is already running — `ensure` handles that. Don't manually `python3 -m http.server`.
- Don't commit `.claude/mockups/` — `ensure` writes the gitignore entry, but verify if a `git add` happens nearby.
- Don't wire up forms, APIs, or "real" interactivity. These are static previews. If the user wants real behavior, build it for real, not in a mockup.
- Don't add CSS frameworks beyond Tailwind (no Bootstrap, no Bulma). The template's CDN script is the whole styling stack.
- Don't write a mockup full of `Lorem ipsum` or `Item 1 / Item 2 / Item 3`. If you can't fill it convincingly, ask for one more detail first.

## Server lifecycle

The server keeps running across Claude Code sessions because PID + port are persisted on disk. It will outlive a single chat. If the user explicitly wants to stop it:

```bash
python3 ~/.claude/skills/mockup/scripts/mockup_server.py stop
```

To check whether one is running:

```bash
python3 ~/.claude/skills/mockup/scripts/mockup_server.py status
```
