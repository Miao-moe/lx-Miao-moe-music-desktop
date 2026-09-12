const assert = require('node:assert/strict')
const path = require('node:path')
const { test } = require('node:test')
const { launch, route, settled } = require('./helpers/motion-fixture.cjs')
const { original, match, unrelated, results, song } = require('./fixtures/music-toggle.cjs')
const invoke = (page, channel, params) => page.evaluate(({ channel, params }) => require('electron').ipcRenderer.invoke(channel, params), { channel, params })

test('source switching keeps the selected song through matching, preview and playlist replacement', { timeout: 45000 }, async t => {
  const { app, page, errors, output } = await launch({ rendererPath: path.resolve('dist/index.html') })
  try {
    page.setDefaultTimeout(5000)
    page.on('pageerror', error => { t.diagnostic(error.stack) })
    const list = [0, 1, 2].map(i => song('neighbor-' + i, 'wy', 'Neighbor ' + i, 'Fixture', '03:00'))
    list.push(original, song('last', 'wy', 'Last song', 'Fixture', '03:00'))
    await invoke(page, 'player_list_add', { position: 0, listInfos: [{ id: 'toggle-fixture', name: 'Toggle fixture', source: 'kg', sourceListId: '123', locationUpdateTime: null }] })
    await invoke(page, 'player_list_music_overwrite', { listId: 'toggle-fixture', musicInfos: list })
    await route(page, '/list?id=toggle-fixture')
    await settled(page)
    const labels = await page.evaluate(({ results, original, match, unrelated }) => {
      const component = window.__motionComponents().find(c => c.type.name === 'MusicList' && 'list' in c.setupState)
      const modal = window.__motionComponents().find(c => 'searchKey' in c.data && 'musicInfo' in c.props)
      window.__toggleList = component
      window.__toggleModal = modal
      // Hold individual provider responses while exercising the real loading order and controls.
      window.__toggleRequests = []
      window.__finishSource = {}
      modal.proxy.fetchSourceList = function(source) {
        const main = document.getElementById('music_toggle_only_matches')?.closest('main')
        window.__toggleRequests.push({ source, preferredRendered: !!main?.querySelector('button[aria-pressed]') })
        return new Promise((resolve, reject) => {
          window.__finishSource[source] = (fail = false) => fail ? reject(Error('fixture provider failure')) : resolve(results.find(result => result.source === source)?.list ?? [])
        })
      }
      // No credentials or audio provider are required to verify which song playback selects.
      window.lx.apiInitPromise[0] = Promise.resolve(false)
      window.lxData.appSetting['player.autoSkipOnError'] = false
      window.__setPreviewQueue = mode => {
        const current = component.setupState.list[0]
        const other = component.setupState.list[1]
        const entries = [current, other].map(musicInfo => ({ musicInfo, listId: '@play_queue', isTempPlay: false }))
        window.lxData.playQueueList.splice(0, Infinity, ...entries)
        Object.assign(window.lxData.playMusicInfo, entries[0])
        Object.assign(window.lxData.playInfo, { playerListId: '@play_queue', playerPlayIndex: 0, playIndex: 0 })
        window.lxData.appSetting['player.togglePlayMethod'] = mode === 'history' ? 'listLoop' : mode
        window.lxData.playedList.splice(0, Infinity, ...(mode === 'history' ? entries : []))
      }
      return {
        toggle: window.i18n.t('list__toggle_source'),
        preview: window.i18n.t('music_toggle_preview', { name: match.name }),
        otherPreview: window.i18n.t('music_toggle_preview', { name: unrelated.name }),
        confirm: window.i18n.t('music_toggle_confirm'),
        failed: window.i18n.t('music_toggle_failed'),
        dismiss: window.i18n.t('confirm_button_text'),
        empty: window.i18n.t('music_toggle_no_match'),
        loading: window.i18n.t('list__loading'),
        retry: window.i18n.t('reload'),
      }
    }, { results, original, match, unrelated })
    const menu = page.locator('[role="toolbar"][aria-hidden="false"]')
    await page.locator('#view .list-item .select.name').filter({ hasText: new RegExp('^' + original.name + '$') }).click({ button: 'right' })
    await menu.getByRole('tab', { name: labels.toggle, exact: true }).click()
    const modal = page.locator('#view main').filter({ has: page.locator('#music_toggle_only_matches') })
    const preview = modal.getByRole('button', { name: labels.preview, exact: true })
    const confirm = modal.getByRole('button', { name: labels.confirm, exact: true })
    await t.test('the playlist platform is selected and rendered before the other four requests', async() => {
      assert.equal(await page.evaluate(() => window.__toggleModal.proxy.source), 'kg')
      assert.equal(original.source, 'wy', 'The playlist platform takes precedence over the song platform')
      assert.equal(await modal.getByRole('tab').count(), 5)
      assert.deepEqual(await page.evaluate(() => window.__toggleRequests.map(request => request.source)), ['kg'])
      await modal.getByText(labels.loading, { exact: true }).waitFor()
      await page.evaluate(() => window.__finishSource.kg())
      await preview.waitFor()
      await page.waitForFunction(() => window.__toggleRequests.length === 5)
      assert.deepEqual(await page.evaluate(() => window.__toggleRequests.map(request => request.source)), ['kg', 'kw', 'tx', 'wy', 'mg'])
      assert.equal(await page.evaluate(() => window.__toggleRequests.slice(1).every(request => request.preferredRendered)), true)
      assert.equal(await page.evaluate(() => window.__toggleModal.proxy.loading), false)
      assert.equal(await modal.getByRole('button', { name: labels.otherPreview, exact: true }).count(), 0)
      assert.equal(await confirm.isDisabled(), true)
      assert.equal(await page.evaluate(() => window.__toggleList.setupState.selectedToggleMusicInfo.id), original.id)
    })

    await t.test('empty and failed platforms retain their tabs and late results do not change the selected platform', async() => {
      const tabs = await page.evaluate(() => window.__toggleModal.proxy.tabs)
      await modal.getByRole('tab', { name: tabs.find(tab => tab.id === 'mg').label, exact: true }).click()
      await modal.getByText(labels.loading, { exact: true }).waitFor()
      await page.evaluate(() => {
        for (const source of ['kw', 'tx', 'wy', 'mg']) window.__finishSource[source](source === 'tx')
      })
      await modal.getByText(labels.empty, { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => window.__toggleModal.proxy.source), 'mg')
      for (const tab of tabs.filter(tab => tab.id !== 'kg')) {
        await modal.getByRole('tab', { name: tab.label, exact: true }).click()
        await modal.getByText(labels.empty, { exact: true }).waitFor()
        assert.equal(await modal.getByRole('tab').count(), 5)
        assert.equal(await confirm.isDisabled(), true)
      }
      await modal.getByRole('tab', { name: tabs.find(tab => tab.id === 'tx').label, exact: true }).click()
      await modal.getByRole('button', { name: labels.retry, exact: true }).click()
      await modal.getByText(labels.loading, { exact: true }).waitFor()
      assert.deepEqual(await page.evaluate(() => window.__toggleRequests.map(request => request.source)), ['kg', 'kw', 'tx', 'wy', 'mg', 'tx'])
      await page.evaluate(() => window.__finishSource.tx())
      await modal.getByText(labels.empty, { exact: true }).waitFor()
      assert.equal(await modal.getByRole('button', { name: labels.retry, exact: true }).count(), 0)
      await modal.getByRole('tab', { name: tabs.find(tab => tab.id === 'kg').label, exact: true }).click()
      await preview.waitFor()
    })

    for (const mode of ['history', 'random', 'singleLoop', 'listLoop']) {
      await t.test(`preview plays the clicked candidate with ${mode} playback`, async() => {
        await page.evaluate(mode => {
          window.__setPreviewQueue(mode)
          window.__originalRandom = Math.random
          if (mode === 'random') Math.random = () => 0.99
        }, mode)
        try {
          await preview.click()
          assert.equal(await page.evaluate(() => window.lxData.playMusicInfo.musicInfo.id), match.id)
          assert.equal(await page.evaluate(() => window.__toggleModal.proxy.toggleMusicInfo.id), match.id)
          assert.equal(await preview.getAttribute('aria-pressed'), 'true')
        } finally {
          await page.evaluate(() => { Math.random = window.__originalRandom })
        }
      })
    }

    await t.test('changing the filter or source clears stale selection and shows the selected version duration', async() => {
      await modal.locator('label[for="music_toggle_only_matches"]').click()
      assert.equal(await confirm.isDisabled(), true)
      assert.equal(await page.evaluate(() => window.__toggleModal.proxy.source), 'kg')
      assert.equal(await modal.getByRole('tab').count(), 5)
      await preview.click()
      const kwTab = await page.evaluate(() => window.__toggleModal.proxy.tabs.find(tab => tab.id === 'kw').label)
      await modal.getByRole('tab', { name: kwTab, exact: true }).click()
      assert.equal(await confirm.isDisabled(), true)
      assert.equal(await page.evaluate(() => window.__toggleModal.proxy.toggleMusicInfo), null)
      const kgTab = await page.evaluate(() => window.__toggleModal.proxy.tabs.find(tab => tab.id === 'kg').label)
      await modal.getByRole('tab', { name: kgTab, exact: true }).click()
      await modal.getByRole('button', { name: labels.otherPreview, exact: true }).click()
      await modal.getByText('kg 03:06', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => window.lxData.playMusicInfo.musicInfo.id), unrelated.id)
      await preview.click()
      await modal.getByText('kg 02:02', { exact: true }).waitFor()
    })

    await page.screenshot({ path: path.join(output, 'music-toggle.png') })
    t.diagnostic('Screenshot: ' + path.join(output, 'music-toggle.png'))

    await t.test('a failed confirmation keeps the original so the selected candidate can be retried', async() => {
      await page.evaluate(() => {
        const ipc = require('electron').ipcRenderer
        const invoke = ipc.invoke.bind(ipc)
        window.__failToggleWrite = true
        ipc.invoke = async(channel, ...args) => {
          if (window.__failToggleWrite && channel === 'player_list_music_overwrite') throw Error('fixture disk failure')
          return invoke(channel, ...args)
        }
      })
      await confirm.click()
      await page.getByText(labels.failed, { exact: true }).waitFor()
      assert.deepEqual((await invoke(page, 'player_list_music_get', 'toggle-fixture')).map(song => song.id), list.map(song => song.id))
      await page.evaluate(() => { window.__failToggleWrite = false })
      await page.getByRole('button', { name: labels.dismiss, exact: true }).click()
      await page.getByText(labels.failed, { exact: true }).waitFor({ state: 'hidden' })
      assert.equal(await page.evaluate(() => window.__toggleModal.proxy.toggleMusicInfo.id), match.id)
    })

    await t.test('confirmation replaces the original song at its original position and leaves neighbors intact', async() => {
      await confirm.click()
      await page.waitForFunction(id => window.__toggleList.setupState.list[3]?.id === id, match.id)
      const saved = await invoke(page, 'player_list_music_get', 'toggle-fixture')
      assert.deepEqual(saved.map(song => song.id), [...list.slice(0, 3).map(song => song.id), match.id, 'last'])
      assert.equal(saved[3].name, original.name)
      assert.equal(saved[3].source, 'kg')
      assert.equal(await page.evaluate(() => window.__toggleList.setupState.isShowMusicToggleModal), false)
    })
    assert.deepEqual(errors, [])
  } finally {
    await app.close()
  }
})
