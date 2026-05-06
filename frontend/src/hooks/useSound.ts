/**
 * Procedural sound effects using the Web Audio API.
 * No audio files needed — all sounds are synthesized in the browser.
 *
 * AudioContext is created lazily on first use so we don't hit the
 * "AudioContext not allowed before user gesture" browser restriction.
 */

let _ctx: AudioContext | null = null

function ctx(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  // Resume if suspended (browser autoplay policy)
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

/** Short click of a poker chip landing on felt */
export function playChip(volume = 0.35): void {
  try {
    const c = ctx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain); gain.connect(c.destination)
    osc.frequency.setValueAtTime(900, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(320, c.currentTime + 0.06)
    gain.gain.setValueAtTime(volume, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14)
    osc.start(c.currentTime); osc.stop(c.currentTime + 0.14)
  } catch { /* ignore – audio permissions */ }
}

/** Card-slide / deal swish */
export function playDeal(): void {
  try {
    const c = ctx()
    const bufLen = Math.floor(c.sampleRate * 0.07)
    const buf = c.createBuffer(1, bufLen, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      const env = Math.sin((i / bufLen) * Math.PI)
      data[i] = (Math.random() * 2 - 1) * env
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'; filter.frequency.value = 4000; filter.Q.value = 0.6
    const gain = c.createGain(); gain.gain.setValueAtTime(0.3, c.currentTime)
    src.connect(filter); filter.connect(gain); gain.connect(c.destination)
    src.start()
  } catch { /* ignore */ }
}

/** Soft table tap (check) */
export function playCheck(): void {
  try {
    const c = ctx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'triangle'; osc.connect(gain); gain.connect(c.destination)
    osc.frequency.setValueAtTime(260, c.currentTime)
    gain.gain.setValueAtTime(0.18, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09)
    osc.start(c.currentTime); osc.stop(c.currentTime + 0.09)
  } catch { /* ignore */ }
}

/** Paper rustle (fold) */
export function playFold(): void {
  try {
    const c = ctx()
    const bufLen = Math.floor(c.sampleRate * 0.18)
    const buf = c.createBuffer(1, bufLen, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      const env = Math.sin((i / bufLen) * Math.PI) * 0.28
      data[i] = (Math.random() * 2 - 1) * env
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'; filter.frequency.value = 1200
    src.connect(filter); filter.connect(c.destination)
    src.start()
  } catch { /* ignore */ }
}

/** Ascending arpeggio (win) */
export function playWin(): void {
  try {
    const c = ctx()
    const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'; osc.connect(gain); gain.connect(c.destination)
      const t = c.currentTime + i * 0.11
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.28, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
      osc.start(t); osc.stop(t + 0.28)
    })
  } catch { /* ignore */ }
}
