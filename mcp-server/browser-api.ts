import WebSocket from "ws";
import type {
  ExtensionMessage,
  BrowserTab,
  BrowserHistoryItem,
  ServerMessage,
  TabContentExtensionMessage,
  ServerMessageRequest,
  ExtensionError,
} from "@browser-control-mcp/common";
import { isPortInUse } from "./util";

const WS_DEFAULT_PORT = 8089;
const EXTENSION_RESPONSE_TIMEOUT_MS = 0; // 0 = no timeout (wait indefinitely)

interface ExtensionRequestResolver<T extends ExtensionMessage["resource"]> {
  resource: T;
  resolve: (value: Extract<ExtensionMessage, { resource: T }>) => void;
  reject: (reason?: string) => void;
}

export class BrowserAPI {
  private ws: WebSocket | null = null;
  private wsServer: WebSocket.Server | null = null;

  // Map to persist the request to the extension. It maps the request correlationId
  // to a resolver, fulfulling a promise created when sending a message to the extension.
  private extensionRequestMap: Map<
    string,
    ExtensionRequestResolver<ExtensionMessage["resource"]>
  > = new Map();

  async init() {
    const { port } = readConfig();

    if (await isPortInUse(port)) {
      throw new Error(
        `Configured port ${port} is already in use. Please configure a different port.`
      );
    }

    // Unless running in a container, bind to localhost only
    const host = process.env.CONTAINERIZED ? "0.0.0.0" : "localhost";

    this.wsServer = new WebSocket.Server({
      host,
      port,
    });

    console.error(`Starting WebSocket server on ${host}:${port}`);
    this.wsServer.on("connection", async (connection) => {
      this.ws = connection;

      console.error("WebSocket connection established on port", port);

      this.ws.on("message", (message) => {
        const decoded = JSON.parse(message.toString());
        if (isErrorMessage(decoded)) {
          this.handleExtensionError(decoded);
          return;
        }
        this.handleDecodedExtensionMessage(decoded);
      });

      // Handle connection closure - clear the reference so it can reconnect
      this.ws.on("close", () => {
        console.error("WebSocket connection closed on port", port);
        if (this.ws === connection) {
          this.ws = null;
        }
      });

      // Handle connection errors
      this.ws.on("error", (error) => {
        console.error("WebSocket connection error:", error);
      });
    });
    this.wsServer.on("error", (error) => {
      console.error("WebSocket server error:", error);
    });
  }

  close() {
    this.wsServer?.close();
  }

  getSelectedPort() {
    return this.wsServer?.options.port;
  }

  async openTab(url: string): Promise<number | undefined> {
    const correlationId = this.sendMessageToExtension({
      cmd: "open-tab",
      url,
    });
    const message = await this.waitForResponse(correlationId, "opened-tab-id");
    return message.tabId;
  }

  async closeTabs(tabIds: number[]) {
    const correlationId = this.sendMessageToExtension({
      cmd: "close-tabs",
      tabIds,
    });
    await this.waitForResponse(correlationId, "tabs-closed");
  }

  async getTabList(): Promise<BrowserTab[]> {
    const correlationId = this.sendMessageToExtension({
      cmd: "get-tab-list",
    });
    const message = await this.waitForResponse(correlationId, "tabs");
    return message.tabs;
  }

  async getBrowserRecentHistory(
    searchQuery?: string
  ): Promise<BrowserHistoryItem[]> {
    const correlationId = this.sendMessageToExtension({
      cmd: "get-browser-recent-history",
      searchQuery,
    });
    const message = await this.waitForResponse(correlationId, "history");
    return message.historyItems;
  }

  async getTabContent(
    tabId: number,
    offset: number
  ): Promise<TabContentExtensionMessage> {
    const correlationId = this.sendMessageToExtension({
      cmd: "get-tab-content",
      tabId,
      offset,
    });
    return await this.waitForResponse(correlationId, "tab-content");
  }

  async reorderTabs(tabOrder: number[]): Promise<number[]> {
    const correlationId = this.sendMessageToExtension({
      cmd: "reorder-tabs",
      tabOrder,
    });
    const message = await this.waitForResponse(correlationId, "tabs-reordered");
    return message.tabOrder;
  }

  async findHighlight(tabId: number, queryPhrase: string): Promise<number> {
    const correlationId = this.sendMessageToExtension({
      cmd: "find-highlight",
      tabId,
      queryPhrase,
    });
    const message = await this.waitForResponse(
      correlationId,
      "find-highlight-result"
    );
    return message.noOfResults;
  }

  async groupTabs(
    tabIds: number[],
    isCollapsed: boolean,
    groupColor: string,
    groupTitle: string
  ): Promise<number> {
    const correlationId = this.sendMessageToExtension({
      cmd: "group-tabs",
      tabIds,
      isCollapsed,
      groupColor,
      groupTitle,
    });
    const message = await this.waitForResponse(correlationId, "new-tab-group");
    return message.groupId;
  }

  async clickElement(
    tabId: number,
    selector?: string,
    x?: number,
    y?: number
  ): Promise<{ success: boolean; elementInfo?: string }> {
    const correlationId = this.sendMessageToExtension({
      cmd: "click-element",
      tabId,
      selector,
      x,
      y,
    });
    const message = await this.waitForResponse(correlationId, "element-clicked");
    return { success: message.success, elementInfo: message.elementInfo };
  }

