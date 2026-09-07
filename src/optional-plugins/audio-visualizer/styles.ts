export const STYLE_IDS = ['spectrum', 'wave', 'radial'] as const
export type VisualizerStyle = typeof STYLE_IDS[number]
export type VisualizerSurface = 'main' | 'desktop'
export const normalizeStyle = (value: unknown): VisualizerStyle => value === 'ring' ? 'radial' : STYLE_IDS.includes(value as VisualizerStyle) ? value as VisualizerStyle : 'spectrum'

export const demoSpectrum = (time: number) => Uint8Array.from({ length: 128 }, (_, index) => {
  const envelope = Math.exp(-index / 85)
  const pulse = 0.55 + Math.sin(time / 370 + index / 9) * 0.22 + Math.sin(time / 610 - index / 4) * 0.18
  return Math.round(255 * envelope * pulse)
})
