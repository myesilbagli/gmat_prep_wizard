import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { signInWithGoogle, signOutUser, subscribeToAuth } from '../lib/auth'

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeToAuth(setUser), [])

  const label = user ? `Sign out (${user.displayName ?? 'user'})` : 'Sign in'

  return (
    <button
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          if (user) await signOutUser()
          else await signInWithGoogle()
        } finally {
          setBusy(false)
        }
      }}
      title={user?.email ?? undefined}
    >
      {busy ? 'Working…' : label}
    </button>
  )
}

