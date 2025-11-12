# CLAUDE.md

This file provides guidance to Claude Code when working with the Browser Control MCP repository.

## Project Overview

**Firefox MCP for Browser Automation** - A Model Context Protocol (MCP) server that enables Claude to control Firefox browser through a WebExtension. Supports browser automation, web scraping, form filling, JavaScript execution, screenshots, and bookmark management.

**Key Features:**
- 🌐 Tab management (open, close, list, reorder, group)
- 📖 Content reading (page text, links, history)
- 🖱️ Web interaction (click, fill forms, execute JS)
- 📸 Screenshot capture (auto-save to Pictures/Browser-Screenshots)
- 🔖 Bookmark management (search, open)
- 🔍 Page monitoring (DOM change detection)
- 🚫 Domain deny list for safety
- 🔓 No authentication required (localhost-only connection)

## Architecture

### Three-Component System

```
Claude CLI (MCP Client)
    ↓
MCP Server (Node.js) - localhost:8089 WebSocket
    ↓ [JSON messages over WebSocket]
    ↓
Firefox Extension (WebExtension)
    ↓
Firefox Browser APIs
```

### Directory Structure

```
browser-control-mcp-main/
├── common/                    # Shared TypeScript types
│   ├── server-messages.ts     # MCP → Extension messages
│   ├── extension-messages.ts  # Extension → MCP responses
│   └── index.ts
├── mcp-server/               # Node.js MCP server
│   ├── server.ts             # MCP tool definitions (15 tools)
│   ├── browser-api.ts        # WebSocket client + API methods
│   ├── util.ts               # Port checker
│   └── dist/                 # Build output
├── firefox-extension/        # Firefox WebExtension
│   ├── background.ts         # Extension entry point
│   ├── message-handler.ts    # Command handlers (all logic here)
│   ├── client.ts             # WebSocket connection
│   ├── extension-config.ts   # Settings + tool registry
│   ├── options.ts/.html      # Settings UI
│   ├── manifest.json         # Firefox permissions
│   └── dist/                 # Build output
└── package.json              # Workspace root
```

## Available Tools (15 Total)

### Original Tools (8)
1. **open-browser-tab** - Open URLs
2. **close-browser-tabs** - Close by tab IDs
3. **get-list-of-open-tabs** - List all tabs
4. **get-recent-browser-history** - Search history
5. **get-tab-web-content** - Read page text + links
6. **reorder-browser-tabs** - Reorder tabs
7. **find-highlight-in-browser-tab** - Search & highlight text
8. **group-browser-tabs** - Create tab groups

### Interaction Tools (4)
9. **click-element-in-browser** - Click by selector or coordinates
10. **fill-form-field-in-browser** - Fill inputs, checkboxes, selects
11. **execute-javascript-in-browser** - Run arbitrary JS
12. **monitor-page-changes-in-browser** - MutationObserver for DOM changes

### Utility Tools (3)
13. **screenshot-website** - Save PNG to Pictures/Browser-Screenshots
14. **search-bookmarks** - Search by query
15. **open-bookmark** - Open by bookmark ID

## Building & Installation Guide

### Building the Project

#### 1. Build Firefox Extension
```bash
cd firefox-extension
npm install
npm run build
```

**Output:** `firefox-extension/dist/` contains compiled extension files

#### 2. Build MCP Server
```bash
cd mcp-server
npm install
npm run build
```

**Output:** `mcp-server/dist/server.js` - the MCP server executable

### Installing Firefox Extension

**Load Temporary Extension (Development):**
1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `firefox-extension/manifest.json`
5. Extension loads and appears in toolbar

**Permanent Installation:**
- Extension reloads on every Firefox restart when loaded as "temporary"
- For permanent install, package as `.xpi` and sign via Mozilla Add-ons

### Installing MCP Server to Claude Code CLI

**IMPORTANT:** Do NOT manually create `.mcp.json` or edit `settings.json`. Use the CLI commands.

#### Global Installation (Recommended - Available in All Projects)

```bash
# Add the MCP server
claude mcp add --transport stdio browser-control --scope user -- node "FULL_PATH_TO/mcp-server/dist/server.js"

# Example (Windows):
claude mcp add --transport stdio browser-control --scope user -- node "D:\My OpenSource\voicecontrol\others\browser-control-mcp-main\mcp-server\dist\server.js"

# Example (Mac/Linux):
claude mcp add --transport stdio browser-control --scope user -- node "/path/to/browser-control-mcp-main/mcp-server/dist/server.js"
```

