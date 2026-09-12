// Paste this entire file into LX-M 2.3.0/2.4.0 or LX 2.12.2's DevTools Console.
// Inspect a few failed/successful searches, then run:
// copy(window.__lxQqSearchCapture.export())
// window.__lxQqSearchCapture.stop()
;(() => {
  window.__lxQqSearchCapture?.stop()
  const https = require('node:https')
  const zlib = require('node:zlib')
  const original = https.request
  const records = []
  const maxBytes = 2 * 1024 * 1024
  let sequence = 0
  let stopped = false
  let timer
  const code = value => typeof value === 'number' && Number.isFinite(value) ? value
    : typeof value === 'string' && /^-?\d{1,12}$/.test(value) ? value : null
  const write = record => {
    records.push(record)
    console.log('[QQSearchCapture]', JSON.stringify(record))
  }
  const stop = () => {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
    if (https.request === observe) https.request = original
    console.log('QQ 搜索诊断已停止，仍可导出本次记录。')
  }
  function observe(...args) {
    const request = original.apply(this, args)
    if (stopped || String(request.getHeader('host')).toLowerCase() !== 'u.y.qq.com' ||
      !/^\/cgi-bin\/musics?\.fcg(?:\?|$)/.test(request.path)) return request
    if (sequence >= 40) { stop(); return request }
    const id = ++sequence
    const started = Date.now()
    let completed = false
    const finish = details => {
      if (completed) return
      completed = true
      write({ id, time: new Date(started).toISOString(), elapsedMs: Date.now() - started, ...details })
    }
    request.once('error', error => finish({ type: 'network', networkCode: /^[A-Z0-9_]{1,40}$/.test(error.code ?? '') ? error.code : null }))
    request.once('response', response => {
      const chunks = []
      let size = 0
      response.on('data', chunk => {
        size += chunk.length
        if (size <= maxBytes) chunks.push(Buffer.from(chunk))
      })
      response.once('aborted', () => finish({ type: 'aborted', status: response.statusCode }))
      response.once('error', () => finish({ type: 'response-error', status: response.statusCode }))
      response.once('end', () => {
        if (size > maxBytes) { finish({ type: 'too-large', status: response.statusCode, bytes: size }); return }
        try {
          let bytes = Buffer.concat(chunks)
          const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase()
          if (encoding === 'gzip') bytes = zlib.gunzipSync(bytes, { maxOutputLength: maxBytes })
          else if (encoding === 'deflate') bytes = zlib.inflateSync(bytes, { maxOutputLength: maxBytes })
          else if (encoding === 'br') bytes = zlib.brotliDecompressSync(bytes, { maxOutputLength: maxBytes })
          const body = JSON.parse(bytes.toString('utf8'))
          const req = body?.req
          const songs = req?.data?.body?.item_song
          finish({ type: 'json', status: response.statusCode, bytes: size, code: code(body?.code), reqCode: code(req?.code), hasData: !!req?.data, songCount: Array.isArray(songs) ? songs.length : null })
        } catch {
          finish({ type: 'non-json-or-encoding-error', status: response.statusCode, bytes: size })
        }
      })
    })
    return request
  }
  https.request = observe
  window.__lxQqSearchCapture = {
    stop,
    export: () => JSON.stringify({
      schemaVersion: 1,
      environment: { version: process.versions.app ?? 'unknown', electron: process.versions.electron, platform: process.platform, arch: process.arch },
      records,
    }, null, 2),
  }
  timer = setTimeout(stop, 10 * 60 * 1000)
  console.log('QQ 搜索诊断已启用。请搜索并重试几次，再执行 copy(window.__lxQqSearchCapture.export())。不记录关键词、Cookie、签名或完整响应；10 分钟后自动停止。')
})()
