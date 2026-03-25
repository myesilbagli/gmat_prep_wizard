import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'
import { darkTheme, lightTheme, type AppTheme } from '../theme'

/** Same key as web [AppLayout.tsx] localStorage */
export const THEME_STORAGE_KEY = 'gmat-vocab-theme'

type ThemeContextValue = {
  theme: AppTheme
  colorScheme: 'light' | 'dark'
  setColorScheme: (next: 'light' | 'dark') => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme()
  const [colorScheme, setColorSchemeState] = useState<'light' | 'dark'>(() =>
    system === 'light' ? 'light' : 'dark',
  )

  useEffect(() => {
    let cancelled = false
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then((v) => {
      if (cancelled) return
      if (v === 'light' || v === 'dark') {
        setColorSchemeState(v)
      } else if (system === 'light' || system === 'dark') {
        setColorSchemeState(system === 'light' ? 'light' : 'dark')
      }
    })
    return () => {
      cancelled = true
    }
  }, [system])

  const setColorScheme = (next: 'light' | 'dark') => {
    setColorSchemeState(next)
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next)
  }

  const theme = useMemo(() => (colorScheme === 'dark' ? darkTheme : lightTheme), [colorScheme])

  const value = useMemo(
    () => ({ theme, colorScheme, setColorScheme }),
    [theme, colorScheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider')
  return ctx
}
