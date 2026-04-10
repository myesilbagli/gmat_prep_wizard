import { Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { AuthMarketingBackground } from '../components/AuthMarketingShell'
import { useGlassFonts } from '../components/GlassUi'
import { AUTH } from '../lib/authMarketingTheme'
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '../lib/legalLinks'
import type { AppTheme } from '../theme'

/** Cohesive with Sign In marketing UI (indigo radial + glass). */
const W = {
  tertiary: '#4fdbc8',
  onSurface: AUTH.white,
  onSurfaceVariant: AUTH.zinc400,
}

type WelcomeFonts = ReturnType<typeof useGlassFonts>

function WelcomeLexiconMockCard({
  fonts,
  word,
  pos,
  ipa,
  definition,
  tipTitle,
  tipBody,
  status,
}: {
  fonts: WelcomeFonts
  word: string
  pos: string
  ipa: string
  definition: string
  tipTitle: string
  tipBody: string
  status: 'learning' | 'mastered'
}) {
  const statusChip =
    status === 'mastered'
      ? {
          bg: 'rgba(79, 219, 200, 0.12)',
          border: 'rgba(79, 219, 200, 0.35)',
          color: W.tertiary,
          label: 'MASTERED',
        }
      : {
          bg: 'rgba(79, 219, 200, 0.12)',
          border: 'rgba(79, 219, 200, 0.35)',
          color: W.tertiary,
          label: 'LEARNING',
        }

  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        borderRadius: 13,
        backgroundColor: 'rgba(23, 31, 51, 0.92)',
        paddingHorizontal: 12,
        paddingTop: 11,
        paddingBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: statusChip.bg,
            borderWidth: 1,
            borderColor: statusChip.border,
          }}
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: '800',
              letterSpacing: 0.8,
              color: statusChip.color,
              fontFamily: fonts.fontLabelBold,
            }}
          >
            {statusChip.label}
          </Text>
        </View>
      </View>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{
          fontSize: 21,
          fontWeight: '800',
          letterSpacing: -0.6,
          color: AUTH.white,
          fontFamily: fonts.fontHeadline,
        }}
      >
        {word}
      </Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: 10,
          fontStyle: 'italic',
          color: AUTH.zinc500,
          fontFamily: fonts.fontBody,
        }}
      >
        {pos} · {ipa}
      </Text>

      <Text
        numberOfLines={3}
        style={{
          marginTop: 8,
          fontSize: 10,
          lineHeight: 14,
          color: AUTH.zinc400,
          fontFamily: fonts.fontBody,
        }}
      >
        {definition}
      </Text>

      <View
        style={{
          marginTop: 7,
          paddingVertical: 4,
          paddingHorizontal: 7,
          borderRadius: 7,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderLeftWidth: 2,
          borderLeftColor: 'rgba(99, 102, 241, 0.55)',
        }}
      >
        <Text
          style={{
            fontSize: 7,
            fontWeight: '800',
            letterSpacing: 0.9,
            color: AUTH.zinc500,
            marginBottom: 1,
            fontFamily: fonts.fontLabelBold,
          }}
        >
          {tipTitle}
        </Text>
        <Text numberOfLines={2} style={{ fontSize: 8, lineHeight: 11, color: AUTH.zinc400, fontFamily: fonts.fontBody }}>
          {tipBody}
        </Text>
      </View>

      <View style={{ flex: 1, minHeight: 0 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 1.5,
            color: AUTH.primary,
            fontFamily: fonts.fontLabelBold,
          }}
        >
          1/100
        </Text>
      </View>
    </View>
  )
}

