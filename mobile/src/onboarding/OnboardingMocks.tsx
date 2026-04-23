import { Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { glassScreenShadow } from '../components/GlassUi'
import type { AppTheme } from '../theme'

const MOCK_INPUT_BG = '#0b0e14'

/** Tiny LEXICON bar — matches app chrome. */
export function MockLexiconBar({ theme }: { theme: AppTheme }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20,
        opacity: 0.95,
      }}
    >
      <MaterialIcons name="menu-book" size={22} color={theme.learnAccent} />
      <Text style={{ color: theme.learnAccent, fontSize: 18, fontWeight: '800', letterSpacing: 3 }}>LEXICON</Text>
    </View>
  )
}

/** Today “Quick capture” card — non-interactive mock. */
export function MockTodayCaptureCard({ theme, fontBody, fontHeadline }: { theme: AppTheme; fontBody?: string; fontHeadline?: string }) {
  const r = 22
  return (
    <View
      style={{
        borderRadius: r,
        borderWidth: 1,
        borderColor: theme.learnGlassBorder,
        backgroundColor: theme.surface2,
        padding: 18,
        ...glassScreenShadow(theme),
      }}
    >
      <Text
        style={{
          fontFamily: fontBody,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.2,
          color: theme.learnOnSurfaceVariant,
          marginBottom: 12,
          textAlign: 'center',
        }}
      >
        TODAY · QUICK CAPTURE
      </Text>
      <View style={{ position: 'relative' }}>
        <View
          style={{
            backgroundColor: MOCK_INPUT_BG,
            borderRadius: 999,
            paddingHorizontal: 18,
            paddingVertical: 14,
            borderWidth: 1,
            borderColor: 'rgba(99,102,241,0.15)',
          }}
        >
          <Text style={{ fontFamily: fontBody, fontSize: 15, color: `${theme.learnOutline}99` }}>Enter word or phrase…</Text>
        </View>
        <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }} pointerEvents="none">
          <MaterialIcons name="edit-note" size={22} color={theme.learnOutline} />
        </View>
      </View>
      <View
        style={{
          marginTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 14,
          borderRadius: 999,
          backgroundColor: theme.learnPillActiveBg,
          opacity: 0.92,
        }}
      >
        <MaterialIcons name="flash-on" size={20} color={theme.learnPillActiveText} />
        <Text style={{ fontFamily: fontHeadline, fontSize: 15, fontWeight: '800', color: theme.learnPillActiveText }}>Generate Card</Text>
      </View>
    </View>
  )
}

/** Word stacks list — mimics Learn → stacks. */
export function MockStacksList({ theme, fontBody }: { theme: AppTheme; fontBody?: string }) {
  const rows = [
    { title: 'Argument Architecture', sub: '80 words · Basic', icon: 'library-books' as const, accent: true },
    { title: 'Academic Register', sub: '65 words · Basic', icon: 'library-books' as const, accent: false },
    { title: 'Near-Synonym Discriminator', sub: '78 words · Basic', icon: 'library-books' as const, accent: false },
  ]
  return (
    <View style={{ gap: 10, marginTop: 4 }}>
      {rows.map((row) => (
        <View
          key={row.title}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
            backgroundColor: theme.learnSearchBg,
            opacity: row.accent ? 1 : 0.85,
          }}
        >
          <MaterialIcons name={row.icon} size={22} color={row.accent ? theme.learnAccent : theme.learnOutline} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontBody, fontSize: 15, fontWeight: '700', color: theme.learnOnSurface }}>{row.title}</Text>
            <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOnSurfaceVariant, marginTop: 2 }}>{row.sub}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={theme.learnOutline} />
        </View>
      ))}
    </View>
  )
}

/** Session batch — five word chips. */
export function MockSessionStrip({ theme, fontBody, fontHeadlineSm }: { theme: AppTheme; fontBody?: string; fontHeadlineSm?: string }) {
  const words = ['bolster', 'nuance', 'infer', 'scope', 'tenuous']
  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.learnGlassBorder,
        backgroundColor: theme.surface2,
        padding: 18,
        ...glassScreenShadow(theme),
      }}
    >
      <Text
        style={{
          fontFamily: fontHeadlineSm,
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 2,
          color: theme.learnAccent,
          textAlign: 'center',
          marginBottom: 14,
        }}
      >
        DAILY SESSION
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {words.map((w) => (
          <View
            key={w}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: theme.learnViewToggleBg,
              borderWidth: 1,
              borderColor: theme.learnGlassBorder,
            }}
          >
            <Text style={{ fontFamily: fontBody, fontSize: 13, fontWeight: '700', color: theme.learnOnSurface }}>{w}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOnSurfaceVariant, textAlign: 'center', marginTop: 14 }}>
        5 learning words · swipe & quiz
      </Text>
    </View>
  )
}

/** Dense paragraph with one highlighted GMAT-style term. */
export function MockParagraphHighlight({ theme, fontBody }: { theme: AppTheme; fontBody?: string }) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.learnGlassBorder,
        backgroundColor: theme.learnSearchBg,
        padding: 16,
        ...glassScreenShadow(theme),
      }}
    >
      <Text style={{ fontFamily: fontBody, fontSize: 13, lineHeight: 22, color: theme.learnOnSurfaceVariant }}>
        The author’s main conclusion is not{' '}
        <Text
          style={{
            color: theme.learnOnSurface,
            fontWeight: '700',
            backgroundColor: 'rgba(99,102,241,0.22)',
          }}
        >
          equivocal
        </Text>{' '}
        — it follows once you grant the premises about market efficiency…
      </Text>
    </View>
  )
}
