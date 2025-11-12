import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BrowserAPI } from "./browser-api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const mcpServer = new McpServer({
  name: "BrowserControl",
  version: "1.5.1",
});

mcpServer.tool(
  "open-browser-tab",
  "Open a new tab in the user's browser (useful when the user asks to open a website)",
  { url: z.string() },
  async ({ url }) => {
    const openedTabId = await browserApi.openTab(url);
    if (openedTabId !== undefined) {
      return {
        content: [
          {
            type: "text",
            text: `${url} opened in tab id ${openedTabId}`,
          },
        ],
      };
    } else {
      return {
        content: [{ type: "text", text: "Failed to open tab", isError: true }],
      };
    }
  }
);

mcpServer.tool(
  "close-browser-tabs",
  "Close tabs in the user's browser by tab IDs",
  { tabIds: z.array(z.number()) },
  async ({ tabIds }) => {
    await browserApi.closeTabs(tabIds);
    return {
      content: [{ type: "text", text: "Closed tabs" }],
    };
  }
);

mcpServer.tool(
  "get-list-of-open-tabs",
  "Get the list of open tabs in the user's browser",
  {},
  async () => {
    const openTabs = await browserApi.getTabList();
    return {
      content: openTabs.map((tab) => {
        let lastAccessed = "unknown";
        if (tab.lastAccessed) {
          lastAccessed = dayjs(tab.lastAccessed).fromNow(); // LLM-friendly time ago
        }
        return {
          type: "text",
          text: `tab id=${tab.id}, tab url=${tab.url}, tab title=${tab.title}, last accessed=${lastAccessed}`,
        };
      }),
    };
  }
);

mcpServer.tool(
  "get-recent-browser-history",
  "Get the list of recent browser history (to get all, don't use searchQuery)",
  { searchQuery: z.string().optional() },
  async ({ searchQuery }) => {
    const browserHistory = await browserApi.getBrowserRecentHistory(
      searchQuery
    );
    if (browserHistory.length > 0) {
      return {
        content: browserHistory.map((item) => {
          let lastVisited = "unknown";
          if (item.lastVisitTime) {
            lastVisited = dayjs(item.lastVisitTime).fromNow(); // LLM-friendly time ago
          }
          return {
            type: "text",
            text: `url=${item.url}, title="${item.title}", lastVisitTime=${lastVisited}`,
          };
        }),
      };
    } else {
      // If nothing was found for the search query, hint the AI to list
      // all the recent history items instead.
      const hint = searchQuery ? "Try without a searchQuery" : "";
      return { content: [{ type: "text", text: `No history found. ${hint}` }] };
    }
  }
);

mcpServer.tool(
  "get-tab-web-content",
  `
    Get the full text content of the webpage and the list of links in the webpage, by tab ID. 
    Use "offset" only for larger documents when the first call was truncated and if you require more content in order to assist the user.
  `,
  { tabId: z.number(), offset: z.number().default(0) },
  async ({ tabId, offset }) => {
    const content = await browserApi.getTabContent(tabId, offset);
    let links: { type: "text"; text: string }[] = [];
    if (offset === 0) {
      // Only include the links if offset is 0 (default value). Otherwise, we can
      // assume this is not the first call. Adding the links again would be redundant.
      links = content.links.map((link: { text: string; url: string }) => {
        return {
          type: "text",

          text: `Link text: ${link.text}, Link URL: ${link.url}`,
        };
      });
    }

    let text = content.fullText;
    let hint: { type: "text"; text: string }[] = [];
    if (content.isTruncated || offset > 0) {
      // If the content is truncated, add a "tip" suggesting
      // that another tool, search in page, can be used to
      // discover additional data.
      const rangeString = `${offset}-${offset + text.length}`;
      hint = [
        {
          type: "text",
          text:
            `The following text content is truncated due to size (includes character range ${rangeString} out of ${content.totalLength}). ` +
            "If you want to read characters beyond this range, please use the 'get-tab-web-content' tool with an offset. ",
        },
      ];
    }

    return {
      content: [...hint, { type: "text", text }, ...links],
    };
  }
);

mcpServer.tool(
  "reorder-browser-tabs",
  "Change the order of open browser tabs",
  { tabOrder: z.array(z.number()) },
  async ({ tabOrder }) => {
    const newOrder = await browserApi.reorderTabs(tabOrder);
    return {
      content: [
        { type: "text", text: `Tabs reordered: ${newOrder.join(", ")}` },
      ],
    };
  }
);

mcpServer.tool(
  "find-highlight-in-browser-tab",
  "Find and highlight text in a browser tab (use a query phrase that exists in the web content)",
  { tabId: z.number(), queryPhrase: z.string() },
  async ({ tabId, queryPhrase }) => {
    const noOfResults = await browserApi.findHighlight(tabId, queryPhrase);
    return {
      content: [
        {
          type: "text",
          text: `Number of results found and highlighted in the tab: ${noOfResults}`,
        },
      ],
    };
  }
);

