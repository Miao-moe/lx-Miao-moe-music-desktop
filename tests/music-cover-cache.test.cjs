const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/renderer/utils/musicCover.js'), 'utf8'), {
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
  let resolve
  const cover = fixture(disk, () => new Promise(done => { resolve = done }))
  const pending = cover.getMusicCoverUrl(song)
  await new Promise(setImmediate)
  disk.clear()
  resolve(url)
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
  assert.equal(calls, 1)
})
