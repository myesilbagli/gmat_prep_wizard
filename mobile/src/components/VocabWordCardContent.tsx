import { useMemo, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { getMainLanguageLabel } from '@shared/languages'
import type { VocabItem } from '@shared/types'
import { getNativeGloss } from '@shared/vocab'
import type { AppTheme } from '../theme'

type Variant = 'session' | 'learn'

function cardColors(theme: AppTheme, variant: Variant) {
  if (variant === 'learn') {
    return {
      text: theme.learnOnSurface,
      muted: theme.learnOnSurfaceVariant,
      outline: theme.learnOutline,
      surface2: theme.learnSearchBg,
      border: theme.learnGlassBorder,
      accent: theme.learnAccent,
      primary: theme.learnAccent,
      danger: theme.danger,
      success: theme.success,
    }
  }
  return {
    text: theme.text,
    muted: theme.muted,
    outline: theme.muted,
    surface2: theme.surface2,
    border: theme.border,
    accent: theme.primary,
    primary: theme.primary,
    danger: theme.danger,
    success: theme.success,
  }
}

function VocabContentBlock({
  learn,
  borderColor,
  surfaceBg,
  children,
}: {
  learn: boolean
  borderColor: string
  surfaceBg: string
  children: ReactNode
}) {
  if (learn) {
    return (
      <View
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor,
          backgroundColor: surfaceBg,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
        }}
      >
        {children}
      </View>
    )
  }
  return <View style={{ marginBottom: 10 }}>{children}</View>
}

export type VocabWordCardContentProps = {
  theme: AppTheme
  mainLanguage: string
  word: VocabItem
  variant: Variant
  /** e.g. "SWIPE" in session */
  topRightBadge?: string
  footer?: ReactNode
  /** Tighter typography and spacing */
  compact?: boolean
  fontHeadline?: string
  fontBody?: string
}

/**
 * Shared word study body: type, headline, definitions, gloss, example, synonyms, notes.
 * Wrap in ScrollView in parent when content may overflow (session swipe card, learn modal).
 */
