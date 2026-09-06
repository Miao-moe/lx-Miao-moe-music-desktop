const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { after, before, test } = require('node:test')
const webpack = require('webpack')

const projectDir = path.resolve(__dirname, '..')
const tempRoot = path.join(projectDir, '.npm')
let outputDir
let server
let baseUrl
let request

before(async() => {
  await fs.mkdir(tempRoot, { recursive: true })
  outputDir = await fs.mkdtemp(path.join(tempRoot, 'request-test-'))
  const storeFixture = path.join(outputDir, 'store.mjs')
  await fs.writeFile(storeFixture, 'export const proxy = { enable: false, host: "", port: "" }\n')
  const compiler = webpack({
    mode: 'production',
    target: 'electron-renderer',
    entry: path.join(projectDir, 'src/renderer/utils/request.js'),
    output: { path: outputDir, filename: 'request.cjs', library: { type: 'commonjs2' } },
    resolve: { extensions: ['.js', '.ts'], alias: { '@renderer/store$': storeFixture } },
    module: { rules: [{ test: /\.ts$/, use: { loader: 'ts-loader', options: { transpileOnly: true } } }] },
    // Exercise the same constant folding and minification as the production renderer.
    optimization: { minimize: true },
  })
  try {
    await new Promise((resolve, reject) => compiler.run((error, stats) => {
      if (error) return reject(error)
      if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })))
      resolve()
    }))
  } finally {
    await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()))
  }
  request = require(path.join(outputDir, 'request.cjs'))
  server = http.createServer((req, res) => {
    if (req.url === '/cancel') return
    if (req.url === '/disconnect') return req.socket.destroy()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 200, list: [{ id: req.url }] }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  baseUrl = 'http://127.0.0.1:' + server.address().port
})

after(async() => {
  if (server) {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
  if (outputDir) {
    const resolved = await fs.realpath(outputDir)
    assert.equal(path.dirname(resolved), await fs.realpath(tempRoot))
    assert(path.basename(resolved).startsWith('request-test-'))
    await fs.rm(resolved, { recursive: true, force: true })
  }
})

test('production HTTP requests resolve with the server response', async() => {
  const responses = await Promise.all(['/playlists', '/leaderboard'].map(route => request.httpFetch(baseUrl + route).promise))
  for (const [index, response] of responses.entries()) {
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.code, 200)
    assert.equal(response.body.list[0].id, ['/playlists', '/leaderboard'][index])
  }
})

test('cancellation keeps a callable rejection handler', async() => {
  for (const afterStart of [false, true]) {
    const pending = request.httpFetch(baseUrl + '/cancel')
    const rejected = assert.rejects(pending.promise, error => error instanceof Error && error.message === '取消http请求')
    if (afterStart) await new Promise(resolve => setImmediate(resolve))
    pending.cancelHttp()
    await rejected
  }
})

test('a network failure rejects with an Error', async() => {
  await assert.rejects(request.httpFetch(baseUrl + '/disconnect').promise, error => error instanceof Error)
})

test('callback POST requests also survive production logging optimization', async() => {
  const response = await new Promise((resolve, reject) => {
    request.httpPost(baseUrl + '/callback', { value: 1 }, {}, (error, response) => error ? reject(error) : resolve(response))
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.list[0].id, '/callback')
})
