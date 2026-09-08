import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { isPluginId, OFFICIAL_PLUGIN_ROOT, PLUGIN_CATALOG_FILE, isPluginApiSupported, type PluginDisplayInfo, type PluginCatalog, type PluginCatalogEntry, type PluginId, type PluginManifest, type PluginStoreSnapshot } from '@common/optionalPlugins'

const MAX_PACKAGE_BYTES = 20 * 1024 * 1024
const MAX_UNPACKED_BYTES = 40 * 1024 * 1024
const MAX_CATALOG_BYTES = 512 * 1024
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex')
const validVersion = (value: unknown): value is string => typeof value == 'string' && /^\d{1,8}\.\d{1,8}\.\d{1,8}$/.test(value)
const validHash = (value: unknown): value is string => typeof value == 'string' && /^[a-f0-9]{64}$/.test(value)
const validFile = (value: unknown): value is string => typeof value == 'string' && value.length < 180 && value.split('/').every(part => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part) && !part.endsWith('.') && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))
type Registry = Partial<Record<PluginId, { directory: string, manifestHash: string }>>
type FetchBinary = (url: string, maxBytes: number) => Promise<Buffer>

const validText = (value: unknown, limit: number): boolean => value == null || (typeof value === 'string'
  ? value.length <= limit
  : typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length <= 16 && Object.entries(value).every(([key, text]) =>
    /^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(key) && typeof text === 'string' && text.length <= limit))
const validDisplayInfo = (value: PluginDisplayInfo) => validText(value.name, 120) && validText(value.description, 2000) &&
  (value.icon == null || (typeof value.icon === 'string' && /^#icon-[a-z0-9-]{1,64}$/.test(value.icon)))

export const parseCatalog = (bytes: Buffer): PluginCatalog => {
  if (bytes.length > MAX_CATALOG_BYTES) throw new Error('Plugin catalog is too large')
  const catalog = JSON.parse(bytes.toString('utf8')) as PluginCatalog
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.plugins) || catalog.plugins.length > 200) throw new Error('Invalid plugin catalog')
  const ids = new Set<string>()
  for (const plugin of catalog.plugins) {
    if (!plugin || !isPluginId(plugin.id) || ids.has(plugin.id) || !validDisplayInfo(plugin) || !validVersion(plugin.version) || !Number.isSafeInteger(plugin.apiVersion) ||
      !validHash(plugin.sha256) || !Number.isSafeInteger(plugin.bytes) || plugin.bytes <= 0 || plugin.bytes > MAX_PACKAGE_BYTES ||
      !validFile(plugin.path) || !plugin.path.startsWith(`${plugin.id}/${plugin.version}/`) || !plugin.path.endsWith('.lxplugin')) throw new Error('Invalid plugin catalog entry')
    ids.add(plugin.id)
  }
  return catalog
}

const validateManifest = (manifest: PluginManifest, id: PluginId) => {
  if (!manifest || manifest.id !== id || !validDisplayInfo(manifest) || !validVersion(manifest.version) || !isPluginApiSupported(manifest.apiVersion) ||
    manifest.entry !== 'renderer.js' || (manifest.lyricEntry != null && manifest.lyricEntry !== 'lyric.js') ||
    !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 100 ||
    !Array.isArray(manifest.styles) || (manifest.lyricStyles != null && !Array.isArray(manifest.lyricStyles))) throw new Error('Invalid plugin manifest')
  const names = new Set<string>()
  const normalizedNames = new Set<string>()
  let total = 0
  for (const file of manifest.files) {
    if (!validFile(file.path) || file.path.toLowerCase() === 'manifest.json' || normalizedNames.has(file.path.toLowerCase()) || !validHash(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) throw new Error('Invalid plugin file')
    names.add(file.path)
    normalizedNames.add(file.path.toLowerCase())
    total += file.bytes
  }
  if (total > MAX_UNPACKED_BYTES || !names.has(manifest.entry) || (manifest.lyricEntry && !names.has(manifest.lyricEntry)) ||
    [...manifest.styles, ...(manifest.lyricStyles ?? [])].some(file => !names.has(file) || !file.endsWith('.css'))) throw new Error('Incomplete plugin package')
}

export const unpackPlugin = (bytes: Buffer, entry: PluginCatalogEntry) => {
  if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) throw new Error('Plugin download checksum mismatch')
  const archive = JSON.parse(gunzipSync(bytes, { maxOutputLength: MAX_UNPACKED_BYTES }).toString('utf8')) as { manifest: PluginManifest, files: Record<string, string> }
  validateManifest(archive.manifest, entry.id)
  if (archive.manifest.version !== entry.version || archive.manifest.apiVersion !== entry.apiVersion || !archive.files || typeof archive.files != 'object' || Object.keys(archive.files).length !== archive.manifest.files.length) throw new Error('Plugin package does not match the catalog')
  const files = archive.manifest.files.map(file => {
    const encoded = archive.files[file.path]
    if (typeof encoded != 'string') throw new Error('Missing plugin file')
    const data = Buffer.from(encoded, 'base64')
    if (data.length !== file.bytes || digest(data) !== file.sha256) throw new Error('Plugin file checksum mismatch')
    return { path: file.path, data }
  })
  return { manifest: archive.manifest, files }
}

