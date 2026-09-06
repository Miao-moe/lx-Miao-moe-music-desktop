import { computed, reactive, watch, type Ref } from '@common/utils/vueTools'
import { COOKIE_SOURCES, SOURCE_NAME, type CookieSource } from '@renderer/utils/cookieManager'
import { userLists } from '@renderer/store/list/state'

const STORAGE_KEY = 'my-list-platform-folders'

export const getListFolder = (list?: LX.List.UserListInfo): CookieSource | undefined => {
  return list && COOKIE_SOURCES.find(source => list.id.startsWith(`userlist_${source}_sync_`))
}

export default ({ listId }: { listId: Ref<string> }) => {
  const expandedFolders = reactive<Record<string, boolean>>({})
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    for (const source of COOKIE_SOURCES) expandedFolders[source] = saved?.[source] === true
  } catch {}

  const listGroups = computed(() => {
    const groups: Array<{
      id: string
      source?: CookieSource
      name?: string
      lists: Array<{ item: LX.List.UserListInfo, index: number, name: string }>
    }> = [
      { id: 'local', lists: [] },
      ...COOKIE_SOURCES.map(source => ({ id: source, source, name: SOURCE_NAME[source], lists: [] })),
    ]
    userLists.forEach((item, index) => {
      const source = getListFolder(item)
      const group = groups.find(group => group.source === source)!
      const prefix = source ? `${SOURCE_NAME[source]} - ` : ''
      const name = prefix && item.name.startsWith(prefix) ? item.name.slice(prefix.length) : item.name
      group.lists.push({ item, index, name })
    })
    return groups
  })

  watch(() => getListFolder(userLists.find(list => list.id === listId.value)), source => {
    if (source) expandedFolders[source] = true
  }, { immediate: true })

  watch(expandedFolders, state => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
  })

  const toggleFolder = (source: CookieSource) => {
    expandedFolders[source] = !expandedFolders[source]
  }

  return { listGroups, expandedFolders, toggleFolder }
}
