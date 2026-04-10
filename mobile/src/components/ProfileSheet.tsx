import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { MAIN_LANGUAGE_OPTIONS, normalizeMainLanguageCode } from '@shared/languages'
import type { ExamPart, ExamTarget } from '@shared/userProfile'
import { DEFAULT_TIMEZONE } from '@shared/userProfile'
import { useAuth } from '../context/AuthContext'
import { signOutUser } from '../lib/auth'
import {
  ensureUserProfileDefaults,
  saveExamTarget,
  saveUserProfilePatch,
} from '../lib/userProfile'
import Purchases from 'react-native-purchases'
import { useSubscription } from '../context/SubscriptionContext'
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '../lib/legalLinks'
import type { AppTheme } from '../theme'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const EXAM_PART_ROWS: { id: ExamPart; label: string; hint: string }[] = [
  { id: 'early', label: 'Early', hint: 'Days 1–10' },
  { id: 'mid', label: 'Mid', hint: 'Days 11–20' },
  { id: 'late', label: 'Late', hint: 'Days 21–31' },
]

type Props = {
  theme: AppTheme
  colorScheme: 'light' | 'dark'
  setColorScheme: (next: 'light' | 'dark') => void
  visible: boolean
  onClose: () => void
  onProfileSaved?: () => void
}

type SubScreen = 'main' | 'language'

