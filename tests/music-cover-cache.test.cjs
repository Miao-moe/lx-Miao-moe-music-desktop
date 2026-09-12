const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/renderer/utils/musicCover.js'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const playerCompiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/renderer/core/music/utils.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const song = { id: 'song', source: 'wy', meta: {} }
const url = 'https://example.com/artwork.jpg'
function storage() {
  const saved = new Map()
  const listeners = []
  let generation = 0
  return {
    saved,
    artworkCacheGeneration: () => generation,
    onArtworkCacheCleared: listener => listeners.push(listener),
    readArtworkCache: async key => saved.get(key),
    writeArtworkCache: async(key, value, version) => { if (generation === version) saved.set(key, value) },
    clear: () => { generation++; saved.clear(); listeners.forEach(listener => listener()) },
  }
}
function fixture(disk, getPic) {
  const exports = {}
  const modules = {
    '@renderer/utils/musicSdk': { default: { wy: { getPic } } },
    '@renderer/store': { userApi: { apis: {} } },
    '@renderer/utils': { toOldMusicInfo: value => value },
    '@common/utils/vueTools': { reactive: value => value },
    './artworkStorage': disk,
  }
  vm.runInNewContext(compiled, { exports, require: name => { assert.ok(name in modules, name); return modules[name] } })
  return exports
}
function playerFixture(cover, getPic) {
  const exports = {}
  const modules = {
    '@renderer/store': { qualityList: [] },
    '@renderer/store/utils': {},
    '@renderer/utils/musicSdk': { default: { wy: { getPic } } },
    '@renderer/utils/musicCover': cover,
    '@renderer/utils/ipc': {},
    '@renderer/store/setting': { appSetting: {} },
    '@renderer/utils': { toOldMusicInfo: value => value },
    '@renderer/utils/message': { requestMsg: {} },
    '@renderer/utils/musicSdk/api-source': { apis: {} },
  }
  vm.runInNewContext(playerCompiled, { exports, require: name => { assert.ok(name in modules, name); return modules[name] } })
  return exports
}

test('resolved source URLs persist and bypass the API in a new renderer', async() => {
  const disk = storage()
  let calls = 0
  const first = fixture(disk, async() => { calls++; return url })
  const results = await Promise.all([first.getMusicCoverUrl(song), first.getMusicCoverUrl(song)])
  assert.deepEqual(results, [url, url])
  assert.equal(calls, 1)
  assert.equal(disk.saved.get('source:wy__song'), url)
  assert.equal(first.getCachedCoverUrl(song), url)
  const restarted = fixture(disk, () => { calls++; throw new Error('offline') })
  assert.equal(await restarted.getMusicCoverUrl(song), url)
  assert.equal(restarted.getCachedCoverUrl(song), url)
  assert.equal(calls, 1)
})

test('failed lookups do not poison the persistent cache', async() => {
  const disk = storage()
  const offline = fixture(disk, () => { throw new Error('offline') })
  assert.equal(await offline.getMusicCoverUrl(song), '')
  assert.equal(disk.saved.size, 0)
  const restarted = fixture(disk, async() => url)
  assert.equal(await restarted.getMusicCoverUrl(song), url)
})

test('clearing artwork during an API request does not repopulate old caches', async() => {
  const disk = storage()
  let fulfill
  const cover = fixture(disk, () => new Promise(resolve => { fulfill = resolve }))
  const pending = cover.getMusicCoverUrl(song)
  await new Promise(setImmediate)
  disk.clear()
  fulfill(url)
  assert.equal(await pending, url)
  assert.equal(disk.saved.size, 0)
  assert.equal(cover.getCachedCoverUrl(song), '')
})

test('a download wrapper shares its underlying song cover cache', async() => {
  const disk = storage()
  let calls = 0
  const cover = fixture(disk, async() => { calls++; return url })
  assert.equal(await cover.getMusicCoverUrl({ id: 'download-id', metadata: { musicInfo: song } }), url)
  assert.equal(await cover.getMusicCoverUrl(song), url)
  assert.equal(cover.getCachedCoverUrl({ id: 'download-id', metadata: { musicInfo: song } }), url)
  assert.equal(calls, 1)
})

test('list and player source lookups share both in-flight and completed requests', async() => {
  let calls = 0
  let fulfill
  const getPic = () => { calls++; return new Promise(resolve => { fulfill = resolve }) }
  const cover = fixture(storage(), getPic)
  const player = playerFixture(cover, getPic)
  const options = { musicInfo: song, isRefresh: false, allowToggleSource: false, onToggleSource: () => {} }
  const row = cover.getMusicCoverUrl(song)
  const playback = player.handleGetOnlinePicUrl(options)
  await new Promise(setImmediate)
  assert.equal(calls, 1)
  fulfill(url)
  assert.equal(await row, url)
  assert.equal((await playback).url, url)
  assert.equal((await player.handleGetOnlinePicUrl({ ...options, musicInfo: { ...song, meta: {} } })).url, url)
  assert.equal(calls, 1)
})

test('an explicit player refresh can bypass the shared address cache', async() => {
  let calls = 0
  const getPic = async() => `${url}?version=${++calls}`
  const cover = fixture(storage(), getPic)
  const player = playerFixture(cover, getPic)
  await cover.getMusicCoverUrl(song)
  const result = await player.handleGetOnlinePicUrl({ musicInfo: song, isRefresh: true, allowToggleSource: false, onToggleSource: () => {} })
  assert.equal(result.url, url + '?version=2')
  assert.equal(calls, 2)
})

test('a failed list lookup can recover when playback retries in the same renderer', async() => {
  let calls = 0
  const getPic = async() => {
    if (++calls === 1) throw new Error('temporary failure')
    return url
  }
  const cover = fixture(storage(), getPic)
  const player = playerFixture(cover, getPic)
  assert.equal(await cover.getMusicCoverUrl(song), '')
  const result = await player.handleGetOnlinePicUrl({ musicInfo: song, isRefresh: false, allowToggleSource: false, onToggleSource: () => {} })
  assert.equal(result.url, url)
  assert.equal(calls, 2)
})
