import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Frontend ErrorBoundary]', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-white border border-rose-200 rounded-xl p-8 max-w-lg mx-auto my-12 text-center shadow-sm space-y-4"
        >
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertOctagon className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {this.props.fallbackTitle || 'A module rendering error occurred'}
          </h2>
          <p className="text-xs text-slate-500 font-mono bg-slate-50 p-3 rounded border border-slate-200 text-left overflow-x-auto">
            {this.state.error?.message || 'Unexpected application error.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="primary" size="sm" onClick={this.handleReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              Reload Workspace
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
