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
    case 'bars': {
      const count = Math.max(12, Math.min(64, Math.floor(width / 14)))
      const values = bands(data, count)
      const step = width / count
      const gap = Math.max(2, step * 0.24)
      values.forEach((value, index) => {
        if (!value) return
        const h = value * height * scale * 0.8
        context.fillRect(index * step + gap / 2, height - h, step - gap, h)
        context.fillRect(index * step + gap / 2, height - h - 4, step - gap, 2)
      })
      break
    }
    case 'mirror': {
      const count = Math.max(16, Math.min(64, Math.floor(width / 12)))
      const values = bands(data, Math.ceil(count / 2))
      const step = width / count
      const center = height * (preview ? 0.5 : 0.7)
      for (let i = 0; i < count; i++) {
        const value = values[Math.min(values.length - 1, Math.abs(i - Math.floor(count / 2)))]
        const h = value * height * (preview ? 0.38 : 0.25)
        context.fillRect(i * step + 1, center - h, Math.max(1, step - 3), h * 2)
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
    case 'ring': {
      const values = bands(data, 32)
      const radius = Math.min(width * 0.2, height * (preview ? 0.24 : 0.17))
      const cx = width / 2
      const cy = height * (preview || desktop ? 0.5 : 0.7)
      context.lineWidth = Math.max(1, Math.min(3, radius / 25))
      context.beginPath()
      context.arc(cx, cy, radius, 0, Math.PI * 2)
      context.stroke()
      for (let i = 0; i < 64; i++) {
        const value = values[i < 32 ? i : 63 - i]
        const angle = i / 64 * Math.PI * 2 - Math.PI / 2 + Math.sin(time / 3000) * 0.08
        const outer = radius + value * radius * 0.8
        context.beginPath()
        context.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
        context.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
        context.stroke()
      }
      break
    }
    case 'particles': {
      const count = Math.max(18, Math.min(72, Math.round(width / 10)))
      const values = bands(data, count)
      values.forEach((value, index) => {
        if (!value) return
        const x = ((index * 0.61803398875) % 1) * width
        const drift = (time / 7000 + index * 0.37) % 1
        const y = height * (1 - (0.12 + drift * 0.75) * value * (preview ? 1.4 : 1))
        const r = Math.max(1, Math.min(4, height / 70)) * (0.5 + value)
        context.save()
        context.globalAlpha *= 0.35 + value * 0.65
        context.beginPath()
        context.arc(x, y, r, 0, Math.PI * 2)
        context.fill()
        context.restore()
      })
      break
    }
  }
  context.restore()
}
