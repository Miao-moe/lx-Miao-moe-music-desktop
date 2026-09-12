const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const { test } = require('node:test')
const { launch, route, settled } = require('./helpers/motion-fixture.cjs')

const artwork = size => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#297c88"/></svg>`
const seedList = (page, urls) => page.evaluate(urls => {
  const component = window.__motionComponents().find(c => c.type.name === 'MusicList' && 'list' in c.setupState)
  component.setupState.list = urls.map((url, i) => ({
    id: `cover-check-${i}`,
    source: 'wy',
    name: `Cover ${i}`,
    singer: 'Fixture',
    interval: '03:40',
    meta: { picUrl: url, albumName: 'Fixture', songId: String(i), qualitys: [], _qualitys: {} },
  }))
}, urls)

test('small artwork loads promptly, falls back and reuses the artwork cache', { timeout: 45000 }, async t => {
  const { app, page, errors } = await launch({ rendererPath: path.resolve('dist/index.html') })
  let cachedRequests = 0
  const server = http.createServer((req, res) => {
    cachedRequests++
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' })
    res.end(artwork(96))
  })
  try {
    const requests = []
    await page.route('https://p1.music.126.net/lx-cover-check/**', async request => {
      const url = new URL(request.request().url())
      requests.push(url.href)
      const thumbnail = url.searchParams.has('param')
      const missing = url.pathname.endsWith('/missing.jpg') || (url.pathname.endsWith('/fallback.jpg') && thumbnail)
      await request.fulfill({ status: missing ? 404 : 200, contentType: 'image/svg+xml', body: missing ? '' : artwork(thumbnail ? 640 : 1400) })
    })
    await route(page, '/list')
    await settled(page)
    const urls = Array.from({ length: 1000 }, (_, i) => `https://p1.music.126.net/lx-cover-check/${i}.jpg`)

    await t.test('only virtualized rows request artwork that can also serve the player', async() => {
      await seedList(page, urls)
      await page.waitForFunction(() => {
        const images = Array.from(document.querySelectorAll('#view [data-cover-image]'))
        return images.length > 5 && images.every(image => image.complete && image.naturalWidth > 0)
      })
      const images = await page.locator('#view [data-cover-image]').evaluateAll(images => images.map(image => ({
        size: image.naturalWidth, loading: image.loading, width: image.clientWidth,
      })))
      assert.ok(images.length < 70, 'the full 1,000-song playlist is not loaded')
      assert.ok(images.every(image => image.size === 640 && image.loading === 'eager' && image.width > 0))
      assert.ok(requests.length < 70)
      assert.ok(requests.every(url => new URL(url).searchParams.get('param') === '640y640'))
      assert.equal(await page.evaluate(() => window.__motionComponents().find(c => c.type.name === 'MusicList').setupState.list[0].meta.picUrl), urls[0])
    })

    await t.test('a rejected thumbnail retries its original artwork once', async() => {
      const fallback = 'https://p1.music.126.net/lx-cover-check/fallback.jpg'
      await seedList(page, [fallback])
      await page.waitForFunction(() => document.querySelector('#view [data-cover-image]')?.naturalWidth === 1400)
      assert.match(await page.locator('#view [data-cover-image]').getAttribute('src'), /^blob:/)
      assert.deepEqual(requests.filter(url => url.includes('/fallback.jpg')), [fallback + '?param=640y640', fallback])
      // Virtualized rows may reuse their component for a different song.
      await seedList(page, [urls[1]])
      await page.waitForFunction(() => document.querySelector('#view [data-cover-image]')?.naturalWidth === 640)
      assert.match(await page.locator('#view [data-cover-image]').getAttribute('src'), /^blob:/)
      await seedList(page, [fallback])
      await page.waitForFunction(() => document.querySelector('#view [data-cover-image]')?.naturalWidth === 1400)
      assert.equal(requests.filter(url => url.includes('/fallback.jpg')).length, 2)
    })

    await t.test('missing originals reach the existing placeholder without a retry loop', async() => {
      const missing = 'https://p1.music.126.net/lx-cover-check/missing.jpg'
      await seedList(page, [missing])
      await page.waitForFunction(() => !document.querySelector('#view [data-cover-image]'))
      assert.deepEqual(requests.filter(url => url.includes('/missing.jpg')), [missing + '?param=640y640', missing])
    })

    await t.test('returning to a loaded cover avoids another network transfer', async() => {
      // Request interception disables Chromium's cache; remove it for this check.
      await page.unrouteAll({ behavior: 'wait' })
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      const cachedUrl = `http://127.0.0.1:${server.address().port}/cover.svg`
      await route(page, '/setting')
      await settled(page)
      await route(page, '/list')
      await settled(page)
      await seedList(page, [cachedUrl])
      await page.waitForFunction(() => document.querySelector('#view [data-cover-image]')?.naturalWidth === 96)
      assert.equal(cachedRequests, 1)
      await route(page, '/setting')
      await settled(page)
      await route(page, '/list')
      await settled(page)
      await seedList(page, [cachedUrl])
      await page.waitForFunction(() => document.querySelector('#view [data-cover-image]')?.naturalWidth === 96)
      assert.equal(cachedRequests, 1)
    })
    assert.deepEqual(errors, [])
  } finally {
    await app.close()
    server.closeAllConnections()
    if (server.listening) await new Promise(resolve => server.close(resolve))
  }
})
