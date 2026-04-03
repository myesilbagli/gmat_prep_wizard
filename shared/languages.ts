/** ISO 639-1 code — used as Firestore key in `translations`. */
export type MainLanguageCode = string

/** Preset list for profile pickers (English first). */
export const MAIN_LANGUAGE_OPTIONS: { code: MainLanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Turkish (Türkçe)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'pt-BR', label: 'Portuguese — Brazil' },
  { code: 'nl', label: 'Dutch (Nederlands)' },
  { code: 'pl', label: 'Polish (Polski)' },
  { code: 'ru', label: 'Russian (Русский)' },
  { code: 'uk', label: 'Ukrainian (Українська)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'zh', label: 'Chinese — Mandarin (中文)' },
  { code: 'zh-TW', label: 'Chinese — Traditional (繁體)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'vi', label: 'Vietnamese (Tiếng Việt)' },
  { code: 'th', label: 'Thai (ไทย)' },
  { code: 'id', label: 'Indonesian (Bahasa Indonesia)' },
  { code: 'ms', label: 'Malay (Bahasa Melayu)' },
  { code: 'fil', label: 'Filipino' },
  { code: 'el', label: 'Greek (Ελληνικά)' },
  { code: 'he', label: 'Hebrew (עברית)' },
  { code: 'fa', label: 'Persian (فارسی)' },
  { code: 'ur', label: 'Urdu (اردو)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'sw', label: 'Swahili (Kiswahili)' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'cs', label: 'Czech (Čeština)' },
  { code: 'da', label: 'Danish (Dansk)' },
  { code: 'fi', label: 'Finnish (Suomi)' },
  { code: 'sv', label: 'Swedish (Svenska)' },
  { code: 'no', label: 'Norwegian (Norsk)' },
  { code: 'hu', label: 'Hungarian (Magyar)' },
  { code: 'ro', label: 'Romanian (Română)' },
  { code: 'bg', label: 'Bulgarian (Български)' },
  { code: 'hr', label: 'Croatian (Hrvatski)' },
  { code: 'sr', label: 'Serbian (Српски)' },
  { code: 'sk', label: 'Slovak (Slovenčina)' },
  { code: 'sl', label: 'Slovenian (Slovenščina)' },
  { code: 'et', label: 'Eesti (Estonian)' },
  { code: 'lv', label: 'Latviešu (Latvian)' },
  { code: 'lt', label: 'Lietuvių (Lithuanian)' },
  { code: 'is', label: 'Íslenska (Icelandic)' },
  { code: 'ga', label: 'Irish (Gaeilge)' },
  { code: 'mt', label: 'Maltese (Malti)' },
  { code: 'ca', label: 'Catalan (Català)' },
  { code: 'eu', label: 'Basque (Euskara)' },
  { code: 'gl', label: 'Galician (Galego)' },
  { code: 'az', label: 'Azerbaijani (Azərbaycan)' },
  { code: 'ka', label: 'Georgian (ქართული)' },
  { code: 'hy', label: 'Armenian (Հայերեն)' },
  { code: 'kk', label: 'Kazakh (Қазақша)' },
  { code: 'uz', label: 'Uzbek (Oʻzbek)' },
  { code: 'mn', label: 'Mongolian (Монгол)' },
  { code: 'ne', label: 'Nepali (नेपाली)' },
  { code: 'si', label: 'Sinhala (සිංහල)' },
  { code: 'my', label: 'Burmese (မြန်မာ)' },
  { code: 'km', label: 'Khmer (ខ្មែរ)' },
  { code: 'lo', label: 'Lao (ລາວ)' },
]

export const DEFAULT_MAIN_LANGUAGE: MainLanguageCode = 'en'

const labelByCode = new Map(MAIN_LANGUAGE_OPTIONS.map((o) => [o.code, o.label]))

export function getMainLanguageLabel(code: string | undefined): string {
  if (!code) return 'English'
  return labelByCode.get(code) ?? code
}

export function normalizeMainLanguageCode(raw: unknown): MainLanguageCode {
  if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_MAIN_LANGUAGE
  const c = raw.trim()
  const known = MAIN_LANGUAGE_OPTIONS.some((o) => o.code === c)
  return known ? c : DEFAULT_MAIN_LANGUAGE
}