**Configuration:**

The MCP server configuration is stored in `C:\Users\YOUR_USERNAME\.claude.json` (Windows) or `~/.claude.json` (Mac/Linux):

```json
"mcpServers": {
  "browser-control": {
    "type": "stdio",
    "command": "node",
    "args": [
      "D:\\My OpenSource\\voicecontrol\\others\\browser-control-mcp-main\\mcp-server\\dist\\server.js"
    ]
  }
}
```

**No environment variables or secrets required!** The extension and server communicate over localhost WebSocket without authentication.

#### Project-Specific Installation (Per-Project)

```bash
cd your-project-directory
claude mcp add --transport stdio browser-control --scope project -- node "FULL_PATH_TO/mcp-server/dist/server.js"
```

This creates `.mcp.json` in your project root:
```json
{
  "mcpServers": {
    "browser-control": {
      "type": "stdio",
      "command": "node",
      "args": ["FULL_PATH_TO/mcp-server/dist/server.js"]
    }
  }
}
```

#### Local Installation (Project-Specific, Private)

```bash
cd your-project-directory
claude mcp add --transport stdio browser-control --scope local -- node "FULL_PATH_TO/mcp-server/dist/server.js"
```

Configuration stored in project-specific settings, private to you.

### Verifying Installation

```bash
# List all MCP servers
claude mcp list

# Check specific server
claude mcp get browser-control
```

**Expected output:**
```
browser-control:
  Scope: User config (available in all your projects)
  Status: ✓ Connected
  Type: stdio
  Command: node
  Args: D:\...\mcp-server\dist\server.js
```

**Status should be:** `✓ Connected`

### Configuration File Locations

| Scope | Location | Usage |
|-------|----------|-------|
| **User** | `~/.claude.json` | Global, all projects |
| **Project** | `PROJECT_ROOT/.mcp.json` | Team collaboration (commit to Git) |
| **Local** | Project settings | Private, per-project |

**Do NOT manually create `~/.claude/mcp.json`** - this file doesn't exist. Use `.claude.json` instead.

### Testing the Installation

Start Claude Code CLI and try:

```bash
claude
```

Then ask:
```
Get the list of my open Firefox tabs
```

Or:
```
Take a screenshot of tab 1
```

If working correctly, Claude will connect to Firefox and execute the commands.

### Troubleshooting Installation

**"Failed to connect" status:**
1. Verify Firefox extension is loaded and running
2. Check WebSocket port 8089 is not in use
3. Ensure MCP server path is correct and `dist/server.js` exists
4. Check Firefox console for WebSocket errors (`Ctrl+Shift+J`)
5. Verify both extension and server are using the same WebSocket port

**MCP server not listed:**
1. Run `claude mcp list` to verify installation
2. Check `.claude.json` file exists and has correct syntax
3. Restart Claude Code CLI

**Permission errors:**
1. Enable tools in extension settings (click extension icon → Settings)
2. Check domain deny list doesn't block target sites

## Adding New Tools - Step-by-Step Guide

### 1. Define Message Types (common/)

**common/server-messages.ts** - Add request interface:
```typescript
export interface YourNewServerMessage extends ServerMessageBase {
  cmd: "your-command";
  param1: string;
  param2?: number;
}

// Add to union type:
export type ServerMessage =
  | /* existing... */
  | YourNewServerMessage;
```

**common/extension-messages.ts** - Add response interface:
```typescript
export interface YourNewExtensionMessage extends ExtensionMessageBase {
  resource: "your-response";
  result: string;
  success: boolean;
}

// Add to union type:
export type ExtensionMessage =
  | /* existing... */
  | YourNewExtensionMessage;
```

### 2. Register Tool (firefox-extension/extension-config.ts)

Add to `AVAILABLE_TOOLS` array:
```typescript
{
  id: "your-tool-id",
  name: "Your Tool Name",
  description: "What this tool does"
}
```

Add to `COMMAND_TO_TOOL_ID` map:
```typescript
"your-command": "your-tool-id",
```

### 3. Implement Handler (firefox-extension/message-handler.ts)

Add case in `handleDecodedMessage()`:
```typescript
case "your-command":
  await this.yourNewHandler(
    req.correlationId,
    req.param1,
    req.param2
  );
  break;
```

