import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AuthButton } from './AuthButton'

export function AppLayout() {
  const location = useLocation()
  const showBack = location.pathname.startsWith('/words/')

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <header
        className="container"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          paddingTop: 14,
          paddingBottom: 10,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          className="card"
          style={{
            padding: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {showBack ? (
              <NavLink to="/words" className="btn" style={{ textDecoration: 'none' }}>
                Back
              </NavLink>
            ) : null}
            <div>
              <div style={{ fontWeight: 700, letterSpacing: -0.2 }}>
                GMAT Vocab Wizard
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                Look up, generate, and save
              </div>
            </div>
          </div>
          <AuthButton />
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <nav
        style={{
          position: 'sticky',
          bottom: 0,
          padding: 12,
        }}
      >
        <div
          className="card"
          style={{
            display: 'flex',
            gap: 10,
            padding: 10,
            justifyContent: 'space-around',
          }}
        >
          <NavLink
            to="/"
            style={({ isActive }) => ({
              textDecoration: 'none',
              padding: '10px 12px',
              borderRadius: 12,
              background: isActive ? 'rgba(124,58,237,0.18)' : 'transparent',
              border: isActive ? '1px solid rgba(124,58,237,0.55)' : '1px solid transparent',
            })}
          >
            Lookup
          </NavLink>
          <NavLink
            to="/learn"
            style={({ isActive }) => ({
              textDecoration: 'none',
              padding: '10px 12px',
              borderRadius: 12,
              background: isActive ? 'rgba(124,58,237,0.18)' : 'transparent',
              border: isActive ? '1px solid rgba(124,58,237,0.55)' : '1px solid transparent',
            })}
          >
            Learn
          </NavLink>
          <NavLink
            to="/test"
            style={({ isActive }) => ({
              textDecoration: 'none',
              padding: '10px 12px',
              borderRadius: 12,
              background: isActive ? 'rgba(124,58,237,0.18)' : 'transparent',
              border: isActive ? '1px solid rgba(124,58,237,0.55)' : '1px solid transparent',
            })}
          >
            Test
          </NavLink>
        </div>
      </nav>
    </div>
  )
}

