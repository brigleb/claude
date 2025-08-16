# Test Playwright MCP Server

This command verifies that the Playwright MCP server is working correctly.

```bash
# Test if Playwright MCP is accessible
claude mcp list | grep playwright

# Simple test to navigate to a page
echo "Testing Playwright MCP by navigating to example.com"
```

## Usage Example

When you need to test if Playwright is working in a project:

1. First check MCP server status: `claude mcp list`
2. Navigate to a test page: Use `mcp__playwright__browser_navigate` with URL "https://example.com"
3. Take a snapshot: Use `mcp__playwright__browser_snapshot`
4. Generate a test: Use `mcp__playwright__browser_generate_playwright_test`