Implement handler method at end of class:
```typescript
private async yourNewHandler(
  correlationId: string,
  param1: string,
  param2?: number
): Promise<void> {
  // Check deny list if URL-based
  const tab = await browser.tabs.get(tabId);
  if (tab.url && (await isDomainInDenyList(tab.url))) {
    throw new Error(`Domain in tab URL is in the deny list`);
  }

  // Use Firefox APIs: browser.tabs, browser.bookmarks, etc.
  const result = await browser.someApi.doSomething(param1);

  // Send response
  await this.client.sendResourceToServer({
    resource: "your-response",
    correlationId,
    result,
    success: true,
  });
}
```

### 4. Add API Method (mcp-server/browser-api.ts)

```typescript
async yourNewMethod(
  param1: string,
  param2?: number
): Promise<{ result: string; success: boolean }> {
  const correlationId = this.sendMessageToExtension({
    cmd: "your-command",
    param1,
    param2,
  });
  const message = await this.waitForResponse(correlationId, "your-response");
  return { result: message.result, success: message.success };
}
```

### 5. Define MCP Tool (mcp-server/server.ts)

```typescript
mcpServer.tool(
  "your-tool-name",
  "Description of what this tool does for the LLM",
  {
    param1: z.string(),
    param2: z.number().optional(),
  },
  async ({ param1, param2 }) => {
    const result = await browserApi.yourNewMethod(param1, param2);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Success: ${result.result}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: "Operation failed",
            isError: true,
          },
        ],
      };
    }
  }
);
```

### 6. Update Manifest (if new permissions needed)

**firefox-extension/manifest.json**:
```json
"permissions": [
  "newPermission"  // e.g., "cookies", "clipboardWrite", etc.
]
```

## Build & Deploy

### Development Build
```bash
# Install dependencies (first time only)
npm install

# Build extension
cd firefox-extension
npm run build

# Build MCP server
cd ../mcp-server
npm run build
```

### Load Extension in Firefox
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `firefox-extension/manifest.json`
4. Extension loads → Get secret from options page

### Configure Claude Code CLI

Add to `~/.claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "browser-control": {
      "command": "node",
      "args": ["FULL_PATH/mcp-server/dist/server.js"],
      "env": {
        "EXTENSION_SECRET": "secret-from-firefox-options-page"
      }
    }
  }
}
```

Restart Claude Code CLI.

## Security Architecture

### No User Consent Required (Modified from Original)
- **Original behavior:** Per-domain permission prompts
- **Current behavior:** All domains accessible (except deny list)
- Permissions granted in manifest.json upfront
- Domain deny list still enforced for safety

### No Authentication (Modified)
- **Original behavior:** HMAC-SHA256 signed messages with shared secret
- **Current behavior:** No authentication required
- WebSocket binds to `localhost` only (not accessible from network)
- Local processes can connect to port 8089
- **Security consideration:** Simpler setup, but any local process can control browser
  - Local malware could already access browser directly
  - Localhost-only binding prevents network attacks
  - Domain deny list provides some protection

### Deny List
- User-configurable domain blacklist
- Checked in handlers: `isDomainInDenyList(url)`
- Format: `example.com` blocks `example.com` and `*.example.com`

### Tool Toggles
- Each tool can be disabled in settings
- Checked before execution: `isCommandAllowed(cmd)`
- Settings UI: Extension options page

### Audit Logging
- Last 100 operations logged with timestamp + URL
- Viewable in extension settings
- Entry format: `{ toolId, command, timestamp, url }`

## Common Firefox APIs Used

### Tabs
```typescript
browser.tabs.create({ url })
browser.tabs.get(tabId)
browser.tabs.update(tabId, { active: true })
browser.tabs.remove(tabIds)
browser.tabs.move(tabId, { index })
browser.tabs.query({})
browser.tabs.executeScript(tabId, { code })
browser.tabs.captureVisibleTab(windowId, { format: "png" })
```

### Bookmarks
```typescript
browser.bookmarks.search({ query })
browser.bookmarks.get(bookmarkId)
```

### History
```typescript
browser.history.search({ text, maxResults, startTime })
```

### Downloads
```typescript
browser.downloads.download({ url, filename, saveAs })
browser.downloads.onChanged.addListener()
browser.downloads.search({ id })
```

### Find
```typescript
browser.find.find(query, { tabId, caseSensitive })
browser.find.highlightResults({ tabId })
```

