// hooks/useCall.ts
import useSWR from 'swr'
import { getCall } from '@/lib/api'

export function useCall(id: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/calls/${id}` : null,
    () => getCall(id),
    {
      refreshInterval: (data) => {
        // Keep polling while processing
        if (!data) return 3000
        const processing = ['uploading', 'transcribing', 'analyzing', 'crm_syncing']
        return processing.includes(data.status) ? 3000 : 0
      },
    }
  )

  return { call: data, isLoading, error, mutate }
}

// ─────────────────────────────────────────────
// hooks/useAuthStore.ts
// Minimal in-memory auth state (no Zustand needed for MVP)
// ─────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react'

interface AuthState {
  user: any | null
  workspace: any | null
  isAuthenticated: boolean
}

// Module-level state (singleton)
let _state: AuthState = { user: null, workspace: null, isAuthenticated: false }
let _listeners: Array<() => void> = []

function notify() {
  _listeners.forEach(l => l())
}

export function useAuthStore() {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1)
    _listeners.push(listener)
    return () => { _listeners = _listeners.filter(l => l !== listener) }
  }, [])

  const setAuth = useCallback((user: any, workspace: any) => {
    _state = { user, workspace, isAuthenticated: true }
    notify()
  }, [])

  const clearAuth = useCallback(() => {
    _state = { user: null, workspace: null, isAuthenticated: false }
    localStorage.removeItem('cf_token')
    notify()
  }, [])

  return { ..._state, setAuth, clearAuth }
}
