/** POS bookmarks for General Store — local per branch (large catalogs). */

export type StorePosBrowseView = "bookmarks" | "all" | "category";

const VIEW_KEY = "store-pos-browse-view";
const BOOKMARKS_KEY = "store-pos-bookmarks";

export const DEFAULT_STORE_POS_VIEW: StorePosBrowseView = "bookmarks";

export function loadStorePosBrowseView(branchCode?: string | null): StorePosBrowseView | null {
  try {
    const raw = localStorage.getItem(viewStorageKey(branchCode));
    if (raw === "bookmarks" || raw === "all" || raw === "category") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveStorePosBrowseView(view: StorePosBrowseView, branchCode?: string | null): void {
  try {
    localStorage.setItem(viewStorageKey(branchCode), view);
  } catch {
    /* ignore */
  }
}

export function loadStorePosBookmarks(branchCode?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(bookmarksStorageKey(branchCode));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

export function saveStorePosBookmarks(ids: Set<string>, branchCode?: string | null): void {
  try {
    localStorage.setItem(bookmarksStorageKey(branchCode), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function toggleStorePosBookmark(
  productId: string,
  branchCode?: string | null,
): Set<string> {
  const next = loadStorePosBookmarks(branchCode);
  if (next.has(productId)) next.delete(productId);
  else next.add(productId);
  saveStorePosBookmarks(next, branchCode);
  return next;
}

function viewStorageKey(branchCode?: string | null): string {
  return branchCode ? `${VIEW_KEY}:${branchCode}` : VIEW_KEY;
}

function bookmarksStorageKey(branchCode?: string | null): string {
  return branchCode ? `${BOOKMARKS_KEY}:${branchCode}` : BOOKMARKS_KEY;
}
