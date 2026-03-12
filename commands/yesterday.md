Summarize my work yesterday from Basecamp, GitHub, and Notion.

Follow these steps:

1. **Gather data in parallel** from all three sources:

   - **Basecamp**: Run `basecamp timeline me --json` and filter for yesterday's date. Extract the action, project name, target, and summary excerpt for each event.
   - **GitHub**: Run `gh api search/commits` for `author:@me committer-date:<yesterday>` to get commits. Also check `gh api search/issues` for `author:@me updated:<yesterday>` for any PR/issue activity.
   - **Notion**: Use the Notion MCP search tool to find pages created or updated yesterday, filtering by date range. Look for meeting notes, documents, and content updates.

2. **Organize the summary** by source with these sections:

   - **GitHub** — Group commits by repository. Summarize features, fixes, and refactors concisely. Note commit counts per repo.
   - **Basecamp** — Group by project. Highlight completed todos, comments, created items, and any check-in answers. Note total event count.
   - **Notion / Meetings** — Summarize meeting notes, document updates, and content page changes. Include connected sources (Google Drive meeting transcripts, etc.) if relevant.

3. **End with a brief one-liner** capturing the overall shape of the day.

Keep the summary concise and scannable. Use markdown headers and bullet points. Focus on what was accomplished, not raw data.