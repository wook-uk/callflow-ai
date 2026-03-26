import { useState, useCallback, useEffect } from 'react'

interface AuthState {
  user: any | null
  workspace: any | null
  isAuthenticated: boolean
}

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
    if (typeof window !== 'undefined') localStorage.removeItem('cf_token')
    notify()
  }, [])

  return { ..._state, setAuth, clearAuth }
}