export function VocabWordCardContent({
  theme,
  mainLanguage,
  word,
  variant,
  topRightBadge,
  footer,
  compact = false,
  fontHeadline,
  fontBody,
}: VocabWordCardContentProps) {
  const c = cardColors(theme, variant)
  const twoExamples = word.examples?.length === 2 ? word.examples : null
  const example =
    twoExamples == null
      ? (word.exampleSentence?.trim() || word.examples?.[0]?.trim())
      : undefined
  const nativeGloss = getNativeGloss(word, mainLanguage)
  const languageTitle = useMemo(() => {
    const full = getMainLanguageLabel(mainLanguage)
    const cut = full.indexOf(' (')
    return cut >= 0 ? full.slice(0, cut) : full
  }, [mainLanguage])
  const typeLabel = word.type === 'phrase' ? 'PHRASE' : 'WORD'
  const posLabel = (word.partOfSpeech ?? '').trim()
  const typeLine = posLabel ? `${typeLabel} · ${posLabel}` : typeLabel
  const simpleLine = (word.simpleDefinition || word.definition || '').trim()
  const longDef =
    word.definition && word.simpleDefinition && word.definition.trim() !== word.simpleDefinition.trim()
      ? word.definition.trim()
      : null

  const pad = compact ? 14 : 16
  const titleSize = compact ? 24 : 26
  const bodySize = compact ? 15 : 16
  const labelSize = compact ? 10 : 11
  const learnBodyLh = variant === 'learn' ? 26 : compact ? 22 : 24
  const learnFullLh = variant === 'learn' ? 24 : compact ? 20 : 22

  const fh = fontHeadline
  const fb = fontBody
  const learnLayout = variant === 'learn'

  return (
    <View style={{ paddingHorizontal: pad, paddingTop: compact ? 12 : 14, paddingBottom: compact ? 12 : 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text
          style={{
            fontFamily: fh,
            fontSize: labelSize,
            fontWeight: '800',
            letterSpacing: 1,
            color: c.muted,
          }}
        >
          {typeLine}
        </Text>
        {topRightBadge ? (
          <Text
            style={{
              fontFamily: fh,
              fontSize: labelSize,
              fontWeight: '800',
              letterSpacing: 0.8,
              color: c.muted,
            }}
          >
            {topRightBadge}
          </Text>
        ) : (
          <View style={{ width: 8 }} />
        )}
      </View>

      <Text
        style={{
          fontFamily: fh,
          color: c.text,
          fontSize: titleSize,
          fontWeight: '800',
          letterSpacing: -0.4,
          marginBottom: 12,
        }}
      >
        {word.text}
      </Text>

      {simpleLine ? (
        <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
              MEANING (ENGLISH)
            </Text>
            <Text
              style={{ fontFamily: fb, color: c.text, fontSize: bodySize, lineHeight: learnBodyLh }}
            >
              {simpleLine}
            </Text>
          </View>
        </VocabContentBlock>
      ) : null}

      {longDef ? (
        <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
              FULL DEFINITION
            </Text>
            <Text style={{ fontFamily: fb, color: c.text, fontSize: compact ? 14 : 15, lineHeight: learnFullLh }}>
              {longDef}
            </Text>
          </View>
        </VocabContentBlock>
      ) : null}

      {nativeGloss ? (
        <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
              {languageTitle}
            </Text>
            <Text
              style={{
                fontFamily: fb,
                color: c.outline,
                fontSize: compact ? 14 : 15,
                lineHeight: learnFullLh,
                fontStyle: 'italic',
              }}
            >
              {nativeGloss}
            </Text>
          </View>
        </VocabContentBlock>
      ) : null}

      {twoExamples ? (
        variant === 'learn' ? (
          <>
            <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <MaterialIcons name="format-quote" size={18} color={c.muted} />
                <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
                  EXAMPLE · ACADEMIC
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fb,
                  color: c.muted,
                  fontSize: 14,
                  lineHeight: 22,
                  fontStyle: 'italic',
                }}
              >
                &quot;{twoExamples[0]}&quot;
              </Text>
            </VocabContentBlock>
            <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <MaterialIcons name="format-quote" size={18} color={c.muted} />
                <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
                  EXAMPLE · ARGUMENT
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fb,
                  color: c.muted,
                  fontSize: 14,
                  lineHeight: 22,
                  fontStyle: 'italic',
                }}
              >
                &quot;{twoExamples[1]}&quot;
              </Text>
            </VocabContentBlock>
          </>
        ) : (
          <>
            <View
              style={{
                marginTop: 2,
                paddingVertical: compact ? 8 : 10,
                paddingHorizontal: compact ? 10 : 12,
                borderLeftWidth: 3,
                borderLeftColor: c.primary,
                borderRadius: 10,
                backgroundColor: c.surface2,
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <MaterialIcons name="format-quote" size={compact ? 16 : 18} color={c.muted} />
                <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
                  EXAMPLE · ACADEMIC
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fb,
                  color: c.muted,
                  fontSize: compact ? 13 : 14,
                  lineHeight: compact ? 19 : 21,
                  fontStyle: 'italic',
                }}
              >
                &quot;{twoExamples[0]}&quot;
              </Text>
            </View>
            <View
              style={{
                marginTop: 2,
                paddingVertical: compact ? 8 : 10,
                paddingHorizontal: compact ? 10 : 12,
                borderLeftWidth: 3,
                borderLeftColor: c.primary,
                borderRadius: 10,
                backgroundColor: c.surface2,
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <MaterialIcons name="format-quote" size={compact ? 16 : 18} color={c.muted} />
                <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
                  EXAMPLE · ARGUMENT
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fb,
                  color: c.muted,
                  fontSize: compact ? 13 : 14,
                  lineHeight: compact ? 19 : 21,
                  fontStyle: 'italic',
                }}
              >
                &quot;{twoExamples[1]}&quot;
              </Text>
            </View>
          </>
        )
      ) : example ? (
        variant === 'learn' ? (
          <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <MaterialIcons name="format-quote" size={18} color={c.muted} />
              <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
                EXAMPLE
              </Text>
            </View>
            <Text
              style={{
                fontFamily: fb,
                color: c.muted,
                fontSize: 14,
                lineHeight: 22,
                fontStyle: 'italic',
              }}
            >
              &quot;{example}&quot;
            </Text>
          </VocabContentBlock>
        ) : (
          <View
            style={{
              marginTop: 2,
              paddingVertical: compact ? 8 : 10,
              paddingHorizontal: compact ? 10 : 12,
              borderLeftWidth: 3,
              borderLeftColor: c.primary,
              borderRadius: 10,
              backgroundColor: c.surface2,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <MaterialIcons name="format-quote" size={compact ? 16 : 18} color={c.muted} />
              <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
                EXAMPLE
              </Text>
            </View>
            <Text style={{ fontFamily: fb, color: c.muted, fontSize: compact ? 13 : 14, lineHeight: compact ? 19 : 21, fontStyle: 'italic' }}>
              &quot;{example}&quot;
            </Text>
          </View>
        )
      ) : null}

      {(word.synonyms?.length ?? 0) > 0 ? (
        variant === 'learn' ? (
          <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
                SYNONYMS
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(word.synonyms ?? []).map((syn, idx) => (
                  <View
                    key={`${syn}-${idx}`}
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: c.border,
                      backgroundColor: theme.learnGlass,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ fontFamily: fb, color: c.text, fontSize: 13 }}>{syn}</Text>
                  </View>
                ))}
              </View>
            </View>
          </VocabContentBlock>
        ) : (
          <View style={{ gap: 6, marginBottom: 8 }}>
            <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
              SYNONYMS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(word.synonyms ?? []).map((syn, idx) => (
                <View
                  key={`${syn}-${idx}`}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.surface2,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontFamily: fb, color: c.text, fontSize: compact ? 12 : 13 }}>{syn}</Text>
                </View>
              ))}
            </View>
          </View>
        )
      ) : null}

      {(word.wordTags?.length ?? 0) > 0 ? (
        variant === 'learn' ? (
          <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
                TAGS
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(word.wordTags ?? []).map((t, idx) => (
                  <View
                    key={`${t}-${idx}`}
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: c.border,
                      backgroundColor: theme.learnGlass,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ fontFamily: fb, color: c.text, fontSize: 12 }}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </VocabContentBlock>
        ) : (
          <View style={{ gap: 6, marginBottom: 8 }}>
            <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>
              TAGS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(word.wordTags ?? []).map((t, idx) => (
                <View
                  key={`${t}-${idx}`}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.surface2,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontFamily: fb, color: c.text, fontSize: compact ? 12 : 12 }}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )
      ) : null}

      {word.contrastWord?.word && word.contrastWord.explanation ? (
        variant === 'learn' ? (
          <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <MaterialIcons name="compare-arrows" size={20} color={c.muted} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted }}>CONTRAST</Text>
                <Text style={{ fontFamily: fb, color: c.text, fontSize: 14, lineHeight: 22 }}>
                  <Text style={{ fontWeight: '800' }}>{word.contrastWord.word}</Text>
                  {' — '}
                  {word.contrastWord.explanation}
                </Text>
              </View>
            </View>
          </VocabContentBlock>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <MaterialIcons name="compare-arrows" size={compact ? 18 : 20} color={c.muted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted }}>CONTRAST</Text>
              <Text style={{ fontFamily: fb, color: c.text, fontSize: compact ? 13 : 14, lineHeight: compact ? 19 : 21 }}>
                <Text style={{ fontWeight: '800' }}>{word.contrastWord.word}</Text>
                {' — '}
                {word.contrastWord.explanation}
              </Text>
            </View>
          </View>
        )
      ) : null}

      {word.memoryHook ? (
        variant === 'learn' ? (
          <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <MaterialIcons name="psychology" size={20} color={c.muted} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted }}>MEMORY HOOK</Text>
                <Text style={{ fontFamily: fb, color: c.text, fontSize: 14, lineHeight: 22 }}>{word.memoryHook}</Text>
              </View>
            </View>
          </VocabContentBlock>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <MaterialIcons name="psychology" size={compact ? 18 : 20} color={c.muted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted }}>MEMORY HOOK</Text>
              <Text style={{ fontFamily: fb, color: c.text, fontSize: compact ? 13 : 14, lineHeight: compact ? 19 : 21 }}>
                {word.memoryHook}
              </Text>
            </View>
          </View>
        )
      ) : null}

      {word.nuanceNote ? (
        variant === 'learn' ? (
          <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <MaterialIcons name="lightbulb-outline" size={20} color={c.muted} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted }}>NUANCE</Text>
                <Text style={{ fontFamily: fb, color: c.text, fontSize: 14, lineHeight: 22 }}>{word.nuanceNote}</Text>
              </View>
            </View>
          </VocabContentBlock>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <MaterialIcons name="lightbulb-outline" size={compact ? 18 : 20} color={c.muted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted }}>NUANCE</Text>
              <Text style={{ fontFamily: fb, color: c.text, fontSize: compact ? 13 : 14, lineHeight: compact ? 19 : 21 }}>
                {word.nuanceNote}
              </Text>
            </View>
          </View>
        )
      ) : null}

      {word.gmatUsageNote ? (
        variant === 'learn' ? (
          <VocabContentBlock learn={learnLayout} borderColor={c.border} surfaceBg={c.surface2}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <MaterialIcons name="star-border" size={20} color={c.muted} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted }}>GMAT USAGE</Text>
                <Text style={{ fontFamily: fb, color: c.text, fontSize: 14, lineHeight: 22 }}>{word.gmatUsageNote}</Text>
              </View>
            </View>
          </VocabContentBlock>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
            <MaterialIcons name="star-border" size={compact ? 18 : 20} color={c.muted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fb, fontSize: labelSize, fontWeight: '700', color: c.muted }}>GMAT USAGE</Text>
              <Text style={{ fontFamily: fb, color: c.text, fontSize: compact ? 13 : 14, lineHeight: compact ? 19 : 21 }}>
                {word.gmatUsageNote}
              </Text>
            </View>
          </View>
        )
      ) : null}

      {footer}
    </View>
  )
}

export function VocabWordCardSwipeFooter({
  theme,
  variant,
  compact,
  fontBody,
}: {
  theme: AppTheme
  variant: Variant
  compact?: boolean
  fontBody?: string
}) {
  const c = cardColors(theme, variant)
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: compact ? 10 : 12,
        paddingTop: compact ? 10 : 12,
      }}
    >
      <Text style={{ fontFamily: fontBody, color: c.danger, fontSize: compact ? 11 : 12, fontWeight: '700' }}>
        ← Don&apos;t know
      </Text>
      <Text style={{ fontFamily: fontBody, color: c.success, fontSize: compact ? 11 : 12, fontWeight: '700' }}>
        Know →
      </Text>
    </View>
  )
}
