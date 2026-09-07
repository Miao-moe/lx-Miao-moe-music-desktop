const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { test } = require('node:test')
const { launch, route, settled, seedTrack, showDetail } = require('./helpers/motion-fixture.cjs')

const catalogRoot = path.resolve(__dirname, '../plugins/official')
const mockGitHub = async(app, offline = false) => {
  await app.evaluate(({ session, net }, { catalogRoot, offline }) => {
    const fs = process.mainModule.require('node:fs')
    const path = process.mainModule.require('node:path')
    global.__pluginOffline = offline
    global.__pluginRequests = []
    const root = 'https://raw.githubusercontent.com/Miao-moe/lx-m_lx-Miao-moe-music-desktop/master/plugins/official/'
    session.fromPartition('persist:win-main').protocol.handle('https', request => {
      if (!request.url.startsWith(root)) return net.fetch(request, { bypassCustomProtocolHandlers: true })
      global.__pluginRequests.push(request.url)
      if (global.__pluginOffline) return new Response('Unavailable', { status: 503 })
      const relative = decodeURIComponent(request.url.slice(root.length))
      const filename = path.resolve(catalogRoot, relative)
      if (!filename.startsWith(catalogRoot + path.sep)) return new Response('', { status: 400 })
      return new Response(fs.readFileSync(filename), { headers: { 'content-type': relative.endsWith('.json') ? 'application/json' : 'application/octet-stream' } })
    })
  }, { catalogRoot, offline })
}
const openStore = async page => {
  await route(page, '/setting?name=SettingPluginStore')
  await settled(page)
  await page.locator('#plugin_store').waitFor()
}
const label = (page, key) => page.evaluate(key => window.i18n.t(key), key)
const install = async(page, id) => {
  const card = page.locator(`[data-plugin-id="${id}"]`)
  const button = card.getByRole('button', { name: await label(page, 'setting__plugins_install'), exact: true })
  await page.waitForFunction(id => {
    const card = document.querySelector(`[data-plugin-id="${id}"]`)
    return card && [...card.querySelectorAll('button')].some(button => !button.disabled)
  }, id)
  await button.click()
  await card.getByRole('button', { name: await label(page, 'setting__plugins_settings'), exact: true }).waitFor()
}
const uninstall = async(page, id) => {
  const card = page.locator(`[data-plugin-id="${id}"]`)
  await card.getByRole('button', { name: await label(page, 'setting__plugins_uninstall'), exact: true }).click()
  await card.getByRole('button', { name: await label(page, 'setting__plugins_install'), exact: true }).waitFor()
}
const startSilentAudio = async page => {
  const sampleRate = 44100
  const count = sampleRate * 2
  const bytes = Buffer.alloc(44 + count * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(sampleRate, 24)
  bytes.writeUInt32LE(sampleRate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(count * 2, 40)
  for (let i = 0; i < count; i++) bytes.writeInt16LE(Math.round(Math.sin(i * Math.PI * 2 * 1000 / sampleRate) * 8000), 44 + i * 2)
  await page.evaluate(async source => {
    const player = window.__lxPluginHost.player
    player.setResource(source)
    player.setLoopPlay(true)
    await player.getAudioContext().resume()
    await player.getAudioElement().play()
  }, 'data:audio/wav;base64,' + bytes.toString('base64'))
}

test('GitHub plugins load independently, release audio resources, and survive offline restart', { timeout: 120000 }, async() => {
  let fixture = await launch()
  const profilePath = fixture.output
  const pluginErrors = []
  const capturePluginErrors = page => page.on('console', message => {
    if (message.type() === 'error' && /Plugin .*failed|Sound effect .*failed/.test(message.text())) pluginErrors.push(message.text())
  })
  try {
    let { app, page } = fixture
    capturePluginErrors(page)
    page.setDefaultTimeout(12000)
    await mockGitHub(app)
    await page.evaluate(() => {
      window.__pluginAudio = { filters: [], analysers: [], worklets: [] }
      const connect = AudioNode.prototype.connect
      AudioNode.prototype.connect = function(target, ...args) {
        if (target instanceof AudioDestinationNode) {
          const silence = this.context.createGain()
          silence.gain.value = 0
          connect.call(silence, target)
          return connect.call(this, silence, ...args)
        }
        return connect.call(this, target, ...args)
      }
      for (const [method, collection] of [['createBiquadFilter', 'filters'], ['createAnalyser', 'analysers']]) {
        const original = AudioContext.prototype[method]
        AudioContext.prototype[method] = function(...args) {
          const node = original.apply(this, args)
          const disconnect = node.disconnect.bind(node)
          node.__disconnected = false
          node.disconnect = (...args) => { node.__disconnected = true; return disconnect(...args) }
          window.__pluginAudio[collection].push(node)
          return node
        }
      }
      const Worklet = window.AudioWorkletNode
      window.AudioWorkletNode = class extends Worklet {
        constructor(...args) { super(...args); window.__pluginAudio.worklets.push(this) }
      }
      window.lxData.updateSetting({ 'player.soundEffect.biquadFilter.hz1000': 6 })
    })
    assert.equal(await page.evaluate(() => window.__lxPluginHost.player.hasInitedAdvancedAudioFeatures()), false)
    await openStore(page)
    await install(page, 'audio-visualizer')
    assert.equal(await page.evaluate(() => window.__pluginAudio.filters.length), 0, 'The visualizer must not create sound effect nodes')
    await install(page, 'sound-effects')
    await page.waitForFunction(() => window.__pluginAudio.filters.length === 10)
    assert.equal(await page.evaluate(() => window.__pluginAudio.filters[5].gain.value), 6)
    const soundCard = page.locator('[data-plugin-id="sound-effects"]')
    await soundCard.getByRole('button', { name: await label(page, 'setting__plugins_settings'), exact: true }).click()
    await page.locator('[data-plugin-settings="sound-effects"]').waitFor()
    for (const [width, height] of [[828, 540], [1366, 768], [3840, 2160]]) {
      await page.setViewportSize({ width, height })
      await settled(page)
      const bounds = await page.locator('[data-plugin-id], [data-plugin-id] button, [data-plugin-settings] input, [data-plugin-settings] button').evaluateAll(elements => elements.map(element => {
        const { left, right, width } = element.getBoundingClientRect()
        return { left, right, width }
      }).filter(rect => rect.width > 0))
      for (const rect of bounds) assert.ok(rect.left >= 0 && rect.right <= width + 1, `Plugin UI outside ${width}px viewport: ${JSON.stringify(rect)}`)
      if (width === 828) await page.screenshot({ path: path.join(profilePath, 'plugin-store-small.png') })
    }
    await page.setViewportSize({ width: 1114, height: 718 })
    await page.screenshot({ path: path.join(profilePath, 'plugin-store.png') })
    const dataRoot = await app.evaluate(() => global.lxDataPath)
    const registryBefore = JSON.parse(await fs.readFile(path.join(dataRoot, 'plugins/installed.json'), 'utf8'))
    await seedTrack(page)
    await page.evaluate(() => {
      window.lxData.musicInfo.lrc = '[00:00.00]Plugin audio check\n[00:01.00]Offline test signal'
      window.app_event.lyricUpdated()
    })
    await showDetail(page, true)
    await settled(page)
    await page.locator('[data-player-detail]').getByRole('button', { name: await label(page, 'player__sound_effect'), exact: true }).click()
    const soundDialog = page.locator('[data-plugin-sound-dialog]')
    await soundDialog.waitFor()
    await soundDialog.locator('..').getByRole('button', { name: await label(page, 'close'), exact: true }).click()
    await soundDialog.waitFor({ state: 'hidden' })
    await page.evaluate(() => window.lxData.updateSetting({ 'player.audioVisualization': true, 'desktopLyric.audioVisualization': true, 'desktopLyric.enable': true }))
    await page.locator('[data-plugin-visualizer="main"]').waitFor()
    const desktop = app.windows().find(window => window.url().includes('lyric.html')) ?? await app.waitForEvent('window', { predicate: window => window.url().includes('lyric.html') })
    await desktop.locator('[data-plugin-visualizer="desktop"]').waitFor({ timeout: 20000 })
    await startSilentAudio(page)
    await page.waitForFunction(() => {
      const analyser = window.__pluginAudio.analysers[0]
      if (!analyser) return false
      const values = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(values)
      return values.some(value => value > 0)
    })
    await desktop.waitForFunction(() => {
      const canvas = document.querySelector('[data-plugin-visualizer="desktop"] canvas')
      return canvas?.width && canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(value => value > 0)
    })
    await page.evaluate(() => window.lxData.updateSetting({ 'player.soundEffect.convolution.fileName': 'filter-telephone.wav', 'player.soundEffect.pitchShifter.playbackRate': 1.25 }))
    await page.waitForFunction(() => window.__pluginAudio.worklets.length === 1)
    await page.evaluate(() => { window.__motionDetail().isShowPlayerDetail = false })
    await openStore(page)
    await uninstall(page, 'sound-effects')
    assert.equal(await page.evaluate(() => window.__pluginAudio.filters.every(filter => filter.__disconnected)), true)
    assert.equal(await page.evaluate(() => window.__lxPluginHost.player.getAudioElement().paused), false, 'Uninstalling effects must not pause playback')
    assert.equal(await page.locator('style[data-plugin="sound-effects"]').count(), 0)
    await assert.rejects(fs.stat(path.join(dataRoot, 'plugins', registryBefore['sound-effects'].directory)), { code: 'ENOENT' })
    assert.equal(await desktop.locator('[data-plugin-visualizer="desktop"]').count(), 1, 'The other plugin stays active')
    await install(page, 'sound-effects')
    await page.waitForFunction(() => window.__pluginAudio.worklets.length === 2)
    assert.equal(await page.evaluate(() => window.__pluginAudio.filters.length), 20, 'Reinstalling creates a fresh effects graph')
    assert.equal(await page.evaluate(() => window.__pluginAudio.filters[15].gain.value), 6)
    await uninstall(page, 'sound-effects')
    assert.equal(await page.evaluate(() => window.__pluginAudio.filters.every(filter => filter.__disconnected)), true)
    await uninstall(page, 'audio-visualizer')
    await desktop.locator('[data-plugin-visualizer="desktop"]').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.__pluginAudio.analysers.every(analyser => analyser.__disconnected)), true)
    assert.equal(await page.evaluate(() => window.lxData.appSetting['player.soundEffect.biquadFilter.hz1000']), 6)
    await install(page, 'audio-visualizer')
    await page.evaluate(() => {
      window.__lxPluginHost.player.setStop()
      window.lxData.updateSetting({ 'desktopLyric.enable': false })
    })
    await route(page, '/search')
    assert.deepEqual(fixture.errors, [])
    assert.deepEqual(pluginErrors, [])
    await app.close()
    fixture = await launch({ profilePath })
    ;({ app, page } = fixture)
    capturePluginErrors(page)
    page.setDefaultTimeout(12000)
    await mockGitHub(app, true)
    await openStore(page)
    await page.getByText(await label(page, 'setting__plugins_catalog_error'), { exact: true }).waitFor()
    await page.locator('[data-plugin-id="audio-visualizer"]').getByRole('button', { name: await label(page, 'setting__plugins_settings'), exact: true }).waitFor()
    assert.equal(await page.locator('[data-plugin-id="sound-effects"]').getByRole('button', { name: await label(page, 'setting__plugins_uninstall'), exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => window.lxData.appSetting['player.soundEffect.biquadFilter.hz1000']), 6)
    const registryAfter = JSON.parse(await fs.readFile(path.join(dataRoot, 'plugins/installed.json'), 'utf8'))
    assert.deepEqual(Object.keys(registryAfter), ['audio-visualizer'])
    assert.deepEqual(fixture.errors, [])
    assert.deepEqual(pluginErrors, [])
    console.log('Plugin store verification profile:', profilePath)
  } catch (error) {
    console.error('Plugin store failure profile:', profilePath)
    console.error('Plugin cards:', await fixture.page.locator('[data-plugin-id]').allTextContents().catch(() => []))
    console.error('Renderer errors:', fixture.errors)
    console.error('Plugin errors:', pluginErrors)
    await fixture.page.screenshot({ path: path.join(profilePath, 'plugin-store-failure.png') }).catch(() => {})
    throw error
  } finally {
    await fixture.app.close()
  }
})
