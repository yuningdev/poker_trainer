/**
 * ChipStack — renders a player's chip count as visual poker chip stacks.
 *
 * Denominations (in multiples of 0.5 BB = halfBb):
 *   25 BB → purple
 *    5 BB → gray
 *    1 BB → green
 *  0.5 BB → blue
 *
 * Each denomination is drawn as a small side-view disc stack, like
 * real casino chips viewed from the side.  When count > maxStack the
 * excess is shown as a "×N" multiplier label.
 */

interface Props {
  chips: number
  bigBlind: number
  /** Maximum discs to draw per stack before showing a ×N label (default 5). */
  maxStack?: number
  /** Scale factor for chip size (default 1). Use 0.8 for bet-area chips. */
  scale?: number
}

interface Denom {
  mult: number   // multiples of halfBb
  bg: string
  border: string
  shadow: string
}

const DENOMS: Denom[] = [
  { mult: 50, bg: '#7c3aed', border: '#c4b5fd', shadow: '#3b0764' },  // 25BB purple
  { mult: 10, bg: '#4b5563', border: '#d1d5db', shadow: '#111827' },  // 5BB  gray
  { mult:  2, bg: '#15803d', border: '#4ade80', shadow: '#052e16' },  // 1BB  green
  { mult:  1, bg: '#1d4ed8', border: '#93c5fd', shadow: '#172554' },  // 0.5BB blue
]

export function ChipStack({ chips, bigBlind, maxStack = 5, scale = 1 }: Props) {
  const halfBb = Math.max(1, Math.floor(bigBlind / 2))

  // Always reserve some small-denomination chips (visual variety — every healthy
  // stack should show blue + green chips, not just all purple).
  // Only apply when the stack is large enough that the reserve is < 10% of total.
  const RESERVE = [
    { mult: 2, count: 2 },  // 2 green chips (1BB each)
    { mult: 1, count: 2 },  // 2 blue chips (0.5BB each)
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
  const W = Math.round(20 * scale)
  const H = Math.round(5 * scale)
  const GAP = Math.round(2 * scale)   // overlap gap between discs

  return (
    <div className="flex items-end gap-1 justify-center flex-wrap">
      {stacks.map(({ denom, count }, di) => {
        const visCount = Math.min(count, maxStack)
        const stackH = visCount * H + (visCount - 1) * GAP + (count > maxStack ? 10 : 0)

        return (
          <div key={di} className="flex flex-col items-center" style={{ width: W }}>
            {/* Chip discs, rendered bottom-to-top */}
            <div className="relative" style={{ width: W, height: stackH }}>
              {Array.from({ length: visCount }).map((_, ci) => (
                <div
                  key={ci}
                  style={{
                    position: 'absolute',
                    bottom: ci * (H + GAP),
                    left: 0,
                    width: W,
                    height: H,
                    background: denom.bg,
                    border: `1px solid ${denom.border}`,
                    borderRadius: H / 2,
                    boxShadow: `0 ${Math.round(2 * scale)}px 0 ${denom.shadow}`,
                  }}
                />
              ))}
              {/* Count label above the stack when capped */}
              {count > maxStack && (
                <span
                  className="absolute left-0 right-0 text-center font-bold text-white leading-none"
                  style={{ bottom: stackH - 8, fontSize: Math.round(7 * scale) }}
                >
                  ×{count}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
