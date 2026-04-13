import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  clearSession,
  readSession,
  tryLogin,
  tryRegister,
  writeSession,
  type StubSessionUser,
} from './stubAuthStorage'

type AuthContextValue = {
  user: StubSessionUser | null
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string }
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => { ok: true } | { ok: false; error: string }
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StubSessionUser | null>(() => readSession())

  const login = useCallback((email: string, password: string) => {
    const r = tryLogin(email, password)
    if (!r.ok) return r
    writeSession(r.user)
    setUser(r.user)
    return { ok: true as const }
  }, [])

  const register = useCallback((email: string, password: string, displayName: string) => {
    const r = tryRegister(email, password, displayName)
    if (!r.ok) return r
    return { ok: true as const }
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      login,
      register,
      logout,
    }),
    [user, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
