import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native'
import type { SessionSlotRole } from '@shared/sessionPlanner'
import type { VocabItem } from '@shared/types'
import { getMainLanguageLabel } from '@shared/languages'
import { getNativeGloss } from '@shared/vocab'
import { BucketPill } from './BucketPill'
import { PrimaryButton } from './UI'
import { useGlassFonts } from './GlassUi'
import { radius, spacing, typography, type AppTheme } from '../theme'

/**
 * theme.primary at 40% opacity. Inlined because RN text-shadow style values
 * are evaluated at compose time and cannot read theme tokens directly. Keep
 * in sync with theme.primary if the brand color shifts. See design-system
 * notes (.cursor/rules/desing.md) — text-shadow is one of the few places where
 * a literal color value is acceptable.
 */
const WORD_GLOW_COLOR = 'rgba(107, 91, 255, 0.4)'

function QuoteDivider({ theme }: { theme: AppTheme }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.border,
        marginVertical: spacing.lg,
      }}
    />
  )
}

function CaptionLabel({
  theme,
  fontFamily,
  children,
}: {
  theme: AppTheme
  fontFamily?: string
  children: string
}) {
  return (
    <Text
      style={{
        ...typography.caption,
        ...(fontFamily ? { fontFamily } : {}),
        color: theme.textMuted,
      }}
    >
      {children}
    </Text>
  )
}

function ExampleRow({
  theme,
  fontFamily,
  text,
}: {
  theme: AppTheme
  fontFamily?: string
  text: string
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' }}>
      <View
        style={{
          width: 2,
          alignSelf: 'stretch',
          backgroundColor: theme.borderStrong,
          borderRadius: radius.full,
        }}
      />
      <Text
        style={{
          ...typography.body,
          ...(fontFamily ? { fontFamily } : {}),
          color: theme.textSecondary,
          fontStyle: 'italic',
          flex: 1,
        }}
      >
        {`"${text}"`}
      </Text>
    </View>
  )
}

