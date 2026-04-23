import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import type { GeneratedResult } from '@shared/types'
import { validateUserStackName } from '@shared/userStacks'
import { useGlassFonts } from './GlassUi'
import { createUserStack, listUserStacks } from '../lib/userStacks'
import { MAX_USER_STACKS_PER_WORD } from '../lib/words'
import type { UserStack } from '@shared/types'
import type { AppTheme } from '../theme'

export type PendingStackSave = {
  text: string
  result: GeneratedResult
  mainLanguage: string
}

type Props = {
  theme: AppTheme
  visible: boolean
  pending: PendingStackSave | null
  /** Edit membership for an existing saved word (no new card write). */
  membershipEdit?: { wordId: string; initialIds: string[] } | null
  saving: boolean
  onCancel: () => void
  /** New save from Quick Capture / regenerate. */
  onConfirm: (opts: { deckOnly: boolean; selectedStackIds: string[] }) => Promise<void>
  /** Existing word: replace userStackIds. */
  onConfirmMembership?: (opts: { deckOnly: boolean; selectedStackIds: string[] }) => Promise<void>
}

export function StackAssignmentSheet({
  theme,
  visible,
  pending,
  membershipEdit = null,
  saving,
  onCancel,
  onConfirm,
  onConfirmMembership,
}: Props) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { fontBody, fontHeadline, fontLabel, fontLabelBold } = useGlassFonts()

  const [loadingStacks, setLoadingStacks] = useState(false)
  const [stacks, setStacks] = useState<UserStack[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deckOnly, setDeckOnly] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [inlineCreateOpen, setInlineCreateOpen] = useState(false)
  const [inlineName, setInlineName] = useState('')
  const [creatingStack, setCreatingStack] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const refreshStacks = useCallback(async () => {
    setLoadingStacks(true)
    setLoadError(null)
    try {
      const list = await listUserStacks()
      setStacks(list)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load stacks.')
    } finally {
      setLoadingStacks(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    if (membershipEdit) {
      const ids = membershipEdit.initialIds
      setDeckOnly(ids.length === 0)
      setSelectedIds(new Set(ids))
      setInlineCreateOpen(false)
      setInlineName('')
      setCreateError(null)
      void refreshStacks()
      return
    }
    if (pending) {
      setDeckOnly(true)
      setSelectedIds(new Set())
      setInlineCreateOpen(false)
      setInlineName('')
      setCreateError(null)
      void refreshStacks()
    }
  }, [visible, pending, membershipEdit, refreshStacks])

  function toggleDeckOnly(next: boolean) {
    setDeckOnly(next)
    if (next) setSelectedIds(new Set())
  }

  function toggleStack(id: string) {
    setDeckOnly(false)
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) {
        n.delete(id)
      } else if (n.size >= MAX_USER_STACKS_PER_WORD) {
        return prev
      } else {
        n.add(id)
      }
      return n
    })
  }

  async function onInlineCreate() {
    const v = validateUserStackName(inlineName)
    if (!v.ok) {
      setCreateError(v.error)
      return
    }
    setCreateError(null)
    setCreatingStack(true)
    try {
      const s = await createUserStack({ name: inlineName.trim(), description: null })
      setStacks((prev) => [s, ...prev.filter((x) => x.id !== s.id)])
      setDeckOnly(false)
      setSelectedIds((prev) => {
        const n = new Set(prev)
        if (n.size < MAX_USER_STACKS_PER_WORD) n.add(s.id)
        return n
      })
      setInlineName('')
      setInlineCreateOpen(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not create stack.')
    } finally {
      setCreatingStack(false)
    }
  }

  async function handleConfirm() {
    const ids = deckOnly ? [] : Array.from(selectedIds)
    if (membershipEdit) {
      await onConfirmMembership?.({ deckOnly, selectedStackIds: ids })
      return
    }
    if (!pending) return
    await onConfirm({ deckOnly, selectedStackIds: ids })
  }

  const atMaxStacks = !deckOnly && selectedIds.size >= MAX_USER_STACKS_PER_WORD
  const primaryLabel = deckOnly ? 'Save' : 'Save & add to stacks'
  const confirmDisabled = saving || creatingStack || loadingStacks

  const sheetMaxHeight = Math.round(windowHeight * 0.88)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => !saving && onCancel()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
          onPress={() => !saving && !creatingStack && onCancel()}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{ maxHeight: sheetMaxHeight }}>
            <View
              style={{
                backgroundColor: theme.learnScreenBg,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: Math.max(insets.bottom, 16),
                paddingHorizontal: 20,
                paddingTop: 14,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fontHeadline, fontSize: 18, fontWeight: '800', color: theme.learnOnSurface }}>
                  {membershipEdit ? 'Stacks for this word' : 'Save to deck'}
                </Text>
                <Pressable onPress={() => !saving && !creatingStack && onCancel()} hitSlop={12} disabled={saving}>
                  <MaterialIcons name="close" size={26} color={theme.learnOutline} />
                </Pressable>
              </View>

              <Text
                style={{
                  fontFamily: fontBody,
                  fontSize: 13,
                  color: theme.learnOnSurfaceVariant,
                  marginTop: 8,
                  lineHeight: 18,
                }}
              >
                Choose “Save to deck only” or add to your stacks (up to {MAX_USER_STACKS_PER_WORD}).
              </Text>

              <Pressable
                onPress={() => toggleDeckOnly(!deckOnly)}
                style={{
                  marginTop: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 12,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: deckOnly ? theme.learnAccent : theme.learnGlassBorder,
                    backgroundColor: deckOnly ? theme.learnAccent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {deckOnly ? <MaterialIcons name="check" size={16} color={theme.learnPillActiveText} /> : null}
                </View>
                <Text style={{ fontFamily: fontLabel, fontSize: 15, color: theme.learnOnSurface, flex: 1 }}>
                  Save to deck only
                </Text>
              </Pressable>

              {loadingStacks ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={theme.learnAccent} />
                </View>
              ) : loadError ? (
                <Text style={{ fontFamily: fontBody, color: theme.danger, marginTop: 12 }}>{loadError}</Text>
              ) : (
                <ScrollView
                  style={{ maxHeight: sheetMaxHeight - 280 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {stacks.map((s) => {
                    const checked = selectedIds.has(s.id)
                    const disabled = !checked && atMaxStacks
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => {
                          if (disabled) return
                          toggleStack(s.id)
                        }}
                        disabled={disabled}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 10,
                          opacity: disabled ? 0.45 : 1,
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: checked ? theme.learnAccent : theme.learnGlassBorder,
                            backgroundColor: checked ? theme.learnAccent : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {checked ? <MaterialIcons name="check" size={16} color={theme.learnPillActiveText} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: fontLabel, fontSize: 15, color: theme.learnOnSurface }}>{s.name}</Text>
                          <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.learnOnSurfaceVariant }}>
                            {s.wordCount} word{s.wordCount === 1 ? '' : 's'}
                          </Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              )}

              {atMaxStacks ? (
                <Text style={{ fontFamily: fontBody, fontSize: 13, color: theme.danger, marginTop: 8 }}>
                  Maximum {MAX_USER_STACKS_PER_WORD} stacks per word.
                </Text>
              ) : null}

              {!inlineCreateOpen ? (
                <Pressable
                  onPress={() => setInlineCreateOpen(true)}
                  style={{ marginTop: 12, paddingVertical: 10 }}
                >
                  <Text style={{ fontFamily: fontLabelBold, fontSize: 15, color: theme.learnAccent }}>+ Create new stack</Text>
                </Pressable>
              ) : (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <TextInput
                    value={inlineName}
                    onChangeText={(t) => {
                      setInlineName(t)
                      setCreateError(null)
                    }}
                    placeholder="Stack name"
                    placeholderTextColor={`${theme.learnOutline}aa`}
                    editable={!creatingStack}
                    style={{
                      fontFamily: fontBody,
                      fontSize: 15,
                      color: theme.learnOnSurface,
                      backgroundColor: theme.surface2,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderWidth: 1,
                      borderColor: theme.learnGlassBorder,
                    }}
                  />
                  {createError ? (
                    <Text style={{ fontFamily: fontBody, fontSize: 12, color: theme.danger }}>{createError}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={() => {
                        setInlineCreateOpen(false)
                        setInlineName('')
                        setCreateError(null)
                      }}
                      disabled={creatingStack}
                    >
                      <Text style={{ fontFamily: fontBody, color: theme.learnOnSurfaceVariant }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void onInlineCreate()}
                      disabled={creatingStack}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      {creatingStack ? <ActivityIndicator color={theme.learnAccent} size="small" /> : null}
                      <Text style={{ fontFamily: fontLabelBold, color: theme.learnAccent }}>Create</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <Pressable
                onPress={() => void handleConfirm()}
                disabled={confirmDisabled}
                style={{
                  marginTop: 20,
                  paddingVertical: 16,
                  borderRadius: 14,
                  backgroundColor: theme.learnAccent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: confirmDisabled ? 0.55 : 1,
                }}
              >
                {saving ? <ActivityIndicator color={theme.learnPillActiveText} /> : null}
                <Text style={{ fontFamily: fontLabelBold, fontSize: 16, fontWeight: '800', color: theme.learnPillActiveText }}>
                  {primaryLabel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}
