import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-background px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-md">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-danger/10 text-danger">
              <AlertTriangle className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-1 break-words text-sm text-muted-foreground">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
