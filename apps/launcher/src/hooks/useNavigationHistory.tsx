import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import {
  isPosFullscreenOpen,
  POS_FULLSCREEN_OPEN_EVENT,
  requestPosConsumeBack,
} from "../pops/lib/posTopExperience";


type NavigationHistoryContextValue = {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
};

const NavigationHistoryContext = createContext<NavigationHistoryContextValue | null>(null);

function isTransientPath(path: string): boolean {
  return path === "/pops";
}

function isMainPosPath(path: string): boolean {
  return path === "/pops/pos";
}

function isPosCashDrawerPath(path: string): boolean {
  return path.includes("/pos/cash-drawer");
}

/** Skip cash-drawer when leaving main POS so Back never lands on Cash drawer. */
function shouldSkipBackTarget(currentPath: string | undefined, target: string): boolean {
  if (isTransientPath(target)) return true;
  if (currentPath && isMainPosPath(currentPath) && isPosCashDrawerPath(target)) return true;
  return false;
}

export function NavigationHistoryProvider({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const stackRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const skipNextSyncRef = useRef(false);
  const [historyState, setHistoryState] = useState({ index: -1, length: 0 });
  const [posFullscreenOpen, setPosFullscreenOpen] = useState(() => isPosFullscreenOpen());

  const pathname = location.pathname;

  useEffect(() => {
    function onFullscreenFlag(event: Event): void {
      const open = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open);
      setPosFullscreenOpen(open);
    }
    window.addEventListener(POS_FULLSCREEN_OPEN_EVENT, onFullscreenFlag);
    return () => window.removeEventListener(POS_FULLSCREEN_OPEN_EVENT, onFullscreenFlag);
  }, []);


  const publish = useCallback(() => {
    setHistoryState({
      index: indexRef.current,
      length: stackRef.current.length,
    });
  }, []);

  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      publish();
      return;
    }

    if (isTransientPath(pathname)) {
      publish();
      return;
    }

    const stack = stackRef.current;
    const idx = indexRef.current;

    if (stack.length === 0) {
      stackRef.current = [pathname];
      indexRef.current = 0;
      publish();
      return;
    }

    const current = stack[idx];
    if (pathname === current) {
      publish();
      return;
    }

    // NavLink replace (e.g. cash-drawer → POS) must overwrite the current entry
    // so Back does not reopen Cash drawer.
    if (navigationType === "REPLACE") {
      const next = [...stack];
      next[idx] = pathname;
      stackRef.current = next.slice(0, idx + 1);
      publish();
      return;
    }

    // Even without replace, never keep Cash drawer under main POS in the stack.
    if (isMainPosPath(pathname) && current && isPosCashDrawerPath(current)) {
      const next = [...stack];
      next[idx] = pathname;
      stackRef.current = next.slice(0, idx + 1);
      publish();
      return;
    }

    if (navigationType === "POP") {
      if (idx > 0 && stack[idx - 1] === pathname) {
        indexRef.current = idx - 1;
        publish();
        return;
      }
      if (idx < stack.length - 1 && stack[idx + 1] === pathname) {
        indexRef.current = idx + 1;
        publish();
        return;
      }
      const found = stack.lastIndexOf(pathname);
      if (found >= 0) {
        indexRef.current = found;
        publish();
        return;
      }
    }

    const next = [...stack.slice(0, idx + 1), pathname];
    stackRef.current = next;
    indexRef.current = next.length - 1;
    publish();
  }, [pathname, navigationType, publish]);

  const goBack = useCallback(() => {
    // Full-screen POS: close overlay first; stay on /pops/pos.
    if (isMainPosPath(pathname) && requestPosConsumeBack()) {
      return;
    }

    const currentPath = stackRef.current[indexRef.current];
    let newIndex = indexRef.current;
    while (newIndex > 0) {
      newIndex -= 1;
      const target = stackRef.current[newIndex];
      if (!target || shouldSkipBackTarget(currentPath, target)) continue;
      indexRef.current = newIndex;
      skipNextSyncRef.current = true;
      publish();
      navigate(target);
      return;
    }
  }, [navigate, pathname, publish]);

  const goForward = useCallback(() => {
    let newIndex = indexRef.current;
    while (newIndex < stackRef.current.length - 1) {
      newIndex += 1;
      const target = stackRef.current[newIndex];
      if (!target || isTransientPath(target)) continue;
      indexRef.current = newIndex;
      skipNextSyncRef.current = true;
      publish();
      navigate(target);
      return;
    }
  }, [navigate, publish]);

  const canGoBack = useMemo(() => {
    if (isMainPosPath(pathname) && posFullscreenOpen) return true;
    const currentPath = stackRef.current[historyState.index];
    for (let i = historyState.index - 1; i >= 0; i -= 1) {
      const path = stackRef.current[i];
      if (path && !shouldSkipBackTarget(currentPath, path)) return true;
    }
    return false;
  }, [historyState.index, historyState.length, pathname, posFullscreenOpen]);

  const canGoForward = useMemo(() => {
    for (let i = historyState.index + 1; i < stackRef.current.length; i += 1) {
      const path = stackRef.current[i];
      if (path && path !== "/pops") return true;
    }
    return false;
  }, [historyState.index, historyState.length]);

  const value = useMemo(
    () => ({ canGoBack, canGoForward, goBack, goForward }),
    [canGoBack, canGoForward, goBack, goForward],
  );

  return <NavigationHistoryContext.Provider value={value}>{children}</NavigationHistoryContext.Provider>;
}

export function useNavigationHistory(): NavigationHistoryContextValue {
  const ctx = useContext(NavigationHistoryContext);
  if (!ctx) {
    throw new Error("useNavigationHistory must be used within NavigationHistoryProvider");
  }
  return ctx;
}
