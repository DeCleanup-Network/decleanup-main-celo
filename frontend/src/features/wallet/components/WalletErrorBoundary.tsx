'use client'

import { Component, type ReactNode } from 'react'
import { WalletConnectFallback } from './WalletConnectFallback'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class WalletErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[WalletErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      return <WalletConnectFallback />
    }
    return this.props.children
  }
}
