import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import type { UserStack } from '@shared/types'
import { validateUserStackName } from '@shared/userStacks'
import { useGlassFonts } from './GlassUi'
import { createUserStack } from '../lib/userStacks'
import type { AppTheme } from '../theme'

type Props = {
  theme: AppTheme
  visible: boolean
  onClose: () => void
  /** Called after successful create (full modal flow from Learn). */
  onCreated?: (stack: UserStack) => void
}

export function CreateUserStackModal({ theme, visible, onClose, onCreated }: Props) {
  const insets = useSafeAreaInsets()
  const { fontBody, fontHeadline, fontLabelBold } = useGlassFonts()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetAndClose() {
    setName('')
    setDescription('')
    setError(null)
    setCreating(false)
    onClose()
  }

  async function onConfirm() {
    const v = validateUserStackName(name)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setError(null)
    setCreating(true)
    try {
      const desc =
        description.trim() === '' ? null : description.trim()
      const stack = await createUserStack({ name: name.trim(), description: desc })
      onCreated?.(stack)
      resetAndClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create stack.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => !creating && resetAndClose()}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            onPress={() => !creating && resetAndClose()}
          />
          <View
            style={{
              width: '100%',
              paddingBottom: Math.max(insets.bottom, 16),
              paddingHorizontal: 20,
              paddingTop: 12,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              backgroundColor: theme.learnScreenBg,
            }}
          >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: fontHeadline, fontSize: 18, fontWeight: '800', color: theme.learnOnSurface }}>
                    New stack
                  </Text>
                  <Pressable onPress={() => !creating && resetAndClose()} hitSlop={12} disabled={creating}>
                    <MaterialIcons name="close" size={26} color={theme.learnOutline} />
                  </Pressable>
                </View>

                <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant, marginTop: 12 }}>
                  Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={(t) => {
                    setName(t)
                    setError(null)
                  }}
                  placeholder="e.g. Hard words"
                  placeholderTextColor={`${theme.learnOutline}aa`}
                  editable={!creating}
                  style={{
                    marginTop: 8,
                    fontFamily: fontBody,
                    fontSize: 16,
                    color: theme.learnOnSurface,
                    backgroundColor: theme.surface2,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: theme.learnGlassBorder,
                  }}
                />

                <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.learnOnSurfaceVariant, marginTop: 14 }}>
                  Description (optional)
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional note"
                  placeholderTextColor={`${theme.learnOutline}aa`}
                  editable={!creating}
                  multiline
                  style={{
                    marginTop: 8,
                    minHeight: 72,
                    fontFamily: fontBody,
                    fontSize: 15,
                    color: theme.learnOnSurface,
                    backgroundColor: theme.surface2,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: theme.learnGlassBorder,
                  }}
                />

                {error ? (
                  <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.danger, marginTop: 10 }}>{error}</Text>
                ) : null}

                <Pressable
                  onPress={() => void onConfirm()}
                  disabled={creating}
                  style={{
                    marginTop: 20,
                    paddingVertical: 16,
                    borderRadius: 14,
                    backgroundColor: theme.learnAccent,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: creating ? 0.65 : 1,
                  }}
                >
                  {creating ? <ActivityIndicator color={theme.learnPillActiveText} /> : null}
                  <Text style={{ fontFamily: fontLabelBold, fontSize: 16, fontWeight: '800', color: theme.learnPillActiveText }}>
                    Create stack
                  </Text>
                </Pressable>
              </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