export function ProfileSheet({
  theme,
  colorScheme,
  setColorScheme,
  visible,
  onClose,
  onProfileSaved,
}: Props) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const [profileChromeHeight, setProfileChromeHeight] = useState(0)
  const { user } = useAuth()
  const { isPro, loading: subLoading, openPaywall, restore } = useSubscription()
  const [subScreen, setSubScreen] = useState<SubScreen>('main')
  const [langQuery, setLangQuery] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [examYear, setExamYear] = useState(new Date().getFullYear())
  const [examMonth, setExamMonth] = useState(1)
  const [examPart, setExamPart] = useState<ExamPart>('mid')
  const [mainLanguage, setMainLanguage] = useState('en')

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 8 }, (_, i) => y + i)
  }, [])

  const filteredLanguages = useMemo(() => {
    const q = langQuery.trim().toLowerCase()
    if (!q) return MAIN_LANGUAGE_OPTIONS
    return MAIN_LANGUAGE_OPTIONS.filter(
      (o) => o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
    )
  }, [langQuery])

  const currentLangLabel =
    MAIN_LANGUAGE_OPTIONS.find((o) => o.code === mainLanguage)?.label ?? mainLanguage

  useEffect(() => {
    if (!visible) {
      setSubScreen('main')
      setLangQuery('')
    }
  }, [visible])

  useEffect(() => {
    if (!visible || !user) return
    let cancelled = false
    setLoadingProfile(true)
    setSaved(false)
    void ensureUserProfileDefaults()
      .then((p) => {
        if (cancelled) return
        setMainLanguage(normalizeMainLanguageCode(p.mainLanguage))
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
      await saveUserProfilePatch({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE,
        mainLanguage: normalizeMainLanguageCode(mainLanguage),
      })
      const target: ExamTarget = { year: examYear, month: examMonth, part: examPart }
      await saveExamTarget(target)
      setSaved(true)
      onProfileSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const sheetBg = theme.learnScreenBg
  const cardBg = theme.surface2
  const privacyUrl = getPrivacyPolicyUrl()
  const termsUrl = getTermsOfServiceUrl()
  const showLegal = Boolean(privacyUrl || termsUrl)

  const sheetMaxHeight = windowHeight * 0.92
  const sheetPadTop = 4
  const sheetPadBottom = Math.max(insets.bottom, 16)
  const profileScrollMaxHeight =
    profileChromeHeight > 0
      ? Math.max(160, sheetMaxHeight - sheetPadTop - profileChromeHeight - sheetPadBottom)
      : Math.max(160, sheetMaxHeight * 0.68)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss profile" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.kav, { maxHeight: sheetMaxHeight }]}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: sheetBg,
                paddingBottom: sheetPadBottom,
                paddingTop: sheetPadTop,
                maxHeight: sheetMaxHeight,
                borderColor: theme.learnGlassBorder,
              },
            ]}
          >
            {subScreen === 'language' ? (
              <>
                <View style={styles.handleWrap}>
                  <View style={[styles.handle, { backgroundColor: theme.learnOutline }]} />
                </View>
                <LanguagePickerBody
                  theme={theme}
                  query={langQuery}
                  onQueryChange={setLangQuery}
                  filtered={filteredLanguages}
                  selected={mainLanguage}
                  onSelect={(code) => {
                    setMainLanguage(code)
                    setSubScreen('main')
                    setLangQuery('')
                  }}
                  onBack={() => {
                    setSubScreen('main')
                    setLangQuery('')
                  }}
                />
              </>
            ) : (
              <>
                <View
                  style={{ width: '100%' }}
                  onLayout={(e) => setProfileChromeHeight(e.nativeEvent.layout.height)}
                >
                  <View style={styles.handleWrap}>
                    <View style={[styles.handle, { backgroundColor: theme.learnOutline }]} />
                  </View>
                  <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: theme.learnOnSurface }]}>Profile</Text>
                      {user?.email ? (
                        <Text style={[styles.email, { color: theme.learnOnSurfaceVariant }]} numberOfLines={1}>
                          {user.email}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={onClose}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      style={[styles.iconBtn, { backgroundColor: cardBg }]}
                    >
                      <MaterialIcons name="close" size={22} color={theme.learnOnSurface} />
                    </Pressable>
                  </View>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  style={[styles.scrollView, { maxHeight: profileScrollMaxHeight }]}
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom, 12) + 8 },
                  ]}
                >
                  <SectionCard theme={theme} cardBg={cardBg} title="Appearance" subtitle="App colors across Lexicon.">
                    <View style={[styles.segmentWrap, { backgroundColor: theme.learnViewToggleBg }]}>
                      <Pressable
                        onPress={() => setColorScheme('light')}
                        style={[
                          styles.segmentCell,
                          colorScheme === 'light' && { backgroundColor: theme.learnPillActiveBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            {
                              color:
                                colorScheme === 'light' ? theme.learnPillActiveText : theme.learnOnSurfaceVariant,
                              fontWeight: colorScheme === 'light' ? '800' : '600',
                            },
                          ]}
                        >
                          Light
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setColorScheme('dark')}
                        style={[
                          styles.segmentCell,
                          colorScheme === 'dark' && { backgroundColor: theme.learnPillActiveBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            {
                              color:
                                colorScheme === 'dark' ? theme.learnPillActiveText : theme.learnOnSurfaceVariant,
                              fontWeight: colorScheme === 'dark' ? '800' : '600',
                            },
                          ]}
                        >
                          Dark
                        </Text>
                      </Pressable>
                    </View>
                  </SectionCard>

                  <SectionCard
                    theme={theme}
                    cardBg={cardBg}
                    title="Gloss language"
                    subtitle="Native-language gloss on cards. Definitions stay in English."
                  >
                    <Pressable
                      onPress={() => setSubScreen('language')}
                      style={[styles.rowChevron, { borderColor: theme.learnGlassBorder, backgroundColor: theme.learnSearchBg }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowValue, { color: theme.learnOnSurface }]} numberOfLines={1}>
                          {currentLangLabel}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={theme.learnOutline} />
                    </Pressable>
                  </SectionCard>

                  <SectionCard
                    theme={theme}
                    cardBg={cardBg}
                    title="Exam window"
                    subtitle="Used for streaks and session planning."
                  >
                    {loadingProfile ? (
                      <ActivityIndicator style={{ marginVertical: 12 }} color={theme.learnAccent} />
                    ) : (
                      <>
                        <ExamWindowFields
                          theme={theme}
                          examMonth={examMonth}
                          examYear={examYear}
                          examPart={examPart}
                          yearOptions={yearOptions}
                          onMonth={setExamMonth}
                          onYear={setExamYear}
                          onPart={setExamPart}
                        />
                      </>
                    )}
                  </SectionCard>

                  <Pressable
                    onPress={() => void saveProfileSettings()}
                    disabled={saving || loadingProfile}
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: theme.learnAccent,
                        opacity: saving || loadingProfile ? 0.55 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.primaryBtnText, { color: theme.learnPillActiveText }]}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </Text>
                  </Pressable>
                  {saved ? (
                    <Text style={[styles.savedHint, { color: theme.learnTertiary }]}>Saved</Text>
                  ) : null}

                  <SectionCard
                    theme={theme}
                    cardBg={cardBg}
                    title="Lexicon Pro"
                    subtitle={
                      isPro
                        ? 'Your subscription is active.'
                        : 'Free: 50 saved words, 3 session starts/day, 2 basic stacks. Pro: unlimited saves & sessions, all stacks.'
                    }
                  >
                    {subLoading ? (
                      <ActivityIndicator style={{ marginVertical: 8 }} color={theme.learnAccent} />
                    ) : isPro ? (
                      <View style={{ gap: 10 }}>
                        {Platform.OS === 'ios' ? (
                          <Pressable
                            onPress={() =>
                              void Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {})
                            }
                            style={[
                              styles.rowChevron,
                              { borderColor: theme.learnGlassBorder, backgroundColor: theme.learnSearchBg },
                            ]}
                            accessibilityRole="link"
                            accessibilityLabel="Manage subscription in App Store"
                          >
                            <Text style={[styles.rowValue, { color: theme.learnOnSurface }]}>Manage in App Store</Text>
                            <MaterialIcons name="open-in-new" size={20} color={theme.learnOutline} />
                          </Pressable>
                        ) : null}
                        <Pressable onPress={() => void restore()} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.learnAccent }}>Restore purchases</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        <Pressable
                          onPress={openPaywall}
                          style={{
                            backgroundColor: theme.learnAccent,
                            paddingVertical: 14,
                            borderRadius: 12,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 15, fontWeight: '800', color: theme.learnPillActiveText }}>Upgrade</Text>
                        </Pressable>
                        <Pressable onPress={() => void restore()}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.learnOutline }}>Restore purchases</Text>
                        </Pressable>
                      </View>
                    )}
                  </SectionCard>

                  {showLegal ? (
                    <SectionCard theme={theme} cardBg={cardBg} title="Legal" subtitle="Opens in your browser.">
                      {privacyUrl ? (
                        <Pressable
                          onPress={() => void Linking.openURL(privacyUrl)}
                          style={[styles.rowChevron, { borderColor: theme.learnGlassBorder, backgroundColor: theme.learnSearchBg }]}
                          accessibilityRole="link"
                          accessibilityLabel="Privacy policy"
                        >
                          <Text style={[styles.rowValue, { color: theme.learnAccent }]}>Privacy Policy</Text>
                          <MaterialIcons name="open-in-new" size={20} color={theme.learnOutline} />
                        </Pressable>
                      ) : null}
                      {termsUrl ? (
                        <Pressable
                          onPress={() => void Linking.openURL(termsUrl)}
                          style={[
                            styles.rowChevron,
                            {
                              borderColor: theme.learnGlassBorder,
                              backgroundColor: theme.learnSearchBg,
                              marginTop: privacyUrl ? 10 : 0,
                            },
                          ]}
                          accessibilityRole="link"
                          accessibilityLabel="Terms of service"
                        >
                          <Text style={[styles.rowValue, { color: theme.learnAccent }]}>Terms of Service</Text>
                          <MaterialIcons name="open-in-new" size={20} color={theme.learnOutline} />
                        </Pressable>
                      ) : null}
                    </SectionCard>
                  ) : null}

                  <Pressable
                    onPress={() => {
                      void (async () => {
                        setSigningOut(true)
                        try {
                          await Purchases.logOut().catch(() => {})
                          await signOutUser()
                          onClose()
                        } finally {
                          setSigningOut(false)
                        }
                      })()
                    }}
                    disabled={signingOut}
                    style={[styles.signOutBtn, { borderColor: theme.danger, opacity: signingOut ? 0.55 : 1 }]}
                  >
                    <Text style={{ color: theme.danger, fontWeight: '800', fontSize: 15 }}>
                      {signingOut ? 'Signing out…' : 'Sign out'}
                    </Text>
                  </Pressable>
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

