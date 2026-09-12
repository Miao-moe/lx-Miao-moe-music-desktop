import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { initWebDAVStatus, runWebDAVAction, webdav } from '@renderer/store/webdav'

export default () => {
  let timer: ReturnType<typeof setTimeout> | null = null
  let started = false
  let revision = 0
  const interval = () => Math.max(1, Math.min(1440, Number(appSetting['sync.webdav.interval']) || 5)) * 60_000
  const schedule = (delay = 10_000) => {
    if (timer) clearTimeout(timer)
    timer = null
    const current = ++revision
    if (!started || !appSetting['sync.webdav.enable'] || !appSetting['sync.webdav.autoSync'] || !appSetting['sync.webdav.url'].trim()) return
    timer = setTimeout(async() => {
      if (navigator.onLine && !webdav.busy) await runWebDAVAction('sync')
      if (current == revision) schedule(interval())
    }, delay)
  }
  const unwatch = watch(() => Object.entries(appSetting).filter(([key]) => key.startsWith('sync.webdav.')).map(([, value]) => value), () => { schedule() })
  const handleOnline = () => { schedule() }
  window.addEventListener('online', handleOnline)
  onBeforeUnmount(() => {
    started = false
    schedule()
    unwatch()
    window.removeEventListener('online', handleOnline)
  })
  return () => {
    started = true
    void initWebDAVStatus().catch(console.error)
    schedule()
  }
}
