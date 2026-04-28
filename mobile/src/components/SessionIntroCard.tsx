import { ScrollView, Text, View } from 'react-native'
import type { SessionSlotRole } from '@shared/sessionPlanner'
import type { VocabItem } from '@shared/types'
import { BucketPill } from './BucketPill'
import { PrimaryButton } from './UI'
import { useGlassFonts } from './GlassUi'
import type { AppTheme } from '../theme'

function SectionDivider({ theme }: { theme: AppTheme }) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: theme.border,
        paddingTop: 14,
        marginTop: 14,
      }}
    />
  )
}

export function SessionIntroCard({
  theme,
  word,
  sessionSlotRole,
  introCurrent,
  introTotal,
  onGotIt,
  busy,
}: {
  theme: AppTheme
  word: VocabItem
  sessionSlotRole: SessionSlotRole
  introCurrent: number
  introTotal: number
  onGotIt: () => void
  busy: boolean
}) {
  const { fontHeadline, fontBody } = useGlassFonts()

  const simpleRaw = (word.simpleDefinition || '').trim()
  const defRaw = (word.definition || '').trim()
  const simple = simpleRaw
  const fullDef = defRaw
  const pos = (typeof word.partOfSpeech === 'string' ? word.partOfSpeech : '').trim()

  const exampleText =
    word.examples?.[0]?.trim() || (word.exampleSentence?.trim() ?? '') || ''
  const hasExample = exampleText.length > 0

  const hasContrast = Boolean(
    word.contrastWord?.word?.trim() && word.contrastWord?.explanation?.trim(),
  )
  const hook = (word.memoryHook || '').trim()
  const hasHook = hook.length > 0

  const hasMeaningBlock = Boolean(simple || fullDef)

  /** Dividers only between adjacent rendered groups (meaning → example → contrast → hook). */
  const dividerBeforeExample = hasMeaningBlock && hasExample ? <SectionDivider theme={theme} /> : null
  const dividerBeforeContrast =
    (hasMeaningBlock || hasExample) && hasContrast && word.contrastWord ? (
      <SectionDivider theme={theme} />
    ) : null
  const dividerBeforeHook =
    (hasMeaningBlock || hasExample || hasContrast) && hasHook ? <SectionDivider theme={theme} /> : null

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <BucketPill role={sessionSlotRole} size="md" />
        {introTotal > 1 ? (
          <Text
            style={{
              color: theme.muted,
              fontSize: 12,
              fontWeight: '600',
              textAlign: 'right',
              marginTop: 2,
              fontFamily: fontBody,
            }}
          >
            {introCurrent} / {introTotal}
          </Text>
        ) : null}
      </View>

      <Text
        style={{
          fontFamily: fontHeadline,
          color: theme.text,
          fontSize: 34,
          fontWeight: '800',
          lineHeight: 40,
          marginTop: 16,
          marginBottom: pos ? 6 : 14,
          letterSpacing: -0.4,
        }}
      >
        {word.text}
      </Text>

      {pos ? (
        <Text
          style={{
            fontFamily: fontBody,
            color: theme.muted,
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {pos}
        </Text>
      ) : null}

      {hasMeaningBlock ? (
        <>
          {simple ? (
            <Text
              style={{
                fontFamily: fontBody,
                color: theme.text,
                fontSize: 17,
                lineHeight: 25,
              }}
            >
              {simple}
            </Text>
          ) : null}
          {fullDef ? (
            <Text
              style={{
                fontFamily: fontBody,
                color: theme.text,
                fontSize: 15,
                lineHeight: 22,
                marginTop: simple ? 10 : 0,
              }}
            >
              {fullDef}
            </Text>
          ) : null}
        </>
      ) : null}

      {dividerBeforeExample}

      {hasExample ? (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: fontBody,
              color: theme.muted,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.4,
            }}
          >
            EXAMPLE.
          </Text>
          <Text
            style={{
              fontFamily: fontBody,
              color: theme.muted,
              fontSize: 15,
              lineHeight: 22,
              fontStyle: 'italic',
            }}
          >
            &quot;{exampleText}&quot;
          </Text>
        </View>
      ) : null}

      {dividerBeforeContrast}

      {hasContrast && word.contrastWord ? (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: fontBody,
              color: theme.muted,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.4,
            }}
          >
            CONTRAST WITH.
          </Text>
          <Text style={{ fontFamily: fontBody, color: theme.text, fontSize: 15, lineHeight: 22 }}>
            <Text style={{ fontWeight: '800' }}>{word.contrastWord.word.trim()}</Text>
            {' — '}
            {word.contrastWord.explanation.trim()}
          </Text>
        </View>
      ) : null}

      {dividerBeforeHook}

      {hasHook ? (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: fontBody,
              color: theme.muted,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.4,
            }}
          >
            MEMORY HOOK
          </Text>
          <Text style={{ fontFamily: fontBody, color: theme.text, fontSize: 15, lineHeight: 22 }}>{hook}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 24 }}>
        <PrimaryButton theme={theme} label={busy ? 'Saving…' : 'Got it'} onPress={onGotIt} disabled={busy} />
      </View>
    </ScrollView>
  )
}
