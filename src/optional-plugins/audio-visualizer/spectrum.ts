import { normalizeStyle, type VisualizerStyle } from './styles'

interface DrawOptions { style?: VisualizerStyle, desktop?: boolean, preview?: boolean, time?: number }

const bands = (data: Uint8Array, count: number) => Array.from({ length: count }, (_, index) => {
  const start = Math.floor(Math.pow(index / count, 1.6) * data.length)
  const end = Math.max(start + 1, Math.floor(Math.pow((index + 1) / count, 1.6) * data.length))
  let peak = 0
  for (let i = start; i < end; i++) peak = Math.max(peak, data[i] ?? 0)
  return peak / 255
})

export const drawSpectrum = (canvas: HTMLCanvasElement, data: Uint8Array, options: DrawOptions = {}) => {
  const context = canvas.getContext('2d')
  if (!context) return
  const { desktop = false, preview = false, time = 0 } = options
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  // Bound the backing buffer on high DPI and 4K displays.
  const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / Math.max(1, width * height)))
  const pixelWidth = Math.round(width * ratio)
  const pixelHeight = Math.round(height * ratio)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  if (!width || !height || !data.some(value => value > 0)) return
  const theme = getComputedStyle(document.documentElement)
  const color = desktop && !preview ? '#ffffff' : theme.getPropertyValue('--color-primary').trim() || '#4daf7c'
  context.save()
  context.fillStyle = context.strokeStyle = color
  context.globalAlpha = preview ? 0.8 : desktop ? 0.22 : 0.19
  context.lineCap = 'round'
  context.lineJoin = 'round'
  const scale = preview ? 0.9 : desktop ? 0.8 : 0.65
  switch (normalizeStyle(options.style)) {
    case 'spectrum': {
      const barWidth = width / 128 * 2.5
      for (let i = 0; i < data.length && i * barWidth < width; i++) {
        const barHeight = data[i] / 255 * height * scale * 0.65
        context.fillRect(i * barWidth, height - barHeight, barWidth, barHeight)
      }
      break
    }
    case 'wave': {
      const values = bands(data, 48)
      for (let layer = 0; layer < 3; layer++) {
        const points = values.map((value, i) => ({
          x: i / (values.length - 1) * width,
          y: height - value * height * scale * (0.45 + layer * 0.13) * (0.8 + 0.2 * Math.sin(time / 800 + i / 6 + layer)),
        }))
        context.beginPath()
        context.moveTo(0, height)
        context.lineTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          const previous = points[i - 1]
          const point = points[i]
          context.quadraticCurveTo(previous.x, previous.y, (previous.x + point.x) / 2, (previous.y + point.y) / 2)
        }
        context.lineTo(width, points[points.length - 1].y)
        context.stroke()
        context.lineTo(width, height)
        context.closePath()
        context.save()
        context.globalAlpha *= 0.22
        context.fill()
        context.restore()
      }
      break
    }
  }
  context.restore()
}
