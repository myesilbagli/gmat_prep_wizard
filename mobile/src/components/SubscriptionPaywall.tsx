import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useSubscription } from '../context/SubscriptionContext'
import { useAppTheme } from '../context/ThemeContext'
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '../lib/legalLinks'

export function SubscriptionPaywall() {
  const insets = useSafeAreaInsets()
  const { theme } = useAppTheme()
  const {
    paywallVisible,
    closePaywall,
    purchaseMonthly,
    purchaseYearly,
    restore,
    monthlyPriceLabel,
    yearlyPriceLabel,
    busy,
    error,
    clearError,
  } = useSubscription()

  const privacyUrl = getPrivacyPolicyUrl()
  const termsUrl = getTermsOfServiceUrl()

  return (
    <Modal visible={paywallVisible} animationType="slide" transparent onRequestClose={closePaywall}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={closePaywall} accessibilityLabel="Dismiss paywall backdrop" />
        <View
          style={{
            backgroundColor: theme.learnScreenBg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 20),
            maxHeight: '88%',
            borderWidth: 1,
            borderColor: theme.learnGlassBorder,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.learnOnSurface }}>Lexicon Pro</Text>
            <Pressable onPress={closePaywall} hitSlop={12} accessibilityLabel="Close">
              <MaterialIcons name="close" size={26} color={theme.learnOutline} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: 15, lineHeight: 22, color: theme.learnOnSurfaceVariant, marginBottom: 20 }}>
              Pro removes free-tier limits: unlimited saved words, more than three guided sessions per day, and every
              word stack. Free includes Quick Capture analysis, up to 50 saved words, three session starts per day, and two
              basic stacks. Cancel anytime in Apple Subscriptions settings.
            </Text>

            <Pressable
              onPress={() => void purchaseYearly()}
              disabled={busy}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 18,
                borderRadius: 14,
                backgroundColor: theme.learnAccent,
                marginBottom: 12,
                opacity: busy ? 0.65 : 1,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.learnPillActiveText, letterSpacing: 1 }}>BEST VALUE</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: theme.learnPillActiveText, marginTop: 4 }}>{yearlyPriceLabel}</Text>
            </Pressable>

            <Pressable
              onPress={() => void purchaseMonthly()}
              disabled={busy}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 18,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.learnGlassBorder,
                backgroundColor: theme.learnSearchBg,
                marginBottom: 16,
                opacity: busy ? 0.65 : 1,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: theme.learnOnSurface }}>{monthlyPriceLabel}</Text>
            </Pressable>

            <Pressable
              onPress={() => void restore()}
              disabled={busy}
              style={{ alignSelf: 'center', paddingVertical: 10, opacity: busy ? 0.6 : 1 }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.learnAccent }}>Restore purchases</Text>
            </Pressable>

            {busy ? (
              <ActivityIndicator style={{ marginTop: 12 }} color={theme.learnAccent} />
            ) : null}

            {error ? (
              <Text style={{ color: theme.danger, fontSize: 14, marginTop: 12, textAlign: 'center' }} onPress={clearError}>
                {error}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 20 }}>
              {privacyUrl ? (
                <Pressable onPress={() => void Linking.openURL(privacyUrl)}>
                  <Text style={{ fontSize: 13, color: theme.learnAccent, fontWeight: '600' }}>Privacy Policy</Text>
                </Pressable>
              ) : null}
              {termsUrl ? (
                <Pressable onPress={() => void Linking.openURL(termsUrl)}>
                  <Text style={{ fontSize: 13, color: theme.learnAccent, fontWeight: '600' }}>Terms of Service</Text>
                </Pressable>
              ) : null}
            </View>

            {Platform.OS === 'ios' ? (
              <Text style={{ fontSize: 11, lineHeight: 16, color: theme.learnOutline, marginTop: 16, textAlign: 'center' }}>
                Payment charged to your Apple ID. Subscriptions renew automatically until cancelled. Manage or cancel in
                Settings → Subscriptions.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
