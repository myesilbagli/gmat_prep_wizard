import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import type { AppTheme } from '../theme'

export function Card({
  theme,
  children,
}: {
  theme: AppTheme
  children: React.ReactNode
}) {
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        gap: 10,
      }}
    >
      {children}
    </View>
  )
}

export function PrimaryButton({
  theme,
  label,
  onPress,
  disabled,
  loading,
}: {
  theme: AppTheme
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: disabled ? theme.muted : theme.primary,
        borderRadius: 999,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: '#fff', fontWeight: '700' }}>{label}</Text>
      )}
    </Pressable>
  )
}

export function Input({
  theme,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  onSubmitEditing,
}: {
  theme: AppTheme
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  secureTextEntry?: boolean
  onSubmitEditing?: () => void
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.muted}
      secureTextEntry={secureTextEntry}
      onSubmitEditing={onSubmitEditing}
      style={{
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        color: theme.text,
        backgroundColor: theme.surface2,
      }}
    />
  )
}
