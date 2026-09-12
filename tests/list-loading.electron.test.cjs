const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { test } = require('node:test')
const { launch, route, settled } = require('./helpers/motion-fixture.cjs')

const artwork = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#297c88"/></svg>'
const songs = (prefix, urls) => urls.map((url, i) => ({
  id: `${prefix}-${i}`, source: 'wy', name: `${prefix} song ${i}`, singer: 'Fixture', interval: '03:40',
  meta: { picUrl: url, songId: String(100 + i), albumName: 'Fixture', qualitys: [], _qualitys: {} },
}))
const seedLocal = (page, list) => page.evaluate(list => {
  window.__motionComponents().find(c => c.type.name === 'MusicList' && 'list' in c.setupState).setupState.list = list
}, list)
const ready = page => page.waitForFunction(() => {
  const groups = [...document.querySelectorAll('#view [data-list-loading]')]
  return groups.length && groups.every(group => group.getAttribute('aria-busy') === 'false')
})
const setMode = async(page, mode) => {
  await page.evaluate(mode => window.lxData.updateSetting({ 'list.loadingMode': mode }), mode)
  await page.waitForFunction(mode => window.lxData.appSetting['list.loadingMode'] === mode, mode)
}

test('lists follow the selected loading mode for data and visible artwork', { timeout: 85000 }, async t => {
  const requests = []
  const gates = new Map()
  const block = pathname => {
    let started
    const gate = { requested: new Promise(resolve => { started = resolve }), started, release: () => {} }
    gates.set(pathname, gate)
    return gate
  }
  let base
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, base).pathname
    requests.push(pathname)
    const send = () => {
      if (pathname === '/weapi/v3/song/detail') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ code: 200, songs: [{ al: { picUrl: `${base}/resolved.svg` } }] }))
      } else if (pathname === '/eapi/batch') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          code: 200, total: 1,
          artist: { id: 789, name: 'Fixture artist', briefDesc: 'Fixture biography', cover: `${base}/artist.svg`, musicSize: 1, albumSize: 1 },
          songs: [{ id: 456, name: 'Artist song', artists: [{ name: 'Fixture artist' }], album: { id: 1, name: 'Fixture album' }, dt: 180000, privilege: { chargeInfoList: [] } }],
        }))
      } else {
        res.writeHead(pathname === '/missing.svg' ? 404 : 200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' })
        res.end(artwork)
      }
    }
    const gate = gates.get(pathname)
    if (gate) { gate.release = () => { gates.delete(pathname); send() }; gate.started() }
    else send()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
  const { app, page, errors, output } = await launch({ rendererPath: path.resolve('dist/index.html') })
  try {
    page.setDefaultTimeout(5000)
    // Only the cover-address lookup is redirected; no account or platform writes.
    await page.evaluate(port => {
      const https = require('https'), http = require('http')
      const original = https.request
      https.request = function(options, callback) {
        if ((options.hostname ?? options.host) === 'music.163.com' && options.path === '/weapi/v3/song/detail') {
          return http.request({ ...options, protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1', port, agent: undefined }, callback)
        }
        return original.apply(this, arguments)
      }
    }, server.address().port)
    await route(page, '/list')
    await settled(page)
    const rows = page.locator('#view .list-item')
    const group = page.locator('#view [data-list-loading]').first()
    const assertPending = async() => {
      assert.equal(await group.getAttribute('aria-busy'), 'true')
      assert.ok(await rows.count() > 0, 'rows are mounted so layout and cover loading can proceed')
      assert.equal(await rows.first().isVisible(), false, 'text stays hidden with the covers')
      assert.equal(await group.locator(':scope > [role="status"]').isVisible(), true)
    }

    await t.test('one slow cover holds back the whole list, including already decoded covers', async() => {
      const slow = block('/slow.svg')
      await seedLocal(page, songs('slow', [`${base}/fast.svg`, `${base}/slow.svg`]))
      await slow.requested
      await page.waitForFunction(() => document.querySelector('#view [data-cover-image]')?.naturalWidth === 96)
      await assertPending()
      await page.evaluate(() => {
        window.__firstReveal = new Promise(resolve => {
          const inspect = () => {
            const row = document.querySelector('#view .list-item')
            if (row && getComputedStyle(row).visibility !== 'hidden') {
              resolve([...document.querySelectorAll('#view [data-cover-image]')].every(image => image.complete && image.naturalWidth > 0))
            } else requestAnimationFrame(inspect)
          }
          requestAnimationFrame(inspect)
        })
      })
      slow.release()
      await ready(page)
      assert.equal(await page.evaluate(() => window.__firstReveal), true)
      assert.equal(await rows.count(), 2)
    })

    await t.test('a missing cover URL is included in loading before its image is requested', async() => {
      const lookup = block('/weapi/v3/song/detail')
      await seedLocal(page, songs('lookup', ['']))
      await lookup.requested
      await assertPending()
      lookup.release()
      await ready(page)
      assert.equal(await page.locator('#view [data-cover-image]').evaluate(image => image.naturalWidth), 96)
      assert.ok(requests.includes('/resolved.svg'))
    })

    await t.test('decoding the displayed image also completes before revealing the list', async() => {
      await page.evaluate(() => {
        const decode = HTMLImageElement.prototype.decode
        const pending = new Promise(resolve => { window.__releaseDecode = resolve })
        HTMLImageElement.prototype.decode = async function() {
          await decode.call(this)
          if (this.hasAttribute('data-cover-image')) {
            window.__decoding = true
            await pending
          }
        }
        window.__restoreDecode = () => { HTMLImageElement.prototype.decode = decode }
      })
      await seedLocal(page, songs('decode', [`${base}/decode.svg`]))
      await page.waitForFunction(() => window.__decoding)
      await assertPending()
      await page.evaluate(() => { window.__restoreDecode(); window.__releaseDecode() })
      await ready(page)
      assert.equal(await rows.first().isVisible(), true)
    })

    await t.test('failed artwork reveals its placeholder and an empty list reaches its empty state', async() => {
      await seedLocal(page, songs('missing', [`${base}/missing.svg`]))
      await ready(page)
      assert.equal(await rows.first().isVisible(), true)
      assert.equal(await rows.locator('[data-cover-image]').count(), 0)
      assert.ok(await rows.locator('svg use').count() > 0)
      await seedLocal(page, [])
      await ready(page)
      const empty = await page.evaluate(() => window.i18n.t('no_item'))
      assert.equal(await group.getByText(empty, { exact: true }).isVisible(), true)
    })

    await t.test('a stalled decode times out to a placeholder without a late image popping in', async() => {
      await page.evaluate(() => {
        const decode = HTMLImageElement.prototype.decode, timeout = window.setTimeout
        const pending = new Promise(resolve => { window.__releaseDecode = resolve })
        HTMLImageElement.prototype.decode = async function() {
          await decode.call(this)
          if (this.hasAttribute('data-cover-image')) await pending
        }
        // Exercise the real timeout branch without waiting 15 seconds in this test.
        window.setTimeout = (callback, delay, ...args) => timeout(callback, delay === 15000 ? 300 : delay, ...args)
        window.__restoreDecode = () => { HTMLImageElement.prototype.decode = decode; window.setTimeout = timeout }
      })
      await seedLocal(page, songs('timeout', [`${base}/timeout.svg`]))
      await ready(page)
      assert.equal(await rows.first().isVisible(), true)
      assert.equal(await rows.locator('[data-cover-image]').count(), 0)
      await page.evaluate(() => { window.__restoreDecode(); window.__releaseDecode() })
      await page.waitForTimeout(100)
      assert.equal(await rows.locator('[data-cover-image]').count(), 0)
    })

    await t.test('switching lists cancels the old wait and ignores its late completion', async() => {
      const old = block('/old.svg')
      await seedLocal(page, songs('old', [`${base}/old.svg`]))
      await old.requested
      await seedLocal(page, songs('new', [`${base}/fast.svg`]))
      await ready(page)
      assert.match(await rows.first().innerText(), /new song 0/)
      old.release()
      await page.waitForTimeout(100)
      assert.match(await rows.first().innerText(), /new song 0/)
      assert.equal(await group.getAttribute('aria-busy'), 'false')
    })

    await t.test('progressive mode waits for list data but lets covers appear independently', async() => {
      await setMode(page, 'progressive')
      const first = block('/progressive-first.svg'), second = block('/progressive-second.svg')
      await page.evaluate(() => {
        window.__motionComponents().find(c => c.type.name === 'MusicList' && 'list' in c.setupState).setupState.isLoading = true
      })
      await seedLocal(page, songs('progressive', [`${base}/progressive-first.svg`, `${base}/progressive-second.svg`]))
      await Promise.all([first.requested, second.requested])
      await assertPending()
      await page.evaluate(() => {
        window.__motionComponents().find(c => c.type.name === 'MusicList' && 'list' in c.setupState).setupState.isLoading = false
      })
      await ready(page)
      assert.equal(await rows.first().isVisible(), true)
      assert.equal(await rows.nth(1).isVisible(), true)
      assert.equal(await rows.first().evaluate(row => !!row.closest('[inert]')), false)
      assert.equal(await rows.locator('[data-cover-image][src]').count(), 0)
      first.release()
      await page.waitForFunction(() => document.querySelector('#view [data-cover-image]')?.naturalWidth === 96)
      assert.equal(await rows.nth(1).locator('[data-cover-image]').getAttribute('src'), null)
      assert.equal(await group.getAttribute('aria-busy'), 'false')
      second.release()
      await page.waitForFunction(() => [...document.querySelectorAll('#view [data-cover-image]')].every(image => image.naturalWidth === 96))
      await setMode(page, 'together')
    })

    await t.test('immediate mode navigates to a blank list and reveals batches while data and covers are still pending', async() => {
      await setMode(page, 'immediate')
      await route(page, '/setting?name=SettingList')
      await page.evaluate(() => {
        const ipc = require('electron').ipcRenderer, original = ipc.invoke.bind(ipc)
        ipc.invoke = async(channel, ...args) => {
          if (channel === 'player_list_music_get' && args[0] === 'immediate-fixture') {
            window.__waitingForList = true
            return new Promise(resolve => { window.__releaseList = resolve })
          }
          return original(channel, ...args)
        }
        window.__restoreImmediateInvoke = () => { ipc.invoke = original }
      })
      const first = block('/immediate-first.svg'), second = block('/immediate-second.svg')
      const initial = songs('immediate', [`${base}/immediate-first.svg`])
      await route(page, '/list?id=immediate-fixture')
      await page.waitForFunction(() => window.__waitingForList)
      assert.match(page.url(), /immediate-fixture/)
      assert.equal(await rows.count(), 0)
      assert.equal(await group.getAttribute('aria-busy'), 'true')
      assert.equal(await group.locator(':scope > [role="status"]').count(), 0)
      assert.equal(await group.locator(':scope > [inert]').count(), 1)
      assert.equal(await page.locator('#view [data-motion-outlet]').evaluateAll(elements => elements.some(el => el.getAnimations().length)), true)
      await page.evaluate(list => window.__releaseList(list), initial)
      await first.requested
      await rows.first().waitFor({ state: 'visible' })
      assert.equal(await rows.locator('[data-cover-image][src]').count(), 0)
      await page.evaluate(list => {
        const local = window.__motionComponents().find(c => c.type.name === 'MusicList' && 'list' in c.setupState)
        local.setupState.isLoading = true
        local.setupState.list = list
      }, [...initial, ...songs('immediate-next', [`${base}/immediate-second.svg`])])
      await second.requested
      await rows.nth(1).waitFor({ state: 'visible' })
      assert.equal(await group.getAttribute('aria-busy'), 'true')
      assert.equal(await rows.first().evaluate(row => !!row.closest('[inert]')), false)
      first.release()
      await page.waitForFunction(() => document.querySelector('#view [data-cover-image]')?.naturalWidth === 96)
      assert.equal(await rows.nth(1).locator('[data-cover-image]').getAttribute('src'), null)
      second.release()
      await page.evaluate(() => {
        window.__motionComponents().find(c => c.type.name === 'MusicList' && 'list' in c.setupState).setupState.isLoading = false
        window.__restoreImmediateInvoke()
      })
      await ready(page)
      await page.screenshot({ path: path.join(output, 'list-loading-immediate.png') })
      await setMode(page, 'together')
    })

    await t.test('changing mode releases a pending cover wait and applies to subsequent lists', async() => {
      const old = block('/mode-old.svg')
      await seedLocal(page, songs('mode-old', [`${base}/mode-old.svg`]))
      await old.requested
      await assertPending()
      await setMode(page, 'progressive')
      await ready(page)
      assert.equal(await rows.first().isVisible(), true)
      assert.equal(await rows.locator('[data-cover-image]').getAttribute('src'), null)
      await setMode(page, 'together')
      assert.equal(await rows.first().isVisible(), true, 'changing mode must not hide a list already on screen')
      const next = block('/mode-next.svg')
      await seedLocal(page, songs('mode-next', [`${base}/mode-next.svg`]))
      await next.requested
      await assertPending()
      old.release()
      await page.waitForTimeout(100)
      await assertPending()
      next.release()
      await ready(page)
      assert.match(await rows.first().innerText(), /mode-next song 0/)
    })

    await t.test('playlist cards wait for visible lazy images without downloading the whole page', async() => {
      await route(page, '/songList/list?source=wy&sortId=recommend')
      await settled(page)
      const slow = block('/grid-0.svg')
      await page.evaluate(base => {
        const card = window.__motionComponents().find(c => 'listInfo' in c.props && 'visibleSource' in c.props)
        Object.assign(card.props.listInfo, {
          key: 'fixture-grid', total: 30, page: 1, limit: 30, noItemLabel: '',
          list: Array.from({ length: 30 }, (_, i) => ({
            id: `grid-${i}`, source: 'wy', name: `Grid ${i}`, author: 'Fixture', img: `${base}/grid-${i}.svg`, desc: '', play_count: '',
          })),
        })
      }, base)
      await slow.requested
      const first = page.getByRole('button', { name: 'Grid 0', exact: true, includeHidden: true })
      assert.equal(await first.isVisible(), false)
      slow.release()
      await ready(page)
      assert.equal(await first.isVisible(), true)
      assert.equal(requests.includes('/grid-29.svg'), false)
      assert.ok(requests.filter(url => url.startsWith('/grid-')).length < 30)
      assert.equal(await page.evaluate(() => {
        const group = document.querySelector('#view [data-list-loading]'), bounds = group.getBoundingClientRect()
        return [...group.querySelectorAll('[data-cover-image]')].filter(image => {
          const rect = image.getBoundingClientRect()
          return rect.top < bounds.bottom && rect.bottom > bounds.top
        }).every(image => image.complete && image.naturalWidth > 0)
      }), true)
    })

    await t.test('immediate mode reveals playlist cards in batches without flashing loading or empty messages', async() => {
      await setMode(page, 'immediate')
      const cover = block('/immediate-card.svg')
      await page.evaluate(() => {
        const card = window.__motionComponents().find(c => 'listInfo' in c.props && 'visibleSource' in c.props)
        Object.assign(card.props.listInfo, { key: 'immediate-cards', list: [], noItemLabel: window.i18n.t('list__loading') })
        window.__immediateCards = card.props.listInfo
      })
      assert.equal(await group.locator('[role="status"]:visible').count(), 0)
      await page.evaluate(base => {
        window.__immediateCards.list = [{ id: 'first-card', source: 'wy', name: 'First arriving card', author: 'Fixture', img: `${base}/immediate-card.svg` }]
      }, base)
      await cover.requested
      await page.getByRole('button', { name: 'First arriving card', exact: true }).waitFor()
      assert.equal(await group.getAttribute('aria-busy'), 'true')
      await page.evaluate(() => {
        window.__immediateCards.list = [...window.__immediateCards.list, { id: 'second-card', source: 'wy', name: 'Second arriving card', author: 'Fixture', img: '' }]
      })
      await page.getByRole('button', { name: 'Second arriving card', exact: true }).waitFor()
      assert.equal(await group.locator('[role="status"]:visible').count(), 0)
      cover.release()
      await page.evaluate(() => { window.__immediateCards.noItemLabel = '' })
      await ready(page)
      await setMode(page, 'together')
    })

    await t.test('online songs and the playlist header cover appear as one group', async() => {
      await route(page, '/songList/detail?source=wy&id=fixture-list')
      await settled(page)
      const header = block('/header.svg')
      await page.evaluate(({ base, list }) => {
        const detail = window.__motionComponents().find(c => 'listDetailInfo' in c.setupState)
        Object.assign(detail.setupState.listDetailInfo, {
          key: 'fixture-detail', list, total: list.length, limit: 30, page: 1, noItemLabel: '',
          info: { name: 'Together online', img: `${base}/header.svg`, desc: 'Fixture description' },
        })
      }, { base, list: songs('online', [`${base}/fast.svg`]) })
      await header.requested
      await page.waitForFunction(() => document.querySelector('#view .list-item [data-cover-image]')?.naturalWidth === 96)
      assert.equal(await rows.first().isVisible(), false)
      assert.equal(await page.getByText('Together online', { exact: true }).isVisible(), false)
      header.release()
      await ready(page)
      assert.equal(await rows.first().isVisible(), true)
      assert.equal(await page.getByText('Together online', { exact: true }).isVisible(), true)
      await page.screenshot({ path: path.join(output, 'list-loading.png') })
      t.diagnostic('Screenshot: ' + path.join(output, 'list-loading.png'))
    })

    await t.test('progressive detail shows its header and songs while their covers are still loading', async() => {
      await setMode(page, 'progressive')
      const header = block('/progressive-header.svg'), song = block('/progressive-online.svg')
      await page.evaluate(({ base, list }) => {
        const detail = window.__motionComponents().find(c => 'listDetailInfo' in c.setupState)
        Object.assign(detail.setupState.listDetailInfo, {
          key: 'fixture-progressive-detail', list, total: list.length, limit: 30, page: 1, noItemLabel: '',
          info: { name: 'Progressive online', img: `${base}/progressive-header.svg`, desc: 'Fixture description' },
        })
      }, { base, list: songs('progressive-online', [`${base}/progressive-online.svg`]) })
      await Promise.all([header.requested, song.requested])
      await ready(page)
      assert.equal(await rows.first().isVisible(), true)
      assert.equal(await page.getByText('Progressive online', { exact: true }).isVisible(), true)
      assert.equal(await page.locator('#view [data-cover-image][src]').count(), 0)
      header.release()
      song.release()
      await page.waitForFunction(() => [...document.querySelectorAll('#view [data-cover-image]')].every(image => image.naturalWidth === 96))
      await setMode(page, 'together')
    })

    await t.test('immediate nested details show partial songs and retain final empty and error states', async() => {
      await setMode(page, 'immediate')
      await page.evaluate(() => {
        const detail = window.__motionComponents().find(c => 'listDetailInfo' in c.setupState)
        window.__immediateDetail = detail.setupState.listDetailInfo
        Object.assign(window.__immediateDetail, { key: 'immediate-detail', list: [], noItemLabel: window.i18n.t('list__loading') })
      })
      assert.equal(await group.locator('[role="status"]:visible').count(), 0)
      await page.evaluate(list => { window.__immediateDetail.list = list }, songs('partial-detail', [`${base}/fast.svg`]))
      await rows.first().waitFor({ state: 'visible' })
      assert.equal(await rows.first().evaluate(row => !!row.closest('[inert]')), false)
      assert.equal(await group.getAttribute('aria-busy'), 'true')
      await page.evaluate(() => {
        window.__immediateDetail.list = []
        window.__immediateDetail.noItemLabel = window.i18n.t('no_item')
      })
      const empty = await page.evaluate(() => window.i18n.t('no_item'))
      await group.getByText(empty, { exact: true }).waitFor()
      await page.evaluate(() => { window.__immediateDetail.noItemLabel = window.i18n.t('list__load_failed') })
      const error = await page.evaluate(() => window.i18n.t('list__load_failed'))
      await group.getByText(error, { exact: true }).waitFor()
      assert.equal(await group.locator('.ui-state-retry:visible').count(), 1)
      await setMode(page, 'together')
    })

    await t.test('artist detail waits for its profile cover as well as its songs', async() => {
      await page.evaluate(port => {
        const http = require('http'), original = http.request
        http.request = function(options, callback) {
          if ((options.hostname ?? options.host) === 'interface.music.163.com') {
            return original.call(this, { ...options, hostname: '127.0.0.1', host: '127.0.0.1', port, agent: undefined }, callback)
          }
          return original.apply(this, arguments)
        }
      }, server.address().port)
      const cover = block('/artist.svg')
      await route(page, '/search/entity/detail?source=wy&type=singer&id=789&name=Fixture%20artist')
      await settled(page)
      await cover.requested
      await page.waitForFunction(() => document.querySelector('#view .list-item [data-cover-image]')?.naturalWidth === 96)
      assert.equal(await rows.first().isVisible(), false)
      cover.release()
      await ready(page)
      assert.match(await rows.first().innerText(), /Artist song/)
      assert.equal(await rows.first().isVisible(), true)
    })

    await t.test('download list data and artwork use the same loading state', async() => {
      const cover = block('/download.svg')
      await page.evaluate(list => {
        const ipc = require('electron').ipcRenderer, original = ipc.invoke.bind(ipc)
        ipc.invoke = async(channel, ...args) => {
          if (channel === 'winMain_download_list_get') return list
          return original(channel, ...args)
        }
        window.__restoreInvoke = () => { ipc.invoke = original }
      }, [{
        id: 'download-fixture', status: 'pause', statusText: 'Paused', progress: 0, speed: 0, isComplate: false,
        metadata: { musicInfo: songs('download', [`${base}/download.svg`])[0], quality: '128k' },
      }])
      await route(page, '/download')
      await settled(page)
      await cover.requested
      await assertPending()
      cover.release()
      await ready(page)
      assert.equal(await rows.first().isVisible(), true)
      await page.evaluate(() => window.__restoreInvoke())
    })
    assert.deepEqual(errors, [])
  } finally {
    for (const gate of gates.values()) gate.release()
    await app.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

test('the loading-mode setting is saved through the UI and restored after full restarts', { timeout: 55000 }, async t => {
  let fixture
  let profilePath
  const start = async() => {
    fixture = await launch({ profilePath, rendererPath: path.resolve('dist/index.html') })
    profilePath ??= fixture.output
    await route(fixture.page, '/setting?name=SettingList')
    await settled(fixture.page)
  }
  const close = async() => {
    assert.deepEqual(fixture.errors, [])
    await fixture.app.close()
    fixture = null
  }
  const config = async() => JSON.parse(await fs.readFile(path.join(profilePath, 'portable/userData/LxDatas/config_v2.json'), 'utf8')).setting
  const select = async mode => {
    await fixture.page.locator(`label[for="setting_list_loading_mode_${mode}"]`).click()
    await fixture.page.waitForFunction(mode => window.lxData.appSetting['list.loadingMode'] === mode, mode)
    assert.equal((await config())['list.loadingMode'], mode)
  }
  const selected = async mode => {
    assert.equal(await fixture.page.evaluate(() => window.lxData.appSetting['list.loadingMode']), mode)
    assert.equal(await fixture.page.locator(`#setting_list_loading_mode_${mode}`).isChecked(), true)
    assert.equal(await fixture.page.locator('input[name="setting_list_loading_mode"]:checked').count(), 1)
    assert.equal(await fixture.page.locator('[role="radiogroup"] [role="radio"][aria-checked="true"]').count(), 1)
  }
  try {
    await start()
    await t.test('fresh settings keep the existing together mode and can select progressive mode', async() => {
      await selected('together')
      await select('progressive')
      await selected('progressive')
      await fixture.page.screenshot({ path: path.join(profilePath, 'list-loading-setting.png'), animations: 'disabled' })
      t.diagnostic('Screenshot: ' + path.join(profilePath, 'list-loading-setting.png'))
    })
    await close()
    await start()
    await t.test('progressive mode survives a restart and the immediate option can be selected', async() => {
      await selected('progressive')
      assert.equal(await fixture.page.locator('input[name="setting_list_loading_mode"]').count(), 3)
      await select('immediate')
      await selected('immediate')
    })
    await close()
    await start()
    await t.test('immediate mode survives a restart and can be changed back through the UI', async() => {
      await selected('immediate')
      await select('together')
      await selected('together')
    })
    await close()
    await start()
    await t.test('the together selection also survives a restart', async() => {
      await selected('together')
    })
  } finally {
    if (fixture) await fixture.app.close()
  }
})