## Screenshot Implementation Details

**File Naming Format:** `ddmmyyhhmmssss.png`
- Example: `121224153045123.png` = Dec 12, 2024 at 3:30:45.123 PM

**Save Location:**
- MCP Server saves to: `%USERPROFILE%\Pictures\Browser-Screenshots\`
- Extension captures screenshot and sends data URL to server
- Server uses Node.js fs module to save file
- Directory created automatically if it doesn't exist

**Process:**
1. Activate tab (`browser.tabs.update`)
2. Capture visible area (`browser.tabs.captureVisibleTab`)
3. Send data URL to MCP server via WebSocket
4. Server generates timestamp filename
5. Server decodes base64 and writes PNG file
6. Return full file path

## Troubleshooting

### Extension Not Connecting
- Check WebSocket port (default 8089) not in use
- Verify both extension and server are using the same WebSocket port
- Check browser console for WebSocket errors
- Extension auto-reconnects every 2 seconds

### Tool Not Working
1. Check if tool is enabled in extension settings
2. Check domain not in deny list
3. Verify correct tab ID (use `get-list-of-open-tabs`)
4. Check Firefox console for errors (`Ctrl+Shift+J`)

### Build Errors
- Ensure Node.js v22+ installed
- Run `npm install` in root, mcp-server, and firefox-extension
- Delete `node_modules` and reinstall if TypeScript errors persist

### Permission Errors
- Verify all required permissions in `manifest.json`
- Reload extension after manifest changes
- Check Firefox's permission prompt (if any)

## TypeScript Configuration

### Monorepo Workspace
- Root `package.json` defines workspace
- Common types shared via `@browser-control-mcp/common`
- Extension and server import from common package

### Type Safety
- All messages strongly typed via TypeScript
- Union types ensure exhaustive switch statements
- Use `const _exhaustiveCheck: never = req` to catch missing cases

## Important Notes

### Manifest Version
- Currently uses Manifest V2 (Firefox standard)
- Manifest V3 migration pending (Chrome compatibility)

### Content Scripts vs executeScript
- Uses `browser.tabs.executeScript()` for one-off JS execution
- Runs in page context (full DOM access)
- No persistent content script needed

### WebSocket Timeouts
- Default response timeout: Unlimited (0ms = no timeout)
- Allows long-running operations (page monitoring, etc.)
- Configure in `EXTENSION_RESPONSE_TIMEOUT_MS` in `mcp-server/browser-api.ts`

### Screenshot Folder
- Screenshots save to `Browser-Screenshots` subfolder in Pictures directory
- Server-side saving (Node.js) allows custom paths without browser restrictions
- Full path: `%USERPROFILE%\Pictures\Browser-Screenshots\`

### Form Filling
- Dispatches `input` and `change` events for framework compatibility
- Supports: text, email, password, checkbox, radio, select
- `submit` parameter triggers form submission via `closest('form').submit()`

### JavaScript Execution
- Wrapped in IIFE: `(function() { ${code} })()`
- Return values serialized via JSON
- Errors caught and returned in `error` field
- Async code requires wrapping in Promise

## Future Enhancement Ideas

- Full-page screenshots (currently viewport only)
- Cookie management (read, write, delete)
- Local storage access
- Network request interception
- Multiple tab screenshots (batch)
- Bookmark creation/deletion
- Browser settings modification
- Extension management
- WebDriver BiDi integration (future Firefox standard)

## Development Best Practices

1. **Always check deny list** for URL-based operations
2. **Activate tabs before screenshots** to ensure visibility
3. **Use TypeScript strict mode** to catch type errors
4. **Test with deny list enabled** to ensure proper blocking
5. **Add audit logging** for all new tools
6. **Handle errors gracefully** - send success/failure in response
7. **Document tool descriptions** clearly for LLM understanding
8. **Keep message types in sync** across common/, extension, and server
9. **Use semantic versioning** when releasing changes
10. **Test WebSocket reconnection** by stopping/starting MCP server

## Git Workflow

- **Main branch:** Stable releases
- **Feature branches:** New tool development
- Test thoroughly before merging to main
- Update version in `manifest.json` and `server.ts` together

## Resources

- [Firefox WebExtension API Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [Browser Control MCP GitHub](https://github.com/adhikasp/browser-control-mcp)

---

**Last Updated:** December 2024
**Current Version:** 1.5.0 (modified with enhanced automation features)
