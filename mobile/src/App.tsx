import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MaterialIcons } from '@expo/vector-icons'
import type { VocabItem } from '@shared/types'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ProfileSheet } from './components/ProfileSheet'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useAppTheme } from './context/ThemeContext'
import { DEFAULT_MAIN_LANGUAGE, normalizeMainLanguageCode } from '@shared/languages'
import { ensureUserProfileDefaults } from './lib/userProfile'
import { listVocabItems } from './lib/vocab'
import { SessionScreen } from './screens/SessionScreen'
import { computeDashboardStats, TodayScreen } from './screens/TodayScreen'
import { LearnScreen, type LearnTabPreset } from './screens/LearnScreen'
import { SignInScreen } from './screens/SignInScreen'
import { SignUpScreen } from './screens/SignUpScreen'
import { TestScreen } from './screens/TestScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import type { AppTheme } from './theme'

function ShellBackground({ theme, children }: { theme: AppTheme; children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: theme.bg }}>{children}</View>
}

function AuthNavigator() {
  const { theme } = useAppTheme()
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup'>('welcome')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ShellBackground theme={theme}>
        {mode === 'welcome' ? (
          <WelcomeScreen
            theme={theme}
            onSignIn={() => setMode('signin')}
            onSignUp={() => setMode('signup')}
          />
        ) : null}
        {mode === 'signin' ? (
          <SignInScreen
            theme={theme}
            onGoSignUp={() => setMode('signup')}
            onBack={() => setMode('welcome')}
          />
        ) : null}
        {mode === 'signup' ? (
          <SignUpScreen
            theme={theme}
            onGoSignIn={() => setMode('signin')}
            onBack={() => setMode('welcome')}
          />
        ) : null}
      </ShellBackground>
    </SafeAreaView>
  )
}

function MainTabs() {
  const { theme, colorScheme, setColorScheme } = useAppTheme()
  const [tab, setTab] = useState<'today' | 'learn' | 'test'>('today')
  const [sessionOpen, setSessionOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [learnPreset, setLearnPreset] = useState<LearnTabPreset | null>(null)
  const consumeLearnPreset = useCallback(() => setLearnPreset(null), [])
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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
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
                paddingVertical: 12,
                backgroundColor: theme.learnScreenBg,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
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
              <Pressable onPress={() => setProfileOpen(true)} hitSlop={10}>
                <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>Profile</Text>
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
                  onStartSession={() => setSessionOpen(true)}
                  onOpenProfile={() => setProfileOpen(true)}
                  onSavedWord={() => void reloadItems()}
                  onReviewLearning={() => {
                    setLearnPreset('learning')
                    setTab('learn')
                  }}
                  onReviewFlagged={() => {
                    setLearnPreset('flagged')
                    setTab('learn')
                  }}
                />
              ) : null}
              {tab === 'learn' ? (
                <LearnScreen
                  theme={theme}
                  mainLanguage={mainLanguage}
                  items={items}
                  onReload={reloadItems}
                  learnPreset={learnPreset}
                  onConsumedLearnPreset={consumeLearnPreset}
                  onOpenProfile={() => setProfileOpen(true)}
                />
              ) : null}
              {tab === 'test' ? (
                <TestScreen theme={theme} items={items} onOpenProfile={() => setProfileOpen(true)} />
              ) : null}
            </View>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.surface,
                borderTopWidth: 1,
                borderTopColor: theme.border,
                paddingVertical: 10,
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
    </SafeAreaView>
  )
}

function RootNavigation() {
  const { loading, user } = useAuth()
  const { theme } = useAppTheme()

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    )
  }

  return user ? <MainTabs /> : <AuthNavigator />
}

function AppStatusBar() {
  const { colorScheme } = useAppTheme()
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppStatusBar />
        <RootNavigation />
      </AuthProvider>
    </ThemeProvider>
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
