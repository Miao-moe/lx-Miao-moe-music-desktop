import { requestMsg } from '../message'

export const assertSearch = (condition) => {
  if (!condition) throw new Error('Invalid search response')
}

export const readSearchBody = (response) => {
  const status = Number(response?.statusCode)
  if (!(status >= 200 && status < 300)) {
    const error = new Error(`Search HTTP ${Number.isFinite(status) ? status : '?'}`)
    // Do not bypass a server's explicit backoff by immediately trying another route.
    error.stopSearchFallback = status == 429
    throw error
  }
  return response.body
}

export const searchResult = (source, list, total, page, limit, extra = {}) => {
  assertSearch((typeof total == 'number' || (typeof total == 'string' && /^\d+$/.test(total))) && Number.isSafeInteger(Number(total)) && Number(total) >= 0)
  assertSearch(Array.isArray(list) && (list.length > 0 || (page - 1) * limit >= Number(total)))
  assertSearch(list.every(song => song?.source === source && song.songmid != null && song.songmid !== '' && typeof song.name == 'string' && song.name.length))
  return { ...extra, source, list, total: Number(total), limit, allPage: Math.ceil(Number(total) / limit) }
}

export const isSearchStopped = error => error?.message == requestMsg.cancelRequest || error?.searchDetails?.kind == 'cancelled' ||
  error?.stopSearchFallback || error?.retryAfterMs > 5000 || error?.searchDetails?.httpStatus == 429

// One chain per query/page. Keep the selected route while paging: providers can
// rank the same songs differently, so switching halfway would skip/repeat songs.
export const withSearchFallback = (primary, fallbacks) => {
  const routes = [primary, ...fallbacks]
  const pending = new Map()
  const sessions = new Map()
  return function(str, page = 1, limit = this.limit) {
    if (limit == null) limit = this.limit
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) return Promise.reject(new Error('Invalid search pagination'))
    const queryKey = JSON.stringify([str, limit])
    const key = JSON.stringify([str, page, limit])
    if (pending.has(key)) return pending.get(key)
    let session = sessions.get(queryKey)
    if (!session || page == 1) {
      session = { route: null }
      sessions.delete(queryKey)
      sessions.set(queryKey, session)
      if (sessions.size > 30) sessions.delete(sessions.keys().next().value)
    }
    const task = (async() => {
      // A quick page change must wait for page one to choose a route.
      if (page > 1) await pending.get(JSON.stringify([str, 1, limit]))
      const start = session.route ?? 0
      const end = session.route == null ? routes.length : start + 1
      let failure
      for (let index = start; index < end; index++) {
        try {
          const result = await routes[index].call(this, str, page, limit)
          const checked = searchResult(result.source, result.list, result.total, page, limit, result)
          session.route = index
          this.total = checked.total
          this.page = page
          this.allPage = checked.allPage
          return checked
        } catch (error) {
          if (isSearchStopped(error)) throw error
          failure = error
          // Route indices only; never log query text, signed URLs or response bodies.
          if (index + 1 < end) console.warn('[SearchFallback]', index, '->', index + 1)
        }
      }
      throw failure
    })()
    pending.set(key, task)
    const clear = () => { if (pending.get(key) === task) pending.delete(key) }
    task.then(clear, clear)
    return task
  }
}
