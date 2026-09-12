import { httpFetch } from '../../request'
import { assertSearch, readSearchBody, searchResult } from '../searchFallback'

const plain = value => String(value ?? '').replace(/<\/?em>/gi, '')
const normalizeSong = item => ({
  Audioid: item.audio_id,
  MixSongID: item.album_audio_id,
  FileHash: item.hash,
  FileSize: Number(item.filesize) || 0,
  HQFileHash: item['320hash'],
  HQFileSize: Number(item['320filesize']) || 0,
  SQFileHash: item.sqhash,
  SQFileSize: Number(item.sqfilesize) || 0,
  ResFileHash: item.reshash,
  ResFileSize: Number(item.resfilesize) || 0,
  SongName: plain(item.songname_original || item.songname),
  Singers: plain(item.singername).split('、').map(name => ({ name })),
  AlbumName: plain(item.album_name),
  AlbumID: item.album_id,
  Duration: Number(item.duration) || 0,
  Grp: [],
})

const mobileSearch = async function(str, page, limit, cdn) {
  const params = new URLSearchParams(cdn
    ? { format: 'json', keyword: str, page, pagesize: limit, showtype: 1 }
    : { keyword: str, page, pagesize: limit, version: 9108, plat: 0, sver: 2, iscorrection: 1, with_res_tag: 1, highlight: 'em' })
  const endpoint = cdn ? 'http://mobilecdn.kugou.com' : 'https://msearch.kugou.com'
  let body = readSearchBody(await httpFetch(`${endpoint}/api/v3/search/song?${params}`, {
    headers: { Referer: 'https://www.kugou.com/' },
  }).promise)
  if (typeof body == 'string') body = JSON.parse(body.trim().replace(/^<!--KG_TAG_RES_START-->/, '').replace(/<!--KG_TAG_RES_END-->$/, ''))
  assertSearch(body?.status == 1 && body?.errcode == 0 && Array.isArray(body?.data?.info))
  const songs = body.data.info.map(item => {
    assertSearch(item.audio_id && item.hash && (item.songname_original || item.songname))
    return normalizeSong(item)
  })
  return searchResult('kg', this.handleResult(songs), body.data.total, page, limit)
}

export function msearch(str, page, limit) { return mobileSearch.call(this, str, page, limit, false) }
export function mobilecdnSearch(str, page, limit) { return mobileSearch.call(this, str, page, limit, true) }
