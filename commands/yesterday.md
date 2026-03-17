Summarize my work yesterday from Basecamp, GitHub, Notion, and Harvest.

Follow these steps:

1. **Gather data in parallel** from all four sources:

   - **Basecamp**: Run `basecamp timeline me --json` and filter for yesterday's date. Extract the action, project name, target, and summary excerpt for each event.
   - **GitHub**: Run `gh api search/commits` for `author:@me committer-date:<yesterday>` to get commits. Also check `gh api search/issues` for `author:@me updated:<yesterday>` for any PR/issue activity.
   - **Notion**: Use the Notion MCP search tool to find pages created or updated yesterday, filtering by date range. Look for meeting notes, documents, and content updates.
   - **Harvest**: Run `hrvst time-entries list --from <yesterday> --to <yesterday> --output json` to get all time entries for the day. Extract project name, task name, hours, and notes for each entry.

2. **Organize the summary** by source with these sections:

   - **GitHub** — Group commits by repository. Summarize features, fixes, and refactors concisely. Note commit counts per repo.
   - **Basecamp** — Group by project. Highlight completed todos, comments, created items, and any check-in answers. Note total event count.
   - **Notion / Meetings** — Summarize meeting notes, document updates, and content page changes. Include connected sources (Google Drive meeting transcripts, etc.) if relevant.
   - **Harvest** — Show time entries grouped by project/client. Include task name, hours, and notes. Show total hours logged for the day.

3. **Cross-reference Harvest with other sources.** Flag any gaps:
   - Work that appears in Basecamp/GitHub/Notion but has no corresponding Harvest time entry (potentially forgotten hours).
   - Harvest entries with missing or empty notes that could use detail.

4. **End with a brief one-liner** capturing the overall shape of the day, including total hours logged.

Keep the summary concise and scannable. Use markdown headers and bullet points. Focus on what was accomplished, not raw data.