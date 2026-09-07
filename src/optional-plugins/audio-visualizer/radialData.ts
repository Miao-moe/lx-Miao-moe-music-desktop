// The existing desktop-lyric channel carries Uint8Array. Keep sample rate and FFT
// magnitudes together, without changing the host API or the two legacy effects.
export const RADIAL_FFT_SIZE = 8192
export const RADIAL_MIN_DB = -100
export const RADIAL_MAX_DB = -20
const HEADER_SIZE = 8
const MAGIC = [65, 77, 1, 0]

export const createRadialData = (sampleRate: number) => {
  const packet = new Uint8Array(HEADER_SIZE + RADIAL_FFT_SIZE / 2)
  packet.set(MAGIC)
  new DataView(packet.buffer).setFloat32(4, sampleRate, true)
  return packet
}
export const radialBins = <T extends ArrayBufferLike>(packet: Uint8Array<T>) => packet.subarray(HEADER_SIZE)
export const readRadialData = (packet: Uint8Array) => {
  if (packet.length !== HEADER_SIZE + RADIAL_FFT_SIZE / 2 || !MAGIC.every((value, index) => packet[index] === value)) return null
  const sampleRate = new DataView(packet.buffer, packet.byteOffset, packet.byteLength).getFloat32(4, true)
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 384000) return null
  return { sampleRate, bins: radialBins(packet) }
}

export const demoRadialData = (time: number) => {
  const packet = createRadialData(48000)
  const bins = radialBins(packet)
  for (let i = 1; i < bins.length; i++) {
    const frequency = i * 48000 / RADIAL_FFT_SIZE
    const octave = Math.log2(frequency / 40)
    const envelope = 0.48 + 0.16 * Math.cos(octave * 1.25 - time / 800)
    const beat = 0.12 * Math.sin(octave * 2.8 + time / 400)
    bins[i] = Math.round(255 * Math.max(0, Math.min(1, envelope + beat)))
  }
  return packet
}
