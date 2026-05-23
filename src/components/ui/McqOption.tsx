import type { CSSProperties, MouseEvent, ReactNode } from 'react'

export type McqOptionState = 'default' | 'selected' | 'correct' | 'incorrect' | 'dimmed'

export type McqOptionProps = {
  label: ReactNode
  letter?: string
  state?: McqOptionState
  showLetter?: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
}

const STATE_CLASS: Record<McqOptionState, string> = {
  default: '',
  selected: 'is-selected',
  correct: 'is-correct',
  incorrect: 'is-incorrect',
  dimmed: 'is-dimmed',
}

export function McqOption({
  label,
  letter,
  state = 'default',
  showLetter = true,
  onClick,
  disabled,
  className,
  style,
}: McqOptionProps) {
  const parts = ['uiMcqOption']
  const stateCls = STATE_CLASS[state]
  if (stateCls) parts.push(stateCls)
  if (className) parts.push(className)

  return (
    <button
      type="button"
      className={parts.join(' ')}
      style={style}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === 'selected'}
    >
      {showLetter && letter ? <span className="uiMcqOption__letter">{letter}</span> : null}
      <span>{label}</span>
    </button>
  )
}
