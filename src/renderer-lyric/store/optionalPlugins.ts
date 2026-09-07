import { ipcRenderer } from 'electron'
import { PLUGIN_IPC, type PluginStoreSnapshot } from '@common/optionalPlugins'
import { createPluginRuntime } from '@common/optionalPluginRuntime'
import { isPlay, setting } from './state'
import { useEvent, getAnalyserDataArray } from '@lyric/core/mainWindowChannel'

export const pluginRuntime = createPluginRuntime({
  lyricState: { isPlay, setting },
  lyricChannel: { useEvent, getAnalyserDataArray },
}, true)
export const initOptionalPlugins = () => {
  const onChange = (_event: Electron.IpcRendererEvent, snapshot: PluginStoreSnapshot) => { void pluginRuntime.sync(snapshot).catch(console.error) }
  ipcRenderer.on(PLUGIN_IPC.changed, onChange)
  void ipcRenderer.invoke(PLUGIN_IPC.list).then(snapshot => pluginRuntime.sync(snapshot)).catch(console.error)
  return () => {
    ipcRenderer.removeListener(PLUGIN_IPC.changed, onChange)
    void pluginRuntime.dispose()
  }
}
