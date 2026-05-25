---
description: Daily report combining yesterday's work summary and today's briefing from Basecamp, GitHub, Notion, Harvest, and Gmail.
allowed-tools: Bash, mcp__a873b553-f126-4e29-8f6f-f268b276f7da__notion-search, mcp__c89c67e4-c14c-42d2-9a67-1e7368b88ced__gmail_search_messages, mcp__c89c67e4-c14c-42d2-9a67-1e7368b88ced__gmail_read_message
---

# /daily — Daily work report

Generates a daily report combining yesterday's work summary and today's briefing. Pulls from Basecamp, GitHub, Notion, Harvest, and Gmail. Automatically detects which team member is running it.

## Usage

- `/daily` — Run both yesterday and today reports
- `/daily yesterday` — Yesterday's work summary only
- `/daily today` — Today's briefing only

The user may also say things like:
- "daily report"
- "daily update"
- "what did I do yesterday"
- "what should I work on today"

## Tools

- **Basecamp CLI** (`basecamp`) — Timeline, assigned todos, overdue reports.
- **GitHub CLI** (`gh`) — Commits, issues, PRs.
- **Harvest CLI** (`hrvst`) — Time entries.
- **Notion MCP** — Page search for meeting notes and documents.
- **Gmail MCP** — Email search for urgent/action-required messages (today section only).

## Steps

### 1. Detect User Identity

Run `git config user.name` and match against the team roster in the daily-report skill. If no match, ask the user who they are before proceeding.

### 2. Determine Mode

Based on the user's request:
- If they asked for "yesterday" → run Yesterday section only
- If they asked for "today" → run Today section only
- If no specific section requested → run both sections

### 3. Compute Dates

Calculate the concrete YYYY-MM-DD dates needed:
- **Yesterday**: Previous business day. **On Monday, this is always the previous Friday** — never Saturday or Sunday.
- **Today**: Current date.

### 4. Run Yesterday Section (if applicable)

Gather data from all four sources **in parallel** (Basecamp, GitHub, Notion, Harvest) following the data source instructions in the daily-report skill.

Format the output following the Yesterday output structure in the daily-report skill.

If running both sections, prefix with:

```
# Yesterday
```

### 5. Run Today Section (if applicable)

Gather data from all four sources **in parallel** (Basecamp, GitHub, Notion, Gmail) following the data source instructions in the daily-report skill.

Format the output following the Today output structure in the daily-report skill.

If running both sections, prefix with:

```
# Today
```

### 6. Post to Basecamp

After generating the full report, post it as a check-in answer to the team's daily question:

```bash
basecamp checkins answer create "https://3.basecamp.com/5624304/buckets/32948200/questions/9684812567" "<html content>"
```

**Formatting for Basecamp:**
- Convert the report to **HTML** (Basecamp does not support markdown).
- Do **not** use tables — Basecamp strips them. Use `<ul>`, `<li>`, `<strong>`, `<h2>`, `<h3>`, and `<p>` tags instead.
- Use `<h2 style="background-color:#fff9c4;">` for Yesterday / Today headings (yellow highlight), `<h3>` for section headings (GitHub, Basecamp, Harvest, etc.), and `<ul><li>` for list items.
- Keep `<strong>` for emphasis where markdown would use bold.
- The HTML content must be passed as a single string argument to the command.

Also display the report in the terminal in markdown as usual so the user can read it immediately.

## Rules

- **Always detect identity first.** Never assume who is running the report.
- **Gather sources in parallel.** Issue all data source Bash calls in a single message as parallel tool calls. Never use `run_in_background` — background tasks write to temp files in `/private/tmp/` which require additional shell permissions to read back.
- **Monday = Friday.** When running on a Monday, yesterday is always the previous Friday, never a weekend day.
- **Degrade gracefully.** If a CLI tool is missing or a source errors, skip it and note it at the end. Never fail the entire report because one source is unavailable.
- **Keep it scannable.** Use markdown headers, bullet points, and concise language. The user wants a quick overview, not a wall of text.
- **Cross-reference is valuable.** In the yesterday section, always flag work without Harvest entries and Harvest entries without notes.
- **Stay in scope.** Only report on yesterday and today. Do not query Calendar, Slack, or produce reports for other date ranges unless explicitly asked.
- **Always link.** Every GitHub repo, PR, commit, Basecamp todo, project, and email thread must be a clickable hyperlink using URLs from the API responses. Never print a bare URL — always wrap in link text. See the Linking section in the daily-report skill for per-source URL patterns.
