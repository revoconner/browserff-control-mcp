export interface ExtensionMessageBase {
  resource: string;
  correlationId: string;
}

export interface TabContentExtensionMessage extends ExtensionMessageBase {
  resource: "tab-content";
  tabId: number;
  fullText: string;
  isTruncated: boolean;
  totalLength: number;
  links: { url: string; text: string }[];
}

export interface BrowserTab {
  id?: number;
  url?: string;
  title?: string;
  lastAccessed?: number;
}

export interface TabsExtensionMessage extends ExtensionMessageBase {
  resource: "tabs";
  tabs: BrowserTab[];
}

export interface OpenedTabIdExtensionMessage extends ExtensionMessageBase {
  resource: "opened-tab-id";
  tabId: number | undefined;
}

export interface BrowserHistoryItem {
  url?: string;
  title?: string;
  lastVisitTime?: number;
}

export interface BrowserHistoryExtensionMessage extends ExtensionMessageBase {
  resource: "history";

  historyItems: BrowserHistoryItem[];
}

export interface ReorderedTabsExtensionMessage extends ExtensionMessageBase {
  resource: "tabs-reordered";
  tabOrder: number[];
}

export interface FindHighlightExtensionMessage extends ExtensionMessageBase {
  resource: "find-highlight-result";
  noOfResults: number;
}

export interface TabsClosedExtensionMessage extends ExtensionMessageBase {
  resource: "tabs-closed";
}

export interface TabGroupCreatedExtensionMessage extends ExtensionMessageBase {
  resource: "new-tab-group";
  groupId: number;
}

export interface ClickElementExtensionMessage extends ExtensionMessageBase {
  resource: "element-clicked";
  success: boolean;
  elementInfo?: string;
}

export interface FillFormFieldExtensionMessage extends ExtensionMessageBase {
  resource: "form-field-filled";
  success: boolean;
}

export interface ExecuteJavaScriptExtensionMessage extends ExtensionMessageBase {
  resource: "javascript-executed";
  result: any;
  error?: string;
}

export interface MonitorPageChangesExtensionMessage extends ExtensionMessageBase {
  resource: "page-changes-detected";
  changes: string;
  timedOut: boolean;
}

export interface ScreenshotWebsiteExtensionMessage extends ExtensionMessageBase {
  resource: "screenshot-saved";
  dataUrl: string;
}

export interface BookmarkItem {
  id: string;
  title: string;
  url?: string;
  type: "bookmark" | "folder" | "separator";
  parentId?: string;
  dateAdded?: number;
}

export interface SearchBookmarksExtensionMessage extends ExtensionMessageBase {
  resource: "bookmarks-found";
  bookmarks: BookmarkItem[];
}

export interface OpenBookmarkExtensionMessage extends ExtensionMessageBase {
  resource: "bookmark-opened";
  tabId?: number;
  success: boolean;
}

export type ExtensionMessage =
  | TabContentExtensionMessage
  | TabsExtensionMessage
  | OpenedTabIdExtensionMessage
  | BrowserHistoryExtensionMessage
  | ReorderedTabsExtensionMessage
  | FindHighlightExtensionMessage
  | TabsClosedExtensionMessage
  | TabGroupCreatedExtensionMessage
  | ClickElementExtensionMessage
  | FillFormFieldExtensionMessage
  | ExecuteJavaScriptExtensionMessage
  | MonitorPageChangesExtensionMessage
  | ScreenshotWebsiteExtensionMessage
  | SearchBookmarksExtensionMessage
  | OpenBookmarkExtensionMessage;

export interface ExtensionError {
  correlationId: string;
  errorMessage: string;
}