mcpServer.tool(
  "group-browser-tabs",
  "Organize opened browser tabs in a new tab group",
  {
    tabIds: z.array(z.number()),
    isCollapsed: z.boolean().default(false),
    groupColor: z
      .enum([
        "grey",
        "blue",
        "red",
        "yellow",
        "green",
        "pink",
        "purple",
        "cyan",
        "orange",
      ])
      .default("grey"),
    groupTitle: z.string().default("New Group"),
  },
  async ({ tabIds, isCollapsed, groupColor, groupTitle }) => {
    const groupId = await browserApi.groupTabs(
      tabIds,
      isCollapsed,
      groupColor,
      groupTitle
    );
    return {
      content: [
        {
          type: "text",
          text: `Created tab group "${groupTitle}" with ${tabIds.length} tabs (group ID: ${groupId})`,
        },
      ],
    };
  }
);

mcpServer.tool(
  "click-element-in-browser",
  "Click on an element in a browser tab using CSS selector or coordinates",
  {
    tabId: z.number(),
    selector: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
  },
  async ({ tabId, selector, x, y }) => {
    const result = await browserApi.clickElement(tabId, selector, x, y);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Successfully clicked element${result.elementInfo ? ': ' + result.elementInfo : ''}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: "Failed to click element",
            isError: true,
          },
        ],
      };
    }
  }
);

mcpServer.tool(
  "fill-form-field-in-browser",
  "Fill out a form field in a browser tab (supports text inputs, checkboxes, radio buttons, and select dropdowns)",
  {
    tabId: z.number(),
    selector: z.string(),
    value: z.string(),
    submit: z.boolean().default(false),
  },
  async ({ tabId, selector, value, submit }) => {
    const result = await browserApi.fillFormField(tabId, selector, value, submit);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Successfully filled form field '${selector}' with value '${value}'${submit ? ' and submitted form' : ''}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: "Failed to fill form field",
            isError: true,
          },
        ],
      };
    }
  }
);

mcpServer.tool(
  "execute-javascript-in-browser",
  "Execute arbitrary JavaScript code in a browser tab and return the result",
  {
    tabId: z.number(),
    code: z.string(),
  },
  async ({ tabId, code }) => {
    const result = await browserApi.executeJavaScript(tabId, code);
    if (result.error) {
      return {
        content: [
          {
            type: "text",
            text: `JavaScript execution failed: ${result.error}`,
            isError: true,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `JavaScript executed successfully. Result: ${JSON.stringify(result.result)}`,
          },
        ],
      };
    }
  }
);

mcpServer.tool(
  "monitor-page-changes-in-browser",
  "Monitor DOM changes on a web page for a specified duration (useful for detecting dynamic content loading)",
  {
    tabId: z.number(),
    selector: z.string().optional(),
    timeout: z.number().default(10000),
  },
  async ({ tabId, selector, timeout }) => {
    const result = await browserApi.monitorPageChanges(tabId, selector, timeout);
    return {
      content: [
        {
          type: "text",
          text: `Page changes detected${result.timedOut ? ' (monitoring timed out)' : ''}: ${result.changes}`,
        },
      ],
    };
  }
);

mcpServer.tool(
  "screenshot-website",
  "Take a screenshot of a website tab and save it to the Browser-Screenshots folder in user's Pictures directory",
  {
    tabId: z.number(),
    fullPage: z.boolean().default(false),
  },
  async ({ tabId, fullPage }) => {
    const result = await browserApi.screenshotWebsite(tabId, fullPage);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Screenshot saved successfully to: ${result.filePath}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: "Failed to save screenshot",
            isError: true,
          },
        ],
      };
    }
  }
);

mcpServer.tool(
  "search-bookmarks",
  "Search browser bookmarks by query (returns all bookmarks if no query provided)",
  {
    query: z.string().optional(),
  },
  async ({ query }) => {
    const bookmarks = await browserApi.searchBookmarks(query);
    if (bookmarks.length > 0) {
      return {
        content: bookmarks.map((bookmark: any) => ({
          type: "text",
          text: `ID: ${bookmark.id}, Title: "${bookmark.title}", URL: ${bookmark.url || 'N/A (folder)'}, Type: ${bookmark.type}`,
        })),
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: query ? `No bookmarks found matching "${query}"` : "No bookmarks found",
          },
        ],
      };
    }
  }
);

mcpServer.tool(
  "open-bookmark",
  "Open a bookmark in a new tab by bookmark ID",
  {
    bookmarkId: z.string(),
  },
  async ({ bookmarkId }) => {
    const result = await browserApi.openBookmark(bookmarkId);
    if (result.success && result.tabId) {
      return {
        content: [
          {
            type: "text",
            text: `Bookmark opened in tab ID ${result.tabId}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: "Failed to open bookmark (bookmark may be a folder or not exist)",
            isError: true,
          },
        ],
      };
    }
  }
);

const browserApi = new BrowserAPI();
browserApi.init().catch((err) => {
  console.error("Browser API init error", err);
  process.exit(1);
});

const transport = new StdioServerTransport();
mcpServer.connect(transport).catch((err) => {
  console.error("MCP Server connection error", err);
  process.exit(1);
});

process.stdin.on("close", () => {
  browserApi.close();
  mcpServer.close();
  process.exit(0);
});