export function WelcomeScreen({
  theme: _theme,
  onSignIn,
  onSignUp,
}: {
  theme: AppTheme
  onSignIn: () => void
  onSignUp: () => void
}) {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const fonts = useGlassFonts()
  const privacyUrl = getPrivacyPolicyUrl()
  const termsUrl = getTermsOfServiceUrl()
  const showLegal = Boolean(privacyUrl || termsUrl)

  const maxContent = 400
  const contentW = Math.min(width - 48, maxContent)
  const cardW = Math.min(168, contentW * 0.46)
  const cardH = cardW * 1.52

  return (
    <View style={{ flex: 1, backgroundColor: AUTH.radialViolet, overflow: 'hidden' }}>
      <AuthMarketingBackground baseColor={AUTH.radialViolet} />

      <ScrollView
        style={{ flex: 1 }}
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top, 8),
          paddingBottom: Math.max(insets.bottom, 12) + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            paddingTop: 16,
            paddingBottom: 12,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <MaterialIcons name="menu-book" size={26} color={AUTH.primary} />
          <Text
            style={{
              fontSize: 20,
              fontWeight: '800',
              letterSpacing: 5,
              color: AUTH.zinc200,
              fontFamily: fonts.fontHeadlineSm,
            }}
          >
            LEXICON
          </Text>
        </View>

        <View style={{ flex: 1, minHeight: 420, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: contentW,
              height: cardH + 56,
              marginBottom: 36,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                position: 'absolute',
                width: 128,
                height: 128,
                borderRadius: 64,
                backgroundColor: 'rgba(99, 102, 241, 0.14)',
                top: '18%',
              }}
            />

            <View
              style={{
                position: 'absolute',
                width: cardW,
                height: cardH,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                padding: 1,
                transform: [{ rotate: '-12deg' }, { translateX: -cardW * 0.28 }, { translateY: 14 }],
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.35,
                shadowRadius: 20,
                elevation: 8,
                overflow: 'hidden',
              }}
            >
              <WelcomeLexiconMockCard
                fonts={fonts}
                word="Pursue"
                pos="verb"
                ipa="/pərˈsuː/"
                definition='To follow or chase; in CR, watch for answers that "pursue" a conclusion beyond the stimulus.'
                tipTitle="GMAT TIP"
                tipBody="If an answer overreaches what the passage actually establishes, it’s often wrong."
                status="mastered"
              />
            </View>

            <View
              style={{
                width: cardW,
                height: cardH,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                padding: 1,
                transform: [{ rotate: '6deg' }, { translateX: cardW * 0.12 }, { translateY: 4 }],
                shadowColor: '#6366f1',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.22,
                shadowRadius: 20,
                elevation: 12,
                overflow: 'hidden',
              }}
            >
              <WelcomeLexiconMockCard
                fonts={fonts}
                word="Grit"
                pos="noun"
                ipa="/ɡrɪt/"
                definition="Courage and resolve; the stamina to push through dense verbal sections without losing focus."
                tipTitle="GMAT TIP"
                tipBody="Long RC sets reward steady pacing—build the habit in practice, not just on test day."
                status="learning"
              />
            </View>
          </View>

          <View style={{ width: contentW, alignItems: 'center', marginBottom: 28, gap: 14 }}>
            <Text
              style={{
                textAlign: 'center',
                fontSize: 30,
                lineHeight: 34,
                fontWeight: '800',
                letterSpacing: -0.5,
                color: W.onSurface,
                fontFamily: fonts.fontHeadline,
              }}
            >
              Build your GMAT{'\n'}vocabulary system.
            </Text>
            <Text
              style={{
                textAlign: 'center',
                fontSize: 15,
                lineHeight: 22,
                color: W.onSurfaceVariant,
                maxWidth: 280,
                fontFamily: fonts.fontBody,
              }}
            >
              Save words, study them in daily sessions, and build real vocabulary retention for the GMAT.
            </Text>
          </View>

          <View
            style={{
              width: contentW,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: AUTH.glassBorder,
              backgroundColor: AUTH.glassFill,
              padding: 22,
              gap: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.32,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <Pressable
              onPress={onSignUp}
              style={({ pressed }) => ({
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 16,
                borderRadius: 999,
                backgroundColor: pressed ? AUTH.primaryPressed : AUTH.primary,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '800',
                  color: AUTH.white,
                  fontFamily: fonts.fontHeadlineSm,
                }}
              >
                Sign up
              </Text>
              <MaterialIcons name="arrow-forward" size={22} color={AUTH.white} />
            </Pressable>

            <Pressable
              onPress={onSignIn}
              style={({ pressed }) => ({
                width: '100%',
                paddingVertical: 16,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: AUTH.socialBorder,
                backgroundColor: pressed ? AUTH.socialBgPress : AUTH.socialBg,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '700',
                  color: W.onSurface,
                  fontFamily: fonts.fontHeadlineSm,
                }}
              >
                Sign in
              </Text>
            </Pressable>
          </View>
        </View>

        {showLegal ? (
          <View style={{ alignItems: 'center', marginTop: 28, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              {privacyUrl ? (
                <Pressable
                  onPress={() => void Linking.openURL(privacyUrl)}
                  hitSlop={10}
                  accessibilityRole="link"
                  accessibilityLabel="Privacy policy"
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: '800',
                      letterSpacing: 1.5,
                      color: W.onSurfaceVariant,
                      opacity: 0.65,
                      textDecorationLine: 'underline',
                    }}
                  >
                    PRIVACY
                  </Text>
                </Pressable>
              ) : null}
              {termsUrl ? (
                <Pressable
                  onPress={() => void Linking.openURL(termsUrl)}
                  hitSlop={10}
                  accessibilityRole="link"
                  accessibilityLabel="Terms of service"
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: '800',
                      letterSpacing: 1.5,
                      color: W.onSurfaceVariant,
                      opacity: 0.65,
                      textDecorationLine: 'underline',
                    }}
                  >
                    TERMS
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
