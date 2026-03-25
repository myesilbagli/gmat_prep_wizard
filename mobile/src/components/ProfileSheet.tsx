import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { ExamPart, ExamTarget } from '@shared/userProfile'
import { DEFAULT_TIMEZONE } from '@shared/userProfile'
import { useAuth } from '../context/AuthContext'
import { signOutUser } from '../lib/auth'
import {
  ensureUserProfileDefaults,
  saveExamTarget,
  saveUserProfilePatch,
} from '../lib/userProfile'
import type { AppTheme } from '../theme'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Props = {
  theme: AppTheme
  colorScheme: 'light' | 'dark'
  setColorScheme: (next: 'light' | 'dark') => void
  visible: boolean
  onClose: () => void
}

export function ProfileSheet({
  theme,
  colorScheme,
  setColorScheme,
  visible,
  onClose,
}: Props) {
  const { user } = useAuth()
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)
  const [examYear, setExamYear] = useState(new Date().getFullYear())
  const [examMonth, setExamMonth] = useState(1)
  const [examPart, setExamPart] = useState<ExamPart>('mid')

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 8 }, (_, i) => y + i)
  }, [])

  useEffect(() => {
    if (!visible || !user) return
    let cancelled = false
    setLoadingProfile(true)
    setSaved(false)
    void ensureUserProfileDefaults()
      .then((p) => {
        if (cancelled) return
        setTimezone(p.timezone || DEFAULT_TIMEZONE)
        if (p.examTarget) {
          setExamYear(p.examTarget.year)
          setExamMonth(p.examTarget.month)
          setExamPart(p.examTarget.part)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false)
      })
    return () => {
      cancelled = true
    }
  }, [visible, user])

  async function saveProfileSettings() {
    if (!user) return
    setSaving(true)
    setSaved(false)
    try {
      await saveUserProfilePatch({ timezone: timezone.trim() || DEFAULT_TIMEZONE })
      const target: ExamTarget = { year: examYear, month: examMonth, part: examPart }
      await saveExamTarget(target)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: 20,
        }}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%', maxWidth: 400, alignSelf: 'center' }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 16,
                maxHeight: '88%',
              }}
            >
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Profile</Text>
              {user?.email ? (
                <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }} numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}

              <ScrollView
                style={{ marginTop: 16 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>SETTINGS</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable
                    onPress={() => setColorScheme('light')}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colorScheme === 'light' ? theme.text : theme.border,
                      backgroundColor: colorScheme === 'light' ? theme.surface2 : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        textAlign: 'center',
                        fontWeight: '700',
                        color: colorScheme === 'light' ? theme.text : theme.muted,
                      }}
                    >
                      Light
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setColorScheme('dark')}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colorScheme === 'dark' ? theme.text : theme.border,
                      backgroundColor: colorScheme === 'dark' ? theme.surface2 : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        textAlign: 'center',
                        fontWeight: '700',
                        color: colorScheme === 'dark' ? theme.text : theme.muted,
                      }}
                    >
                      Dark
                    </Text>
                  </Pressable>
                </View>

                <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700', marginTop: 16 }}>
                  EXAM WINDOW
                </Text>
                {loadingProfile ? (
                  <ActivityIndicator style={{ marginTop: 8 }} color={theme.primary} />
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      <PartPicker theme={theme} months={MONTHS} value={examMonth} onChange={setExamMonth} />
                      <YearPicker theme={theme} years={yearOptions} value={examYear} onChange={setExamYear} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      {(['early', 'mid', 'late'] as ExamPart[]).map((p) => (
                        <Pressable
                          key={p}
                          onPress={() => setExamPart(p)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: theme.border,
                            backgroundColor: examPart === p ? 'rgba(99,102,241,0.2)' : theme.surface,
                          }}
                        >
                          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{p}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 10 }}>Timezone (IANA)</Text>
                    <TextInput
                      value={timezone}
                      onChangeText={setTimezone}
                      placeholder="e.g. America/New_York"
                      placeholderTextColor={theme.muted}
                      style={{
                        marginTop: 4,
                        borderWidth: 1,
                        borderColor: theme.border,
                        borderRadius: 10,
                        padding: 12,
                        color: theme.text,
                        backgroundColor: theme.surface2,
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      onPress={() => void saveProfileSettings()}
                      disabled={saving}
                      style={{
                        marginTop: 10,
                        alignSelf: 'flex-start',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: theme.border,
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: '700' }}>
                        {saving ? 'Saving…' : 'Save exam + timezone'}
                      </Text>
                    </Pressable>
                    {saved ? (
                      <Text style={{ color: theme.muted, fontSize: 12, marginTop: 6 }}>Saved</Text>
                    ) : null}
                  </>
                )}

                <Pressable
                  onPress={() => {
                    void (async () => {
                      setSigningOut(true)
                      try {
                        await signOutUser()
                        onClose()
                      } finally {
                        setSigningOut(false)
                      }
                    })()
                  }}
                  disabled={signingOut}
                  style={{
                    marginTop: 20,
                    paddingVertical: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: theme.danger,
                    alignItems: 'center',
                    opacity: signingOut ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: theme.danger, fontWeight: '700' }}>
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </Text>
                </Pressable>
              </ScrollView>

              <Pressable
                onPress={onClose}
                style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
              >
                <Text style={{ color: theme.muted, fontWeight: '600' }}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

function PartPicker({
  theme,
  months,
  value,
  onChange,
}: {
  theme: AppTheme
  months: string[]
  value: number
  onChange: (m: number) => void
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {months.map((name, idx) => (
          <Pressable
            key={name}
            onPress={() => onChange(idx + 1)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: value === idx + 1 ? 'rgba(99,102,241,0.2)' : theme.surface,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}

function YearPicker({
  theme,
  years,
  value,
  onChange,
}: {
  theme: AppTheme
  years: number[]
  value: number
  onChange: (y: number) => void
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {years.map((y) => (
        <Pressable
          key={y}
          onPress={() => onChange(y)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: value === y ? 'rgba(99,102,241,0.2)' : theme.surface,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{y}</Text>
        </Pressable>
      ))}
    </View>
  )
}
