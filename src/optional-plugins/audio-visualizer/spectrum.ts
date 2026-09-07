export const drawSpectrum = (canvas: HTMLCanvasElement, data: Uint8Array, desktop = false) => {
  const context = canvas.getContext('2d')
  if (!context) return
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  if (!data.length || !width || !height) return
  context.fillStyle = desktop ? 'rgba(255,255,255,.12)' : getComputedStyle(document.documentElement).getPropertyValue('--color-primary-light-200-alpha-800').trim()
  const preferred = width / 128 * 2.5
  const diff = preferred - width / 86
  const barWidth = diff > 32 ? width / 128 : diff > 12 ? width / 86 : preferred
  let average = 0
  for (let i = 20; i < Math.min(111, data.length); i++) average += data[i]
  average = average / data.length / 255 * (desktop ? 2.24 : 1.68)
  for (let i = 0; i < data.length && i * barWidth < width; i++) {
    const barHeight = data[i] * (average + 0.42) * height * (desktop ? 0.46 : 0.4) / 255
    context.fillRect(i * barWidth, height - barHeight, barWidth, barHeight)
  }
}
