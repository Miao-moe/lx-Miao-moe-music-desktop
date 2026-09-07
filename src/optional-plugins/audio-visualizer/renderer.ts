import { drawSpectrum } from './spectrum'
import { createRadialRenderer } from './radial'
import { normalizeStyle, type VisualizerStyle } from './styles'

interface Bounds { x: number, y: number, width: number, height: number }
interface Options { style: VisualizerStyle, desktop?: boolean, preview?: boolean, time?: number, bounds?: Bounds }

export const createVisualizerRenderer = (canvas: HTMLCanvasElement) => {
  let radial: ReturnType<typeof createRadialRenderer> | null = null
  const dispose = () => { radial?.dispose(); radial = null; delete canvas.dataset.visualizerEngine }
  return {
    dispose,
    draw(data: Uint8Array, options: Options) {
      if (normalizeStyle(options.style) !== 'radial') {
        dispose()
        // A style change can precede the next desktop-lyric packet.
        drawSpectrum(canvas, data.length <= 128 ? data : new Uint8Array(), options)
        return
      }
      const context = canvas.getContext('2d')
      if (!context) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / Math.max(1, width * height)))
      const pixelWidth = Math.round(width * ratio)
      const pixelHeight = Math.round(height * ratio)
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      const area = options.bounds ?? { x: 0, y: 0, width, height }
      const size = Math.min(area.width, area.height, options.preview ? 220 : 640) * (options.preview ? 0.9 : 0.88)
      if (size < 8) return
      radial ??= createRadialRenderer()
      canvas.dataset.visualizerEngine = 'audioMotion-4.5.4'
      if (!radial.draw(data, size, options.time ?? performance.now())) return
      context.save()
      context.globalAlpha = options.preview ? 0.95 : options.desktop ? 0.4 : 0.32
      context.drawImage(radial.canvas, area.x + (area.width - size) / 2, area.y + (area.height - size) / 2, size, size)
      context.restore()
    },
  }
}
