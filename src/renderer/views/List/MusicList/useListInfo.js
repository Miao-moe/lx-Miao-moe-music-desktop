import { ref, shallowRef, nextTick, watch, computed, onBeforeUnmount } from '@common/utils/vueTools'
import { playMusicInfo, playInfo, isPlay } from '@renderer/store/player/state'
import { getListMusics } from '@renderer/store/list/action'
import { appSetting } from '@renderer/store/setting'
import { allMusicList } from '@renderer/store/list/state'


export default ({ props, onLoadedList }) => {
  const rightClickSelectedIndex = ref(-1)
  const selectedIndex = ref(-1)
  const dom_listContent = ref(null)
  const listRef = ref(null)

  const excludeListIds = computed(() => ([props.listId]))


  const list = shallowRef([])
  let generation = 0
  const loadList = (restoreScroll) => {
    const id = props.listId
    const current = ++generation
    const apply = songs => {
      if (current !== generation || id !== props.listId) return
      list.value = [...songs]
      if (restoreScroll) {
        // A warm cache is available during setup, before the scroll helpers mount.
        nextTick(() => {
          if (current === generation && id === props.listId) onLoadedList()
        })
      }
    }
    const cached = allMusicList.get(id)
    if (cached) apply(cached) // Includes an intentionally empty playlist.
    else {
      list.value = []
      getListMusics(id).then(apply).catch(error => { console.error('Load local playlist failed', error) })
    }
  }
  watch(() => props.listId, () => { loadList(true) }, { immediate: true })

  const playerInfo = computed(() => ({
    isPlayList: playMusicInfo.listId == props.listId,
    playIndex: playInfo.playIndex,
    isPlay: isPlay.value,
  }))

  const setSelectedIndex = index => {
    selectedIndex.value = index
  }

  const isShowSource = computed(() => appSetting['list.isShowSource'])

  const handleMyListUpdate = (ids) => {
    if (!ids.includes(props.listId)) return
    loadList(false)
  }

  window.app_event.on('myListUpdate', handleMyListUpdate)

  onBeforeUnmount(() => {
    generation++
    window.app_event.off('myListUpdate', handleMyListUpdate)
  })

  return {
    rightClickSelectedIndex,
    selectedIndex,
    dom_listContent,
    listRef,
    list,
    playerInfo,
    setSelectedIndex,
    isShowSource,
    excludeListIds,
  }
}
