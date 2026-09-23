import { Button } from "@platform/ui";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[launcher]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg bg-slate-50 px-6 py-16 text-center dark:bg-slate-950">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Something went wrong</h1>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-red-600 dark:text-red-300/90">{this.state.error.message}</p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {this.state.error.message.includes("dynamically imported module")
              ? "This page failed to load. Reload keeps you on the same screen."
              : "If this keeps happening, reload the page or sign in again."}
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload app
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
