import { artworkCacheGeneration, onArtworkCacheCleared, readArtworkCache, writeArtworkCache } from './artworkStorage'
import { getCoverThumbnail } from './coverThumbnail'

interface CachedImage { src: string, bytes: number, users: number, retired: boolean }
const images = new Map<string, CachedImage>()
const pending = new Map<string, Promise<CachedImage>>()
const queue: Array<() => void> = []
let active = 0
const MAX_MEMORY_BYTES = 32 * 1024 * 1024
const MAX_MEMORY_ENTRIES = 256

const trimMemory = () => {
  let bytes = [...images.values()].reduce((total, image) => total + image.bytes, 0)
  for (const [key, image] of images) {
    if (images.size <= MAX_MEMORY_ENTRIES && bytes <= MAX_MEMORY_BYTES) break
    if (image.users || pending.has(key)) continue
    images.delete(key)
    bytes -= image.bytes
    URL.revokeObjectURL(image.src)
  }
}

onArtworkCacheCleared(() => {
  for (const image of images.values()) {
    image.retired = true
    if (!image.users) URL.revokeObjectURL(image.src)
  }
  images.clear()
  pending.clear()
})

const download = async(url: string): Promise<Blob> => {
  await new Promise<void>(resolve => {
    const start = () => { active++; resolve() }
    if (active < 6) start()
    else queue.push(start)
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => { controller.abort() }, 12000)
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'include' })
    if (!response.ok) throw new Error(`Artwork HTTP ${response.status}`)
    return await response.blob()
  } finally {
    clearTimeout(timeout)
    active--
    queue.shift()?.()
  }
}

const load = async(url: string, fallbackUrl?: string): Promise<CachedImage> => {
  const generation = artworkCacheGeneration()
  const key = `image:${url}`
  let cached = await readArtworkCache<Blob>(key)
  const candidates = [...new Set([url, fallbackUrl].filter(Boolean))] as string[]
  for (let index = 0; index < candidates.length; index++) {
    let src = ''
    try {
      const blob = cached ?? await download(candidates[index])
      src = URL.createObjectURL(blob)
      // Decode before persisting: a 200 response can still contain an error page.
      const decoded = new Image()
      decoded.src = src
      await decoded.decode()
      // A working original also satisfies this thumbnail key, avoiding another
      // failed thumbnail request every time the playlist is opened.
      if (!cached) await writeArtworkCache(key, blob, generation)
      const image = { src, bytes: blob.size, users: 0, retired: generation !== artworkCacheGeneration() }
      if (!image.retired) images.set(url, image)
      return image
    } catch (error) {
      if (src) URL.revokeObjectURL(src)
      if (cached) {
        cached = undefined
        index-- // A damaged disk entry should be replaced by a fresh download.
        continue
      }
      if (index === candidates.length - 1) throw error
    }
  }
  throw new Error('No artwork URL')
}

const getImage = async(url: string, fallbackUrl?: string) => {
  const image = images.get(url)
  if (image) return image
  let task = pending.get(url)
  if (!task) {
    task = load(url, fallbackUrl)
    pending.set(url, task)
  }
  try {
    return await task
  } finally {
    if (pending.get(url) === task) pending.delete(url)
  }
}

// Each mounted image leases its URL. Eviction never revokes an image still on screen.
const leaseImage = (url: string, image: CachedImage) => {
  image.users++
  if (!image.retired) {
    images.delete(url)
    images.set(url, image)
  }
  trimMemory()
  let released = false
  return {
    src: image.src,
    release: () => {
      if (released) return
      released = true
      image.users--
      if (image.retired && !image.users) URL.revokeObjectURL(image.src)
      trimMemory()
    },
  }
}

export const acquireCover = async(url: string, fallbackUrl?: string) => {
  if (!/^https?:\/\//i.test(url)) return { src: url, release: () => {} }
  return leaseImage(url, await getImage(url, fallbackUrl))
}

// Song rows and every player surface use the same detail-sized artwork. Display
// dimensions must not produce separate downloads or enlarge a tiny list thumbnail.
const musicCoverUrl = (url: string) => getCoverThumbnail(url, 640)
export const acquireMusicCover = async(url: string) => acquireCover(musicCoverUrl(url), url)
export const acquireCachedMusicCover = (url: string) => {
  if (!/^https?:\/\//i.test(url)) return { src: url, release: () => {} }
  const key = musicCoverUrl(url)
  const image = images.get(key)
  return image ? leaseImage(key, image) : undefined
}
