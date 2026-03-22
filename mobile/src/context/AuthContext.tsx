import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { subscribeToAuth } from '../lib/auth'

type AuthContextValue = {
  loading: boolean
  user: User | null
}

const AuthContext = createContext<AuthContextValue>({ loading: true, user: null })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    return subscribeToAuth((next) => {
      setUser(next)
      setLoading(false)
    })
  }, [])

  const value = useMemo(() => ({ loading, user }), [loading, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
