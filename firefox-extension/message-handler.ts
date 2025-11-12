import type { ServerMessageRequest } from "@browser-control-mcp/common";
import { WebsocketClient } from "./client";
import { isCommandAllowed, isDomainInDenyList, COMMAND_TO_TOOL_ID, addAuditLogEntry } from "./extension-config";

export class MessageHandler {
  private client: WebsocketClient;

  constructor(client: WebsocketClient) {
    this.client = client;
  }

  public async handleDecodedMessage(req: ServerMessageRequest): Promise<void> {
    const isAllowed = await isCommandAllowed(req.cmd);
    if (!isAllowed) {
      throw new Error(`Command '${req.cmd}' is disabled in extension settings`);
    }

    this.addAuditLogForReq(req).catch((error) => {
      console.error("Failed to add audit log entry:", error);
    });

    switch (req.cmd) {
      case "open-tab":
        await this.openUrl(req.correlationId, req.url);
        break;
      case "close-tabs":
        await this.closeTabs(req.correlationId, req.tabIds);
        break;
      case "get-tab-list":
        await this.sendTabs(req.correlationId);
        break;
      case "get-browser-recent-history":
        await this.sendRecentHistory(req.correlationId, req.searchQuery);
        break;
      case "get-tab-content":
        await this.sendTabsContent(req.correlationId, req.tabId, req.offset);
        break;
      case "reorder-tabs":
        await this.reorderTabs(req.correlationId, req.tabOrder);
        break;
      case "find-highlight":
        await this.findAndHighlightText(
          req.correlationId,
          req.tabId,
          req.queryPhrase
        );
        break;
      case "group-tabs":
        await this.groupTabs(
          req.correlationId,
          req.tabIds,
          req.isCollapsed,
          req.groupColor as browser.tabGroups.Color,
          req.groupTitle
        );
        break;
      case "click-element":
        await this.clickElement(
          req.correlationId,
          req.tabId,
          req.selector,
          req.x,
          req.y
        );
        break;
      case "fill-form-field":
        await this.fillFormField(
          req.correlationId,
          req.tabId,
          req.selector,
          req.value,
          req.submit
        );
        break;
      case "execute-javascript":
        await this.executeJavaScript(
          req.correlationId,
          req.tabId,
          req.code
        );
        break;
      case "monitor-page-changes":
        await this.monitorPageChanges(
          req.correlationId,
          req.tabId,
          req.selector,
          req.timeout
        );
        break;
      case "screenshot-website":
        await this.screenshotWebsite(
          req.correlationId,
          req.tabId,
          req.fullPage
        );
        break;
      case "search-bookmarks":
        await this.searchBookmarks(
          req.correlationId,
          req.query
        );
        break;
      case "open-bookmark":
        await this.openBookmark(
          req.correlationId,
          req.bookmarkId
        );
        break;
      default:
        const _exhaustiveCheck: never = req;
        console.error("Invalid message received:", req);
    }
  }

  private async addAuditLogForReq(req: ServerMessageRequest) {
    // Get the URL in context (either from param or from the tab)
    let contextUrl: string | undefined;
    if ("url" in req && req.url) {
      contextUrl = req.url;
    }
    if ("tabId" in req) {
      try {
        const tab = await browser.tabs.get(req.tabId);
        contextUrl = tab.url;
      } catch (error) {
        console.error("Failed to get tab URL for audit log:", error);
      }
    }

    const toolId = COMMAND_TO_TOOL_ID[req.cmd];
    const auditEntry = {
      toolId,
      command: req.cmd,
      timestamp: Date.now(),
      url: contextUrl
    };
    
    await addAuditLogEntry(auditEntry);
  }

  private async openUrl(correlationId: string, url: string): Promise<void> {
    if (!url.startsWith("https://")) {
      console.error("Invalid URL:", url);
      throw new Error("Invalid URL");
    }

    if (await isDomainInDenyList(url)) {
      throw new Error("Domain in user defined deny list");
    }

    const tab = await browser.tabs.create({
      url,
    });

    await this.client.sendResourceToServer({
      resource: "opened-tab-id",
      correlationId,
      tabId: tab.id,
    });
  }

