import { useLayoutEffect, type ReactNode } from "react";
import { applyTheme } from "../lib/theme";
import { useThemeStore } from "../stores/themeStore";

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const mode = useThemeStore((s) => s.mode);

  useLayoutEffect(() => {
    applyTheme(mode);
  }, [mode]);

  return <>{children}</>;
}