  async fillFormField(
    tabId: number,
    selector: string,
    value: string,
    submit?: boolean
  ): Promise<{ success: boolean }> {
    const correlationId = this.sendMessageToExtension({
      cmd: "fill-form-field",
      tabId,
      selector,
      value,
      submit,
    });
    const message = await this.waitForResponse(correlationId, "form-field-filled");
    return { success: message.success };
  }

  async executeJavaScript(
    tabId: number,
    code: string
  ): Promise<{ result: any; error?: string }> {
    const correlationId = this.sendMessageToExtension({
      cmd: "execute-javascript",
      tabId,
      code,
    });
    const message = await this.waitForResponse(correlationId, "javascript-executed");
    return { result: message.result, error: message.error };
  }

  async monitorPageChanges(
    tabId: number,
    selector?: string,
    timeout?: number
  ): Promise<{ changes: string; timedOut: boolean }> {
    const correlationId = this.sendMessageToExtension({
      cmd: "monitor-page-changes",
      tabId,
      selector,
      timeout,
    });
    const message = await this.waitForResponse(correlationId, "page-changes-detected");
    return { changes: message.changes, timedOut: message.timedOut };
  }

  async screenshotWebsite(
    tabId: number,
    fullPage?: boolean
  ): Promise<{ filePath: string; success: boolean }> {
    const correlationId = this.sendMessageToExtension({
      cmd: "screenshot-website",
      tabId,
      fullPage,
    });
    const message = await this.waitForResponse(correlationId, "screenshot-saved");

    // Save the data URL to a file
    try {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");

      // Generate filename with ddmmyyhhmmssss format
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
      const filename = `${day}${month}${year}${hours}${minutes}${seconds}${milliseconds}.png`;

      // Create screenshots directory in Pictures folder
      const picturesDir = path.join(os.homedir(), 'Pictures', 'Browser-Screenshots');
      if (!fs.existsSync(picturesDir)) {
        fs.mkdirSync(picturesDir, { recursive: true });
      }

      const filePath = path.join(picturesDir, filename);

      // Convert data URL to buffer and save
      const base64Data = message.dataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      return { filePath, success: true };
    } catch (error) {
      console.error("Failed to save screenshot:", error);
      return { filePath: "", success: false };
    }
  }

  async searchBookmarks(
    query?: string
  ): Promise<any[]> {
    const correlationId = this.sendMessageToExtension({
      cmd: "search-bookmarks",
      query,
    });
    const message = await this.waitForResponse(correlationId, "bookmarks-found");
    return message.bookmarks;
  }

  async openBookmark(
    bookmarkId: string
  ): Promise<{ tabId?: number; success: boolean }> {
    const correlationId = this.sendMessageToExtension({
      cmd: "open-bookmark",
      bookmarkId,
    });
    const message = await this.waitForResponse(correlationId, "bookmark-opened");
    return { tabId: message.tabId, success: message.success };
  }

  private sendMessageToExtension(message: ServerMessage): string {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }

    const correlationId = Math.random().toString(36).substring(2);
    const req: ServerMessageRequest = { ...message, correlationId };

    // Send the message to the extension
    this.ws.send(JSON.stringify(req));

    return correlationId;
  }

  private handleDecodedExtensionMessage(decoded: ExtensionMessage) {
    const { correlationId } = decoded;
    const { resolve, resource } = this.extensionRequestMap.get(correlationId)!;
    if (resource !== decoded.resource) {
      console.error("Resource mismatch:", resource, decoded.resource);
      return;
    }
    this.extensionRequestMap.delete(correlationId);
    resolve(decoded);
  }

  private handleExtensionError(decoded: ExtensionError) {
    const { correlationId, errorMessage } = decoded;
    const { reject } = this.extensionRequestMap.get(correlationId)!;
    this.extensionRequestMap.delete(correlationId);
    reject(errorMessage);
  }

  private async waitForResponse<T extends ExtensionMessage["resource"]>(
    correlationId: string,
    resource: T
  ): Promise<Extract<ExtensionMessage, { resource: T }>> {
    return new Promise<Extract<ExtensionMessage, { resource: T }>>(
      (resolve, reject) => {
        this.extensionRequestMap.set(correlationId, {
          resolve: resolve as (value: ExtensionMessage) => void,
          resource,
          reject,
        });
        // Only set timeout if EXTENSION_RESPONSE_TIMEOUT_MS > 0
        if (EXTENSION_RESPONSE_TIMEOUT_MS > 0) {
          setTimeout(() => {
            this.extensionRequestMap.delete(correlationId);
            reject("Timed out waiting for response");
          }, EXTENSION_RESPONSE_TIMEOUT_MS);
        }
      }
    );
  }
}

function readConfig() {
  return {
    port: process.env.EXTENSION_PORT
      ? parseInt(process.env.EXTENSION_PORT, 10)
      : WS_DEFAULT_PORT,
  };
}

export function isErrorMessage(message: any): message is ExtensionError {
  return (
    message.errorMessage !== undefined && message.correlationId !== undefined
  );
}