  private async closeTabs(
    correlationId: string,
    tabIds: number[]
  ): Promise<void> {
    await browser.tabs.remove(tabIds);
    await this.client.sendResourceToServer({
      resource: "tabs-closed",
      correlationId,
    });
  }

  private async sendTabs(correlationId: string): Promise<void> {
    const tabs = await browser.tabs.query({});
    await this.client.sendResourceToServer({
      resource: "tabs",
      correlationId,
      tabs,
    });
  }

  private async sendRecentHistory(
    correlationId: string,
    searchQuery: string | null = null
  ): Promise<void> {
    const historyItems = await browser.history.search({
      text: searchQuery ?? "", // Search for all URLs (empty string matches everything)
      maxResults: 200, // Limit to 200 results
      startTime: 0, // Search from the beginning of time
    });
    const filteredHistoryItems = historyItems.filter((item) => {
      return !!item.url;
    });
    await this.client.sendResourceToServer({
      resource: "history",
      correlationId,
      historyItems: filteredHistoryItems,
    });
  }

  // Permission checks removed - all permissions granted in manifest

  private async sendTabsContent(
    correlationId: string,
    tabId: number,
    offset?: number
  ): Promise<void> {
    const tab = await browser.tabs.get(tabId);
    if (tab.url && (await isDomainInDenyList(tab.url))) {
      throw new Error(`Domain in tab URL is in the deny list`);
    }

    const MAX_CONTENT_LENGTH = 50_000;
    const results = await browser.tabs.executeScript(tabId, {
      code: `
      (function () {
        function getLinks() {
          const linkElements = document.querySelectorAll('a[href]');
          return Array.from(linkElements).map(el => ({
            url: el.href,
            text: el.innerText.trim() || el.getAttribute('aria-label') || el.getAttribute('title') || ''
          })).filter(link => link.text !== '' && link.url.startsWith('https://') && !link.url.includes('#'));
        }

        function getTextContent() {
          let isTruncated = false;
          let text = document.body.innerText.substring(${Number(offset) || 0});
          if (text.length > ${MAX_CONTENT_LENGTH}) {
            text = text.substring(0, ${MAX_CONTENT_LENGTH});
            isTruncated = true;
          }
          return {
            text, isTruncated
          }
        }

        const textContent = getTextContent();

        return {
          links: getLinks(),
          fullText: textContent.text,
          isTruncated: textContent.isTruncated,
          totalLength: document.body.innerText.length
        };
      })();
    `,
    });
    const { isTruncated, fullText, links, totalLength } = results[0];
    await this.client.sendResourceToServer({
      resource: "tab-content",
      tabId,
      correlationId,
      isTruncated,
      fullText,
      links,
      totalLength,
    });
  }

  private async reorderTabs(
    correlationId: string,
    tabOrder: number[]
  ): Promise<void> {
    // Reorder the tabs sequentially
    for (let newIndex = 0; newIndex < tabOrder.length; newIndex++) {
      const tabId = tabOrder[newIndex];
      await browser.tabs.move(tabId, { index: newIndex });
    }
    await this.client.sendResourceToServer({
      resource: "tabs-reordered",
      correlationId,
      tabOrder,
    });
  }

  private async findAndHighlightText(
    correlationId: string,
    tabId: number,
    queryPhrase: string
  ): Promise<void> {
    const tab = await browser.tabs.get(tabId);

    if (tab.url && (await isDomainInDenyList(tab.url))) {
      throw new Error(`Domain in tab URL is in the deny list`);
    }

    const findResults = await browser.find.find(queryPhrase, {
      tabId,
      caseSensitive: true,
    });

    // If there are results, highlight them
    if (findResults.count > 0) {
      // But first, activate the tab. In firefox, this would also enable
      // auto-scrolling to the highlighted result.
      await browser.tabs.update(tabId, { active: true });
      browser.find.highlightResults({
        tabId,
      });
    }

    await this.client.sendResourceToServer({
      resource: "find-highlight-result",
      correlationId,
      noOfResults: findResults.count,
    });
  }

