export const SIDEBAR_ITEMS = [
  { id: 'Search', to: '/search', label: 'search', icon: '#icon-search-2', viewBox: '0 0 425.2 425.2' },
  { id: 'SongList', to: '/songList/list', label: 'song_list', icon: '#icon-album', viewBox: '0 0 425.2 425.2' },
  { id: 'Leaderboard', to: '/leaderboard', label: 'leaderboard', icon: '#icon-leaderboard', viewBox: '0 0 425.22 425.2' },
  { id: 'List', to: '/list', label: 'my_list', icon: '#icon-love', viewBox: '0 0 444.87 391.18' },
  { id: 'Download', to: '/download', label: 'download', icon: '#icon-download-2', viewBox: '0 0 425.2 425.2' },
  { id: 'Setting', to: '/setting', label: 'setting', icon: '#icon-setting', viewBox: '0 0 493.23 436.47' },
] as const

export type SidebarId = typeof SIDEBAR_ITEMS[number]['id']
export const DEFAULT_SIDEBAR_ORDER = SIDEBAR_ITEMS.map(item => item.id).join(',')
export const SIDEBAR_MIN_WIDTH = 64
export const SIDEBAR_MAX_WIDTH = 240

export const SIDEBAR_VISIBILITY = {
  Search: 'ui.sidebar.showSearch',
  SongList: 'ui.sidebar.showSongList',
  Leaderboard: 'ui.sidebar.showLeaderboard',
  List: 'ui.sidebar.showList',
  Download: 'download.enable',
} as const

export const parseSidebarOrder = (value: unknown): SidebarId[] => {
  const ids: SidebarId[] = []
  if (typeof value == 'string') {
    for (const id of value.split(',')) {
      if (SIDEBAR_ITEMS.some(item => item.id == id) && !ids.includes(id as SidebarId)) ids.push(id as SidebarId)
    }
  }
  for (const item of SIDEBAR_ITEMS) if (!ids.includes(item.id)) ids.push(item.id)
  return ids
}

export const sidebarItemVisible = (id: SidebarId, settings: LX.AppSetting) => id == 'Setting' || settings[SIDEBAR_VISIBILITY[id]]

/** Reorder visible slots while retaining the saved positions of hidden buttons. */
export const moveSidebarItem = (order: SidebarId[], visible: SidebarId[], id: SidebarId, toIndex: number) => {
  const fromIndex = visible.indexOf(id)
  if (fromIndex < 0 || toIndex < 0 || toIndex >= visible.length || fromIndex == toIndex) return order
  const reordered = [...visible]
  reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, id)
  const visibleIds = new Set(visible)
  let index = 0
  return order.map(item => visibleIds.has(item) ? reordered[index++] : item)
}
