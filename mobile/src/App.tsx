import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MaterialIcons } from '@expo/vector-icons'
import type { VocabItem } from '@shared/types'
import * as SystemUI from 'expo-system-ui'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ProfileSheet } from './components/ProfileSheet'
import { SubscriptionPaywall } from './components/SubscriptionPaywall'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SubscriptionProvider, useSubscription } from './context/SubscriptionContext'
import { ThemeProvider, useAppTheme } from './context/ThemeContext'
import { FREE_MAX_SESSION_STARTS_PER_DAY } from '@shared/freemium'
import { DEFAULT_MAIN_LANGUAGE, normalizeMainLanguageCode } from '@shared/languages'
import { AUTH } from './lib/authMarketingTheme'
import { ensureUserProfileDefaults, getTodaySessionStarts, recordSessionStart } from './lib/userProfile'
import { listVocabItems } from './lib/vocab'
import { SessionScreen } from './screens/SessionScreen'
import { computeDashboardStats, TodayScreen } from './screens/TodayScreen'
import { LearnScreen } from './screens/LearnScreen'
import { SignInScreen } from './screens/SignInScreen'
import { SignUpScreen } from './screens/SignUpScreen'
import { TestScreen } from './screens/TestScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import type { AppTheme } from './theme'

function ShellBackground({ theme, children }: { theme: AppTheme; children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: theme.learnScreenBg }}>{children}</View>
}

function AuthNavigator() {
  const { theme } = useAppTheme()
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup'>('welcome')

  /**
   * Full-bleed shell (no SafeAreaView here). iOS defaults the window under the home
   * indicator to black; paddingBottom must come from screen ScrollViews + expo
   * backgroundColor / SystemUI so the same navy fills the whole display.
   */
  return (
    <View style={{ flex: 1, backgroundColor: AUTH.bgBase }}>
      {mode === 'welcome' ? (
        <WelcomeScreen theme={theme} onSignIn={() => setMode('signin')} onSignUp={() => setMode('signup')} />
      ) : null}
      {mode === 'signin' ? (
        <SignInScreen theme={theme} onGoSignUp={() => setMode('signup')} onBack={() => setMode('welcome')} />
      ) : null}
      {mode === 'signup' ? (
        <SignUpScreen theme={theme} onGoSignIn={() => setMode('signin')} onBack={() => setMode('welcome')} />
      ) : null}
    </View>
  )
}

