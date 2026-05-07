import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { pickParagraphWords } from '@shared/paragraphPicker'
import type { VocabItem } from '@shared/types'
import { getNativeGloss } from '@shared/vocab'
import { GlassScreenRoot, isLearnDarkUi, useGlassFonts } from '../components/GlassUi'
import { useReadingCountdown } from '../hooks/useReadingCountdown'
import type { GenerateParagraphOptions } from '../lib/api'
import { generateParagraph } from '../lib/api'
import { applyParagraphExposure } from '../lib/vocab'
import type { ParagraphPart, ReadingSession } from '../reading/readingSession'
import type { AppTheme } from '../theme'

const READING_DOMAINS = ['business and economics', 'social science', 'natural science', 'humanities'] as const

function pickReadingDomain(seed: string, index: number): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const idx = Math.abs(h + index * 17) % READING_DOMAINS.length
  return READING_DOMAINS[idx]
}

function buildParagraphRequestOptions(session: ReadingSession): GenerateParagraphOptions {
  const { config, currentIndex, totalPassages } = session
  let lengthHint =
    config.length === 'quick'
      ? 'Single quick read; one cohesive paragraph (150-200 words).'
      : config.length === 'focused'
        ? 'Part of a three-passage focused set; vary angle while keeping register (150-200 words).'
        : 'Timed single passage; keep density scannable under time pressure (150-200 words).'

  const userTheme = config.theme?.trim()
  if (userTheme) {
    lengthHint += ` THEME LOCK-IN: Most of the passage must clearly develop the user's theme "${userTheme}" (concrete context, debate, or mechanism under that theme). Do not replace it with a generic unrelated subject; integrate each vocabulary target in a way that still reads as about this theme where linguistically plausible.`
  }

  const seed = session.usedWordIds.join('|') || 'deck'
  const domain =
    userTheme && userTheme.length > 0 ? undefined : pickReadingDomain(`${seed}|${currentIndex}`, currentIndex)

  const opts: GenerateParagraphOptions = {
    difficulty: 'intermediate',
    lengthHint,
  }
  if (domain) opts.domain = domain
  if (userTheme) opts.theme = userTheme
  if (totalPassages > 1) {
    opts.focusedIndex = currentIndex
    opts.totalPassages = totalPassages
  }
  return opts
}

type Props = {
  theme: AppTheme
  mainLanguage: string
  items: VocabItem[]
  session: ReadingSession
  setReadingSession: React.Dispatch<React.SetStateAction<ReadingSession | null>>
  onReloadItems: () => Promise<void>
  onAbandonToSetup: () => void
  onRequestReview: () => void
}

