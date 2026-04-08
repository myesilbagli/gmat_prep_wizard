import { LP } from '../lib/landingPalette'

type DeckLayer = {
  z: number
  rotate: number
  translateX: number
  translateY: number
  scale: number
  opacity: number
  glow?: boolean
  word: string
  pos: string
  ipa: string
  def: string
  status: 'LEARNING' | 'MASTERED' | 'DO NOT KNOW'
  /** Full card copy (front only) */
  variant: 'simple' | 'full'
  gmatTip?: { title: string; body: string }
  deckLabel?: string
  deckCount?: string
}

/** Fan order: back → front; origin near bottom so tops separate clearly. */
const LAYERS: DeckLayer[] = [
  {
    z: 1,
    rotate: -20,
    translateX: -78,
    translateY: 38,
    scale: 0.9,
    opacity: 0.92,
    word: 'Salient',
    pos: 'adj.',
    ipa: '/ˈseɪliənt/',
    def: 'Most noticeable or important in a discussion.',
    status: 'MASTERED',
    variant: 'simple',
  },
  {
    z: 2,
    rotate: -11,
    translateX: -40,
    translateY: 22,
    scale: 0.93,
    opacity: 0.94,
    word: 'Ubiquitous',
    pos: 'adj.',
    ipa: '/juːˈbɪkwɪtəs/',
    def: 'Present everywhere—common in dense RC passages.',
    status: 'LEARNING',
    variant: 'simple',
  },
  {
    z: 3,
    rotate: -1,
    translateX: 4,
    translateY: 10,
    scale: 0.97,
    opacity: 0.97,
    word: 'Pedantic',
    pos: 'adj.',
    ipa: '/pɪˈdæntɪk/',
    def: 'Overly concerned with minor rules or display of learning.',
    status: 'DO NOT KNOW',
    variant: 'simple',
  },
  {
    z: 4,
    rotate: 9,
    translateX: 48,
    translateY: -6,
    scale: 1,
    opacity: 1,
    glow: true,
    word: 'Equivocate',
    pos: 'verb',
    ipa: '/ɪˈkwɪvəkeɪt/',
    def: 'To use ambiguous language to avoid a clear position—a common CR trap.',
    status: 'LEARNING',
    variant: 'full',
    gmatTip: {
      title: 'GMAT TIP',
      body: 'Watch for choices that equivocate between two claims.',
    },
    deckLabel: 'Daily deck',
    deckCount: '01 / 500',
  },
]

const cardW = 260
const cardH = Math.round(cardW * 1.52)

function statusStyles(status: DeckLayer['status']) {
  if (status === 'MASTERED')
    return {
      bg: 'rgba(79, 219, 200, 0.12)',
      border: 'rgba(79, 219, 200, 0.35)',
      color: LP.tertiary,
    }
  if (status === 'DO NOT KNOW')
    return {
      bg: 'rgba(192, 193, 255, 0.1)',
      border: 'rgba(192, 193, 255, 0.28)',
      color: LP.primary,
    }
  return {
    bg: 'rgba(79, 219, 200, 0.12)',
    border: 'rgba(79, 219, 200, 0.35)',
    color: LP.tertiary,
  }
}

function WordCardFace({ layer }: { layer: DeckLayer }) {
  const st = statusStyles(layer.status)
  const isFull = layer.variant === 'full'

  return (
    <div
      style={{
        width: cardW,
        height: cardH,
        borderRadius: 13,
        backgroundColor: 'rgba(23, 31, 51, 0.94)',
        border: '1px solid rgba(99, 102, 241, 0.22)',
        padding: '12px 14px 10px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: 'var(--sans)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
        <div
          style={{
            padding: '3px 7px',
            borderRadius: 6,
            backgroundColor: 'rgba(99, 102, 241, 0.22)',
            border: '1px solid rgba(129, 140, 248, 0.35)',
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.12em', color: '#c4b5fd' }}>LEXICON</span>
        </div>
        <div
          style={{
            padding: '3px 8px',
            borderRadius: 999,
            backgroundColor: st.bg,
            border: `1px solid ${st.border}`,
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', color: st.color, whiteSpace: 'nowrap' }}>
            {layer.status}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: LP.text, lineHeight: 1.15 }}>{layer.word}</div>
      <div style={{ marginTop: 2, fontSize: 10, fontStyle: 'italic', color: 'rgba(199, 196, 215, 0.65)' }}>
        {layer.pos} · {layer.ipa}
      </div>

      <p
        style={{
          margin: '8px 0 0',
          fontSize: 10,
          lineHeight: 1.45,
          color: LP.muted,
          display: '-webkit-box',
          WebkitLineClamp: isFull ? 2 : 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {layer.def}
      </p>

      {isFull && layer.gmatTip ? (
        <div
          style={{
            marginTop: 8,
            padding: '6px 8px',
            borderRadius: 7,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderLeft: '2px solid rgba(99, 102, 241, 0.55)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(199, 196, 215, 0.55)', marginBottom: 2 }}>
            {layer.gmatTip.title}
          </div>
          <p style={{ margin: 0, fontSize: 8, lineHeight: 1.4, color: LP.muted }}>{layer.gmatTip.body}</p>
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 4 }} />

      {isFull && layer.deckLabel && layer.deckCount ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: 'rgba(79, 219, 200, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="landing-icon" style={{ fontSize: 15, color: LP.tertiary, fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </div>
            <span style={{ fontSize: 9, color: 'rgba(199, 196, 215, 0.55)' }}>{layer.deckLabel}</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: LP.primary }}>{layer.deckCount}</span>
        </div>
      ) : (
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(128, 131, 255, 0.55)', flexShrink: 0 }}>GMAT VOCAB</div>
      )}
    </div>
  )
}

/**
 * Stacked mock vocab cards (aligned with mobile welcome deck) for the landing hero.
 */
const deckPadX = 100
const deckPadY = 56

export function LandingHeroWordDeck() {
  return (
    <div
      className="landing-hero-deck"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        margin: '0 auto',
        minHeight: cardH + deckPadY + 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Soft glow on the page background (no panel) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 'min(100%, 420px)',
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.22) 0%, transparent 70%)',
          filter: 'blur(40px)',
          top: '18%',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'rgba(79, 219, 200, 0.06)',
          filter: 'blur(48px)',
          bottom: '8%',
          right: '8%',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: cardW + deckPadX * 2,
          height: cardH + deckPadY,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {LAYERS.map((layer) => {
          const outerGlow = layer.glow
            ? {
                boxShadow:
                  '0 0 0 1px rgba(255,255,255,0.1), 0 0 40px rgba(99, 102, 241, 0.45), 0 0 72px rgba(99, 102, 241, 0.2), 0 18px 40px rgba(0,0,0,0.45)',
              }
            : {
                boxShadow: '0 14px 28px rgba(0,0,0,0.4)',
              }

          return (
            <div
              key={layer.word}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: cardW,
                height: cardH,
                marginLeft: -cardW / 2,
                marginTop: -cardH / 2,
                borderRadius: 14,
                zIndex: layer.z,
                opacity: layer.opacity,
                transform: `translate(${layer.translateX}px, ${layer.translateY}px) rotate(${layer.rotate}deg) scale(${layer.scale})`,
                transformOrigin: '50% 88%',
                border: layer.glow ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
                background: layer.glow ? 'linear-gradient(145deg, rgba(99,102,241,0.15), rgba(23,31,51,0.3))' : 'rgba(255,255,255,0.03)',
                ...outerGlow,
                transition: 'transform 0.35s ease',
              }}
            >
              <WordCardFace layer={layer} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
