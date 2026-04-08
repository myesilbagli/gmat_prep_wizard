import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Purchases, { type CustomerInfo } from 'react-native-purchases'
import { LEXICON_PRO_ENTITLEMENT } from '../lib/iap/constants'

type SubscriptionContextValue = {
  isPro: boolean
  loading: boolean
  paywallVisible: boolean
  openPaywall: () => void
  closePaywall: () => void
  purchaseMonthly: () => Promise<void>
  purchaseYearly: () => Promise<void>
  restore: () => Promise<void>
  refreshCustomerInfo: () => Promise<void>
  /** Price labels for paywall (updated when sheet opens). */
  monthlyPriceLabel: string
  yearlyPriceLabel: string
  busy: boolean
  error: string | null
  clearError: () => void
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider')
  return ctx
}

function isPurchaseCancelled(e: unknown): boolean {
  if (!e || typeof e !== 'object' || !('code' in e)) return false
  const code = (e as { code?: string }).code
  return code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
}

export function SubscriptionProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [paywallVisible, setPaywallVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthlyPriceLabel, setMonthlyPriceLabel] = useState('Monthly')
  const [yearlyPriceLabel, setYearlyPriceLabel] = useState('Yearly')
  const configuredRef = useRef(false)

  const applyCustomerInfo = useCallback((info: CustomerInfo) => {
    const ent = info.entitlements.active[LEXICON_PRO_ENTITLEMENT]
    setIsPro(Boolean(ent?.isActive))
  }, [])

  const refreshOfferingsLabels = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings()
      const current = offerings.current
      const m = current?.monthly
      const y = current?.annual
      if (m?.product?.priceString) setMonthlyPriceLabel(`${m.product.priceString} / month`)
      else setMonthlyPriceLabel('Monthly')
      if (y?.product?.priceString) setYearlyPriceLabel(`${y.product.priceString} / year`)
      else setYearlyPriceLabel('Yearly')
    } catch {
      setMonthlyPriceLabel('Monthly')
      setYearlyPriceLabel('Yearly')
    }
  }, [])

  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ?? ''
    const key = apiKey.length > 0 ? apiKey : 'dev_placeholder_not_for_store'
    if (!configuredRef.current) {
      Purchases.configure({ apiKey: key })
      configuredRef.current = true
    }
  }, [])

  useEffect(() => {
    const onUpdate = (info: CustomerInfo) => applyCustomerInfo(info)
    Purchases.addCustomerInfoUpdateListener(onUpdate)

    let cancelled = false
    void (async () => {
      try {
        const { customerInfo } = await Purchases.logIn(userId)
        if (!cancelled) applyCustomerInfo(customerInfo)
      } catch {
        try {
          const info = await Purchases.getCustomerInfo()
          if (!cancelled) applyCustomerInfo(info)
        } catch {
          /* ignore */
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      Purchases.removeCustomerInfoUpdateListener(onUpdate)
    }
  }, [userId, applyCustomerInfo])

  const refreshCustomerInfo = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo()
      applyCustomerInfo(info)
    } catch {
      /* ignore */
    }
  }, [applyCustomerInfo])

  const openPaywall = useCallback(() => {
    setError(null)
    setPaywallVisible(true)
    void refreshOfferingsLabels()
  }, [refreshOfferingsLabels])

  const closePaywall = useCallback(() => {
    setPaywallVisible(false)
    setError(null)
  }, [])

  const purchase = useCallback(
    async (which: 'monthly' | 'yearly') => {
      setError(null)
      setBusy(true)
      try {
        const offerings = await Purchases.getOfferings()
        const current = offerings.current
        const pkg = which === 'monthly' ? current?.monthly : current?.annual
        if (!pkg) {
          setError('Subscription is not available yet. Check App Store Connect and RevenueCat configuration.')
          return
        }
        const { customerInfo } = await Purchases.purchasePackage(pkg)
        applyCustomerInfo(customerInfo)
        setPaywallVisible(false)
      } catch (e) {
        if (isPurchaseCancelled(e)) return
        setError(e instanceof Error ? e.message : 'Purchase could not be completed.')
      } finally {
        setBusy(false)
      }
    },
    [applyCustomerInfo],
  )

  const purchaseMonthly = useCallback(async () => purchase('monthly'), [purchase])
  const purchaseYearly = useCallback(async () => purchase('yearly'), [purchase])

  const restore = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const info = await Purchases.restorePurchases()
      applyCustomerInfo(info)
      if (!info.entitlements.active[LEXICON_PRO_ENTITLEMENT]) {
        setError('No active subscription found for this Apple ID.')
      } else {
        setPaywallVisible(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.')
    } finally {
      setBusy(false)
    }
  }, [applyCustomerInfo])

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPro,
      loading,
      paywallVisible,
      openPaywall,
      closePaywall,
      purchaseMonthly,
      purchaseYearly,
      restore,
      refreshCustomerInfo,
      monthlyPriceLabel,
      yearlyPriceLabel,
      busy,
      error,
      clearError: () => setError(null),
    }),
    [
      isPro,
      loading,
      paywallVisible,
      openPaywall,
      closePaywall,
      purchaseMonthly,
      purchaseYearly,
      restore,
      refreshCustomerInfo,
      monthlyPriceLabel,
      yearlyPriceLabel,
      busy,
      error,
    ],
  )

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}
