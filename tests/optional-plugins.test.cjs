const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const Module = require('node:module')
const { createHash } = require('node:crypto')
const { gzipSync } = require('node:zlib')
const { test } = require('node:test')
const ts = require('typescript')

const project = path.resolve(__dirname, '..')
const modules = new Map()
function loadTs(filename) {
  if (modules.has(filename)) return modules.get(filename).exports
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = module.paths
  const originalRequire = loaded.require.bind(loaded)
  loaded.require = name => name.startsWith('@common/')
    ? loadTs(path.join(project, 'src/common', name.slice('@common/'.length) + '.ts'))
    : originalRequire(name)
  modules.set(filename, loaded)
  loaded._compile(ts.transpileModule(fsSync.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
  return loaded.exports
}
const { PluginManager, parseCatalog, unpackPlugin } = loadTs(path.join(project, 'src/main/modules/optionalPlugins/manager.ts'))
const { OFFICIAL_PLUGIN_ROOT } = loadTs(path.join(project, 'src/common/optionalPlugins.ts'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const bundle = (id, version = '1.0.0', transform = value => value) => {
  const data = Buffer.from('module.exports = { default: { components: {} } }')
  const manifest = { id, version, apiVersion: 1, entry: 'renderer.js', styles: [], files: [{ path: 'renderer.js', bytes: data.length, sha256: hash(data) }] }
  const archive = gzipSync(Buffer.from(JSON.stringify(transform({ manifest, files: { 'renderer.js': data.toString('base64') } }))))
  return { archive, entry: { id, version, apiVersion: 1, path: `${id}/${version}/${hash(archive)}.lxplugin`, bytes: archive.length, sha256: hash(archive) } }
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-plugin-manager-'))
  t.after(async() => {
    assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(), 'lx-plugin-manager-')))
    await fs.rm(root, { recursive: true, force: true })
  })
  const state = { packages: [bundle('sound-effects'), bundle('audio-visualizer')], offline: false, corruptDownload: false }
  const fetchBinary = async url => {
    if (state.offline) throw new Error('Offline')
    if (url === OFFICIAL_PLUGIN_ROOT + 'catalog.json') return Buffer.from(JSON.stringify({ schemaVersion: 1, plugins: state.packages.map(item => item.entry) }))
    const item = state.packages.find(item => url === OFFICIAL_PLUGIN_ROOT + item.entry.path)
    assert.ok(item, url)
    return state.corruptDownload ? Buffer.from('broken') : item.archive
  }
  return { root, state, manager: new PluginManager(root, fetchBinary), restart: () => new PluginManager(root, fetchBinary) }
}

test('the distributable official plugins pass all package checks', async() => {
  const root = path.join(project, 'plugins/official')
  const catalog = parseCatalog(await fs.readFile(path.join(root, 'catalog.json')))
  assert.equal(catalog.plugins.length, 2)
  for (const entry of catalog.plugins) {
    const result = unpackPlugin(await fs.readFile(path.join(root, entry.path)), entry)
    assert.equal(result.manifest.id, entry.id)
    assert.ok(result.files.some(file => file.path === 'renderer.js'))
    if (entry.id === 'sound-effects') assert.ok(result.files.some(file => file.path.startsWith('filters/')))
    else assert.ok(result.files.some(file => file.path === 'lyric.js'))
  }
})

test('catalog rejects traversal, foreign URLs, duplicate IDs and oversized packages', () => {
  const { entry } = bundle('sound-effects')
  for (const patch of [{ path: '../escape.lxplugin' }, { path: 'https://example.com/a.lxplugin' }, { path: 'sound-effects/1.0.0/a/../b.lxplugin' }, { id: 'unknown' }, { bytes: 30 * 1024 * 1024 }]) {
    assert.throws(() => parseCatalog(Buffer.from(JSON.stringify({ schemaVersion: 1, plugins: [{ ...entry, ...patch }] }))))
  }
  assert.throws(() => parseCatalog(Buffer.from(JSON.stringify({ schemaVersion: 1, plugins: [entry, entry] }))))
})

test('package checks reject corrupted downloads and unsafe file names before extraction', () => {
  const valid = bundle('sound-effects')
  assert.throws(() => unpackPlugin(Buffer.from('broken'), valid.entry), /checksum/)
  const tampered = Buffer.from(valid.archive)
  tampered[tampered.length - 1] ^= 1
  assert.throws(() => unpackPlugin(tampered, valid.entry), /checksum/)
  for (const filename of ['../escape.js', '/outside.js', 'C:/outside.js', 'folder\\outside.js', 'folder./outside.js', 'NUL.js', 'con/entry.js', 'Manifest.json']) {
    const unsafe = bundle('sound-effects', '1.0.0', archive => {
      archive.manifest.files[0].path = filename
      archive.files[filename] = archive.files['renderer.js']
      delete archive.files['renderer.js']
      return archive
    })
    assert.throws(() => unpackPlugin(unsafe.archive, unsafe.entry), /Invalid plugin file/)
  }
})

test('plugins install independently, survive an offline restart, and uninstall only their own files', async t => {
  const { manager, state, root, restart } = await fixture(t)
  await fs.writeFile(path.join(root, 'preserved-settings.json'), '{"eq":6}')
  await manager.refresh()
  assert.deepEqual(Object.keys((await manager.install('sound-effects')).installed), ['sound-effects'])
  const both = await manager.install('audio-visualizer')
  const soundDirectory = both.installed['sound-effects'].directory
  state.offline = true
  const reopened = restart()
  assert.equal(Object.keys((await reopened.snapshot()).installed).length, 2)
  assert.equal((await reopened.refresh()).catalogError, 'Offline')
  const remaining = await reopened.uninstall('sound-effects')
  assert.deepEqual(Object.keys(remaining.installed), ['audio-visualizer'])
  await assert.rejects(fs.stat(soundDirectory), { code: 'ENOENT' })
  assert.equal(await fs.readFile(path.join(root, 'preserved-settings.json'), 'utf8'), '{"eq":6}')
})

test('a failed update preserves the installed version and corruption can be repaired', async t => {
  const { manager, state } = await fixture(t)
  await manager.refresh()
  const initial = (await manager.install('sound-effects')).installed['sound-effects']
  state.packages[0] = bundle('sound-effects', '1.1.0')
  await manager.refresh()
  state.corruptDownload = true
  await assert.rejects(manager.install('sound-effects'), /checksum/)
  assert.equal((await manager.snapshot()).installed['sound-effects'].directory, initial.directory)
  await fs.writeFile(path.join(initial.directory, 'renderer.js'), 'corrupt')
  const broken = await manager.snapshot()
  assert.equal(broken.installed['sound-effects'], undefined)
  assert.match(broken.errors['sound-effects'], /checksum/)
  state.corruptDownload = false
  const repaired = await manager.install('sound-effects')
  assert.equal(repaired.installed['sound-effects'].manifest.version, '1.1.0')
  assert.equal(repaired.errors['sound-effects'], undefined)
  await assert.rejects(fs.stat(initial.directory), { code: 'ENOENT' })
})

test('concurrent install and uninstall are serialized and unsupported plugin APIs are rejected', async t => {
  const { manager, state, root } = await fixture(t)
  await manager.refresh()
  await Promise.all([manager.install('sound-effects'), manager.uninstall('sound-effects')])
  assert.deepEqual((await manager.snapshot()).installed, {})
  assert.deepEqual(await fs.readdir(root), ['installed.json'])
  state.packages[0].entry.apiVersion = 99
  await manager.refresh()
  await assert.rejects(manager.install('sound-effects'), /different application version/)
  await assert.rejects(manager.install('../outside'), /Unknown official plugin/)
})
