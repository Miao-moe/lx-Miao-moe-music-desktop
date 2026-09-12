const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const zlib = require('node:zlib')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const script = fs.readFileSync('doc/qq-search-diagnostics.js', 'utf8')

function fixture() {
  const requests = [], timers = []
  const original = function(options, callback) {
    const request = new EventEmitter()
    request.path = options.path
    request.getHeader = () => options.host
    if (callback) request.on('response', callback)
    requests.push(request)
    return request
  }
  const https = { request: original }
  const window = {}
  const context = vm.createContext({ window, Buffer, console: { log() {} },
    process: { versions: { app: '2.3.0', electron: '40.9.2' }, platform: 'win32', arch: 'x64' },
    require: name => name === 'node:https' ? https : name === 'node:zlib' ? zlib : assert.fail(name),
    setTimeout: (callback, ms) => { timers.push({ callback, ms }); return timers.length }, clearTimeout() {},
  })
  const install = () => vm.runInContext(script, context)
  const send = (data, { encoding = '', host = 'u.y.qq.com', status = 200, raw = false } = {}) => {
    let delivered
    const request = https.request({ host, path: '/cgi-bin/musics.fcg?sign=PRIVATE_SIGNATURE' }, response => { delivered = response })
    const response = new EventEmitter()
    response.headers = { 'content-encoding': encoding }
    response.statusCode = status
    request.emit('response', response)
    assert.equal(delivered, response, 'the original consumer receives the same response')
    let bytes = raw ? data : Buffer.from(JSON.stringify(data))
    if (encoding === 'gzip') bytes = zlib.gzipSync(bytes)
    if (encoding === 'br') bytes = zlib.brotliCompressSync(bytes)
    response.emit('data', bytes)
    response.emit('end')
    return request
  }
  install()
  return { https, original, requests, timers, install, send, capture: () => window.__lxQqSearchCapture, result: () => JSON.parse(window.__lxQqSearchCapture.export()) }
}

test('the 2.3.0 diagnostic captures HTTP and business codes without private data', () => {
  const f = fixture()
  f.send({ code: 0, req: { code: 2001, data: { body: { item_song: [] }, cookie: 'PRIVATE_COOKIE', query: 'PRIVATE_QUERY' } } })
  const record = f.result().records[0]
  assert.equal(record.status, 200)
  assert.equal(record.reqCode, 2001)
  assert.equal(record.songCount, 0)
  assert.equal(f.result().environment.version, '2.3.0')
  assert(!f.capture().export().includes('PRIVATE'))
  f.capture().stop()
  assert.equal(f.https.request, f.original)
})

test('the diagnostic decodes compressed responses, reports invalid bodies and ignores unrelated hosts', () => {
  const f = fixture()
  for (const encoding of ['gzip', 'br']) f.send({ code: 0, req: { code: 0, data: { body: { item_song: [{ id: 'private-song' }] } } } }, { encoding })
  f.send(Buffer.from('<html>PRIVATE_PROXY_MESSAGE</html>'), { status: 502, raw: true })
  f.send({ code: 5 }, { host: 'other.example' })
  assert.equal(f.result().records.length, 3)
  assert.equal(f.result().records[0].songCount, 1)
  assert.equal(f.result().records[1].songCount, 1)
  assert.equal(f.result().records[2].type, 'non-json-or-encoding-error')
  assert(!f.capture().export().includes('PRIVATE'))
})

test('oversized and interrupted responses remain bounded and are recorded once', () => {
  const f = fixture()
  f.send(Buffer.alloc(2 * 1024 * 1024 + 1), { raw: true })
  assert.equal(f.result().records[0].type, 'too-large')
  const request = f.https.request({ host: 'u.y.qq.com', path: '/cgi-bin/musics.fcg' })
  const response = new EventEmitter()
  response.headers = {}
  response.statusCode = 200
  request.emit('response', response)
  response.emit('aborted')
  request.emit('error', Object.assign(new Error('PRIVATE'), { code: 'ECONNRESET' }))
  assert.equal(f.result().records.length, 2)
  assert.equal(f.result().records[1].type, 'aborted')
})

test('reinstalling the diagnostic and its time/request limits restore the original hook', () => {
  const f = fixture()
  f.install()
  f.send({ code: 0 })
  assert.equal(f.result().records.length, 1)
  assert.equal(f.timers.at(-1).ms, 600000)
  f.timers.at(-1).callback()
  assert.equal(f.https.request, f.original)
  f.install()
  for (let i = 0; i < 41; i++) f.send({ code: 0 })
  assert.equal(f.result().records.length, 40)
  assert.equal(f.https.request, f.original)
})