  private async groupTabs(
    correlationId: string,
    tabIds: number[],
    isCollapsed: boolean,
    groupColor: browser.tabGroups.Color,
    groupTitle: string
  ): Promise<void> {
    const groupId = await browser.tabs.group({
      tabIds,
    });

    let tabGroup = await browser.tabGroups.update(groupId, {
      collapsed: isCollapsed,
      color: groupColor,
      title: groupTitle,
    });

    await this.client.sendResourceToServer({
      resource: "new-tab-group",
      correlationId,
      groupId: tabGroup.id,
    });
  }

  private async clickElement(
    correlationId: string,
    tabId: number,
    selector?: string,
    x?: number,
    y?: number
  ): Promise<void> {
    const tab = await browser.tabs.get(tabId);
    if (tab.url && (await isDomainInDenyList(tab.url))) {
      throw new Error(`Domain in tab URL is in the deny list`);
    }

    const results = await browser.tabs.executeScript(tabId, {
      code: `
      (function() {
        ${selector ? `
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!element) {
            return { success: false, error: 'Element not found' };
          }
          element.click();
          return {
            success: true,
            elementInfo: element.tagName + (element.id ? '#' + element.id : '') + (element.className ? '.' + element.className.split(' ').join('.') : '')
          };
        ` : `
          const x = ${x ?? 0};
          const y = ${y ?? 0};
          const element = document.elementFromPoint(x, y);
          if (!element) {
            return { success: false, error: 'No element at coordinates' };
          }
          element.click();
          return {
            success: true,
            elementInfo: element.tagName + (element.id ? '#' + element.id : '') + (element.className ? '.' + element.className.split(' ').join('.') : '')
          };
        `}
      })();
      `,
    });

