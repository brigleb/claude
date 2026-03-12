Review what I should be aware of and working on today from Basecamp, GitHub, Notion, and Gmail.

Follow these steps:

1. **Gather data in parallel** from all four sources:

   - **Basecamp**:
     - Run `basecamp reports assigned --json` to get my assigned todos across all projects.
     - Run `basecamp reports overdue --json` to surface anything past due.
     - Run `basecamp timeline --json` and filter for today's date to see what's already happened and any activity I should respond to.
   - **GitHub**:
     - Run `gh api search/issues` for `author:@me state:open type:pr` to get my open PRs and their review status.
     - Run `gh api search/issues` for `review-requested:@me type:pr state:open` to find PRs awaiting my review.
     - Run `gh api notifications` to check for any mentions or CI failures.
   - **Notion**: Use the Notion MCP search tool to find pages updated today or relevant upcoming items (meetings, tasks, deadlines). Also search for any meeting notes from today.
   - **Gmail**: Use the Gmail MCP tools to search for recent messages — flag anything urgent, action-required, or time-sensitive from today and yesterday. Check for unread messages that need a response.

2. **Organize the briefing** into these sections:

   - **Priority Items** — Overdue todos, failing CI, urgent emails, anything that needs immediate attention.
   - **Today's Work** — Assigned todos, active PRs, scheduled meetings, and tasks based on recent check-in answers or project momentum.
   - **Awaiting Response** — Comments or threads where someone is waiting on me (Basecamp comments directed at me, PR reviews requested, emails needing replies).
   - **FYI / Awareness** — Recent activity from teammates that I should know about but doesn't require action (new comments, completed work, timeline updates).

3. **End with a suggested focus order** — a short numbered list of what to tackle first based on urgency and dependencies.

Keep the briefing concise and actionable. Use markdown headers and bullet points. Focus on what needs doing, not raw data.