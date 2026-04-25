import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native'
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
import { DEFAULT_TIMEZONE } from '@shared/userProfile'
import { AUTH } from './lib/authMarketingTheme'
import {
  ensureUserProfileDefaults,
  getTodaySessionStarts,
  recordSessionStart,
  shouldShowOnboarding,
} from './lib/userProfile'
import { OnboardingFlow } from './onboarding/OnboardingFlow'
import { listVocabItems } from './lib/vocab'
import { SessionScreen } from './screens/SessionScreen'
import { computeDashboardStats, TodayScreen } from './screens/TodayScreen'
import { LearnScreen } from './screens/LearnScreen'
import { WordStackBrowseScreen } from './screens/WordStackBrowseScreen'
import { UserStackDetailScreen } from './screens/UserStackDetailScreen'
import { WordStackDetailScreen } from './screens/WordStackDetailScreen'
import { SignInScreen } from './screens/SignInScreen'
import { SignUpScreen } from './screens/SignUpScreen'
import { createReadingSession, type ReadingSession } from './reading/readingSession'
import { PracticeHubScreen } from './screens/PracticeHubScreen'
import { ReadingReviewScreen } from './screens/ReadingReviewScreen'
import { ReadingScreen } from './screens/ReadingScreen'
import { ReadingSetupScreen } from './screens/ReadingSetupScreen'
import { TestScreen } from './screens/TestScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import type { AppTheme } from './theme'

function ShellBackground({ theme, children }: { theme: AppTheme; children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: theme.learnScreenBg }}>{children}</View>
}

type AuthMode = 'welcome' | 'signin' | 'signup'

function AuthNavigator() {
  const { theme } = useAppTheme()
  const [mode, setMode] = useState<AuthMode>('welcome')
  const opacity = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const modeRef = useRef<AuthMode>('welcome')
  const animating = useRef(false)

  modeRef.current = mode

  const transition = useCallback(
    (next: AuthMode, dir: 'forward' | 'back') => {
      if (animating.current || modeRef.current === next) return
      animating.current = true
      const outX = dir === 'forward' ? -36 : 36
      const inX = dir === 'forward' ? 44 : -44

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: outX,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMode(next)
        translateX.setValue(inX)
        opacity.setValue(0)
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          animating.current = false
        })
      })
    },
    [opacity, translateX],
  )

  /**
   * Full-bleed shell (no SafeAreaView here). iOS defaults the window under the home
   * indicator to black; paddingBottom must come from screen ScrollViews + expo
   * backgroundColor / SystemUI so the same navy fills the whole display.
   */
  return (
    <View style={{ flex: 1, backgroundColor: AUTH.radialViolet }}>
      <Animated.View
        style={{
          flex: 1,
          opacity,
          transform: [{ translateX }],
        }}
      >
        {mode === 'welcome' ? (
          <WelcomeScreen
            theme={theme}
            onSignIn={() => transition('signin', 'forward')}
            onSignUp={() => transition('signup', 'forward')}
          />
        ) : null}
        {mode === 'signin' ? (
          <SignInScreen
            theme={theme}
            onGoSignUp={() => transition('signup', 'forward')}
            onBack={() => transition('welcome', 'back')}
          />
        ) : null}
        {mode === 'signup' ? (
          <SignUpScreen
            theme={theme}
            onGoSignIn={() => transition('signin', 'back')}
            onBack={() => transition('welcome', 'back')}
          />
        ) : null}
      </Animated.View>
    </View>
  )
}

type LearnFlow =
  | { screen: 'main' }
  | { screen: 'stacks' }
  | { screen: 'detail'; stackId: string }
  | { screen: 'userStack'; userStackId: string }

type PracticeFlow =
  | { screen: 'hub' }
  | { screen: 'drill' }
  | { screen: 'readingSetup' }
  | { screen: 'reading' }
  | { screen: 'review' }

