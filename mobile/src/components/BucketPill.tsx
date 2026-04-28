import { Text, View } from 'react-native'
import type { BucketRole } from '../theme/bucketColors'
import { getBucketColors } from '../theme/bucketColors'
import { useAppTheme } from '../context/ThemeContext'

type Props = {
  role: BucketRole
  size?: 'sm' | 'md'
}

export function BucketPill({ role, size = 'md' }: Props) {
  const { theme } = useAppTheme()
  const colors = getBucketColors(theme, role)

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: size === 'sm' ? 8 : 10,
        paddingVertical: size === 'sm' ? 3 : 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: size === 'sm' ? 11 : 13,
          fontWeight: '600',
          letterSpacing: 0.5,
        }}
      >
        {colors.label}
      </Text>
    </View>
  )
}
