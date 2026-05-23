import type { CSSProperties, ReactNode } from 'react'

export type AlertVariant = 'error' | 'success' | 'info'

export type AlertProps = {
  variant?: AlertVariant
  children: ReactNode
  role?: 'alert' | 'status'
  className?: string
  style?: CSSProperties
}

export function Alert({ variant = 'info', children, role, className, style }: AlertProps) {
  const parts = ['uiAlert', `uiAlert--${variant}`]
  if (className) parts.push(className)
  const resolvedRole = role ?? (variant === 'error' ? 'alert' : 'status')
  return (
    <div className={parts.join(' ')} style={style} role={resolvedRole}>
      {children}
    </div>
  )
}
