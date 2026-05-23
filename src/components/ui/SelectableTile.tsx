import type { CSSProperties, MouseEvent } from 'react'

export type SelectableTileProps = {
  label: string
  sublabel?: string
  selected?: boolean
  disabled?: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  layout?: 'pill' | 'tile'
  className?: string
  style?: CSSProperties
}

export function SelectableTile({
  label,
  sublabel,
  selected,
  disabled,
  onClick,
  layout = 'tile',
  className,
  style,
}: SelectableTileProps) {
  const parts = ['uiSelectableTile', layout === 'pill' ? 'uiSelectableTile--pill' : 'uiSelectableTile--tile']
  if (selected) parts.push('is-selected')
  if (className) parts.push(className)

  return (
    <button
      type="button"
      className={parts.join(' ')}
      style={style}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span>{label}</span>
      {sublabel ? <span className="uiSelectableTile__sublabel">{sublabel}</span> : null}
    </button>
  )
}
