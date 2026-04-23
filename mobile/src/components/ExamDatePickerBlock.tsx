import { useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { formatDateKeyInTimezone } from '@shared/dateInTimezone'
import { MaterialIcons } from '@expo/vector-icons'
import { isLearnDarkUi } from './GlassUi'
import type { AppTheme } from '../theme'

function parseIsoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfTodayInTimezone(timezone: string): Date {
  const key = formatDateKeyInTimezone(new Date(), timezone)
  const [y, mo, da] = key.split('-').map(Number)
  return new Date(y, mo - 1, da)
}

function addYears(d: Date, years: number): Date {
  const n = new Date(d)
  n.setFullYear(n.getFullYear() + years)
  return n
}

type Props = {
  theme: AppTheme
  timezone: string
  /** Current selection `YYYY-MM-DD` (controlled from parent for save). */
  examDateIso: string
  onExamDateIsoChange: (iso: string) => void
}

/** Pick GMAT test day; parent persists `YYYY-MM-DD`. */
export function ExamDatePickerBlock({
  theme,
  timezone,
  examDateIso,
  onExamDateIsoChange,
}: Props) {
  const minDate = useMemo(() => startOfTodayInTimezone(timezone), [timezone])
  const maxDate = useMemo(() => addYears(minDate, 2), [minDate])

  const [value, setValue] = useState(() => parseIsoToLocalDate(examDateIso))

  useEffect(() => {
    setValue(parseIsoToLocalDate(examDateIso))
  }, [examDateIso])

  const summary = useMemo(() => {
    return value.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [value])

  const [showAndroidPicker, setShowAndroidPicker] = useState(false)
  const darkUi = isLearnDarkUi(theme)

  function applyDate(next: Date) {
    let clamped = next
    if (clamped < minDate) clamped = minDate
    if (clamped > maxDate) clamped = maxDate
    setValue(clamped)
    const iso = formatDateKeyInTimezone(clamped, timezone)
    onExamDateIsoChange(iso)
  }

  return (
    <View style={[styles.well, { borderColor: theme.learnGlassBorder, backgroundColor: theme.learnSearchBg }]}>
      <Text style={[styles.summary, { color: theme.learnOnSurface }]} numberOfLines={2}>
        {summary}
      </Text>
      <Text style={[styles.hint, { color: theme.learnOnSurfaceVariant }]}>
        Exact test date — used for countdown and planning
      </Text>

      {Platform.OS === 'android' ? (
        <>
          <Pressable
            onPress={() => setShowAndroidPicker(true)}
            style={[styles.pickBtn, { borderColor: theme.learnGlassBorder, backgroundColor: theme.learnViewToggleBg }]}
          >
            <MaterialIcons name="event" size={20} color={theme.learnAccent} />
            <Text style={[styles.pickBtnText, { color: theme.learnAccent }]}>Choose date</Text>
          </Pressable>
          {showAndroidPicker ? (
            <DateTimePicker
              value={value}
              mode="date"
              display="default"
              minimumDate={minDate}
              maximumDate={maxDate}
              onChange={(_, d) => {
                setShowAndroidPicker(false)
                if (d) applyDate(d)
              }}
            />
          ) : null}
        </>
      ) : (
        <DateTimePicker
          value={value}
          mode="date"
          display="spinner"
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={(_, d) => {
            if (d) applyDate(d)
          }}
          themeVariant={darkUi ? 'dark' : 'light'}
          textColor={theme.learnOnSurface}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  well: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 2,
  },
  summary: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
})
