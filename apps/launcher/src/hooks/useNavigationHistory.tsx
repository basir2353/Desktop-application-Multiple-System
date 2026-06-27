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

type NavigationHistoryContextValue = {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
};

const NavigationHistoryContext = createContext<NavigationHistoryContextValue | null>(null);

export function NavigationHistoryProvider({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const stackRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const skipNextSyncRef = useRef(false);
  const [historyState, setHistoryState] = useState({ index: -1, length: 0 });

  const pathname = location.pathname;

  const publish = useCallback(() => {
    setHistoryState({
      index: indexRef.current,
      length: stackRef.current.length,
    });
  }, []);

  const isTransientPath = useCallback((path: string) => path === "/pops", []);

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
  }, [pathname, navigationType, publish, isTransientPath]);

  const goBack = useCallback(() => {
    let newIndex = indexRef.current;
    while (newIndex > 0) {
      newIndex -= 1;
      const target = stackRef.current[newIndex];
      if (!target || isTransientPath(target)) continue;
      indexRef.current = newIndex;
      skipNextSyncRef.current = true;
      publish();
      navigate(target);
      return;
    }
  }, [navigate, publish, isTransientPath]);

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
  }, [navigate, publish, isTransientPath]);

  const canGoBack = useMemo(() => {
    for (let i = historyState.index - 1; i >= 0; i -= 1) {
      const path = stackRef.current[i];
      if (path && path !== "/pops") return true;
    }
    return false;
  }, [historyState.index, historyState.length]);

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