    const result = results[0];
    await this.client.sendResourceToServer({
      resource: "element-clicked",
      correlationId,
      success: result.success,
      elementInfo: result.elementInfo,
    });
  }

  private async fillFormField(
    correlationId: string,
    tabId: number,
    selector: string,
    value: string,
    submit?: boolean
  ): Promise<void> {
    const tab = await browser.tabs.get(tabId);
    if (tab.url && (await isDomainInDenyList(tab.url))) {
      throw new Error(`Domain in tab URL is in the deny list`);
    }

    const results = await browser.tabs.executeScript(tabId, {
      code: `
      (function() {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) {
          return { success: false, error: 'Element not found' };
        }

        // Handle different input types
        if (element.tagName === 'SELECT') {
          element.value = ${JSON.stringify(value)};
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (element.type === 'checkbox' || element.type === 'radio') {
          element.checked = ${JSON.stringify(value)} === 'true';
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          element.value = ${JSON.stringify(value)};
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        ${submit ? `
          // Find and submit the parent form
          const form = element.closest('form');
          if (form) {
            form.submit();
          }
        ` : ''}

        return { success: true };
      })();
      `,
    });

    const result = results[0];
    await this.client.sendResourceToServer({
      resource: "form-field-filled",
      correlationId,
      success: result.success,
    });
  }

  private async executeJavaScript(
    correlationId: string,
    tabId: number,
    code: string
  ): Promise<void> {
    const tab = await browser.tabs.get(tabId);
    if (tab.url && (await isDomainInDenyList(tab.url))) {
      throw new Error(`Domain in tab URL is in the deny list`);
    }

    try {
      const results = await browser.tabs.executeScript(tabId, {
        code: `(function() { ${code} })();`,
      });

      await this.client.sendResourceToServer({
        resource: "javascript-executed",
        correlationId,
        result: results[0],
      });
    } catch (error: any) {
      await this.client.sendResourceToServer({
        resource: "javascript-executed",
        correlationId,
        result: null,
        error: error.message,
      });
    }
  }

  private async monitorPageChanges(
    correlationId: string,
    tabId: number,
    selector?: string,
    timeout?: number
  ): Promise<void> {
    const tab = await browser.tabs.get(tabId);
    if (tab.url && (await isDomainInDenyList(tab.url))) {
      throw new Error(`Domain in tab URL is in the deny list`);
    }

    const maxTimeout = timeout ?? 10000; // Default 10 seconds
    const results = await browser.tabs.executeScript(tabId, {
      code: `
      (function() {
        return new Promise((resolve) => {
          let timedOut = false;
          const changes = [];

          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              changes.push({
                type: mutation.type,
                target: mutation.target.tagName + (mutation.target.id ? '#' + mutation.target.id : ''),
                addedNodes: mutation.addedNodes.length,
                removedNodes: mutation.removedNodes.length,
              });
            });
          });

          const target = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.body'};
          if (!target) {
            resolve({ changes: 'Target element not found', timedOut: false });
            return;
          }

          observer.observe(target, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });

          setTimeout(() => {
            observer.disconnect();
            timedOut = true;
            resolve({
              changes: JSON.stringify(changes.slice(0, 50)), // Limit to 50 changes
              timedOut
            });
          }, ${maxTimeout});
        });
      })();
      `,
    });

    const result = results[0];
    await this.client.sendResourceToServer({
      resource: "page-changes-detected",
      correlationId,
      changes: result.changes,
      timedOut: result.timedOut,
    });
  }

  private async screenshotWebsite(
    correlationId: string,
    tabId: number,
    fullPage?: boolean
  ): Promise<void> {
    const tab = await browser.tabs.get(tabId);
    if (tab.url && (await isDomainInDenyList(tab.url))) {
      throw new Error(`Domain in tab URL is in the deny list`);
    }

    // Activate the tab to ensure it's visible for screenshot
    await browser.tabs.update(tabId, { active: true });

    // Capture the visible tab
    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    // Send the data URL back to MCP server (it will save the file)
    await this.client.sendResourceToServer({
      resource: "screenshot-saved",
      correlationId,
      dataUrl,
    });
  }

  private async searchBookmarks(
    correlationId: string,
    query?: string
  ): Promise<void> {
    const searchResults = await browser.bookmarks.search(query ? { query } : {});

    const bookmarks = searchResults.map((bookmark) => ({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      type: bookmark.type === "bookmark" ? "bookmark" as const :
            bookmark.type === "folder" ? "folder" as const :
            "separator" as const,
      parentId: bookmark.parentId,
      dateAdded: bookmark.dateAdded,
    }));

    await this.client.sendResourceToServer({
      resource: "bookmarks-found",
      correlationId,
      bookmarks,
    });
  }

  private async openBookmark(
    correlationId: string,
    bookmarkId: string
  ): Promise<void> {
    try {
      const bookmarks = await browser.bookmarks.get(bookmarkId);

      if (bookmarks.length === 0) {
        await this.client.sendResourceToServer({
          resource: "bookmark-opened",
          correlationId,
          success: false,
        });
        return;
      }

      const bookmark = bookmarks[0];

      if (!bookmark.url) {
        // It's a folder or separator, not a bookmark
        await this.client.sendResourceToServer({
          resource: "bookmark-opened",
          correlationId,
          success: false,
        });
        return;
      }

      const tab = await browser.tabs.create({
        url: bookmark.url,
      });

      await this.client.sendResourceToServer({
        resource: "bookmark-opened",
        correlationId,
        tabId: tab.id,
        success: true,
      });
    } catch (error) {
      await this.client.sendResourceToServer({
        resource: "bookmark-opened",
        correlationId,
        success: false,
      });
    }
  }
}
