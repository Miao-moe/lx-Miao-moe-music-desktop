import { ipcRenderer } from 'electron'
import { computed, reactive, shallowRef } from '@common/utils/vueTools'
import { PLUGIN_IPC, type PluginId, type PluginStoreSnapshot } from '@common/optionalPlugins'
import { createPluginRuntime } from '@common/optionalPluginRuntime'
import * as player from '@renderer/plugins/player'
import * as settings from './setting'
import { isPlay } from './player/state'
import { dialog } from '@renderer/plugins/Dialog'
import { setDesktopAnalyserProvider } from '@renderer/core/lyric'
import { getUserSoundEffectConvolutionPresetList, getUserSoundEffectEQPresetList, saveUserSoundEffectConvolutionPresetList, saveUserSoundEffectEQPresetList } from '@renderer/utils/ipc'

export const pluginRuntime = createPluginRuntime({
  player,
  settings,
  playerState: { isPlay },
  dialog: { dialog },
  lyric: { setDesktopAnalyserProvider },
  ipc: { getUserSoundEffectConvolutionPresetList, getUserSoundEffectEQPresetList, saveUserSoundEffectConvolutionPresetList, saveUserSoundEffectEQPresetList },
})
export const pluginStore = shallowRef<PluginStoreSnapshot>({ revision: -1, catalog: [], installed: {}, errors: {}, catalogError: null })
export const pluginBusy = reactive<Partial<Record<PluginId, boolean>>>({})
export const pluginOperationErrors = reactive<Partial<Record<PluginId, string>>>({})
export const visualizerInstalled = computed(() => !!pluginRuntime.components['audio-visualizer'])
export const pluginStoreError = shallowRef<string | null>(null)

const applySnapshot = async(snapshot: PluginStoreSnapshot) => {
  if (snapshot.revision < pluginStore.value.revision) return
  pluginStore.value = snapshot
  await pluginRuntime.sync(snapshot)
}
export const refreshPlugins = async() => {
  pluginStoreError.value = null
  try { await applySnapshot(await ipcRenderer.invoke(PLUGIN_IPC.refresh)) } catch (error: any) { pluginStoreError.value = error.message }
}
export const changePluginInstallation = async(id: PluginId, install: boolean) => {
  if (pluginBusy[id]) return
  pluginBusy[id] = true
  Reflect.deleteProperty(pluginOperationErrors, id)
  try {
    if (!install) await pluginRuntime.unload(id)
    await applySnapshot(await ipcRenderer.invoke(install ? PLUGIN_IPC.install : PLUGIN_IPC.uninstall, id))
  } catch (error: any) {
    pluginOperationErrors[id] = error.message
    await applySnapshot(await ipcRenderer.invoke(PLUGIN_IPC.list)).catch(console.error)
  } finally {
    pluginBusy[id] = false
  }
}
export const initOptionalPlugins = async() => {
  const onChange = (_event: Electron.IpcRendererEvent, snapshot: PluginStoreSnapshot) => { void applySnapshot(snapshot).catch(console.error) }
  ipcRenderer.on(PLUGIN_IPC.changed, onChange)
  try { await applySnapshot(await ipcRenderer.invoke(PLUGIN_IPC.list)) } catch (error: any) { pluginStoreError.value = error.message }
  return () => {
    ipcRenderer.removeListener(PLUGIN_IPC.changed, onChange)
    void pluginRuntime.dispose()
  }
}
