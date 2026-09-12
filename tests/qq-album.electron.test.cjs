const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const { test } = require('node:test')
const { launch, route } = require('./helpers/motion-fixture.cjs')
const { mid, titles, songs, response, info } = require('./fixtures/qq-album.cjs')

test('opening Jay from QQ album search displays its ten tracks without a keyword song search', { timeout: 45000 }, async t => {
  const requests = []
  const artwork = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#297c88"/></svg>'
  const server = http.createServer((req, res) => {
    if (req.headers.host === 'y.gtimg.cn') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' })
      res.end(artwork)
      return
    }
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      let body
      if (req.url.includes('smartbox_new.fcg')) {
        body = { code: 0, data: { album: { itemlist: [{ mid, name: 'Jay', singer: '周杰伦' }] } } }
      } else if (req.url.includes('fcg_v8_album_info_cp.fcg')) {
        body = info.body
      } else {
        const payload = JSON.parse(Buffer.concat(chunks).toString())
        const request = payload.req ?? payload['music.search.SearchCgiService']
        requests.push(request)
        body = request?.method === 'GetAlbumSongList' ? response(songs()).body : { code: 1000 }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let fixture
  try {
    fixture = await launch({ rendererPath: path.resolve('dist/index.html') })
    const { page, errors, output } = fixture
    await page.evaluate(port => {
      const https = require('node:https'), http = require('node:http')
      const original = https.request
      https.request = function(options, ...args) {
        const hostname = options.hostname ?? options.host
        if (!['u.y.qq.com', 'c.y.qq.com', 'y.gtimg.cn'].includes(hostname)) return original.call(this, options, ...args)
        return http.request({ ...options, protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1', port, agent: undefined, headers: { ...options.headers, Host: hostname } }, ...args)
      }
    }, server.address().port)
    await route(page, '/search?' + new URLSearchParams({ text: '周杰伦 Jay', source: 'tx', type: 'album' }))
    await page.getByRole('button', { name: 'Jay', exact: true }).click()
    await page.waitForURL(/search\/entity\/detail/)
    await page.waitForFunction(() => {
      const groups = [...document.querySelectorAll('#view [data-list-loading]')]
      return groups.length && groups.every(group => group.getAttribute('aria-busy') === 'false')
    })
    const result = await page.evaluate(() => {
      const list = window.__motionComponents().find(c => c.type.name === 'MaterialOnlineList').props
      return { noItem: list.noItem, total: list.total, songs: list.list.map(song => ({ name: song.name, albumMid: song.meta.albumMid })) }
    })
    assert.equal(result.noItem, '')
    assert.equal(result.total, 10)
    assert.deepEqual(result.songs.map(song => song.name), titles)
    assert(result.songs.every(song => song.albumMid === mid))
    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'GetAlbumSongList')
    assert.equal(requests[0].param.albumMid, mid)
    assert.equal(await page.locator('#view [data-music-cell="name"] .select.name').first().innerText(), titles[0])
    await page.getByText(titles[9], { exact: true }).scrollIntoViewIfNeeded()
    assert.equal(await page.getByText(titles[9], { exact: true }).isVisible(), true)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: path.join(output, 'qq-jay-album.png') })
    t.diagnostic('QQ album verification: ' + output)
  } finally {
    if (fixture) await fixture.app.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
