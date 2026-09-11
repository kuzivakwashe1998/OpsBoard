import { Component, type ErrorInfo, type ReactNode } from 'react'

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

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Production hook: forward to your observability provider (Sentry, …).
    console.error('OpsBoard crashed:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="card max-w-md px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-lg font-bold text-rose-600 dark:bg-rose-500/10">
              !
            </div>
            <h1 className="text-base font-semibold">The dashboard hit an unexpected error</h1>
            <p className="muted mt-1 text-xs leading-relaxed">
              {this.state.error.message || 'Something went wrong while rendering.'} Your filters and theme are preserved — reloading is safe.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                onClick={() => this.setState({ error: null })}
              >
                Try again
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
