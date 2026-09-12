const assert = require('node:assert/strict')
const { test } = require('node:test')
const loadSdk = require('./helpers/load-search-sdk.cjs')
const { mid, titles, songs, response, info } = require('./fixtures/qq-album.cjs')

const fixture = respond => {
  const f = loadSdk(respond)
  return { ...f, album: f.load('musicSdk/tx/album.js').default }
}

test('QQ Jay loads all ten album tracks in album order with playable music identifiers', async() => {
  const f = fixture(() => response(songs()))
  const result = await f.album.getAlbumDetail(mid)
  assert.equal(f.calls.length, 1)
  const call = f.calls[0]
  assert.equal(call.url, 'https://u.y.qq.com/cgi-bin/musicu.fcg')
  assert.equal(call.method, 'POST')
  assert.equal(call.body.req.module, 'music.musichallAlbum.AlbumSongList')
  assert.equal(call.body.req.method, 'GetAlbumSongList')
  assert.deepEqual({ ...call.body.req.param }, { albumMid: mid, albumID: 0, begin: 0, num: 100, order: 2 })
  assert.deepEqual(Array.from(result.list, song => song.name), titles)
  assert.equal(result.total, 10)
  assert.equal(result.source, 'tx')
  const first = result.list[0]
  assert.equal(first.singer, '周杰伦')
  assert.equal(first.albumName, 'Jay')
  assert.equal(first.albumMid, mid)
  assert.equal(first.songmid, 'album-song-0')
  assert.equal(first.strMediaMid, 'album-media-0')
  assert.equal(first.songId, 97750)
  assert.equal(first.songType, 0)
  assert.match(first.img, new RegExp(mid))
  assert.deepEqual(Array.from(first.types, quality => quality.type), ['128k', '320k', 'flac'])
})

test('QQ album pagination preserves the track sequence, total and last partial page', async() => {
  const all = songs()
  const f = fixture(call => {
    const { begin, num } = call.body.req.param
    return response(all.slice(begin, begin + num), all.length)
  })
  for (const page of [2, 4, 5]) {
    const result = await f.album.getAlbumDetail(mid, page, 3)
    assert.equal(result.page, page)
    assert.equal(result.limit, 3)
    assert.equal(result.total, 10)
    assert.deepEqual(Array.from(result.list, song => song.name), titles.slice((page - 1) * 3, page * 3))
  }
})

test('QQ album metadata reads the singername field returned by the official endpoint', async() => {
  const f = fixture(() => info)
  const result = await f.album.getAlbumInfo(mid)
  assert.equal(result.author, '周杰伦')
  assert.equal(result.name, 'Jay')
  assert.equal(result.time, '2000-11-07')
  assert.equal(result.total, 10)
})

test('a valid empty album succeeds, while failed or malformed replies cannot become an empty album', async() => {
  assert.equal((await fixture(() => response([])).album.getAlbumDetail(mid)).total, 0)
  for (const reply of [
    { ...response(songs()), statusCode: 503 },
    { statusCode: 200, body: { code: 1000 } },
    { statusCode: 200, body: { code: 0, req: { code: 2001 } } },
    { statusCode: 200, body: '<html>unavailable</html>' },
    response(null, 10), response([], 10), response(songs(), -1), response(songs(), null),
    response([null], 1), response([{ songInfo: { mid: 'invalid', title: 'Invalid song' } }], 1),
  ]) {
    await assert.rejects(fixture(() => reply).album.getAlbumDetail(mid), /QQ album/)
  }
})

test('invalid pagination is rejected before making an album request', async() => {
  const f = fixture(() => { throw new Error('Unexpected request') })
  for (const [page, limit] of [[0, 100], [1.5, 100], [1, 0], [1, 101]]) {
    await assert.rejects(f.album.getAlbumDetail(mid, page, limit), /pagination/)
  }
  assert.equal(f.calls.length, 0)
})

const loadStore = album => require('./helpers/load-typescript.cjs')({
  '@common/utils/vueTools': { markRaw: value => value, markRawList: value => value },
  '@renderer/utils': { toNewMusicInfo: value => value, deduplicationList: list => [...new Map(list.map(song => [song.songmid, song])).values()] },
  '@renderer/utils/musicSdk': { tx: { album, musicSearch: { search: () => { throw new Error('Unexpected keyword search') } } } },
  './state': { entityDetailInfo: {}, entityProfileInfo: {} },
})('src/renderer/store/entityDetail/action.ts')
const summary = { name: 'Jay', author: '周杰伦', img: '', desc: '', total: 0 }

test('the entity detail flow uses QQ album tracks and collects every page without keyword search', async() => {
  const all = songs(205)
  const f = fixture(call => {
    const { begin, num } = call.body.req.param
    return response(all.slice(begin, begin + num), all.length)
  })
  const store = loadStore(f.album)
  const detail = await store.getEntityDetail('album', mid, 'tx', 1, summary)
  assert.equal(detail.isFallback, false)
  assert.equal(detail.total, 205)
  const list = await store.getEntityDetailAll('album', mid, 'tx', summary)
  assert.equal(list.length, 205)
  assert.deepEqual(Array.from(list, song => song.songmid), all.map(item => item.songInfo.mid))
  assert.deepEqual(f.calls.map(call => call.body.req.param.begin), [0, 100, 200])
})

test('a failed album request can be retried and is not cached as an empty result', async() => {
  let healthy = false
  const f = fixture(() => healthy ? response(songs()) : { statusCode: 503 })
  await assert.rejects(f.album.getAlbumDetail(mid), /HTTP 503/)
  healthy = true
  assert.equal((await f.album.getAlbumDetail(mid)).list.length, 10)
  assert.equal(f.calls.length, 2)
})
