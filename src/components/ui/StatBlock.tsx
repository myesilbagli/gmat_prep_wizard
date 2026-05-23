import type { CSSProperties, ReactNode } from 'react'

export type StatBlockProps = {
  label: string
  value: ReactNode
  sublabel?: string
  className?: string
  style?: CSSProperties
}

export function StatBlock({ label, value, sublabel, className, style }: StatBlockProps) {
  const parts = ['uiStatBlock']
  if (className) parts.push(className)
  return (
    <div className={parts.join(' ')} style={style}>
      <span className="uiStatBlock__label">{label}</span>
      <span className="uiStatBlock__value">{value}</span>
      {sublabel ? <span className="uiStatBlock__sublabel">{sublabel}</span> : null}
    </div>
  )
}
