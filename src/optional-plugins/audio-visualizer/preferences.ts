import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { reactive, ref } from '@common/utils/vueTools'
import type { PluginContext } from '@common/optionalPluginTypes'
import { normalizeStyle, type VisualizerStyle, type VisualizerSurface } from './styles'

interface Preferences { main: VisualizerStyle, desktop: VisualizerStyle }
export const preferences = reactive<Preferences>({ main: 'spectrum', desktop: 'spectrum' })
export const preferencesReady = ref(false)
export const preferencesError = ref(false)
let persist: ((value: Preferences) => void) | null = null

export const initPreferences = (context: PluginContext, readonly = false) => {
  // Keep preferences beside the versioned installs so updates and uninstalls retain them.
  const directory = path.join(path.dirname(fileURLToPath(context.assetUrl('.'))), 'preferences')
  const filename = path.join(directory, 'audio-visualizer.json')
  let watcher: fs.FSWatcher | null = null
  let disposed = false
  const read = () => {
    if (disposed) return
    try {
      if (!fs.existsSync(filename)) return
      if (fs.statSync(filename).size > 4096) throw new Error('Visualizer preferences are too large')
      const value = JSON.parse(fs.readFileSync(filename, 'utf8')) as Preferences
      preferences.main = normalizeStyle(value?.main)
      preferences.desktop = normalizeStyle(value?.desktop)
      preferencesError.value = false
    } catch (error) {
      preferencesError.value = true
      console.error('Visualizer preferences could not be read:', error)
    }
  }
  try {
    fs.mkdirSync(directory, { recursive: true })
    if (readonly) {
      watcher = fs.watch(directory, { persistent: false }, (_event, name) => {
        if (!name || name.toString() === path.basename(filename)) read()
      })
      watcher.on('error', error => { console.error('Visualizer preferences watcher failed:', error) })
    } else {
      persist = value => {
        const temporary = path.join(directory, `audio-visualizer-${randomUUID()}.tmp`)
        try {
          // Finish this small write before closing the window or unloading the plugin.
          fs.writeFileSync(temporary, JSON.stringify({ version: 1, ...value }), { flag: 'wx' })
          fs.renameSync(temporary, filename)
        } finally {
          fs.rmSync(temporary, { force: true })
        }
      }
    }
    read()
    preferencesReady.value = true
  } catch (error) {
    preferencesError.value = true
    console.error('Visualizer preferences could not be initialized:', error)
  }
  return () => {
    disposed = true
    watcher?.close()
    persist = null
    preferencesReady.value = false
  }
}

export const saveStyle = (surface: VisualizerSurface, style: VisualizerStyle) => {
  if (!persist || !preferencesReady.value) return
  const value = { ...preferences, [surface]: normalizeStyle(style) }
  try {
    persist(value)
    Object.assign(preferences, value)
    preferencesError.value = false
  } catch (error) {
    preferencesError.value = true
    console.error('Visualizer preferences could not be saved:', error)
  }
}