export function ReadingScreen({
  theme,
  mainLanguage,
  items,
  session,
  setReadingSession,
  onReloadItems,
  onAbandonToSetup,
  onRequestReview,
}: Props) {
  const { fontHeadline, fontHeadlineSm, fontBody, fontLabelBold } = useGlassFonts()
  const learnDark = isLearnDarkUi(theme)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [glossaryWord, setGlossaryWord] = useState<VocabItem | null>(null)

  const timed = session.config.length === 'timed'
  const currentPassage = session.passages[session.currentIndex]
  const parts = currentPassage?.parts ?? []
  const partCount = parts.length
  const hasPassage = partCount > 0
  const startedAt = currentPassage?.readingStartedAt ?? null

  const remainingSec = useReadingCountdown(timed && hasPassage, startedAt)
  const glossaryUnlocked = !timed || remainingSec <= 0

  const targetHighlightBg = learnDark ? 'rgba(189, 194, 255, 0.22)' : 'rgba(99, 102, 241, 0.18)'

  const pickedByText = useMemo(() => {
    const m = new Map<string, VocabItem>()
    for (const w of currentPassage?.picked ?? []) {
      m.set(w.text, w)
    }
    return m
  }, [currentPassage?.picked])

  useEffect(() => {
    setLoadError(null)
  }, [session.currentIndex])

  const runGenerate = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      const picked = pickParagraphWords(items, Date.now(), 5, {
        pool: session.config.pool,
        excludeIds: session.usedWordIds,
      })
      if (!picked.length) {
        throw new Error('No eligible words for this pool. Try another pool or study more words first.')
      }

      const apiOpts = buildParagraphRequestOptions(session)
      const nonce = `n-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
      const resp = await generateParagraph(picked, { ...apiOpts, nonce })
      if (!resp.parts?.length) throw new Error('Empty paragraph response.')

      /**
       * Exposure policy (Focused + all modes): credit applies as soon as generation succeeds,
       * not when the user finishes reading — we cannot verify read completion client-side.
       * Abandoned sessions still retain credit for any passage that completed a successful generate.
       */
      await applyParagraphExposure(picked.map((p) => p.id))
      await onReloadItems()

      const now = Date.now()
      setReadingSession((prev) => {
        if (!prev) return prev
        const at = prev.currentIndex
        const nextPassages = [...prev.passages]
        const prior = nextPassages[at]
        nextPassages[at] = {
          parts: resp.parts as ParagraphPart[],
          picked,
          domain: apiOpts.domain ?? prior?.domain,
          difficulty: 'intermediate',
          readingStartedAt: prior?.readingStartedAt ?? now,
          readingEndedAt: prior?.readingEndedAt,
        }
        const used = new Set(prev.usedWordIds)
        picked.forEach((p) => used.add(p.id))
        return { ...prev, passages: nextPassages, usedWordIds: [...used] }
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to generate passage')
    } finally {
      setLoading(false)
    }
  }, [items, onReloadItems, session, setReadingSession])

  const sessionKey = `${session.currentIndex}|${session.config.pool}|${session.config.length}|${session.config.theme ?? ''}|${session.usedWordIds.join(',')}|${session.totalPassages}`

  useEffect(() => {
    if (partCount > 0) return
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await runGenerate()
    })()
    return () => {
      cancelled = true
    }
  }, [sessionKey, partCount, runGenerate])

  function openGlossaryForTarget(text: string) {
    if (!glossaryUnlocked) return
    const w = pickedByText.get(text)
    if (w) setGlossaryWord(w)
  }

  function handleDoneReading() {
    setReadingSession((prev) => {
      if (!prev) return prev
      const at = prev.currentIndex
      const cur = prev.passages[at]
      if (!cur) return prev
      const nextPassages = [...prev.passages]
      nextPassages[at] = { ...cur, readingEndedAt: Date.now() }
      return { ...prev, passages: nextPassages }
    })
    onRequestReview()
  }

  const glossDef =
    glossaryWord != null ? getNativeGloss(glossaryWord, mainLanguage) ?? glossaryWord.simpleDefinition : ''
  const glossExample =
    glossaryWord?.examples?.[0] ?? glossaryWord?.exampleSentence ?? ''

  const sessionTheme = session.config.theme?.trim()

  return (
    <GlassScreenRoot theme={theme}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 6,
          }}
        >
          <Pressable
            onPress={onAbandonToSetup}
            hitSlop={12}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Back to reading setup"
          >
            <MaterialIcons name="arrow-back" size={22} color={theme.learnAccent} />
            <Text style={{ fontFamily: fontLabelBold, fontSize: 14, fontWeight: '700', color: theme.learnAccent }}>Setup</Text>
          </Pressable>
          <Text style={{ fontFamily: fontLabelBold, fontSize: 13, color: theme.learnOnSurfaceVariant }}>
            Passage {session.currentIndex + 1} of {session.totalPassages}
          </Text>
          {timed && hasPassage ? (
            <Text
              style={{
                fontFamily: fontHeadlineSm,
                fontSize: 16,
                fontWeight: '800',
                color: remainingSec <= 10 ? theme.danger : theme.learnOnSurface,
              }}
              accessibilityLiveRegion="polite"
            >
              {remainingSec}s
            </Text>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              fontFamily: fontHeadline,
              fontSize: 22,
              fontWeight: '800',
              color: theme.learnOnSurface,
              marginBottom: 8,
            }}
          >
            Reading
          </Text>
          {sessionTheme ? (
            <Text
              style={{
                fontFamily: fontBody,
                fontSize: 13,
                lineHeight: 19,
                color: theme.learnAccent,
                marginBottom: 10,
              }}
              accessibilityLabel={`Active theme: ${sessionTheme}`}
            >
              Theme: {sessionTheme}
            </Text>
          ) : null}
          {timed ? (
            <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant, marginBottom: 12 }}>
              Glossary unlocks when the timer reaches 0.
            </Text>
          ) : null}

          {loading && !hasPassage ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color={theme.learnAccent} />
              <Text style={{ fontFamily: fontBody, marginTop: 12, color: theme.learnOnSurfaceVariant }}>Generating passage…</Text>
            </View>
          ) : null}

          {loadError ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: fontBody, color: theme.danger, marginBottom: 12 }}>{loadError}</Text>
              <Pressable
                onPress={() => void runGenerate()}
                style={{
                  alignSelf: 'flex-start',
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 999,
                  backgroundColor: theme.learnPillActiveBg,
                }}
                accessibilityRole="button"
                accessibilityLabel="Retry generating passage"
              >
                <Text style={{ fontFamily: fontLabelBold, color: theme.learnPillActiveText }}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {hasPassage ? (
            <Text
              style={{
                fontFamily: fontBody,
                fontSize: 17,
                lineHeight: 28,
                color: theme.learnOnSurface,
                marginTop: 8,
              }}
            >
              {parts.map((p, i) =>
                p.kind === 'text' ? (
                  <Text key={i}>{p.value}</Text>
                ) : (
                  <Text
                    key={i}
                    onPress={() => openGlossaryForTarget(p.text)}
                    suppressHighlighting={!glossaryUnlocked}
                    style={{
                      backgroundColor: targetHighlightBg,
                      fontWeight: '800',
                      color: theme.learnOnSurface,
                      textDecorationLine: 'underline',
                    }}
                    accessibilityRole={glossaryUnlocked ? 'button' : 'text'}
                    accessibilityLabel={glossaryUnlocked ? `Glossary for ${p.text}` : `${p.text}, glossary locked until timer ends`}
                  >
                    {p.text}
                  </Text>
                ),
              )}
            </Text>
          ) : null}
        </ScrollView>

        {hasPassage ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 20,
              paddingBottom: 28,
              paddingTop: 12,
              backgroundColor: theme.learnScreenBg,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.learnGlassBorder,
            }}
          >
            <Pressable
              onPress={handleDoneReading}
              style={{
                paddingVertical: 14,
                borderRadius: 999,
                backgroundColor: theme.learnPillActiveBg,
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Done reading"
            >
              <Text style={{ fontFamily: fontLabelBold, fontSize: 15, fontWeight: '800', color: theme.learnPillActiveText }}>
                Done reading
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Modal
        visible={!!glossaryWord}
        transparent
        animationType="fade"
        onRequestClose={() => setGlossaryWord(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setGlossaryWord(null)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.surface2, borderColor: theme.learnGlassBorder }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontFamily: fontHeadlineSm, fontSize: 18, fontWeight: '800', color: theme.learnOnSurface }}>
                {glossaryWord?.text}
              </Text>
              <Pressable onPress={() => setGlossaryWord(null)} hitSlop={12} accessibilityLabel="Close glossary">
                <MaterialIcons name="close" size={24} color={theme.learnOutline} />
              </Pressable>
            </View>
            <Text style={{ fontFamily: fontBody, fontSize: 15, lineHeight: 22, color: theme.learnOnSurface }}>{glossDef}</Text>
            {glossExample ? (
              <Text style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 21, color: theme.learnOnSurfaceVariant, marginTop: 12, fontStyle: 'italic' }}>
                {glossExample}
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </GlassScreenRoot>
  )
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
})
