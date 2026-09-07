const assert = require('node:assert/strict')
const { test } = require('node:test')
const { launch, route, settled } = require('./helpers/motion-fixture.cjs')

test('song menus keep the clicked song when the playlist changes', { timeout: 45000 }, async t => {
  const { app, page, errors } = await launch()
  try {
    page.setDefaultTimeout(5000)
    await route(page, '/list')
    await settled(page)
    await page.evaluate(() => {
      const component = window.__motionComponents().find(c => c.type.name === 'MusicList' && 'list' in c.setupState)
      window.__menuTargetList = component
      // Search providers are unrelated to which song the menu passes into the dialog.
      const modal = window.__motionComponents().find(c => c.parent === component && 'searchKey' in c.data)
      modal.proxy.loadList = function() {
        this.tabs = []
        this.lists = {}
        this.loading = false
      }
    })
    const menu = page.locator('[role="toolbar"][aria-hidden="false"]')
    const targetTitle = page.locator('#view .list-item .select.name').filter({ hasText: /^Target song$/ })
    const toggleLabel = await page.evaluate(() => window.i18n.t('list__toggle_source'))
    const reset = async buttons => {
      await page.evaluate(buttons => {
        const state = window.__menuTargetList.setupState
        state.handleMenuClick(null)
        state.isShowMusicToggleModal = false
        state.actionButtonsVisible = buttons
        state.list = ['Other song', 'Target song', 'Last song'].map((name, index) => ({
          id: 'menu-song-' + index,
          source: 'local',
          name,
          singer: 'Fixture singer',
          interval: '03:00',
          meta: { albumName: 'Fixture album', filePath: '', ext: 'mp3', picUrl: '' },
        }))
        window.__menuTargetList.proxy.$forceUpdate()
        window.getSelection().removeAllRanges()
      }, buttons)
      await targetTitle.waitFor({ state: 'visible' })
    }
    const openMenu = async() => {
      await targetTitle.click({ button: 'right', position: { x: 12, y: 8 } })
      await menu.waitFor({ state: 'visible' })
    }
    const assertTarget = async() => {
      await menu.getByRole('tab', { name: toggleLabel, exact: true }).click()
      await page.locator('#view h2').filter({ hasText: 'Target song' }).waitFor({ state: 'visible' })
      assert.equal(await page.evaluate(() => window.__menuTargetList.setupState.selectedToggleMusicInfo.id), 'menu-song-1')
    }
    const assertCanceled = async() => {
      await menu.waitFor({ state: 'hidden' })
      assert.equal(await page.evaluate(() => window.__menuTargetList.setupState.isShowMusicToggleModal), false)
      assert.equal(await page.evaluate(() => window.__menuTargetList.setupState.rightClickSelectedIndex), -1)
    }

    for (const buttons of [true, false]) {
      await t.test(`reordering after right-click preserves the target (buttons: ${buttons})`, async() => {
        await reset(buttons)
        await openMenu()
        await page.evaluate(() => {
          const state = window.__menuTargetList.setupState
          state.list = [state.list[1], state.list[0], state.list[2]]
        })
        await assertTarget()
      })

      await t.test(`a pending virtual-list refresh preserves the displayed target (buttons: ${buttons})`, async() => {
        await reset(buttons)
        await targetTitle.evaluate(element => {
          const state = window.__menuTargetList.setupState
          state.list = [state.list[1], state.list[0], state.list[2]]
          const { x, y } = element.getBoundingClientRect()
          element.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: x + 12, clientY: y + 8 }))
        })
        await menu.waitFor({ state: 'visible' })
        await assertTarget()
      })

      await t.test(`removing the clicked song cancels the action (buttons: ${buttons})`, async() => {
        await reset(buttons)
        await openMenu()
        await page.evaluate(() => {
          const state = window.__menuTargetList.setupState
          state.list = state.list.filter(song => song.id !== 'menu-song-1')
        })
        await menu.getByRole('tab', { name: toggleLabel, exact: true }).click()
        await assertCanceled()
      })

      await t.test(`another playlist with the same song ID cannot receive the action (buttons: ${buttons})`, async() => {
        await reset(buttons)
        await openMenu()
        await menu.getByRole('tab', { name: toggleLabel, exact: true }).evaluate(element => {
          const component = window.__menuTargetList
          const listId = component.props.listId
          // Keep the songs identical to isolate the playlist identity check.
          component.props.listId = 'another-playlist'
          element.click()
          component.props.listId = listId
        })
        await assertCanceled()
      })
    }
    assert.deepEqual(errors, [])
  } finally {
    await app.close()
  }
})
