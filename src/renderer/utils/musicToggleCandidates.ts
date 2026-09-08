interface MusicIdentity {
  id: string
  name?: string | null
  singer?: string | null
  interval?: string | null
  meta?: { albumName?: string }
}

const normalize = (value?: string) => (value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '')
const singers = (value?: string | null) => (value ?? '').split(/[、&,，;；/|]/).map(normalize).filter(Boolean)
const title = (value?: string | null) => normalize((value ?? '')
  .replace(/[（([]\s*(?:feat\.?|ft\.?|featuring)\s+[^)）\]]*[)）\]]/gi, '')
  .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.+$/gi, ''))
const duration = (value?: string | null): number | undefined => {
  if (!value || !/^\d+(?::\d{1,2}){1,2}$/.test(value)) return
  const parts = value.split(':').map(Number)
  if (parts.slice(1).some(part => part >= 60)) return
  const seconds = parts.reduce((total, part) => total * 60 + part, 0)
  return seconds > 0 ? seconds : undefined
}

export const musicMatchScore = (original: MusicIdentity, candidate: MusicIdentity) => {
  const originalTitle = title(original.name)
  if (!originalTitle || originalTitle !== title(candidate.name)) return 0
  const originalSingers = singers(original.singer)
  const candidateSingers = singers(candidate.singer)
  const hasSingers = originalSingers.length > 0 && candidateSingers.length > 0
  if (hasSingers && !originalSingers.some(singer => candidateSingers.includes(singer))) return 0
  const originalDuration = duration(original.interval)
  const candidateDuration = duration(candidate.interval)
  const hasDuration = originalDuration != null && candidateDuration != null
  if (hasDuration && Math.abs(originalDuration - candidateDuration) > 5) return 0
  const album = normalize(original.meta?.albumName)
  const sameAlbum = !!album && album === normalize(candidate.meta?.albumName)
  // A title alone cannot distinguish covers when the artist is missing.
  if (!hasSingers && !hasDuration && !sameAlbum) return 0
  return 100 + (hasSingers ? 20 : 0) + (hasDuration ? 10 : 0) + (sameAlbum ? 5 : 0)
}

export const rankMusicToggleCandidates = <T extends MusicIdentity>(original: MusicIdentity, results: Array<{ source: string, list: T[] }>, onlyMatches: boolean) => {
  return results.map(result => {
    const seen = new Set<string>()
    const ranked = result.list.filter(song => {
      if (song.id === original.id || seen.has(song.id)) return false
      seen.add(song.id)
      return true
    }).map(song => ({ song, score: musicMatchScore(original, song) }))
      .filter(item => !onlyMatches || item.score > 0)
      .sort((left, right) => right.score - left.score)
    return { source: result.source, list: ranked.map(item => item.song), score: ranked[0]?.score ?? 0 }
  }).filter(result => result.list.length).sort((left, right) => right.score - left.score)
}
