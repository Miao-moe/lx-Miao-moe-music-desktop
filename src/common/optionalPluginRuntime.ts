import * as vue from 'vue'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PLUGIN_IDS, type InstalledPlugin, type PluginId, type PluginStoreSnapshot } from './optionalPlugins'
import type { PluginModule } from './optionalPluginTypes'

declare const __non_webpack_require__: NodeJS.Require

declare global {
  interface Window {
    __lxPluginHost: Record<string, unknown>
  }
}

export const createPluginRuntime = (host: Record<string, unknown>, lyric = false) => {
  // Vue's Node ESM entry re-exports CommonJS; use that object directly to retain all helpers.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  window.__lxPluginHost = { ...host, vue: require('vue') as typeof vue }
  const components = vue.shallowReactive<Partial<Record<PluginId, PluginModule['components']>>>({})
  const errors = vue.reactive<Partial<Record<PluginId, string>>>({})
  const loaded = new Map<PluginId, { directory: string, dispose: () => void }>()
  let latest: PluginStoreSnapshot | null = null
  let queue: Promise<void> = Promise.resolve()
  let stopped = false

  const unload = async(id: PluginId) => {
    const plugin = loaded.get(id)
    Reflect.deleteProperty(components, id)
    await vue.nextTick()
    try { plugin?.dispose() } finally { loaded.delete(id) }
  }

  const load = async(id: PluginId, installed: InstalledPlugin) => {
    const { directory, manifest } = installed
    const entry = lyric ? manifest.lyricEntry : manifest.entry
    if (!entry) return
    const entryPath = path.join(directory, entry)
    // Installed modules are loaded by Node, outside Webpack's module graph.
    const requirePlugin = __non_webpack_require__
    const styles: HTMLStyleElement[] = []
    const scope = vue.effectScope(true)
    let deactivate: (() => void) | undefined
    const dispose = () => {
      try { deactivate?.() } finally {
        scope.stop()
        for (const style of styles) style.remove()
        Reflect.deleteProperty(requirePlugin.cache, entryPath)
      }
    }
    try {
      for (const name of (lyric ? manifest.lyricStyles : manifest.styles) ?? []) {
        const style = document.createElement('style')
        style.dataset.plugin = id
        style.textContent = await fs.readFile(path.join(directory, name), 'utf8')
        document.head.appendChild(style)
        styles.push(style)
      }
      if (stopped || latest?.installed[id]?.directory !== directory) { dispose(); return }
      const module = requirePlugin(entryPath) as { default: PluginModule }
      if (!module.default?.components || typeof module.default.components != 'object') throw new Error('Invalid plugin module')
      deactivate = scope.run(() => module.default.activate?.({
        version: manifest.version,
        assetUrl: name => pathToFileURL(path.join(directory, name)).href,
        readAsset: async name => fs.readFile(path.join(directory, name)),
      }))
      loaded.set(id, { directory, dispose })
      components[id] = vue.markRaw(module.default.components)
      Reflect.deleteProperty(errors, id)
    } catch (error: any) {
      dispose()
      errors[id] = error.message
      console.error(`Plugin ${id} failed to load:`, error)
    }
  }

  const sync = async(snapshot: PluginStoreSnapshot) => {
    if (stopped || (latest && snapshot.revision < latest.revision)) return
    latest = snapshot
    const task = queue.then(async() => {
      if (stopped) return
      for (const id of PLUGIN_IDS) {
        const installed = latest?.installed[id]
        if (installed?.directory === loaded.get(id)?.directory) continue
        await unload(id)
        if (installed) await load(id, installed)
        else Reflect.deleteProperty(errors, id)
      }
    })
    queue = task.catch(console.error)
    return task
  }

  return {
    components,
    errors,
    sync,
    unload,
    async dispose() {
      stopped = true
      await queue
      for (const id of PLUGIN_IDS) await unload(id)
    },
  }
}
