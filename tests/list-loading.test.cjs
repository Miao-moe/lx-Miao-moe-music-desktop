const assert = require('node:assert/strict')
const { test } = require('node:test')
global.window = { i18n: { t: key => key } }
const platforms = ['kw', 'kg', 'tx', 'wy', 'mg']
const flush = () => new Promise(resolve => setImmediate(resolve))

function fixture(kind, mode = 'immediate') {
  const calls = []
  const info = () => ({ list: [], key: null, page: 1, maxPage: 0, total: 0, limit: 30, noItemLabel: '' })
  const listInfos = Object.fromEntries([...platforms, 'all'].map(source => [source, info()]))
  const entity = kind === 'singer' || kind === 'album'
  const music = Object.fromEntries(platforms.map(source => {
    const search = (...args) => new Promise((resolve, reject) => calls.push({
      source, text: args[entity ? 1 : 0], reject,
      finish: (ids = []) => resolve({ source, allPage: 1, total: ids.length, limit: 30,
        list: ids.map(id => ({ id, source, name: id, author: 'Fixture', singer: 'Fixture', meta: { albumName: 'Fixture' } })) }),
    }))
    return [source, { musicSearch: { search }, songList: { search }, entitySearch: { search } }]
  }))
  const load = require('./helpers/load-typescript.cjs')({
    '@common/utils/vueTools': { markRaw: value => value, markRawList: value => value },
    '@renderer/store/setting': { appSetting: { 'list.loadingMode': mode } },
    '@renderer/utils/musicSdk': music,
    '@renderer/utils': { deduplicationList: list => [...new Map(list.map(item => [item.id, item])).values()], toNewMusicInfo: value => value },
    '@common/utils/common': { sortInsert: (list, item) => list.push(item), similar: () => 1 },
    './state': { sources: [...platforms, 'all'], maxPages: {}, listInfos: entity ? { [kind]: listInfos } : listInfos },
  })
  const store = load(`src/renderer/store/search/${entity ? 'entity' : kind}/action.ts`)
  return { calls, list: listInfos.all, search: text => entity ? store.search(kind, text, 1, 'all') : store.search(text, 1, 'all') }
}

for (const kind of ['music', 'songlist', 'singer', 'album']) {
  test(`${kind}: immediate mode publishes each platform while slower or failed requests remain pending`, async() => {
    const f = fixture(kind)
    let finished = false
    const search = f.search('query').then(() => { finished = true })
    await flush()
    assert.equal(f.list.list.length, 0)
    assert.equal(f.list.noItemLabel, 'list__loading')
    f.calls[0].finish([])
    await flush()
    assert.equal(f.list.noItemLabel, 'list__loading', 'One empty platform must not prematurely show an empty result')
    f.calls[1].finish(['first'])
    await flush()
    assert.deepEqual(f.list.list.map(item => item.id), ['first'])
    assert.equal(finished, false)
    f.calls[2].finish(['second'])
    await flush()
    assert.deepEqual(new Set(f.list.list.map(item => item.id)), new Set(['first', 'second']))
    assert.equal(f.list.noItemLabel, 'list__loading')
    f.calls[3].reject(Error('provider unavailable'))
    f.calls[4].finish([])
    await search
    assert.deepEqual(new Set(f.list.list.map(item => item.id)), new Set(['first', 'second']))
    assert.equal(f.list.noItemLabel, '')
  })

  test(`${kind}: existing modes still wait for all platform data`, async() => {
    for (const mode of ['together', 'progressive']) {
      const f = fixture(kind, mode)
      const search = f.search('query')
      await flush()
      f.calls[0].finish(['first'])
      await flush()
      assert.equal(f.list.list.length, 0)
      assert.equal(f.list.noItemLabel, 'list__loading')
      for (const call of f.calls.slice(1)) call.finish([])
      await search
      assert.deepEqual(f.list.list.map(item => item.id), ['first'])
    }
  })

  test(`${kind}: replacing or clearing a query rejects stale batches even after returning to the same keyword`, async() => {
    const f = fixture(kind)
    const first = f.search('A')
    await flush()
    f.calls[0].finish(['old-first'])
    await flush()
    assert.equal(f.list.list.length, 1)
    const middle = f.search('B')
    await flush()
    const latest = f.search('A')
    await flush()
    assert.equal(f.list.list.length, 0)
    f.calls[10].finish(['latest'])
    for (const call of f.calls.slice(11)) call.finish([])
    await latest
    for (const call of f.calls.slice(1, 10)) call.finish(['stale-' + call.source])
    await Promise.all([first, middle])
    assert.deepEqual(f.list.list.map(item => item.id), ['latest'])
    const pending = f.search('pending')
    await flush()
    await f.search('')
    for (const call of f.calls.slice(15)) call.finish(['discarded'])
    await pending
    assert.equal(f.list.list.length, 0)
    assert.equal(f.list.noItemLabel, '')
    const empty = f.search('empty')
    await flush()
    for (const call of f.calls.slice(20)) call.finish([])
    await empty
    assert.equal(f.list.noItemLabel, 'no_item')
  })
}
