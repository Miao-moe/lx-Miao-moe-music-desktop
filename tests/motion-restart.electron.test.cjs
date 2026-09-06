const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { test } = require('node:test')
const { launch, route, settled } = require('./helpers/motion-fixture.cjs')

test('motion preferences survive full Electron restarts with system reduction enabled', { timeout: 60000 }, async t => {
  let fixture
  let profilePath
  const start = async() => {
    fixture = await launch({ profilePath, initializeMotion: false, reducedMotion: 'reduce' })
    profilePath ??= fixture.output
  }
  const close = async() => {
    assert.deepEqual(fixture.errors, [])
    await fixture.app.close()
    fixture = null
  }
  const state = () => fixture.page.evaluate(() => ({
    follow: window.lxData.appSetting['ui.followSystemMotion'],
    enabled: document.documentElement.dataset.motionEnabled,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }))
  const config = async() => JSON.parse(await fs.readFile(path.join(profilePath, 'portable/userData/LxDatas/config_v2.json'), 'utf8')).setting
  const toggleSystemPreference = async() => {
    await route(fixture.page, '/setting')
    await settled(fixture.page)
    const title = await fixture.page.evaluate(() => window.i18n.t('setting__advanced'))
    await fixture.page.getByRole('tab', { name: title, exact: true }).click()
    await settled(fixture.page)
    await fixture.page.locator('label[for="setting_advanced_ui_follow_system_motion"]').click()
  }
  try {
    await start()
    await t.test('fresh settings use the app animation switches', async() => {
      assert.deepEqual(await state(), { follow: false, enabled: 'true', reduced: true })
      assert.equal((await config())['ui.followSystemMotion'], false)
    })
    await t.test('the actual checkbox saves the system preference', async() => {
      await toggleSystemPreference()
      await fixture.page.waitForFunction(() => document.documentElement.dataset.motionEnabled === 'false')
      assert.equal((await config())['ui.followSystemMotion'], true)
    })
    await close()
    await start()
    await t.test('an explicit system preference is restored after a full restart', async() => {
      assert.deepEqual(await state(), { follow: true, enabled: 'false', reduced: true })
      await toggleSystemPreference()
      await fixture.page.waitForFunction(() => document.documentElement.dataset.motionEnabled === 'true')
      await fixture.page.evaluate(() => window.lxData.updateSetting({ 'ui.animationSpeed': 1.2 }))
      await fixture.page.waitForFunction(() => document.documentElement.dataset.motionSpeed === '1.2')
      const saved = await config()
      assert.equal(saved['ui.followSystemMotion'], false)
      assert.equal(saved['ui.animationSpeed'], 1.2)
    })
    await close()
    for (let i = 0; i < 2; i++) {
      await start()
      await t.test(`app-controlled motion still plays after restart ${i + 1}`, async() => {
        assert.deepEqual(await state(), { follow: false, enabled: 'true', reduced: true })
        await route(fixture.page, '/search')
        await settled(fixture.page)
        await route(fixture.page, '/setting')
        await fixture.page.waitForFunction(() => document.querySelector('#view > [data-motion-outlet]').getAnimations().length > 0)
        assert.equal(await fixture.page.locator('#view > [data-motion-outlet]').evaluate(el => el.getAnimations()[0].effect.getTiming().duration), 200)
        assert.equal((await config())['ui.followSystemMotion'], false)
      })
      await close()
    }
  } finally {
    if (fixture) await fixture.app.close()
  }
})
