import { httpFetch } from '../../request'
import { assertSearch, readSearchBody, searchResult } from '../searchFallback'

const pageSize = 20
const normalizeSong = (item, legacy) => {
  assertSearch(item && (legacy ? item.id : item.songId) && item.copyrightId && (legacy ? item.name : item.songName))
  return legacy ? {
    ...item,
    songId: item.id,
    singerList: item.singers ?? [],
    album: item.albums?.[0]?.name ?? '',
    albumId: item.albums?.[0]?.id ?? '',
    img3: item.imgItems?.[0]?.img ?? null,
    lrcUrl: item.lyricUrl,
    audioFormats: (item.newRateFormats ?? []).map(format => ({
      ...format,
      formatType: format.formatType == 'ZQ' ? 'ZQ24' : format.formatType,
      asize: format.size ?? format.androidSize,
    })),
  } : { ...item, name: item.songName, mrcurl: item.mrcUrl ?? item.mrcurl }
}

const fetchPage = async(str, page, legacy) => {
  const params = new URLSearchParams({ text: str, pageNo: page, pageSize })
  if (legacy) {
    params.set('ua', 'Android_migu')
    params.set('version', '5.0.1')
    params.set('searchSwitch', JSON.stringify({ song: 1, album: 0, singer: 0, tagSong: 0, mvSong: 0, songlist: 0, bestShow: 1 }))
  }
  const endpoint = legacy
    ? 'https://pd.musicapp.migu.cn/MIGUM3.0/v1.0/content/search_all.do'
    : 'https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0'
  const body = readSearchBody(await httpFetch(`${endpoint}?${params}`).promise)
  if (!legacy) {
    assertSearch(Array.isArray(body))
    return { songs: body }
  }
  assertSearch(body?.code == '000000' && Array.isArray(body?.songResultData?.result))
  const total = body.songResultData.totalCount
  assertSearch(total != null && total !== '' && Number.isSafeInteger(Number(total)) && Number(total) >= 0)
  return { songs: body.songResultData.result, total: Number(total) }
}

const pagedSearch = async function(str, page, limit, legacy) {
  const offset = (page - 1) * limit
  const end = offset + limit
  const firstPage = Math.floor(offset / pageSize) + 1
  // The PC response has no total. Read ahead only far enough to establish a
  // next page from real results, instead of inventing a fixed total like 1000.
  const lastPage = legacy ? Math.ceil(end / pageSize) : Math.floor(end / pageSize) + 1
  const songs = []
  let total = 0
  let totalIsExact = legacy
  for (let physicalPage = firstPage; physicalPage <= lastPage; physicalPage++) {
    const result = await fetchPage(str, physicalPage, legacy)
    assertSearch(result.songs.length <= pageSize)
    const batchOffset = (physicalPage - 1) * pageSize
    total = legacy ? result.total : batchOffset + result.songs.length
    assertSearch(result.songs.length || batchOffset >= total)
    if (legacy) assertSearch(result.songs.length == pageSize || batchOffset + result.songs.length >= total)
    songs.push(...result.songs)
    if (result.songs.length < pageSize || (legacy && batchOffset + result.songs.length >= total)) {
      totalIsExact = true
      break
    }
  }
  const start = offset % pageSize
  const selected = songs.slice(start, start + limit).map(item => normalizeSong(item, legacy))
  return searchResult('mg', this.filterData([selected]), total, page, limit, { totalIsExact })
}

export function legacySearch(str, page, limit) { return pagedSearch.call(this, str, page, limit, true) }
export function pcSearch(str, page, limit) { return pagedSearch.call(this, str, page, limit, false) }
