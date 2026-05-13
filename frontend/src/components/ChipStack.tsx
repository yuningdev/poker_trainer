/**
 * ChipStack — renders a player's chip count as visual casino chip stacks.
 *
 * Denominations (in multiples of 0.5 BB = halfBb):
 *   25 BB → purple
 *    5 BB → gray
 *    1 BB → red/pink
 *  0.5 BB → teal/blue
 *
 * Each denomination is drawn as a side-view disc stack: a pill shape with
 * a bright top-edge highlight, solid color body, center stripe, and a
 * bottom-wall box-shadow that creates a 3D casino chip illusion.
 */

interface Props {
  chips: number
  bigBlind: number
  /** Maximum discs to draw per stack before showing a ×N label (default 5). */
  maxStack?: number
  /** Scale factor for chip size (default 1). */
  scale?: number
}

interface Denom {
  mult: number    // multiples of halfBb
  bg: string      // main chip face color
  highlight: string  // top-edge highlight
  stripe: string  // center stripe (casino edge design)
  wall: string    // bottom-wall shadow (chip thickness)
  ring: string    // outer ring / border
}

// Colors calibrated to match reference image (dark navy table)
const DENOMS: Denom[] = [
  {
    mult: 50,
    bg: '#7c3aed',
    highlight: 'rgba(255,255,255,0.45)',
    stripe: 'rgba(255,255,255,0.18)',
    wall: '#3b0764',
    ring: '#a78bfa',
  },  // 25BB purple
  {
    mult: 10,
    bg: '#6b7280',
    highlight: 'rgba(255,255,255,0.40)',
    stripe: 'rgba(255,255,255,0.18)',
    wall: '#1f2937',
    ring: '#d1d5db',
  },  // 5BB  gray
  {
    mult:  2,
    bg: '#dc2626',
    highlight: 'rgba(255,255,255,0.38)',
    stripe: 'rgba(255,255,255,0.18)',
    wall: '#7f1d1d',
    ring: '#fca5a5',
  },  // 1BB  red
  {
    mult:  1,
    bg: '#0891b2',
    highlight: 'rgba(255,255,255,0.38)',
    stripe: 'rgba(255,255,255,0.18)',
    wall: '#164e63',
    ring: '#67e8f9',
  },  // 0.5BB teal
]

export function ChipStack({ chips, bigBlind, maxStack = 5, scale = 1 }: Props) {
  const halfBb = Math.max(1, Math.floor(bigBlind / 2))

  // Reserve some small-denomination chips for visual variety —
  // every healthy stack shows multiple colors, not just all-purple.
  const RESERVE = [
    { mult: 2, count: 2 },  // 2 red chips (1BB each)
    { mult: 1, count: 2 },  // 2 teal chips (0.5BB each)
  ]
  const reserveValue = RESERVE.reduce((s, r) => s + r.mult * halfBb * r.count, 0)
  const applyReserve = chips > reserveValue * 3

  const rawCounts: Record<number, number> = {}
  let rem = applyReserve ? chips - reserveValue : chips
  for (const d of DENOMS) {
    const value = halfBb * d.mult
    const n = Math.floor(rem / value)
    if (n > 0) { rawCounts[d.mult] = n; rem -= n * value }
  }
  if (applyReserve) {
    for (const r of RESERVE) {
      rawCounts[r.mult] = (rawCounts[r.mult] ?? 0) + r.count
    }
  }

  const stacks = DENOMS
    .filter((d) => (rawCounts[d.mult] ?? 0) > 0)
    .map((d) => ({ denom: d, count: rawCounts[d.mult] }))

  if (stacks.length === 0) return null

  // Chip disc dimensions (scaled)
  const W   = Math.round(22 * scale)   // chip width (diameter from side)
  const H   = Math.round(9  * scale)   // chip height (disc thickness from side)
  const GAP = Math.round(2  * scale)   // vertical gap between stacked discs
  const WALL = Math.round(3 * scale)   // 3D bottom-wall thickness

  return (
    <div className="flex items-end gap-1.5 justify-center flex-wrap">
      {stacks.map(({ denom, count }, di) => {
        const visCount = Math.min(count, maxStack)
        // Total stack height: discs + gaps + wall of the bottom disc
        const stackH = visCount * H + Math.max(0, visCount - 1) * GAP + WALL

        return (
          <div key={di} style={{ width: W, position: 'relative', height: stackH }}>
            {Array.from({ length: visCount }).map((_, ci) => {
              const bottom = ci * (H + GAP) + WALL  // leave room for wall at base
              return (
                <div
                  key={ci}
                  style={{
                    position: 'absolute',
                    bottom,
                    left: 0,
                    width: W,
                    height: H,
                    borderRadius: H / 2,
                    // 3-zone gradient: top highlight | main color | bottom shade
                    background: [
                      `linear-gradient(180deg,`,
                      `  ${denom.highlight} 0%,`,
                      `  ${denom.highlight} 18%,`,
                      `  ${denom.bg} 18%,`,
                      `  ${denom.bg} 82%,`,
                      `  rgba(0,0,0,0.28) 82%,`,
                      `  rgba(0,0,0,0.28) 100%`,
                      `)`,
                    ].join(' '),
                    // Center stripe overlay (casino edge design visible from side)
                    backgroundImage: [
                      `linear-gradient(90deg,`,
                      `  transparent 0%, transparent 28%,`,
                      `  ${denom.stripe} 28%, ${denom.stripe} 72%,`,
                      `  transparent 72%, transparent 100%`,
                      `),`,
                      `linear-gradient(180deg,`,
                      `  ${denom.highlight} 0%, ${denom.highlight} 18%,`,
                      `  ${denom.bg} 18%, ${denom.bg} 82%,`,
                      `  rgba(0,0,0,0.28) 82%, rgba(0,0,0,0.28) 100%`,
                      `)`,
                    ].join(' '),
                    // Bottom wall = 3D depth; outer ring
                    boxShadow: [
                      `0 ${WALL}px 0 ${denom.wall}`,
                      `0 0 0 1px ${denom.ring}`,
                    ].join(', '),
                  }}
                />
              )
            })}
            {/* ×N multiplier label when capped */}
            {count > maxStack && (
              <span
                style={{
                  position: 'absolute',
                  bottom: WALL + visCount * (H + GAP) - H * 0.7,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontSize: Math.round(8 * scale),
                  fontWeight: 700,
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  lineHeight: 1,
                }}
              >
                ×{count}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
