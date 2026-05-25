---
name: daily-report
description: Team roster, identity detection, and reporting rules for daily work summaries and briefings. Covers data sources (Basecamp, GitHub, Notion, Harvest, Gmail, Google Calendar), output formatting, and cross-referencing logic.
trigger: When generating daily reports, work summaries, or daily briefings for team members.
---

# Daily Report Knowledge

Reference material for generating daily reports. Used by the `/daily` command and activated contextually when discussing daily work summaries or briefings.

## CLI Tool Paths

Always use full paths — `$PATH` is stripped in scheduled/automated contexts:

| Tool | Full Path |
|---|---|
| `basecamp` | `/Users/ray/.local/bin/basecamp` |
| `gh` | `/opt/homebrew/bin/gh` |
| `hrvst` | `/opt/homebrew/bin/node /opt/homebrew/lib/node_modules/hrvst-cli/dist/cli.js` — invoke via node directly; `/opt/homebrew/bin/hrvst` fails in scheduled contexts because its `#!/usr/bin/env node` shebang can't find node when `$PATH` is stripped |
| `swift` scripts | `/Users/ray/.claude/scripts/calendar-today.swift` |

Never run path discovery (`which`, `find`, `ls` to locate binaries). Use the paths above directly.

## Team Roster

Detect the current user by running `git config user.name` and matching against this table (case-insensitive partial match). If no match, ask the user to identify themselves.

| Git Name (contains) | Harvest User ID | Harvest User Name |
|---|---|---|
| Ray | 18287 | Raymond Brigleb |
| Kandace | 464535 | Kandace Brigleb |

To add a new team member, append a row to this table.

The roster is primarily needed for **Harvest** filtering. GitHub (`author:@me`) and Basecamp (`basecamp timeline me`) resolve the current user automatically.

## Date Computation

Compute concrete dates as YYYY-MM-DD. Never use the literal word "yesterday" in API queries.

- **Yesterday**: The previous business day. On Mondays, this resolves to the previous Friday.
- **Today**: The current date.

## Data Sources — Yesterday

Gather all sources **in parallel**:

- **Basecamp** — `/Users/ray/.local/bin/basecamp timeline me --all --json`, then filter in Python for yesterday's date. **Critical**: the response is `{"ok":true,"data":[...events...]}` — iterate over `result['data']`, NOT over the top-level dict. Filter by `e.get('created_at','').startswith('YYYY-MM-DD')`. Example:
  ```bash
  /Users/ray/.local/bin/basecamp timeline me --all --json 2>/dev/null | python3 -c "
  import json,sys; r=json.load(sys.stdin); events=[e for e in r['data'] if e.get('created_at','').startswith('YYYY-MM-DD')]; print(json.dumps(events,indent=2))
  "
  ```
  Extract `action`, `bucket.name` (project), `app_url`, and `summary_excerpt` for each event.
- **GitHub** — `/opt/homebrew/bin/gh api search/commits` with query `author:@me committer-date:YYYY-MM-DD..YYYY-MM-DD`. Also `/opt/homebrew/bin/gh api search/issues` with `author:@me updated:YYYY-MM-DD..YYYY-MM-DD` for PR/issue activity.
- **Notion** — Run **two parallel searches** using the Notion MCP `notion-search` tool. **Always pass `content_search_mode: "workspace_search"` explicitly** — the auto-selected default (`ai_search`) frequently times out or returns only ancient `notion-calendar` entries instead of real pages, silently dropping recent activity.
  1. Search with `created_date_range` for yesterday (catches newly created pages).
  2. Search with no date filter but project-specific keywords (e.g. client names, "meeting notes", "La Marzocco", "Santiam") to find recently updated pages — check the `timestamp` field in results to surface anything within the last 2 days.
  **Important caveats**:
  - `created_date_range` only matches **creation** date, not last-modified date. Updated documents will be missed if you only use this filter.
  - Results may include `type: "notion-calendar"` entries (Google Calendar events synced to Notion) — useful context, but check the `type` field to separate them from real Notion documents.
  - If both searches return only calendar events with no Notion pages, report "No Notion document activity found for yesterday" rather than omitting the section entirely.
