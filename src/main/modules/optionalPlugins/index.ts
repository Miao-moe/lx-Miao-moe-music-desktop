import { BrowserWindow, ipcMain, net } from 'electron'
import path from 'node:path'
import { OFFICIAL_PLUGIN_ROOT, PLUGIN_CATALOG_FILE, PLUGIN_IPC, type PluginId, type PluginStoreSnapshot } from '@common/optionalPlugins'
import { PluginManager } from './manager'

export default () => {
  const manager = new PluginManager(path.join(global.lxDataPath, 'plugins'), async(url, maxBytes) => {
    if (!url.startsWith(OFFICIAL_PLUGIN_ROOT)) throw new Error('Invalid official plugin URL')
    // net.request also supports the Electron 22 Windows 7 build and the app's proxy.
    return new Promise<Buffer>((resolve, reject) => {
      const request = net.request({ url, partition: 'persist:win-main', redirect: 'error' })
      if (url.endsWith('/' + PLUGIN_CATALOG_FILE)) request.setHeader('Cache-Control', 'no-cache')
      let completed = false
      const fail = (error: Error) => {
        if (completed) return
        completed = true
        clearTimeout(timer)
        reject(error)
        request.abort()
      }
      const timer = setTimeout(() => { fail(new Error('Plugin download timed out')) }, 30_000)
      request.on('error', fail)
      request.on('response', response => {
        if (response.statusCode < 200 || response.statusCode >= 300) { fail(new Error(`GitHub HTTP ${response.statusCode}`)); return }
        if (Number(response.headers['content-length']) > maxBytes) { fail(new Error('Plugin download is too large')); return }
        const chunks: Buffer[] = []
        let length = 0
        response.on('error', fail)
        response.on('aborted', () => { fail(new Error('Plugin download interrupted')) })
        response.on('data', (chunk: Buffer) => {
          if (completed) return
          length += chunk.length
          if (length > maxBytes) { fail(new Error('Plugin download is too large')); return }
          chunks.push(chunk)
        })
        response.on('end', () => {
          if (completed) return
          completed = true
          clearTimeout(timer)
          resolve(Buffer.concat(chunks))
        })
      })
      request.end()
    })
  })
  const broadcast = (snapshot: PluginStoreSnapshot) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.webContents.isDestroyed()) window.webContents.send(PLUGIN_IPC.changed, snapshot)
    }
    return snapshot
  }
  ipcMain.handle(PLUGIN_IPC.list, async() => manager.snapshot())
  ipcMain.handle(PLUGIN_IPC.refresh, async() => broadcast(await manager.refresh()))
  ipcMain.handle(PLUGIN_IPC.install, async(_event, id: PluginId) => broadcast(await manager.install(id)))
  ipcMain.handle(PLUGIN_IPC.uninstall, async(_event, id: PluginId) => broadcast(await manager.uninstall(id)))
}
