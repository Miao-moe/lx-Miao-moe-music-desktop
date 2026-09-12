import { reactive } from '@common/utils/vueTools'
import { runWebDAV, getWebDAVLastResult } from '@renderer/utils/ipc'
import { appSetting } from './setting'
import { withDownloadListSync } from './download/action'

export const webdav = reactive<{ busy: boolean, operation: LX.WebDAV.Operation | null, result: LX.WebDAV.Result | null }>({
  busy: false,
  operation: null,
  result: null,
})

export const initWebDAVStatus = async() => {
  const result = await getWebDAVLastResult()
  if (!webdav.busy && !webdav.result) webdav.result = result
}

export const runWebDAVAction = async(operation: LX.WebDAV.Operation) => {
  if (webdav.busy) return
  webdav.busy = true
  webdav.operation = operation
  try {
    const applyDownloads = (operation == 'sync' || operation == 'download') && (appSetting['sync.webdav.downloadHistory'] || appSetting['sync.webdav.downloadTasks'])
    webdav.result = await (applyDownloads ? withDownloadListSync(async() => runWebDAV(operation)) : runWebDAV(operation))
  } catch (error) {
    webdav.result = {
      success: false,
      operation,
      time: Date.now(),
      uploaded: [],
      downloaded: [],
      error: error instanceof Error && error.message == 'downloads_running' ? 'downloads_running' : 'local_error',
    }
  } finally {
    webdav.busy = false
    webdav.operation = null
  }
}
