import getStore from '@main/utils/store'
import { getLocalListData, setLocalListData } from '@main/modules/sync/listEvent'
import { getLocalDislikeData, setLocalDislikeData } from '@main/modules/sync/dislikeEvent'
import { createClient } from './client'
import { hash, isCompleted, normalizeData, parseSnapshot, selectedSections, validateData } from './data'
import { planSync, type Baseline } from './plan'
import { WebDAVError } from './errors'

const state = { busy: false }

const readLocal = async(sections: LX.WebDAV.Section[]): Promise<LX.WebDAV.Data> => {
  const data: LX.WebDAV.Data = {}
  if (sections.includes('playlists')) data.playlists = await getLocalListData()
  if (sections.includes('dislike')) data.dislike = await getLocalDislikeData()
  if (sections.includes('settings')) data.settings = { ...global.lx.appSetting }
  if (sections.includes('downloadHistory') || sections.includes('downloadTasks')) {
    const tasks = await global.lx.worker.dbService.getDownloadList()
    if (sections.includes('downloadHistory')) data.downloadHistory = tasks.filter(isCompleted)
    if (sections.includes('downloadTasks')) data.downloadTasks = tasks.filter(task => !isCompleted(task))
  }
  return normalizeData(data, sections)
}

const applyLocal = async(data: LX.WebDAV.Data) => {
  if (data.downloadHistory !== undefined || data.downloadTasks !== undefined) {
    const current = await global.lx.worker.dbService.getDownloadList()
    if (current.some(task => task.status == 'run' || task.status == 'waiting')) throw new WebDAVError('downloads_running')
    const byId = new Map(current.map(task => [task.id, task]))
    const retained = current.filter(task => isCompleted(task) ? !data.downloadHistory : !data.downloadTasks)
    const ids = new Set(retained.map(task => task.id))
    // Preserve unselected records. When both categories contain an ID, completion takes precedence.
    for (const task of [...(data.downloadHistory ?? []), ...(data.downloadTasks ?? [])]) {
      if (ids.has(task.id)) continue
      ids.add(task.id)
      const local = byId.get(task.id)
      retained.push({
        ...task,
        metadata: { ...task.metadata, filePath: local && isCompleted(local) == isCompleted(task) ? local.metadata.filePath : '' },
      })
    }
    await global.lx.worker.dbService.downloadListReplace(retained)
  }
  if (data.playlists) await setLocalListData(data.playlists)
  if (data.dislike !== undefined) await setLocalDislikeData(data.dislike)
  if (data.settings) global.lx.event_app.update_config(data.settings)
}

export const getWebDAVLastResult = (): LX.WebDAV.Result | null => getStore('webdav').get<LX.WebDAV.Result>('lastResult') ?? null

export const runWebDAV = async(operation: LX.WebDAV.Operation): Promise<LX.WebDAV.Result> => {
  const result: LX.WebDAV.Result = { success: false, operation, time: Date.now(), uploaded: [], downloaded: [] }
  if (state.busy) return { ...result, error: 'busy' }
  state.busy = true
  try {
    const settings = { ...global.lx.appSetting }
    if (!['test', 'sync', 'upload', 'download'].includes(operation)) throw new WebDAVError('invalid_config')
    if (operation != 'test' && !settings['sync.webdav.enable']) throw new WebDAVError('disabled')
    const client = createClient({
      url: settings['sync.webdav.url'],
      username: settings['sync.webdav.username'],
      password: settings['sync.webdav.password'],
      directory: settings['sync.webdav.directory'],
    })
    if (operation == 'test') await client.test()
    else {
      const sections = selectedSections(settings)
      if (!sections.length) throw new WebDAVError('empty_selection')
      const storage = getStore('webdav')
      const identity = hash(client.identity)
      const baseline = storage.get<{ identity: string, data: Baseline }>('baseline')
      const previous = baseline?.identity == identity ? baseline.data : {}
      const local = await readLocal(sections)
      validateData(local, sections)
      const remoteFile = await client.read()
      if (operation == 'download' && remoteFile.content == null) throw new WebDAVError('missing_remote')
      const remote: LX.WebDAV.Snapshot = remoteFile.content == null ? { type: 'lx-music-webdav', version: 1, updatedAt: 0, data: {} } : parseSnapshot(remoteFile.content)
      validateData(remote.data, sections)
      const remoteData = normalizeData(remote.data, sections)
      const plan = planSync(operation, local, remoteData, previous, sections)

      const checkLocal = async() => {
        const latestSettings = global.lx.appSetting
        const configChanged = (Object.keys(settings) as Array<keyof LX.AppSetting>).some(key => key.startsWith('sync.webdav.') && settings[key] !== latestSettings[key])
        const current = await readLocal(sections)
        if (configChanged || hash(current) != hash(local)) throw new WebDAVError('local_changed')
      }
      await checkLocal()

      // Keep a recoverable local copy before any selected category is replaced.
      if (plan.download.length) {
        const backup = normalizeData(local, plan.download)
        if (plan.download.includes('downloadHistory') || plan.download.includes('downloadTasks')) {
          const tasks = await global.lx.worker.dbService.getDownloadList()
          if (plan.download.includes('downloadHistory')) backup.downloadHistory = tasks.filter(isCompleted)
          if (plan.download.includes('downloadTasks')) backup.downloadTasks = tasks.filter(task => !isCompleted(task))
        }
        getStore('webdav-local-backup').override({ type: 'lx-music-webdav', version: 1, updatedAt: Date.now(), data: backup })
      }
      for (const section of plan.upload) Object.assign(remote.data, { [section]: local[section] })
      if (plan.upload.length) {
        remote.updatedAt = Date.now()
        await client.write(JSON.stringify(remote), remoteFile)
        result.uploaded = plan.upload
      }
      if (plan.download.length) {
        // A network round trip must not overwrite edits made while it was in flight.
        await checkLocal()
        await applyLocal(normalizeData(remoteData, plan.download))
        result.downloaded = plan.download
      }
      const after = await readLocal(sections)
      const next: Baseline = { ...previous }
      for (const section of sections) {
        // Uploaded local state may have changed again during PUT; track the state actually sent.
        next[section] = {
          local: hash(plan.download.includes(section) ? after[section] : local[section]),
          remote: hash(plan.upload.includes(section) ? local[section] : remoteData[section]),
        }
      }
      storage.set('baseline', { identity, data: next })
    }
    result.success = true
  } catch (error) {
    if (error instanceof WebDAVError) {
      result.error = error.code
      result.sections = error.sections
      result.statusCode = error.statusCode
    } else result.error = 'local_error'
  } finally {
    state.busy = false
  }
  result.time = Date.now()
  // Neither server bodies nor credential-bearing URLs are exposed in diagnostics.
  try { getStore('webdav').set('lastResult', result) } catch { /* The operation result remains available to the caller. */ }
  return result
}
