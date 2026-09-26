import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-100 bg-white p-7 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)]">
          <h1 className="text-lg font-semibold text-zinc-900">Something went wrong</h1>
          <p className="mt-1 text-sm text-zinc-500">An unexpected error occurred. Reloading usually fixes it.</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-dark mt-5 w-full rounded-lg py-2.5 text-sm font-medium"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