function MainTabs() {
  const insets = useSafeAreaInsets()
  const { theme, colorScheme, setColorScheme } = useAppTheme()
  const { isPro, loading: subLoading, openPaywall } = useSubscription()
  const [tab, setTab] = useState<'today' | 'learn' | 'test'>('today')
  const [sessionOpen, setSessionOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [items, setItems] = useState<VocabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mainLanguage, setMainLanguage] = useState(DEFAULT_MAIN_LANGUAGE)
  const stats = useMemo(() => computeDashboardStats(items), [items])

  async function reloadItems() {
    setError(null)
    try {
      const next = await listVocabItems()
      setItems(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load words')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reloadItems()
  }, [])

  useEffect(() => {
    let cancelled = false
    void ensureUserProfileDefaults()
      .then((p) => {
        if (!cancelled) setMainLanguage(normalizeMainLanguageCode(p.mainLanguage))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const refreshProfileLanguage = useCallback(() => {
    void ensureUserProfileDefaults()
      .then((p) => setMainLanguage(normalizeMainLanguageCode(p.mainLanguage)))
      .catch(() => {})
  }, [])

  const handleStartSession = useCallback(async () => {
    if (subLoading) return
    if (!isPro) {
      try {
        const n = await getTodaySessionStarts()
        if (n >= FREE_MAX_SESSION_STARTS_PER_DAY) {
          openPaywall()
          return
        }
      } catch {
        openPaywall()
        return
      }
    }
    try {
      await recordSessionStart()
    } catch {
      /* still open session */
    }
    setSessionOpen(true)
  }, [isPro, subLoading, openPaywall])

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.learnScreenBg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.learnScreenBg }}>
      <ShellBackground theme={theme}>
        {sessionOpen ? (
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SessionScreen
              theme={theme}
              mainLanguage={mainLanguage}
              onClose={() => {
                setSessionOpen(false)
                void reloadItems()
              }}
              onCompleted={() => void reloadItems()}
            />
          </GestureHandlerRootView>
        ) : (
          <>
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: Math.max(insets.top, 12),
                paddingBottom: 12,
                backgroundColor: theme.learnScreenBg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialIcons name="menu-book" size={24} color={theme.learnAccent} />
                <Text
                  style={{
                    color: theme.learnAccent,
                    fontSize: 20,
                    fontWeight: '800',
                    letterSpacing: 3,
                  }}
                >
                  LEXICON
                </Text>
              </View>
              <Pressable
                onPress={() => setProfileOpen(true)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Profile"
              >
                <MaterialIcons name="person" size={26} color={theme.primary} />
              </Pressable>
            </View>
            <ProfileSheet
              theme={theme}
              colorScheme={colorScheme}
              setColorScheme={setColorScheme}
              visible={profileOpen}
              onClose={() => setProfileOpen(false)}
              onProfileSaved={refreshProfileLanguage}
            />
            {error ? (
              <Text style={{ color: theme.danger, paddingHorizontal: 16, paddingTop: 8 }}>{error}</Text>
            ) : null}
            <View style={{ flex: 1 }}>
              {tab === 'today' ? (
                <TodayScreen
                  theme={theme}
                  mainLanguage={mainLanguage}
                  stats={stats}
                  items={items}
                  onStartSession={() => void handleStartSession()}
                  onOpenProfile={() => setProfileOpen(true)}
                  onSavedWord={() => void reloadItems()}
                />
              ) : null}
              {tab === 'learn' ? (
                <LearnScreen theme={theme} mainLanguage={mainLanguage} items={items} onReload={reloadItems} />
              ) : null}
              {tab === 'test' ? (
                <TestScreen theme={theme} items={items} onOpenProfile={() => setProfileOpen(true)} />
              ) : null}
            </View>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.learnScreenBg,
                paddingTop: 10,
                paddingBottom: Math.max(insets.bottom, 10),
                paddingHorizontal: 12,
                gap: 10,
              }}
            >
              <TabButton
                label="Today"
                active={tab === 'today'}
                onPress={() => setTab('today')}
                color={theme.primary}
                muted={theme.muted}
              />
              <TabButton
                label="Learn"
                active={tab === 'learn'}
                onPress={() => setTab('learn')}
                color={theme.primary}
                muted={theme.muted}
              />
              <TabButton
                label="Test"
                active={tab === 'test'}
                onPress={() => setTab('test')}
                color={theme.primary}
                muted={theme.muted}
              />
            </View>
          </>
        )}
      </ShellBackground>
    </View>
  )
}

function AppStatusBar() {
  const { colorScheme } = useAppTheme()
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: AUTH.bgBase }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: AUTH.bgBase }}>
        <ThemeProvider>
          <AuthProvider>
            <AppChrome />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function AppChrome() {
  const insets = useSafeAreaInsets()
  const { theme } = useAppTheme()
  const { loading, user } = useAuth()
  const rootBg = user ? theme.learnScreenBg : AUTH.bgBase

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(rootBg)
  }, [rootBg])

  return (
    <View style={{ flex: 1, backgroundColor: rootBg }}>
      <AppStatusBar />
      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: rootBg,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : user ? (
        <SubscriptionProvider userId={user.uid}>
          <MainTabs />
          <SubscriptionPaywall />
        </SubscriptionProvider>
      ) : (
        <AuthNavigator />
      )}
    </View>
  )
}

function TabButton({
  label,
  active,
  onPress,
  color,
  muted,
}: {
  label: string
  active: boolean
  onPress: () => void
  color: string
  muted: string
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: active ? 'rgba(99,102,241,0.12)' : 'transparent',
      }}
    >
      <Text style={{ color: active ? color : muted, fontWeight: active ? '700' : '600' }}>
        {label}
      </Text>
    </Pressable>
  )
}
