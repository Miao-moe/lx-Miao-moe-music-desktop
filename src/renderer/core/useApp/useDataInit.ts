import { getPlayInfo } from '@renderer/utils/ipc'
import music from '@renderer/utils/musicSdk'
import { log } from '@common/utils'
import { getListMusics, getUserLists, registerAction } from '@renderer/store/list/action'


import useInitUserApi from './useInitUserApi'
import { play, playList } from '@renderer/core/player'
import { onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { playMusicInfo } from '@renderer/store/player/state'
import { initDislikeInfo, registerRemoteDislikeAction } from '@renderer/core/dislikeList'
import { syncCookieListsOnStartup } from '@renderer/utils/cookieSync'
import { getListPrevSelectId } from '@renderer/utils/data'

const initPrevPlayInfo = async() => {
  const info = await getPlayInfo()
  window.lx.restorePlayInfo = null
  if (!info?.listId || info.index < 0) return
  const list = await getListMusics(info.listId)
  if (!list[info.index]) return
  window.lx.restorePlayInfo = info
  playList(info.listId, info.index)

  if (appSetting['player.startupAutoPlay']) {
    const musicInfo = playMusicInfo.musicInfo
    if (!musicInfo) return
    setTimeout(() => {
      if (musicInfo.id == playMusicInfo.musicInfo?.id) play()
    })
  }
}

export default () => {
  const initUserApi = useInitUserApi()

  let unregister: null | (() => void) = null
  let unregisterDislikeEvent: null | (() => void) = null

  onBeforeUnmount(() => {
    if (unregister) unregister()
    if (unregisterDislikeEvent) unregisterDislikeEvent()
  })

  return async() => {
    unregister = registerAction((ids) => {
      window.app_event.myListUpdate(ids)
    })
    // Local playlists can render while custom APIs are still initializing.
    const initLocalLists = async() => {
      window.lxData.userLists = await getUserLists()
      const previousId = await getListPrevSelectId()
      await getListMusics(previousId)
    }
    await Promise.all([
      initUserApi().catch(err => { log.error(err) }), // 自定义API
      initLocalLists(),
    ]).catch(err => {
      log.error(err)
    })
    void music.init() // 初始化音乐sdk
    unregisterDislikeEvent = registerRemoteDislikeAction()
    await initDislikeInfo() // 获取不喜欢列表
    await initPrevPlayInfo().catch(err => {
      log.error(err)
    }) // 初始化上次的歌曲播放信息

    // 启动时同步一次基于 Cookie 的平台歌单（静默、不阻塞启动）
    void syncCookieListsOnStartup()
  }
}
