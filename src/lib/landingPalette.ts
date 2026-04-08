import type { CSSProperties } from 'react'

/** Shared tokens for marketing landing and auth screens (Stitch-aligned). */
export const LP = {
  bg: '#0b1326',
  surface: '#171f33',
  surfaceLow: '#131b2e',
  surfaceLowest: '#060e20',
  text: '#dae2fd',
  muted: '#c7c4d7',
  primary: '#c0c1ff',
  primaryContainer: '#8083ff',
  onPrimary: '#1000a9',
  tertiary: '#4fdbc8',
  outline: 'rgba(70, 69, 84, 0.35)',
  borderLight: 'rgba(70, 69, 84, 0.15)',
} as const

export const BOOK_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB4_2MNVfVl0RkxscxxLsopCgLXsNvTjJabwLoS8uWEAe8lKKfggBwrt82fSX3ErbcV7AUncHWHZq5TiUs0xwqvy8iFvPShpzWGLaJ6pQjcIR6kN0vZCDM1Ew4OvvqHmMytibWgx_sY6Bq490DJBLSlJ1TdzE5yJ2TWrHfdurzeH-sDKCU5nM6e3afVh1fAZAB_3IpP5vbEwz2C6IJsLQrEzhwIp7BvZfbKwi21Jcee_sJtMovMi-Gy6BgJfxxor2BUoMHHwLlY0Mo'

export function landingBtnPrimary(extra?: CSSProperties): CSSProperties {
  return {
    border: 'none',
    borderRadius: 12,
    padding: '10px 22px',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    background: LP.primaryContainer,
    color: LP.onPrimary,
    boxShadow: '0 0 20px rgba(128, 131, 255, 0.3)',
    transition: 'transform 0.2s, filter 0.2s',
    ...extra,
  }
}

export function landingBtnGhost(extra?: CSSProperties): CSSProperties {
  return {
    border: `1px solid ${LP.borderLight}`,
    borderRadius: 12,
    padding: '10px 22px',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
    background: 'rgba(45, 52, 73, 0.4)',
    color: LP.text,
    transition: 'background 0.2s',
    ...extra,
  }
}

export function landingInputStyle(): CSSProperties {
  return {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: `1px solid ${LP.borderLight}`,
    background: 'rgba(19, 27, 46, 0.65)',
    color: LP.text,
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
  }
}
