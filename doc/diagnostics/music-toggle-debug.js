/* eslint-env browser, node */
// Paste this entire file into the application's DevTools Console before reproducing.
(() => {
  if (!document.querySelector('#root')?._vnode || !window.lxData) {
    throw new Error('Run this script in the LX-M Music application Console.')
  }
  window.lxMusicToggleDebug?.stop()

  const fs = require('node:fs')
  const path = require('node:path')
  const os = require('node:os')
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lx-music-toggle-debug-'))
  const logPath = path.join(outputDir, 'music-toggle.jsonl')
  const maxBytes = 2 * 1024 * 1024
  let bytes = 0
  let stopped = false
  let traceNumber = 0
  let trace = null
  let unwatch = []

  const text = value => value == null ? null : String(value).slice(0, 300)
  const song = item => item ? {
    id: text(item.id),
    source: text(item.source),
    name: text(item.name),
    singer: text(item.singer),
    albumName: text(item.meta?.albumName),
    interval: text(item.interval),
  } : null

  const stop = () => {
    if (stopped) return
    stopped = true
    unwatch.forEach(dispose => dispose())
    unwatch = []
    document.removeEventListener('contextmenu', onContextMenu, true)
    document.removeEventListener('click', onClick, true)
    window.removeEventListener('beforeunload', stop)
    console.info('[MusicToggleDebug] Stopped. Log:', logPath)
  }
  const record = (stage, data) => {
    if (stopped) return
    const line = JSON.stringify({
      time: new Date().toISOString(),
      traceId: trace?.id ?? null,
      stage,
      ...data,
    }) + '\n'
    const size = Buffer.byteLength(line, 'utf8')
    if (bytes + size > maxBytes) {
      console.warn('[MusicToggleDebug] Reached the 2 MB limit. Run the script again to start a new log.')
      stop()
      return
    }
    try {
      fs.appendFileSync(logPath, line, 'utf8')
      bytes += size
      console.info('[MusicToggleDebug]', line.trim())
    } catch (error) {
      console.error('[MusicToggleDebug] Cannot write the diagnostic log:', error.message)
      stop()
    }
  }

  const inspectTree = () => {
    const nodes = []
    const components = []
    const visit = node => {
      if (!node) return
      if (Array.isArray(node)) return node.forEach(visit)
      nodes.push(node)
      if (node.component) {
        components.push(node.component)
        visit(node.component.subTree)
      } else if (Array.isArray(node.children)) node.children.forEach(visit)
    }
    visit(document.querySelector('#root')?._vnode)
    return { nodes, components }
  }
  const listState = () => {
    const component = trace.component
    const state = component.setupState
    return {
      listId: text(component.props.listId),
      listLength: state.list.length,
      menuOpen: state.isShowItemMenu,
      menuIndex: state.rightClickSelectedIndex,
      songAtMenuIndex: song(state.list[state.rightClickSelectedIndex]),
      clickedIndex: trace.index,
      songAtClickedIndex: song(state.list[trace.index]),
      clickedSongCurrentIndex: state.list.findIndex(item => item.id === trace.songId),
    }
  }

  const observe = (component, modal) => {
    const watch = (getter, stage, options = {}) => {
      unwatch.push(component.proxy.$watch(getter, value => record(stage, JSON.parse(value)), options))
    }
    watch(() => JSON.stringify(listState()), 'list-state', { flush: 'sync' })
    watch(() => JSON.stringify({
      listId: text(component.props.listId),
      show: component.setupState.isShowMusicToggleModal,
      originalSong: song(component.setupState.selectedToggleMusicInfo),
    }), 'modal-target', { flush: 'post' })
    if (!modal) {
      record('diagnostic-note', { message: 'Cannot inspect the source-switch dialog in this build.' })
      return
    }
    watch(() => {
      const original = modal.props.musicInfo
      return JSON.stringify({
        show: modal.props.show,
        searchKey: modal.data.searchKey,
        originalSong: song(original),
        queryText: text(`${original?.name?.trim() ?? ''} ${original?.singer ?? ''}`.trim()),
        loading: modal.data.loading,
        isError: modal.data.isError,
        activeSource: text(modal.data.source),
        selectedCandidate: song(modal.data.toggleMusicInfo),
        results: Object.entries(modal.data.lists).slice(0, 10).map(([source, list]) => ({
          source: text(source),
          count: list.length,
          firstFive: list.slice(0, 5).map(song),
        })),
      })
    }, 'modal-state', { flush: 'post' })
  }

  function onContextMenu(event) {
    if (stopped) return
    try {
      const row = event.target.closest?.('.list-item')
      if (!row) return
      const { nodes, components } = inspectTree()
      const component = components.find(item => item.type.name === 'MusicList' &&
        Array.isArray(item.setupState.list) && item.subTree.el?.contains(row))
      if (!component) return
      const virtualList = components.find(item => item.type.name === 'VirtualizedList' && item.subTree.el?.contains(row))
      const wrapper = nodes.find(node => node.el === row.parentElement && node.key != null)
      const view = virtualList?.setupState.views.find(item => item.key === wrapper?.key)
      const index = view?.index ?? null
      unwatch.forEach(dispose => dispose())
      unwatch = []
      trace = { id: ++traceNumber, component, index, songId: view?.item.id }
      record('right-click', {
        ...listState(),
        renderedSong: song(view?.item),
        visibleTitle: text(row.querySelector('.select.name')?.textContent),
        scrollTop: virtualList?.setupState.dom_scrollContainer?.scrollTop ?? null,
        hasTextSelection: !!window.getSelection()?.toString().trim(),
      })
      const modal = components.find(item => item.parent === component && 'searchKey' in item.data && 'lists' in item.data)
      observe(component, modal)
    } catch (error) {
      record('diagnostic-error', { message: text(error.message) })
    }
  }

  function onClick(event) {
    if (stopped || !trace || trace.component.isUnmounted) return
    try {
      const tab = event.target.closest?.('[role="tab"]')
      const state = trace.component.setupState
      if (!state.isShowItemMenu || !tab?.closest('[role="toolbar"]')) return
      const action = state.menus.find(item => item.name === tab.textContent.trim())?.action
      if (action !== 'toggleSource') return
      record('choose-toggle-source', listState())
    } catch (error) {
      record('diagnostic-error', { message: text(error.message) })
    }
  }

  window.lxMusicToggleDebug = {
    logPath,
    stop,
    openLog: () => require('electron').shell.showItemInFolder(logPath),
  }
  document.addEventListener('contextmenu', onContextMenu, true)
  document.addEventListener('click', onClick, true)
  window.addEventListener('beforeunload', stop)
  record('start', {
    scriptVersion: 1,
    appVersion: text(window.lxData.versionInfo?.version),
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    actionButtonsVisible: window.lxData.appSetting?.['list.actionButtonsVisible'],
  })
  console.info('[MusicToggleDebug] Ready. Reproduce the issue, then run lxMusicToggleDebug.openLog().', logPath)
})()
