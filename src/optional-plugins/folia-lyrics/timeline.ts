import type { FoliaLine, FoliaSong } from './protocol'

interface RawLine { time: number, text: string, extendedLyrics: string[] }
export const buildTimeline = (raw: RawLine[], duration: number): FoliaLine[] => {
  const lines = raw.filter(line => Number.isFinite(line.time) && line.time >= 0 && typeof line.text === 'string').sort((a, b) => a.time - b.time)
  return lines.map((line, index) => {
    const startTime = line.time / 1000
    const words = [...line.text.matchAll(/<(\d+),(\d+)>([^<]*)/g)].map(match => ({
      text: match[3], startTime: startTime + Number(match[1]) / 1000, endTime: startTime + (Number(match[1]) + Number(match[2])) / 1000,
    }))
    const fullText = words.length ? words.map(word => word.text).join('') : line.text
    // Plain LRC supplies line timing only; preserve it instead of inventing word timestamps.
    const endTime = words.length ? Math.max(startTime + 0.001, ...words.map(word => word.endTime)) : Math.max(startTime + 0.001, lines[index + 1]?.time / 1000 || (duration > startTime ? duration : startTime + 5))
    return { id: `${line.time}-${index}`, fullText, startTime, endTime, words: words.length ? words : [{ text: fullText, startTime, endTime }], translation: line.extendedLyrics?.join('\n') || undefined }
  }).filter(line => line.fullText.trim())
}

const demoText = ['晚风轻轻 掠过海面', '把日落 留在你身边', '沿着光 慢慢向前', '听见远处 潮声绵延', '让这一刻 缓缓浮现', '每一次切换 都自然一点']
export const demoSong: FoliaSong = {
  id: 'folia-preview',
  title: '晚风与海',
  artist: 'LX-M',
  album: 'Folia',
  coverUrl: '',
  duration: demoText.length * 4,
  lines: demoText.map((fullText, index) => ({
    id: `preview-${index}`,
    fullText,
    startTime: index * 4,
    endTime: index * 4 + 3.5,
    words: Array.from(fullText).map((text, word) => ({ text, startTime: index * 4 + word * 3.5 / fullText.length, endTime: index * 4 + (word + 1) * 3.5 / fullText.length })),
  })),
}
