import type { CSSProperties, ReactNode, MouseEvent } from 'react'
import { Link } from 'react-router-dom'

type CommonProps = {
  children: ReactNode
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  className?: string
  style?: CSSProperties
}

type ButtonProps = CommonProps & {
  as?: 'button'
  type?: 'button' | 'submit'
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
}

type LinkProps = CommonProps & {
  as: 'link'
  to: string
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

export type PrimaryButtonProps = ButtonProps | LinkProps

function joinClass(base: string, extra?: string, loading?: boolean): string {
  const parts = [base]
  if (loading) parts.push('is-loading')
  if (extra) parts.push(extra)
  return parts.join(' ')
}

export function PrimaryButton(props: PrimaryButtonProps) {
  const { children, disabled, loading, icon, className, style } = props
  const cls = joinClass('uiPrimaryButton', className, loading)
  const body = (
    <>
      {icon}
      {children}
    </>
  )

  if (props.as === 'link') {
    return (
      <Link
        to={props.to}
        className={cls}
        style={style}
        onClick={loading || disabled ? undefined : props.onClick}
        aria-disabled={disabled || loading ? true : undefined}
      >
        {body}
      </Link>
    )
  }

  return (
    <button
      type={props.type ?? 'button'}
      className={cls}
      style={style}
      disabled={disabled || loading}
      onClick={loading || disabled ? undefined : props.onClick}
    >
      {body}
    </button>
  )
}