function MainTabs({
  sessionLaunchKey = 0,
  onRequestOnboardingReplay,
}: {
  sessionLaunchKey?: number
  onRequestOnboardingReplay?: () => void
}) {
  const insets = useSafeAreaInsets()
  const { theme, colorScheme, setColorScheme } = useAppTheme()
  const { isPro, loading: subLoading, openPaywall } = useSubscription()
  const [tab, setTab] = useState<'today' | 'learn' | 'practice'>('today')
  const [learnFlow, setLearnFlow] = useState<LearnFlow>({ screen: 'main' })
  const [practiceFlow, setPracticeFlow] = useState<PracticeFlow>({ screen: 'hub' })
  const [readingSession, setReadingSession] = useState<ReadingSession | null>(null)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [sessionRemountKey, setSessionRemountKey] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [items, setItems] = useState<VocabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mainLanguage, setMainLanguage] = useState(DEFAULT_MAIN_LANGUAGE)
  const [userTimezone, setUserTimezone] = useState(DEFAULT_TIMEZONE)
  const stats = useMemo(() => computeDashboardStats(items, userTimezone), [items, userTimezone])

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
    if (tab !== 'learn') setLearnFlow({ screen: 'main' })
  }, [tab])

  useEffect(() => {
    if (tab !== 'practice') {
      setPracticeFlow({ screen: 'hub' })
      setReadingSession(null)
    }
  }, [tab])

  useEffect(() => {
    if (tab !== 'practice') return
    if ((practiceFlow.screen === 'reading' || practiceFlow.screen === 'review') && !readingSession) {
      setPracticeFlow({ screen: 'readingSetup' })
    }
  }, [tab, practiceFlow.screen, readingSession])

  useEffect(() => {
    let cancelled = false
    void ensureUserProfileDefaults()
      .then((p) => {
        if (!cancelled) {
          setMainLanguage(normalizeMainLanguageCode(p.mainLanguage))
          setUserTimezone(typeof p.timezone === 'string' && p.timezone ? p.timezone : DEFAULT_TIMEZONE)
        }
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

  const handleStartSession = useCallback(async (): Promise<boolean> => {
    if (subLoading) return false
    if (!isPro) {
      try {
        const n = await getTodaySessionStarts()
        if (n >= FREE_MAX_SESSION_STARTS_PER_DAY) {
          openPaywall()
          return false
        }
      } catch {
        openPaywall()
        return false
      }
    }
    try {
      await recordSessionStart()
    } catch {
      /* still open session */
    }
    setSessionOpen(true)
    return true
  }, [isPro, subLoading, openPaywall])

  const consumedSessionLaunch = useRef(0)
  useEffect(() => {
    if (sessionLaunchKey === 0 || sessionLaunchKey <= consumedSessionLaunch.current || subLoading) return
    void (async () => {
      const opened = await handleStartSession()
      if (opened) consumedSessionLaunch.current = sessionLaunchKey
    })()
  }, [sessionLaunchKey, subLoading, handleStartSession])

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
              key={sessionRemountKey}
              theme={theme}
              mainLanguage={mainLanguage}
              onClose={() => {
                setSessionOpen(false)
                void reloadItems()
              }}
              onCompleted={() => void reloadItems()}
              onRequestNewSession={async () => {
                const opened = await handleStartSession()
                if (opened) setSessionRemountKey((k) => k + 1)
              }}
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
              onRequestOnboardingReplay={onRequestOnboardingReplay}
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
                learnFlow.screen === 'main' ? (
                  <LearnScreen
                    theme={theme}
                    mainLanguage={mainLanguage}
                    items={items}
                    onReload={reloadItems}
                    onOpenWordStacks={() => setLearnFlow({ screen: 'stacks' })}
                    onOpenUserStackDetail={(userStackId) => setLearnFlow({ screen: 'userStack', userStackId })}
                  />
                ) : learnFlow.screen === 'stacks' ? (
                  <WordStackBrowseScreen
                    theme={theme}
                    onBack={() => setLearnFlow({ screen: 'main' })}
                    onSelectStack={(stackId) => setLearnFlow({ screen: 'detail', stackId })}
                  />
                ) : learnFlow.screen === 'userStack' ? (
                  <UserStackDetailScreen
                    theme={theme}
                    userStackId={learnFlow.userStackId}
                    onBack={() => setLearnFlow({ screen: 'main' })}
                    onReload={reloadItems}
                  />
                ) : (
                  <WordStackDetailScreen
                    theme={theme}
                    stackId={learnFlow.stackId}
                    mainLanguage={mainLanguage}
                    items={items}
                    onBack={() => setLearnFlow({ screen: 'stacks' })}
                    onReload={reloadItems}
                  />
                )
              ) : null}
              {tab === 'practice' ? (
                practiceFlow.screen === 'hub' ? (
                  <PracticeHubScreen
                    theme={theme}
                    onSelectDrill={() => setPracticeFlow({ screen: 'drill' })}
                    onSelectReading={() => setPracticeFlow({ screen: 'readingSetup' })}
                  />
                ) : practiceFlow.screen === 'drill' ? (
                  <TestScreen
                    theme={theme}
                    items={items}
                    drillMode
                    onBackToPracticeHub={() => setPracticeFlow({ screen: 'hub' })}
                  />
                ) : practiceFlow.screen === 'readingSetup' ? (
                  <ReadingSetupScreen
                    theme={theme}
                    items={items}
                    onBackToHub={() => {
                      setReadingSession(null)
                      setPracticeFlow({ screen: 'hub' })
                    }}
                    onStart={(config) => {
                      setReadingSession(createReadingSession(config))
                      setPracticeFlow({ screen: 'reading' })
                    }}
                  />
                ) : practiceFlow.screen === 'reading' && readingSession ? (
                  <ReadingScreen
                    theme={theme}
                    session={readingSession}
                    onAbandonToSetup={() => {
                      setReadingSession(null)
                      setPracticeFlow({ screen: 'readingSetup' })
                    }}
                    onDoneReading={() => setPracticeFlow({ screen: 'review' })}
                  />
                ) : practiceFlow.screen === 'review' && readingSession ? (
                  <ReadingReviewScreen
                    theme={theme}
                    session={readingSession}
                    onBackToPracticeHub={() => {
                      setReadingSession(null)
                      setPracticeFlow({ screen: 'hub' })
                    }}
                    onAnotherRound={() => {
                      setReadingSession(null)
                      setPracticeFlow({ screen: 'readingSetup' })
                    }}
                    onContinueFocused={() => {
                      setReadingSession((s) =>
                        s && s.config.length === 'focused' && s.currentIndex < s.totalPassages - 1
                          ? { ...s, currentIndex: s.currentIndex + 1 }
                          : s,
                      )
                      setPracticeFlow({ screen: 'reading' })
                    }}
                  />
                ) : null
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
                label="Practice"
                active={tab === 'practice'}
                onPress={() => setTab('practice')}
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

function PostAuthApp({ user }: { user: User }) {
  const { theme } = useAppTheme()
  const [gate, setGate] = useState<'loading' | 'onboarding' | 'main'>('loading')
  const [sessionLaunchKey, setSessionLaunchKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void ensureUserProfileDefaults()
      .then((p) => {
        if (cancelled) return
        setGate(shouldShowOnboarding(p) ? 'onboarding' : 'main')
      })
      .catch(() => {
        if (!cancelled) setGate('main')
      })
    return () => {
      cancelled = true
    }
  }, [user.uid])

  if (gate === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.learnScreenBg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    )
  }

  if (gate === 'onboarding') {
    return (
      <OnboardingFlow
        theme={theme}
        onComplete={() => {
          setGate('main')
          setSessionLaunchKey((k) => k + 1)
        }}
        onReloadWords={async () => {}}
      />
    )
  }

  return (
    <>
      <MainTabs
        sessionLaunchKey={sessionLaunchKey}
        onRequestOnboardingReplay={() => setGate('onboarding')}
      />
      <SubscriptionPaywall />
    </>
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
          <PostAuthApp user={user} />
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