export class PluginManager {
  private revision = 0
  private catalog: PluginCatalogEntry[] = []
  private catalogError: string | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private catalogReady?: Promise<void>

  constructor(private readonly root: string, private readonly fetchBinary: FetchBinary) {}

  private child(name: string) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name === '.' || name === '..') throw new Error('Invalid plugin directory')
    const result = path.resolve(this.root, name)
    if (path.dirname(result) !== path.resolve(this.root)) throw new Error('Plugin path is outside its directory')
    return result
  }

  private async prepare() {
    await fs.mkdir(this.root, { recursive: true })
    if ((await fs.lstat(this.root)).isSymbolicLink()) throw new Error('Plugin directory cannot be a symbolic link')
  }

  private async readRegistry(): Promise<Registry> {
    await this.prepare()
    try {
      const registry = JSON.parse(await fs.readFile(this.child('installed.json'), 'utf8')) as Registry
      if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new Error('Invalid plugin registry')
      return registry
    } catch (error: any) {
      if (error.code === 'ENOENT') return {}
      throw error
    }
  }

  private async saveRegistry(registry: Registry) {
    const temporary = this.child(`registry-${randomUUID()}.tmp`)
    try {
      await fs.writeFile(temporary, JSON.stringify(registry, null, 2))
      await fs.rename(temporary, this.child('installed.json'))
    } finally {
      await fs.rm(temporary, { force: true })
    }
  }

  private installedDirectory(id: PluginId, name: string) {
    if (!isPluginId(id) || typeof name !== 'string' || !name.startsWith(id + '-') ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(name.slice(id.length + 1))) throw new Error('Invalid installed plugin directory')
    return this.child(name)
  }

  private async removeDirectory(id: PluginId, name: string) {
    const target = this.installedDirectory(id, name)
    await this.prepare()
    await fs.rm(target, { recursive: true, force: true })
  }

  private async loadCatalogCache() {
    this.catalogReady ??= (async() => {
      await this.prepare()
      try {
        const filename = this.child('catalog-cache.json')
        const stat = await fs.lstat(filename)
        if (!stat.isFile() || stat.size > MAX_CATALOG_BYTES) return
        this.catalog = parseCatalog(await fs.readFile(filename)).plugins
      } catch (error: any) {
        if (error.code !== 'ENOENT') console.error('Plugin catalog cache could not be read:', error.message)
      }
    })()
    await this.catalogReady
  }

  private async saveCatalogCache(catalog: PluginCatalog) {
    const temporary = this.child(`catalog-${randomUUID()}.tmp`)
    try {
      await fs.writeFile(temporary, JSON.stringify(catalog), { flag: 'wx' })
      await fs.rename(temporary, this.child('catalog-cache.json'))
    } finally { await fs.rm(temporary, { force: true }) }
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation)
    this.queue = task.catch(() => {})
    return task
  }

  async snapshot(): Promise<PluginStoreSnapshot> {
    await this.loadCatalogCache()
    const revision = this.revision
    const registry = await this.readRegistry()
    const snapshot: PluginStoreSnapshot = { revision, catalog: this.catalog, installed: {}, errors: {}, catalogError: this.catalogError }
    for (const [id, record] of Object.entries(registry)) {
      if (!isPluginId(id) || !record) continue
      try {
        const directory = this.installedDirectory(id, record.directory)
        if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error('Invalid installed plugin directory')
        const manifestBytes = await fs.readFile(path.join(directory, 'manifest.json'))
        if (digest(manifestBytes) !== record.manifestHash) throw new Error('Installed plugin manifest checksum mismatch')
        const manifest = JSON.parse(manifestBytes.toString('utf8')) as PluginManifest
        validateManifest(manifest, id)
        for (const file of manifest.files) {
          const filename = path.join(directory, file.path)
          if ((await fs.lstat(filename)).isSymbolicLink()) throw new Error('Invalid installed plugin file')
          const bytes = await fs.readFile(filename)
          if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error('Installed plugin file checksum mismatch')
        }
        snapshot.installed[id] = { manifest, directory }
      } catch (error: any) {
        snapshot.errors[id] = error.message
      }
    }
    return revision === this.revision ? snapshot : this.snapshot()
  }

  async refresh() {
    await this.loadCatalogCache()
    try {
      const catalog = parseCatalog(await this.fetchBinary(OFFICIAL_PLUGIN_ROOT + PLUGIN_CATALOG_FILE, MAX_CATALOG_BYTES))
      this.catalog = catalog.plugins
      this.catalogError = null
      await this.saveCatalogCache(catalog).catch((error: Error) => { console.error('Plugin catalog cache could not be saved:', error.message) })
    } catch (error: any) {
      this.catalogError = error.message
    }
    this.revision++
    return this.snapshot()
  }

  async install(id: PluginId) {
    return this.exclusive(async() => {
      if (!isPluginId(id)) throw new Error('Unknown official plugin')
      await this.loadCatalogCache()
      if (!this.catalog.length) await this.refresh()
      const entry = this.catalog.find(plugin => plugin.id === id)
      if (!entry) throw new Error(this.catalogError ?? 'Plugin is not published in the official catalog')
      if (!isPluginApiSupported(entry.apiVersion)) throw new Error('Plugin requires a different application version')
      const archive = unpackPlugin(await this.fetchBinary(new URL(entry.path, OFFICIAL_PLUGIN_ROOT).href, MAX_PACKAGE_BYTES), entry)
      const registry = await this.readRegistry()
      const previous = registry[id]
      const temporaryName = `install-${randomUUID()}`
      const directoryName = `${id}-${randomUUID()}`
      const temporary = this.child(temporaryName)
      let committed = false
      try {
        await fs.mkdir(temporary)
        for (const file of archive.files) {
          const filename = path.join(temporary, file.path)
          await fs.mkdir(path.dirname(filename), { recursive: true })
          await fs.writeFile(filename, file.data, { flag: 'wx' })
        }
        const manifestBytes = Buffer.from(JSON.stringify(archive.manifest))
        await fs.writeFile(path.join(temporary, 'manifest.json'), manifestBytes)
        await fs.rename(temporary, this.child(directoryName))
        registry[id] = { directory: directoryName, manifestHash: digest(manifestBytes) }
        await this.saveRegistry(registry)
        this.revision++
        committed = true
        if (previous) await this.removeDirectory(id, previous.directory).catch(console.error)
      } finally {
        await this.removeDirectory('install', temporaryName)
        if (!committed) await this.removeDirectory(id, directoryName)
      }
      return this.snapshot()
    })
  }

  async uninstall(id: PluginId) {
    return this.exclusive(async() => {
      if (!isPluginId(id)) throw new Error('Unknown official plugin')
      const registry = await this.readRegistry()
      const previous = registry[id]
      if (previous) {
        // Keep the registration until removal succeeds, so a failed uninstall can be retried.
        await this.removeDirectory(id, previous.directory)
        Reflect.deleteProperty(registry, id)
        await this.saveRegistry(registry)
        this.revision++
      }
      return this.snapshot()
    })
  }
}
