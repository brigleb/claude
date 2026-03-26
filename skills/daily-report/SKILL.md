---
name: daily-report
description: Team roster, identity detection, and reporting rules for daily work summaries and briefings. Covers data sources (Basecamp, GitHub, Notion, Harvest, Gmail), output formatting, and cross-referencing logic.
trigger: When generating daily reports, work summaries, or daily briefings for team members.
---

# Daily Report Knowledge

Reference material for generating daily reports. Used by the `/daily` command and activated contextually when discussing daily work summaries or briefings.

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

- **Basecamp** — `basecamp timeline me --json`, filtered for yesterday's computed date. Extract action, project name, target, and summary excerpt for each event.
- **GitHub** — `gh api search/commits` with query `author:@me committer-date:YYYY-MM-DD..YYYY-MM-DD`. Also `gh api search/issues` with `author:@me updated:YYYY-MM-DD..YYYY-MM-DD` for PR/issue activity.
- **Notion** — Notion MCP search for pages created or updated on yesterday's date. Look for meeting notes, documents, and content updates.
- **Harvest** — `hrvst time-entries list --from YYYY-MM-DD --to YYYY-MM-DD --fields id,hours,project.name,task.name,notes,user.id,user.name`. Filter results to the detected user's Harvest User ID.

## Data Sources — Today

Gather all sources **in parallel**:

- **Basecamp**:
  - `basecamp reports assigned --json` — assigned todos across all projects.
  - `basecamp reports overdue --json` — anything past due.
  - `basecamp timeline --json` filtered for today — activity to respond to.
- **GitHub** — `gh api search/issues` with query `author:@me is:open` for open PRs, review requests, and CI status.
- **Notion** — Notion MCP search for pages updated in the last 48 hours. Check Meetings, Documents, and Cases databases.
- **Gmail** — Gmail MCP search prioritizing unread/flagged messages from the last 48 hours. Only go back further (up to 2 weeks) for threads with new replies. Flag urgent, action-required, or time-sensitive items.

## Output Format — Yesterday

1. **GitHub** — Commits grouped by repository. Summarize features, fixes, refactors. Note commit counts per repo.
2. **Basecamp** — Activity grouped by project. Highlight completed todos, comments, created items, check-in answers. Note total event count.
3. **Notion / Meetings** — Meeting notes, document updates, content page changes. Include connected sources (Google Drive meeting transcripts, etc.) if relevant.
4. **Harvest** — Time entries grouped by project/client. Include task name, hours, and notes. Show total hours for the day.
5. **Cross-reference** — Flag gaps:
   - Work in Basecamp/GitHub/Notion with no corresponding Harvest entry (potentially forgotten hours).
   - Harvest entries with missing or empty notes.
6. **One-liner summary** capturing the shape of the day, including total hours logged.

Concise, scannable, markdown headers and bullet points. Focus on accomplishments, not raw data.

## Output Format — Today

1. **Priority Items** — Overdue todos, failing CI, urgent emails, anything needing immediate attention.
2. **Today's Work** — Assigned todos, active PRs, scheduled meetings, tasks from recent check-in answers or project momentum.
3. **Awaiting Response** — Threads where someone is waiting on the user (Basecamp comments, PR reviews requested, emails needing replies).
4. **FYI / Awareness** — Recent teammate activity worth knowing about but not requiring action.
5. **Suggested focus order** — Short numbered list of what to tackle first, based on urgency and dependencies.

Concise, actionable, markdown headers and bullet points. Focus on what needs doing, not raw data.

## Basecamp Check-in

The report is posted as a check-in answer to the team's daily question:

```
basecamp checkins answer create 9684812567 "<html>" --project 32948200 --date YYYY-MM-DD
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
- Keep it compact — Basecamp renders long check-in answers poorly
- Note: Basecamp allows `background-color` in inline styles but strips `padding` and other properties

## Error Handling

- **No data from a source**: Skip that source's section. Mention briefly at the end ("No Notion activity found for yesterday").
- **CLI tool not installed or auth error**: Skip that source and note it ("Harvest CLI not configured — skipped"). Don't fail the entire report.
- **Git config not set**: Ask the user who they are.
