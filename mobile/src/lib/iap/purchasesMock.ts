/**
 * Metro can alias `react-native-purchases` to this file when using Expo Go (no native module).
 * Mirrors the subset of the SDK used by SubscriptionContext.
 */
import { LEXICON_PRO_ENTITLEMENT, STORE_PRODUCT_MONTHLY, STORE_PRODUCT_YEARLY } from './constants'

type CustomerInfoLike = {
  entitlements: { active: Record<string, { identifier: string; isActive: boolean }>; all: Record<string, unknown> }
  activeSubscriptions: string[]
  originalAppUserId: string
}

const startsEntitled = () => {
  const v = process.env.EXPO_PUBLIC_IAP_MOCK_ENTITLED
  if (v === '0' || v === 'false') return false
  return true
}

let mockEntitled = startsEntitled()
const listeners: Array<(info: CustomerInfoLike) => void> = []

function buildCustomerInfo(): CustomerInfoLike {
  return {
    entitlements: {
      active: mockEntitled
        ? {
            [LEXICON_PRO_ENTITLEMENT]: {
              identifier: LEXICON_PRO_ENTITLEMENT,
              isActive: true,
            },
          }
        : {},
      all: {},
    },
    activeSubscriptions: mockEntitled ? [STORE_PRODUCT_MONTHLY] : [],
    originalAppUserId: 'mock',
  }
}

function emit() {
  const info = buildCustomerInfo()
  listeners.forEach((l) => l(info))
}

function makeProduct(id: string, title: string, price: number, priceString: string) {
  return {
    identifier: id,
    title,
    description: title,
    price,
    priceString,
    currencyCode: 'USD',
  }
}

const monthlyPackage = {
  identifier: '$rc_monthly',
  packageType: 'MONTHLY',
  product: makeProduct(STORE_PRODUCT_MONTHLY, 'Lexicon Pro Monthly', 7.99, '$7.99'),
  presentedOfferingContext: { offeringIdentifier: 'default' as const },
}

const annualPackage = {
  identifier: '$rc_annual',
  packageType: 'ANNUAL',
  product: makeProduct(STORE_PRODUCT_YEARLY, 'Lexicon Pro Yearly', 59.99, '$59.99'),
  presentedOfferingContext: { offeringIdentifier: 'default' as const },
}

const currentOffering = {
  identifier: 'default',
  serverDescription: 'Default',
  metadata: {},
  availablePackages: [monthlyPackage, annualPackage],
  monthly: monthlyPackage,
  annual: annualPackage,
}

export default class Purchases {
  static PURCHASES_ERROR_CODE = { PURCHASE_CANCELLED_ERROR: '1' as const }

  static configure(_config: unknown): void {
    emit()
  }

  static async logIn(_appUserID: string): Promise<{ customerInfo: CustomerInfoLike; created: boolean }> {
    emit()
    return { customerInfo: buildCustomerInfo(), created: false }
  }

  static async logOut(): Promise<CustomerInfoLike> {
    mockEntitled = false
    emit()
    return buildCustomerInfo()
  }

  static addCustomerInfoUpdateListener(cb: (info: CustomerInfoLike) => void): void {
    listeners.push(cb)
    cb(buildCustomerInfo())
  }

  static removeCustomerInfoUpdateListener(cb: (info: CustomerInfoLike) => void): boolean {
    const i = listeners.indexOf(cb)
    if (i >= 0) {
      listeners.splice(i, 1)
      return true
    }
    return false
  }

  static async getOfferings(): Promise<{ current: typeof currentOffering; all: Record<string, typeof currentOffering> }> {
    return {
      current: currentOffering,
      all: { default: currentOffering },
    }
  }

  static async purchasePackage(_pkg: unknown): Promise<{ customerInfo: CustomerInfoLike }> {
    mockEntitled = true
    emit()
    return { customerInfo: buildCustomerInfo() }
  }

  static async restorePurchases(): Promise<CustomerInfoLike> {
    mockEntitled = true
    emit()
    return buildCustomerInfo()
  }

  static async getCustomerInfo(): Promise<CustomerInfoLike> {
    return buildCustomerInfo()
  }
}
