---
description: Copy the last assistant response as rich text (RTF) to the clipboard, suitable for pasting into Basecamp, Google Docs, Slack, etc.
allowed-tools: Write, Bash(~/.claude/scripts/rich-copy.sh:*)
---

Copy your last assistant response as rich text to the user's clipboard.

## Steps

1. Write the full markdown content of your last assistant response to `/tmp/claude-rich-copy.md` using the Write tool.
2. Run the conversion script using Bash:
   ```
   ~/.claude/scripts/rich-copy.sh /tmp/claude-rich-copy.md
   ```
3. Tell the user: "Rich text copied to clipboard."