function ExamWindowFields({
  theme,
  examMonth,
  examYear,
  examPart,
  yearOptions,
  onMonth,
  onYear,
  onPart,
}: {
  theme: AppTheme
  examMonth: number
  examYear: number
  examPart: ExamPart
  yearOptions: number[]
  onMonth: (m: number) => void
  onYear: (y: number) => void
  onPart: (p: ExamPart) => void
}) {
  const partLabel = EXAM_PART_ROWS.find((r) => r.id === examPart)?.label ?? examPart
  const summary = `${MONTHS[examMonth - 1]} ${examYear} · ${partLabel}`

  const yearRows: number[][] = []
  for (let i = 0; i < yearOptions.length; i += 4) {
    yearRows.push(yearOptions.slice(i, i + 4))
  }

  return (
    <View style={[styles.examWell, { borderColor: theme.learnGlassBorder, backgroundColor: theme.learnSearchBg }]}>
      <Text style={[styles.examSummary, { color: theme.learnOnSurface }]} numberOfLines={2}>
        {summary}
      </Text>
      <Text style={[styles.examSummaryHint, { color: theme.learnOnSurfaceVariant }]}>
        Target window for streaks and planning
      </Text>

      <Text style={[styles.examFieldLabel, { color: theme.learnOnSurfaceVariant }]}>Month</Text>
      <View style={styles.examMonthGrid}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.examGridRow}>
            {MONTHS.slice(row * 4, row * 4 + 4).map((name, col) => {
              const m = row * 4 + col + 1
              const on = examMonth === m
              return (
                <Pressable
                  key={name}
                  onPress={() => onMonth(m)}
                  style={[
                    styles.examMonthCell,
                    {
                      borderColor: on ? theme.learnAccent : theme.learnGlassBorder,
                      backgroundColor: on ? 'rgba(99, 102, 241, 0.18)' : theme.learnViewToggleBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.examMonthCellText,
                      { color: on ? theme.learnAccent : theme.learnOnSurfaceVariant, fontWeight: on ? '800' : '600' },
                    ]}
                  >
                    {name}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>

      <Text style={[styles.examFieldLabel, { color: theme.learnOnSurfaceVariant, marginTop: 14 }]}>Year</Text>
      <View style={styles.examYearBlock}>
        {yearRows.map((row, ri) => (
          <View key={ri} style={[styles.examGridRow, ri < yearRows.length - 1 && { marginBottom: 6 }]}>
            {row.map((y) => {
              const on = examYear === y
              return (
                <Pressable
                  key={y}
                  onPress={() => onYear(y)}
                  style={[
                    styles.examYearCell,
                    {
                      borderColor: on ? theme.learnAccent : theme.learnGlassBorder,
                      backgroundColor: on ? 'rgba(99, 102, 241, 0.18)' : theme.learnViewToggleBg,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: on ? '800' : '600',
                      color: on ? theme.learnAccent : theme.learnOnSurface,
                    }}
                  >
                    {y}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>

      <Text style={[styles.examFieldLabel, { color: theme.learnOnSurfaceVariant, marginTop: 14 }]}>Part of month</Text>
      <View style={styles.examPartRow}>
        {EXAM_PART_ROWS.map(({ id, label, hint }) => {
          const on = examPart === id
          return (
            <Pressable
              key={id}
              onPress={() => onPart(id)}
              style={[
                styles.examPartCard,
                {
                  borderColor: on ? theme.learnAccent : theme.learnGlassBorder,
                  backgroundColor: on ? theme.learnAccent : theme.learnViewToggleBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.examPartTitle,
                  {
                    color: on ? theme.learnPillActiveText : theme.learnOnSurface,
                    fontWeight: on ? '800' : '700',
                  },
                ]}
              >
                {label}
              </Text>
              <Text
                style={[
                  styles.examPartHint,
                  {
                    color: on ? theme.learnPillActiveText : theme.learnOnSurfaceVariant,
                    opacity: on ? 0.88 : 1,
                  },
                ]}
                numberOfLines={1}
              >
                {hint}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function SectionCard({
  theme,
  cardBg,
  title,
  subtitle,
  children,
}: {
  theme: AppTheme
  cardBg: string
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: cardBg,
          borderColor: theme.learnGlassBorder,
        },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.learnOnSurface }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: theme.learnOnSurfaceVariant }]}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  )
}

function LanguagePickerBody({
  theme,
  query,
  onQueryChange,
  filtered,
  selected,
  onSelect,
  onBack,
}: {
  theme: AppTheme
  query: string
  onQueryChange: (q: string) => void
  filtered: { code: string; label: string }[]
  selected: string
  onSelect: (code: string) => void
  onBack: () => void
}) {
  return (
    <View style={{ flexGrow: 1, minHeight: 360 }}>
      <View style={styles.langHeader}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.langBackBtn} accessibilityLabel="Back">
          <MaterialIcons name="arrow-back" size={22} color={theme.learnOnSurface} />
        </Pressable>
        <Text style={[styles.langHeaderTitle, { color: theme.learnOnSurface }]}>Gloss language</Text>
        <View style={{ width: 40 }} />
      </View>
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: theme.learnSearchBg,
            borderColor: theme.learnGlassBorder,
          },
        ]}
      >
        <MaterialIcons name="search" size={20} color={theme.learnOutline} style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search languages"
          placeholderTextColor={theme.learnOutline}
          style={[styles.searchInput, { color: theme.learnOnSurface }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => onQueryChange('')} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={theme.learnOutline} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, marginTop: 8 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const on = selected === item.code
          return (
            <Pressable
              onPress={() => onSelect(item.code)}
              style={[
                styles.langRow,
                {
                  borderBottomColor: theme.learnGlassBorder,
                  backgroundColor: on ? 'rgba(99,102,241,0.12)' : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: on ? '800' : '500',
                  color: on ? theme.learnAccent : theme.learnOnSurface,
                }}
                numberOfLines={2}
              >
                {item.label}
              </Text>
              {on ? <MaterialIcons name="check" size={22} color={theme.learnAccent} /> : null}
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <Text style={{ color: theme.learnOnSurfaceVariant, textAlign: 'center', marginTop: 24 }}>
            No matches
          </Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kav: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    maxWidth: '100%',
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 13,
    marginTop: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 8,
    width: '100%',
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 12,
  },
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentCell: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 14,
  },
  rowChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  examWell: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 2,
  },
  examSummary: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  examSummaryHint: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  examFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  examMonthGrid: {
    gap: 6,
  },
  examGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  examMonthCell: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examMonthCellText: {
    fontSize: 12,
    letterSpacing: -0.2,
  },
  examYearBlock: {
    width: '100%',
  },
  examYearCell: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examPartRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  examPartCard: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examPartTitle: {
    fontSize: 14,
  },
  examPartHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  savedHint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  signOutBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  langHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  langBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
