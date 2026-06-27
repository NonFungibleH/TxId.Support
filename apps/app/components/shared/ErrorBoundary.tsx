"use client"

import { Component, type ReactNode } from "react"

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-zinc-950 p-4">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold text-red-400">Widget error</p>
            <p className="text-[11px] text-zinc-500 font-mono break-all max-w-[280px]">
              {this.state.error.message}
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
