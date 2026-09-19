import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Caught an error:', error, errorInfo);
    // Log to external service if available
    if (typeof window !== 'undefined' && window.navigator) {
      console.error('Stack:', error.stack);
    }
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div className="flex flex-col gap-4 p-6 bg-red-900 text-white rounded-lg">
          <h2 className="font-bold text-lg">Something went wrong</h2>
          <details className="text-sm">
            <summary className="cursor-pointer font-mono">Error details</summary>
            <pre className="mt-2 overflow-auto bg-black p-3 rounded text-xs">
              {this.state.error.toString()}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          </details>
          <button
            onClick={this.reset}
            className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