export function SessionIntroCard({
  theme,
  word,
  sessionSlotRole,
  introCurrent: _introCurrent,
  introTotal: _introTotal,
  onGotIt,
  busy,
  mainLanguage,
}: {
  theme: AppTheme
  word: VocabItem
  sessionSlotRole: SessionSlotRole
  /** @deprecated counter now lives in the SessionScreen header */
  introCurrent: number
  /** @deprecated counter now lives in the SessionScreen header */
  introTotal: number
  onGotIt: () => void
  busy: boolean
  /** Learner's main language code (e.g. 'tr'); 'en' suppresses the native gloss block. */
  mainLanguage: string
}) {
  const { loaded, fontSerif, fontBody, fontLabelBold } = useGlassFonts()
  const [showMore, setShowMore] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    setShowMore(false)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [word.id])

  const simple = (word.simpleDefinition || '').trim()
  const fullDef = (word.definition || '').trim()
  const sameMeaning = Boolean(simple && fullDef && simple === fullDef)
  const pos = (typeof word.partOfSpeech === 'string' ? word.partOfSpeech : '').trim()

  const examplesAll = (Array.isArray(word.examples) ? word.examples : [])
    .map((e) => String(e).trim())
    .filter((s) => s.length > 0)
  const sortedExamples = [...examplesAll].sort((a, b) => a.length - b.length)
  const briefExample = sortedExamples[0] ?? (word.exampleSentence?.trim() || '')
  const fullerExample = sortedExamples[1] ?? ''
  const hasBriefExample = briefExample.length > 0
  const hasFullerExample = fullerExample.length > 0 && fullerExample !== briefExample

  const collapsedDefinition = simple || fullDef
  const hasCollapsedDefinition = collapsedDefinition.length > 0
  const showFullDefInExpanded = Boolean(fullDef) && !sameMeaning && fullDef !== simple

  const synonymList = (Array.isArray(word.synonyms) ? word.synonyms : [])
    .map((s) => String(s).trim())
    .filter(Boolean)
  const hasSynonyms = synonymList.length > 0
  const hasContrast = Boolean(
    word.contrastWord?.word?.trim() && word.contrastWord?.explanation?.trim(),
  )
  const hook = (word.memoryHook || '').trim()
  const hasHook = hook.length > 0

  const hasExpandedContent =
    hasFullerExample || showFullDefInExpanded || hasSynonyms || hasContrast || hasHook

  const gloss = getNativeGloss(word, mainLanguage)
  const langLabel =
    mainLanguage !== 'en'
      ? getMainLanguageLabel(mainLanguage).split(' (')[0].toUpperCase()
      : null
  const showGloss = Boolean(gloss && langLabel)

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: spacing['3xl'],
        }}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    )
  }

  const wordStyle: TextStyle = {
    fontFamily: fontSerif,
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 72,
    letterSpacing: -1,
    color: theme.textPrimary,
    textAlign: 'center',
    textShadowColor: WORD_GLOW_COLOR,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  }

  const expandedSections: Array<{ key: string; node: React.ReactNode }> = []

  if (hasFullerExample) {
    expandedSections.push({
      key: 'another-example',
      node: (
        <View style={{ gap: spacing.sm }}>
          <CaptionLabel theme={theme} fontFamily={fontLabelBold}>
            ANOTHER EXAMPLE
          </CaptionLabel>
          <ExampleRow theme={theme} fontFamily={fontBody} text={fullerExample} />
        </View>
      ),
    })
  }

  if (showFullDefInExpanded) {
    expandedSections.push({
      key: 'definition',
      node: (
        <View style={{ gap: spacing.sm }}>
          <CaptionLabel theme={theme} fontFamily={fontLabelBold}>
            DEFINITION
          </CaptionLabel>
          <Text
            style={{
              ...typography.body,
              ...(fontBody ? { fontFamily: fontBody } : {}),
              color: theme.textPrimary,
            }}
          >
            {fullDef}
          </Text>
        </View>
      ),
    })
  }

  if (hasSynonyms) {
    expandedSections.push({
      key: 'synonyms',
      node: (
        <View style={{ gap: spacing.sm }}>
          <CaptionLabel theme={theme} fontFamily={fontLabelBold}>
            SYNONYMS
          </CaptionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {synonymList.map((syn) => (
              <View
                key={syn}
                style={{
                  backgroundColor: theme.bgSubtle,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.sm,
                }}
              >
                <Text
                  style={{
                    ...typography.label,
                    ...(fontBody ? { fontFamily: fontBody } : {}),
                    color: theme.textSecondary,
                  }}
                >
                  {syn}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ),
    })
  }

  if (hasContrast && word.contrastWord) {
    expandedSections.push({
      key: 'contrast',
      node: (
        <View style={{ gap: spacing.sm }}>
          <CaptionLabel theme={theme} fontFamily={fontLabelBold}>
            CONTRAST WITH
          </CaptionLabel>
          <Text
            style={{
              ...typography.body,
              ...(fontBody ? { fontFamily: fontBody } : {}),
              color: theme.textSecondary,
            }}
          >
            <Text style={{ fontStyle: 'italic', color: theme.textPrimary }}>
              {word.contrastWord.word.trim()}
            </Text>
            {' — '}
            {word.contrastWord.explanation.trim()}
          </Text>
        </View>
      ),
    })
  }

  if (hasHook) {
    expandedSections.push({
      key: 'memory-hook',
      node: (
        <View style={{ gap: spacing.sm }}>
          <CaptionLabel theme={theme} fontFamily={fontLabelBold}>
            MEMORY HOOK
          </CaptionLabel>
          <View
            style={{
              backgroundColor: theme.bgSubtle,
              borderRadius: radius.md,
              padding: spacing.md,
            }}
          >
            <Text
              style={{
                ...typography.body,
                ...(fontBody ? { fontFamily: fontBody } : {}),
                color: theme.textSecondary,
              }}
            >
              {hook}
            </Text>
          </View>
        </View>
      ),
    })
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing['2xl'],
        alignItems: 'center',
      }}
    >
      <View style={{ marginTop: spacing['3xl'] }}>
        <BucketPill role={sessionSlotRole} size="md" />
      </View>

      <Text
        style={[wordStyle, { marginTop: spacing['2xl'] }]}
        adjustsFontSizeToFit
        numberOfLines={1}
        minimumFontScale={0.7}
      >
        {word.text}
      </Text>

      {pos ? (
        <Text
          style={{
            ...typography.caption,
            ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
            color: theme.textMuted,
            marginTop: spacing.sm,
          }}
        >
          {pos.toUpperCase()}
        </Text>
      ) : null}

      <View
        style={{
          width: '100%',
          marginTop: spacing['3xl'],
          backgroundColor: theme.bgElevated,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: radius.lg,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.lg,
        }}
      >
        {hasCollapsedDefinition ? (
          <Text
            style={{
              ...typography.subheading,
              ...(fontBody ? { fontFamily: fontBody } : {}),
              fontWeight: '500',
              color: theme.textPrimary,
              textAlign: 'center',
            }}
          >
            {collapsedDefinition}
          </Text>
        ) : null}

        {showGloss ? (
          <View
            style={{
              marginTop: hasCollapsedDefinition ? spacing.md : 0,
              backgroundColor: theme.bgSubtle,
              borderRadius: radius.md,
              padding: spacing.md,
            }}
            accessibilityLabel={`${langLabel} gloss: ${gloss}`}
          >
            <Text
              style={{
                ...typography.caption,
                ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
                color: theme.textMuted,
              }}
            >
              {langLabel}
            </Text>
            <Text
              style={{
                ...typography.body,
                ...(fontBody ? { fontFamily: fontBody } : {}),
                color: theme.textSecondary,
                fontStyle: 'italic',
                marginTop: spacing.sm,
              }}
            >
              {gloss}
            </Text>
          </View>
        ) : null}

        {hasCollapsedDefinition && hasBriefExample ? <QuoteDivider theme={theme} /> : null}

        {hasBriefExample ? (
          <ExampleRow theme={theme} fontFamily={fontBody} text={briefExample} />
        ) : null}

        {hasExpandedContent ? (
          <>
            {hasCollapsedDefinition || hasBriefExample ? <QuoteDivider theme={theme} /> : null}
            <Pressable
              onPress={() => setShowMore((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ expanded: showMore }}
              accessibilityLabel={showMore ? 'Show less detail' : 'Show more detail'}
              style={{
                alignSelf: 'center',
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text
                style={{
                  ...typography.label,
                  ...(fontLabelBold ? { fontFamily: fontLabelBold } : {}),
                  fontWeight: '600',
                  color: theme.primary,
                }}
              >
                {showMore ? 'Show less ▲' : 'Show more ▼'}
              </Text>
            </Pressable>

            {showMore
              ? expandedSections.map((section) => (
                  <View key={section.key}>
                    <QuoteDivider theme={theme} />
                    {section.node}
                  </View>
                ))
              : null}
          </>
        ) : null}
      </View>

      <View style={{ width: '100%', marginTop: spacing['2xl'] }}>
        <PrimaryButton theme={theme} label={busy ? 'Saving…' : 'Got it'} onPress={onGotIt} disabled={busy} />
      </View>
    </ScrollView>
  )
}
