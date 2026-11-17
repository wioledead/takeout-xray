import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally kept silent to avoid printing potentially sensitive state to console.
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07090D] p-6 text-slate-100">
        <div className="w-full max-w-lg rounded-lg border border-[#F59E0B]/40 bg-[#0D1117] p-6 font-mono">
          <div className="text-xs font-bold uppercase tracking-wider text-[#F59E0B]">
            Runtime Error
          </div>
          <p className="mt-2 text-sm text-slate-200">{this.state.error.message}</p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded border border-[#00FF9D]/50 bg-[#00FF9D]/10 px-3.5 py-1.5 text-xs font-bold text-[#00FF9D] hover:bg-[#00FF9D]/20 cursor-pointer"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded border border-[#1E293B] bg-[#111822] px-3.5 py-1.5 text-xs text-slate-300 hover:border-slate-500 cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
