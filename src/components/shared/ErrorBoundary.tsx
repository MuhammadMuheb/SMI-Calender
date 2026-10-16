import { Component, type ReactNode, type ErrorInfo } from 'react';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError, reloadForNewVersion } from '@/lib/lazyWithReload';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors. Renders outside ThemeProvider, so the fallback uses
 * token classes only (no hooks).
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Stale deployment: reload into the new version instead of showing an error.
    if (isChunkLoadError(error) && reloadForNewVersion()) return;
    console.error('Caught an error:', error, errorInfo);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  private reload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      const newVersion = isChunkLoadError(this.state.error);
      return (
        <div role="alert" className="flex min-h-svh items-center justify-center bg-background px-6 py-12 text-foreground">
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <TriangleAlert className="size-6 text-destructive" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
              {newVersion ? 'A new version is available' : 'Something went wrong'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {newVersion
                ? 'The app was updated while this page was open. Reload to continue. If this keeps showing, check your connection.'
                : 'The app hit an unexpected problem. Reload to try again. If it keeps happening, tell your manager.'}
            </p>
            <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button size="lg" onClick={this.reload}>
                <RotateCw /> Reload
              </Button>
              <Button size="lg" variant="outline" onClick={this.reset}>
                Try again
              </Button>
            </div>
            <details className="mt-6 w-full text-left text-sm">
              <summary className="cursor-pointer text-muted-foreground">Error details</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                {this.state.error.toString()}
                {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