- **Harvest** — `/opt/homebrew/bin/node /opt/homebrew/lib/node_modules/hrvst-cli/dist/cli.js time-entries list --from YYYY-MM-DD --to YYYY-MM-DD --fields id,hours,project.name,task.name,notes,user.id,user.name`. Filter results to the detected user's Harvest User ID.

## Data Sources — Today

Gather all sources **in parallel**:

- **Basecamp**:
  - `/Users/ray/.local/bin/basecamp reports assigned --json` — assigned todos across all projects.
  - `/Users/ray/.local/bin/basecamp reports overdue --json` — anything past due.
  - `/Users/ray/.local/bin/basecamp timeline me --all --json` filtered for today using `result['data']` (same structure as yesterday — see above).
- **GitHub** — `/opt/homebrew/bin/gh api search/issues` with query `author:@me is:open` for open PRs, review requests, and CI status.
- **Notion** — Notion MCP search for pages updated in the last 48 hours. **Always pass `content_search_mode: "workspace_search"` explicitly** (the default `ai_search` mode is unreliable — see Yesterday section). Use two parallel searches:
  1. `created_date_range` for the past 2 days (new pages).
  2. Keyword search for active project names without a date filter; use `timestamp` field to identify recent results.
  Same caveats apply: calendar events may appear in results (useful context), but check `type` field to separate them from Notion documents.
