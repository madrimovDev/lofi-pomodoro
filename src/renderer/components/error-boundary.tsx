import { Component, type ReactNode } from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 text-center">
          <p className="text-sm text-destructive/80">Xatolik yuz berdi</p>
          <p className="text-xs text-muted-foreground/60 font-mono break-all max-w-xs">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-1.5 text-xs rounded-lg border border-border hover:bg-muted/20"
          >
            Qayta urinish
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
