/**
 * Header auth control. After the settings-popup consolidation:
 *
 * - Signed-in users see "Profile (Name)" — a Link that navigates to
 *   /profile. Theme, language, timezone, and Sign out all live on the
 *   Settings tab of that page now; there is no header popup.
 * - Signed-out users see a "Sign in" link.
 *
 * No popup, no gear icon, no theme prop. Theme state still lives in
 * AppLayout and is exposed to /profile via the AppLayoutOutletContext.
 */
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { Link } from 'react-router-dom'
import { subscribeToAuth } from '../lib/auth'

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => subscribeToAuth(setUser), [])

  if (!user) {
    return (
      <Link
        to="/sign-in"
        className="btn"
        style={{ textDecoration: 'none', display: 'inline-block' }}
      >
        Sign in
      </Link>
    )
  }

  return (
    <Link
      to="/profile"
      className="btn"
      style={{ textDecoration: 'none', display: 'inline-block' }}
      title={user.email ?? undefined}
    >
      Profile ({user.displayName ?? 'user'})
    </Link>
  )
}
