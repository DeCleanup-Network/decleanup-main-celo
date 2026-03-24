'use client'

import { Component, type ReactNode } from 'react'
import Link from 'next/link'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[RootErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-4 text-center">
          <p className="text-gray-300">Something went wrong loading the app.</p>
          <Link
            href="/reset-wallet-session"
            className="text-brand-green underline hover:no-underline"
          >
            Reset session & reload
          </Link>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="text-sm text-gray-500 underline hover:text-gray-400"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
