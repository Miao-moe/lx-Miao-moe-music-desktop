import { assertSearch, readSearchBody, searchResult } from '../searchFallback'
import { eapiRequest, weapiRequest } from './utils/index'
import musicDetail from './musicDetail'

export async function cloudSearch(str, page, limit) {
  const body = readSearchBody(await eapiRequest('/api/cloudsearch/pc', {
    s: str, type: 1, limit, offset: (page - 1) * limit, total: page == 1,
  }).promise)
  assertSearch(body?.code == 200 && body.result && (Array.isArray(body.result.songs) || body.result.songCount === 0))
  const songs = (body.result.songs ?? []).map(item => ({ baseInfo: { simpleSongData: item } }))
  return searchResult('wy', this.handleResult(songs), body.result.songCount, page, limit)
}

export async function suggestionSearch(str, page, limit) {
  if (page > 1) return searchResult('wy', [], 0, page, limit, { limited: true })
  const body = readSearchBody(await weapiRequest('/search/suggest/web', { s: str }).promise)
  assertSearch(body?.code == 200 && body.result && typeof body.result == 'object')
  assertSearch(body.result.songs == null || Array.isArray(body.result.songs))
  const ids = [...new Set((body.result.songs ?? []).map(song => song.id).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, Math.min(limit, 10))
  if (!ids.length) return searchResult('wy', [], 0, page, limit, { limited: true })
  const details = await musicDetail.getList(ids)
  const byId = new Map(details.list.map(song => [song.songmid, song]))
  const list = ids.map(id => byId.get(id)).filter(Boolean)
  assertSearch(list.length)
  return searchResult('wy', list, list.length, page, limit, { limited: true })
}
