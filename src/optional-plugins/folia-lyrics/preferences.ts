import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { computed, reactive, ref } from '@common/utils/vueTools'
import type { PluginContext } from '@common/optionalPluginTypes'
import { FOLIA_MODES, type FoliaMode } from './protocol'

interface Preferences { enabled: boolean, mode: FoliaMode }
export const preferences = reactive<Preferences>({ enabled: true, mode: 'classic' })
export const preferencesReady = ref(false)
export const preferencesError = ref(false)
export const enabled = computed(() => preferencesReady.value && preferences.enabled)
export const engineUrl = ref('')
let persist: ((value: Preferences) => void) | undefined

export const initPreferences = (context: PluginContext) => {
  const directory = path.join(path.dirname(fileURLToPath(context.assetUrl('.'))), 'preferences')
  const filename = path.join(directory, 'folia-lyrics.json')
  engineUrl.value = context.assetUrl('engine/index.html')
  try {
    fs.mkdirSync(directory, { recursive: true })
    if (fs.existsSync(filename)) {
      if (fs.statSync(filename).size > 4096) throw new Error('Folia preferences are too large')
      const value = JSON.parse(fs.readFileSync(filename, 'utf8')) as Partial<Preferences>
      preferences.enabled = typeof value.enabled === 'boolean' ? value.enabled : true
      preferences.mode = value.mode && FOLIA_MODES.includes(value.mode) ? value.mode : 'classic'
    }
    persist = value => {
      const temporary = path.join(directory, `folia-lyrics-${randomUUID()}.tmp`)
      try {
        fs.writeFileSync(temporary, JSON.stringify({ version: 1, ...value }), { flag: 'wx' })
        fs.renameSync(temporary, filename)
      } finally { fs.rmSync(temporary, { force: true }) }
    }
    preferencesReady.value = true
    preferencesError.value = false
  } catch (error) {
    preferencesError.value = true
    console.error('Folia preferences could not be read:', error)
  }
  return () => { preferencesReady.value = false; persist = undefined; engineUrl.value = '' }
}
export const savePreferences = (patch: Partial<Preferences>) => {
  if (!persist) return
  const value = { ...preferences, ...patch }
  if (!FOLIA_MODES.includes(value.mode)) return
  try {
    persist(value)
    Object.assign(preferences, value)
    preferencesError.value = false
  } catch (error) {
    preferencesError.value = true
    console.error('Folia preferences could not be saved:', error)
  }
}