- **Gmail** — Gmail MCP `gmail_search_messages` tool. **Important**: this tool's schema is deferred and may not be pre-loaded. If a call fails with "stale definitions" or "tool does not exist", run `ToolSearch` with query `"gmail"` first to load the schema, then retry. Search for unread/flagged messages from the last 48 hours (`is:unread after:YYYY/MM/DD -category:promotions -category:social`). Flag urgent, action-required, or time-sensitive items.
- **Google Calendar** — `swift /Users/ray/.claude/scripts/calendar-today.swift YYYY-MM-DD`. Returns pipe-delimited rows: `calendar|time|title|location|organizer|attendees|notes`. Filter out:
  - All-day events from "My Schedule (Basecamp)" (these are Basecamp todos, already covered above).
  - Events on calendars belonging to other family members (e.g., children's schedules) unless they involve the user.
  - Spam/phishing calendar invites (e.g., fake receipts, unsolicited events from unknown senders).
  Keep: actual meetings with attendees, focused work blocks, and personal all-day events (holidays, time off).

## Linking

**Every reference in the report must be a clickable link** wherever a URL is available. This applies to both the markdown output (terminal) and the HTML posted to Basecamp.

- **Markdown links**: `[text](url)`
- **HTML links**: `<a href="url">text</a>` — Basecamp renders these correctly

### URL sources by data source

**GitHub**
- Commits: use `html_url` from the API response (e.g. `https://github.com/needmore/santiam/commit/abc1234`)
- PRs / Issues: use `html_url` from the API response (e.g. `https://github.com/needmore/cuppin/pull/1103`)
- Repositories: construct `https://github.com/{owner}/{repo}` — link the repo name whenever mentioning it

**Basecamp**
- Timeline events (todos, comments, completed items): use `app_url` from each event object
- Projects: use the bucket's URL pattern `https://3.basecamp.com/5624304/projects/{bucket.id}`
- When a project name appears in a list item, link it to the project URL

**Gmail**
- Thread link: `https://mail.google.com/mail/u/0/#all/{threadId}` — use `threadId` from the message object
- Link the subject line or sender name

**Harvest**
- No deep-link per entry; omit links for Harvest rows

**Google Calendar**
- If the event notes contain a Google Meet or Zoom URL, include it as a clickable link next to the meeting title

### Linking rules

- Link **repo names**, **PR titles**, **todo titles**, and **project names** — not just raw URLs
- Never print a bare URL; always wrap it in link text
- If a URL is unavailable for a specific item, leave it unlinked rather than fabricating one
- In Basecamp HTML, repo/PR references like `needmore/cuppin#1103` should render as `<a href="...">needmore/cuppin#1103</a>`

## Output Format — Yesterday

1. **GitHub** — Commits grouped by repository (repo name linked to `https://github.com/owner/repo`). Each PR/commit referenced should be linked via its `html_url`. Summarize features, fixes, refactors. Note commit counts per repo.
2. **Basecamp** — Activity grouped by project (project name linked via `app_url` or project URL). Each todo/comment linked via its `app_url`. Highlight completed todos, comments, created items, check-in answers.
3. **Notion / Meetings** — Meeting notes, document updates, content page changes. Include connected sources (Google Drive meeting transcripts, etc.) if relevant.
4. **Harvest** — Time entries grouped by project/client. Include task name, hours, and notes. Show total hours for the day.
5. **Cross-reference** — Flag gaps:
   - Work in Basecamp/GitHub/Notion with no corresponding Harvest entry (potentially forgotten hours).
   - Harvest entries with missing or empty notes.
6. **One-liner summary** capturing the shape of the day, including total hours logged.

Concise, scannable, markdown headers and bullet points. Focus on accomplishments, not raw data.

## Output Format — Today

1. **Priority Items** — Overdue todos (linked via `app_url`), failing CI, urgent emails (linked via Gmail thread URL), anything needing immediate attention.
2. **Meetings** — For each meeting from Google Calendar, write 1–2 paragraphs covering:
   - **What it's likely about**: Infer the meeting's purpose from its title, attendees, and notes. Cross-reference with Basecamp projects and recent activity to add context (e.g., if the meeting is "Santiam / Website" and there are Basecamp todos for [SAN], connect the dots).
   - **Topics to bring up or prep**: Based on recent work (Basecamp todos, GitHub commits, open PRs), suggest specific things to discuss, demo, ask about, or research before the meeting. Flag any blockers or decisions that need attendee input.
   - Include the meeting time, attendees, and Google Meet/Zoom link (linked) if available.
   - If there are no meetings with attendees today, skip this section entirely.
3. **Today's Work** — Assigned todos (linked via `app_url`), active PRs (linked via `html_url`), tasks from recent check-in answers or project momentum.
4. **Awaiting Response** — Threads where someone is waiting on the user (Basecamp comments linked, PR reviews requested linked, emails linked via Gmail thread URL).
5. **FYI / Awareness** — Recent teammate activity worth knowing about but not requiring action.
6. **Suggested focus order** — Short numbered list of what to tackle first, based on urgency and dependencies. Place meeting prep before the meeting time.

Concise, actionable, markdown headers and bullet points. Focus on what needs doing, not raw data.

## Basecamp Check-in

The report is posted as a check-in answer to the team's daily question:

```
/Users/ray/.local/bin/basecamp checkins answer create 9684812567 "<html>" --project 32948200 --date YYYY-MM-DD
```

**Command gotchas**:
- The question ID must be a bare numeric ID (e.g., `9684812567`), not a full Basecamp URL.
- The `--date YYYY-MM-DD` flag is **required** — without it the API returns a cryptic `validation error`.
- The `--project` flag is also required alongside `--date`.
- `basecamp checkins answer update` appears broken (returns `validation error`). To correct a posted answer, trash it with `basecamp checkins answer trash` and recreate.

**HTML formatting rules** (Basecamp does not support markdown or tables):
- `<h2 style="background-color:#fff9c4;">` for Yesterday / Today headings (yellow highlight)
- `<h3>` for section headings (GitHub, Basecamp, Harvest, etc.)
- `<ul><li>` for all lists (never `<table>`)
- `<strong>` for emphasis
- `<p>` for summary text
- **Emoji are encouraged** at the start of list items when relevant — they render well in Basecamp and compensate for its limited formatting. Use them to signal urgency (🔴, ⚠️), type (📬 email, 📅 meeting, 🔧 fix, ✅ done), or draw attention to important items. Don't force it — only use emoji where they genuinely add clarity.
- Keep it compact — Basecamp renders long check-in answers poorly
- Note: Basecamp allows `background-color` in inline styles but strips `padding` and other properties

## Error Handling

- **No data from a source**: Skip that source's section. Mention briefly at the end ("No Notion activity found for yesterday").
- **CLI tool not installed or auth error**: Skip that source and note it ("Harvest CLI not configured — skipped"). Don't fail the entire report.
- **Git config not set**: Ask the user who they are.
