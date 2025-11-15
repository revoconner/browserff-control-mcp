# BrowserFF Control MCP

An MCP server paired with a Firefox browser extension that provides AI assistants with access to tab management, browsing history, and webpage text content.

## Features

The MCP server supports the following tools:
- Open or close tabs
- Get the list of opened tabs
- Create tab groups with name and color
- Reorder opened tabs
- Read and search the browser's history
- Read a webpage's text content and links
- Find and highlight text in a browser tab
- Execute JS
- Fill Form
- Click Element
- Monitor page changes
- Search bookmark
- Open bookmark

## Example use-cases:

- Open youtube music and play hybs serenity
- Look for what calendar events I have on my microsoft 365 account
- Take a screenshot of the active tab
- Resume playback on prime videos.

**Important note**: BrowserFF Control MCP is still experimental. Use at your own risk. You should practice caution as with any other MCP server and authorize/monitor tool calls carefully.

## Installation


#### 1: Install the Firefox 

The Firefox extension / add-on is available on https://addons.mozilla.org/en-US/firefox/addon/browserff-control-mcp/


### 2: Add to claude code

`claude mcp add --transport stdio browser-control --scope user -- node "PATH_TO/mcp-server/dist/server.js"`

After installing the browser extension, add the following configuration to your mcpServers configuration:
```json
{
    "mcpServers": {
        "browser-control": {
            "command": "node",
            "args": [
                "/path/to/repo/mcp-server/dist/server.js"
            ],
            "env": {
                "EXTENSION_PORT": "8089" 
            }
        }
    }
}
```
Replace `/path/to/repo` with the correct path.


