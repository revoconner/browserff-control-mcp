export interface ServerMessageBase {
  cmd: string;
}

export interface OpenTabServerMessage extends ServerMessageBase {
  cmd: "open-tab";
  url: string;
}

export interface CloseTabsServerMessage extends ServerMessageBase {
  cmd: "close-tabs";
  tabIds: number[];
}

export interface GetTabListServerMessage extends ServerMessageBase {
  cmd: "get-tab-list";
}

export interface GetBrowserRecentHistoryServerMessage extends ServerMessageBase {
  cmd: "get-browser-recent-history";
  searchQuery?: string;
}

export interface GetTabContentServerMessage extends ServerMessageBase {
  cmd: "get-tab-content";
  tabId: number;
  offset?: number;
}

export interface ReorderTabsServerMessage extends ServerMessageBase {
  cmd: "reorder-tabs";
  tabOrder: number[];
}

export interface FindHighlightServerMessage extends ServerMessageBase {
  cmd: "find-highlight";
  tabId: number;
  queryPhrase: string;
}

export interface GroupTabsServerMessage extends ServerMessageBase {
  cmd: "group-tabs";
  tabIds: number[];
  isCollapsed: boolean;
  groupColor: string;
  groupTitle: string;
}

export interface ClickElementServerMessage extends ServerMessageBase {
  cmd: "click-element";
  tabId: number;
  selector?: string;
  x?: number;
  y?: number;
}

export interface FillFormFieldServerMessage extends ServerMessageBase {
  cmd: "fill-form-field";
  tabId: number;
  selector: string;
  value: string;
  submit?: boolean;
}

export interface ExecuteJavaScriptServerMessage extends ServerMessageBase {
  cmd: "execute-javascript";
  tabId: number;
  code: string;
}

export interface MonitorPageChangesServerMessage extends ServerMessageBase {
  cmd: "monitor-page-changes";
  tabId: number;
  selector?: string;
  timeout?: number;
}

export interface ScreenshotWebsiteServerMessage extends ServerMessageBase {
  cmd: "screenshot-website";
  tabId: number;
  fullPage?: boolean;
}

export interface SearchBookmarksServerMessage extends ServerMessageBase {
  cmd: "search-bookmarks";
  query?: string;
}

export interface OpenBookmarkServerMessage extends ServerMessageBase {
  cmd: "open-bookmark";
  bookmarkId: string;
}

export type ServerMessage =
  | OpenTabServerMessage
  | CloseTabsServerMessage
  | GetTabListServerMessage
  | GetBrowserRecentHistoryServerMessage
  | GetTabContentServerMessage
  | ReorderTabsServerMessage
  | FindHighlightServerMessage
  | GroupTabsServerMessage
  | ClickElementServerMessage
  | FillFormFieldServerMessage
  | ExecuteJavaScriptServerMessage
  | MonitorPageChangesServerMessage
  | ScreenshotWebsiteServerMessage
  | SearchBookmarksServerMessage
  | OpenBookmarkServerMessage;

export type ServerMessageRequest = ServerMessage & { correlationId: string };
