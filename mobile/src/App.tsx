import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from 'react-native'
import type { VocabItem } from '@shared/types'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './context/AuthContext'
import { signOutUser } from './lib/auth'
import { listVocabItems } from './lib/vocab'
import { DashboardScreen, computeDashboardStats } from './screens/DashboardScreen'
import { LearnScreen } from './screens/LearnScreen'
import { SignInScreen } from './screens/SignInScreen'
import { SignUpScreen } from './screens/SignUpScreen'
import { TestScreen } from './screens/TestScreen'
import { darkTheme, lightTheme } from './theme'

function AuthNavigator({ isDark }: { isDark: boolean }) {
  const theme = isDark ? darkTheme : lightTheme
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {mode === 'signin' ? (
        <SignInScreen theme={theme} onGoSignUp={() => setMode('signup')} />
      ) : (
        <SignUpScreen theme={theme} onGoSignIn={() => setMode('signin')} />
      )}
    </SafeAreaView>
  )
}

function MainTabs({ isDark }: { isDark: boolean }) {
  const theme = isDark ? darkTheme : lightTheme
  const [tab, setTab] = useState<'dashboard' | 'learn' | 'test'>('dashboard')
  const [items, setItems] = useState<VocabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>GMAT Vocab Wizard</Text>
        <Pressable onPress={() => void signOutUser()}>
          <Text style={{ color: theme.muted }}>Sign out</Text>
        </Pressable>
      </View>
      {error ? (
        <Text style={{ color: theme.danger, paddingHorizontal: 16, paddingTop: 8 }}>{error}</Text>
      ) : null}
      <View style={{ flex: 1 }}>
        {tab === 'dashboard' ? <DashboardScreen theme={theme} stats={stats} /> : null}
        {tab === 'learn' ? <LearnScreen theme={theme} items={items} onReload={reloadItems} /> : null}
        {tab === 'test' ? <TestScreen theme={theme} items={items} /> : null}
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
          label="Dashboard"
          active={tab === 'dashboard'}
          onPress={() => setTab('dashboard')}
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
    </SafeAreaView>
  )
}

function RootNavigation() {
  const { loading, user } = useAuth()
  const scheme = useColorScheme()
  const isDark = scheme !== 'light'
  const theme = isDark ? darkTheme : lightTheme

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    )
  }

  return user ? <MainTabs isDark={isDark} /> : <AuthNavigator isDark={isDark} />
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <RootNavigation />
    </AuthProvider>
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
