import { createUserList, overwriteListMusics, updateUserList } from '@renderer/store/list/action'
import { userLists } from '@renderer/store/list/listManage/state'
import { COOKIE_SOURCES, SOURCE_NAME, getCookie, hasCookie, isCookieRecognized, isFavListSyncEnabled, type CookieSource } from './cookieManager'
import { getRemotePlaylists, getRemoteSongs, type RemotePlaylist, type CookieSyncResult, type CookieSyncDetail } from './cookiePlaylistApi'
import { refreshBoundPlaylist } from './playlistWriteback'
export { checkCookiePlaylists } from './cookiePlaylistApi'
export type { RemotePlaylist, CookieSyncResult, CookieSyncDetail, CookiePlaylistCheck } from './cookiePlaylistApi'

let syncTask: Promise<CookieSyncResult> | null = null
const buildSyncListId = (source: CookieSource, remoteId: string) => `userlist_${source}_sync_${remoteId}`
const findSyncedList = (source: CookieSource, remoteId: string) => userLists.find(list => list.id === buildSyncListId(source, remoteId))
const syncOnePlaylist = async(source: CookieSource, playlist: RemotePlaylist, songs: LX.Music.MusicInfo[]) => {
  const validSongs = songs.filter(s => s?.id)
  const id = buildSyncListId(source, playlist.id)
  const name = `${SOURCE_NAME[source]} - ${playlist.name}`
  const localList = findSyncedList(source, playlist.id)
  if (localList) {
    if (localList.name !== name || localList.source !== source || localList.sourceListId !== playlist.id) {
      await updateUserList([{ ...localList, name, source, sourceListId: playlist.id }], true)
    }
    await overwriteListMusics({ listId: id, musicInfos: validSongs }, true)
  } else {
    await createUserList({ id, name, source, sourceListId: playlist.id, list: validSongs }, true)
  }
}

const syncSource = async(source: CookieSource, cookie: string, captured?: RemotePlaylist[]): Promise<{ listCount: number, count: number, failed: number, total: number }> => {
  const playlists = await getRemotePlaylists(source, cookie, captured)
  let listCount = 0
  let count = 0
  let failed = 0
  for (const playlist of playlists) {
    try {
      let songs: LX.Music.MusicInfo[] = []
      await refreshBoundPlaylist(buildSyncListId(source, playlist.id), async() => getRemoteSongs(source, cookie, playlist), async result => {
        songs = result
        await syncOnePlaylist(source, playlist, songs)
      })
      listCount++
      count += songs.length
    } catch (err) {
      failed++
      console.warn(`[cookieSync] ${source} playlist "${playlist.name}" sync failed:`, err)
    }
  }
  return { listCount, count, failed, total: playlists.length }
}

let syncChain: Promise<unknown> = Promise.resolve()
const serializeSync = async<T>(fn: () => Promise<T>): Promise<T> => {
  const result = syncChain.then(fn, fn)
  syncChain = result.then(() => undefined, () => undefined)
  return result
}

export const syncCookiePlaylists = async(source: CookieSource, captured?: RemotePlaylist[]): Promise<CookieSyncResult> => {
  const cookie = getCookie(source)
  if (!hasCookie(source) || !isCookieRecognized(source, cookie)) {
    return { synced: false, listCount: 0, count: 0, message: 'cookie_unrecognized' }
  }
  return serializeSync(async() => syncSource(source, cookie, captured))
    .then(({ listCount, count, failed, total }) => ({
      synced: listCount > 0 || total === 0,
      listCount,
      count,
      error: failed > 0,
    }))
    .catch((err: any) => {
      console.warn(`[cookieSync] ${source} sync failed:`, err)
      return { synced: false, listCount: 0, count: 0, error: true, message: err?.message ?? 'sync_failed' }
    })
}

const runAllSync = async(): Promise<CookieSyncResult> => {
  const sources = COOKIE_SOURCES.filter(source => hasCookie(source) && isCookieRecognized(source))
  if (!sources.length) return { synced: false, listCount: 0, count: 0, message: 'no_cookie' }

  let listCount = 0
  let count = 0
  let okSources = 0
  let failedSources = 0
  const details: CookieSyncDetail[] = []
  for (const source of sources) {
    let detail: CookieSyncDetail
    try {
      const result = await syncSource(source, getCookie(source))
      listCount += result.listCount
      count += result.count
      if (result.listCount > 0 || result.total === 0) okSources++
      if (result.failed > 0) failedSources++
      const success = result.failed === 0
      detail = { source, status: success ? 'success' : 'failed', listCount: result.listCount, count: result.count }
    } catch (err) {
      failedSources++
      console.warn(`[cookieSync] ${source} sync failed:`, err)
      detail = { source, status: 'failed', listCount: 0, count: 0 }
    }
    details.push(detail)
  }
  return { synced: okSources > 0, listCount, count, error: failedSources > 0, details }
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const syncAllPlaylists = (): Promise<CookieSyncResult> => {
  if (syncTask) return Promise.resolve({ synced: false, listCount: 0, count: 0, message: 'syncing' })
  syncTask = serializeSync(runAllSync).finally(() => { syncTask = null })
  return syncTask
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const syncWyPlaylists = (): Promise<CookieSyncResult> => syncAllPlaylists()

export const syncCookieListsOnStartup = async(): Promise<void> => {
  if (!isFavListSyncEnabled()) return
  try {
    await syncAllPlaylists()
  } catch (err) {
    console.warn('[cookieSync] startup sync failed:', err)
  }
}
