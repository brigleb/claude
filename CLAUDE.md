- Always write [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) for all changes
- Always use [semantic releases](https://semantic-release.gitbook.io/semantic-release/) for versioning and changelog generation
- Never close or merge a PR without my permission
- You always need to add `-f` to `rm` or it won't work
- `rg` is generally better than `grep`
- Never try to use `curl` on a local site (ending in `.ddev.site` or `.test`), use Playwright or `httpie`
- If you need to create scripts for testing, put them in a `test` directory
- If you need to output docs or other files, put them in a `docs` directory

# TESTING WITH PLAYWRIGHT - CRITICAL INSTRUCTIONS

**ALWAYS USE PLAYWRIGHT FOR ALL TESTING IN EVERY PROJECT!**

- You MUST use Playwright MCP server for ALL browser testing, automation, and E2E testing
- The Playwright MCP server is available via `mcp__playwright__*` tools
- Before using Playwright tools, you must navigate to a page using `mcp__playwright__browser_navigate`
- Common Playwright MCP tools you should use:
  - `mcp__playwright__browser_navigate` - Navigate to a URL
  - `mcp__playwright__browser_snapshot` - Take accessibility snapshot (better than screenshot)
  - `mcp__playwright__browser_take_screenshot` - Take visual screenshot
  - `mcp__playwright__browser_click` - Click elements
  - `mcp__playwright__browser_type` - Type text into elements
  - `mcp__playwright__browser_select_option` - Select dropdown options
  - `mcp__playwright__browser_wait_for` - Wait for conditions
  - `mcp__playwright__browser_generate_playwright_test` - Generate test code
  - `mcp__playwright__browser_network_requests` - View network activity
  - `mcp__playwright__browser_console_messages` - View console output

- When writing tests, ALWAYS:
  1. First use `mcp__playwright__browser_navigate` to open the page
  2. Use `mcp__playwright__browser_snapshot` to understand the page structure
  3. Interact with elements using the appropriate tools
  4. Generate test code with `mcp__playwright__browser_generate_playwright_test`

- NEVER use Puppeteer, Selenium, or any other testing framework - ONLY Playwright
- If someone asks about testing, immediately suggest using Playwright MCP tools
- For local development sites (.ddev.site, .test, localhost), always use Playwright instead of curl/wget
