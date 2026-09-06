import Sortable, { AutoScroll } from 'sortablejs/modular/sortable.core.esm'
import { onBeforeUnmount, onMounted } from '@common/utils/vueTools'
import { clearDownKeys } from '@renderer/event'

Sortable.mount(new AutoScroll())

const noop = () => {}

export default ({ dom_list, dragingItemClassName, onUpdate, onStart = noop, onEnd = noop, options = {} }) => {
  let sortable
  let listElement
  let isChosen = false
  let isDragging = false
  let suppressClick = false
  let nextSibling

  const handlePointerDown = () => {
    suppressClick = false
  }
  const handleClick = (event) => {
    if (!suppressClick || event.detail === 0) return
    suppressClick = false
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const handleContextMenu = (event) => {
    if (!isChosen) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  onMounted(() => {
    listElement = dom_list.value
    if (!listElement) return
    listElement.addEventListener('pointerdown', handlePointerDown, true)
    listElement.addEventListener('click', handleClick, true)
    listElement.addEventListener('contextmenu', handleContextMenu, true)
    sortable = Sortable.create(listElement, {
      animation: 150,
      ghostClass: dragingItemClassName,
      ...options,
      onUpdate(event) {
        // Restore the DOM order before Vue applies the saved list order.
        event.item.remove()
        const anchor = nextSibling?.parentNode === event.from ? nextSibling : event.from.children[event.oldIndex]
        event.from.insertBefore(event.item, anchor ?? null)
        onUpdate(event.newDraggableIndex, event.oldDraggableIndex, event.item)
      },
      onMove(event) {
        if (options.draggable && !event.related.matches(options.draggable)) return false
        return options.onMove?.(event) ?? true
      },
      onChoose(event) {
        nextSibling = event.item.nextSibling
        isChosen = true
        suppressClick = true
        onStart()
      },
      onUnchoose() {
        if (!isChosen) return
        isChosen = false
        onEnd()
        // 处于拖动状态期间，键盘事件无法监听，拖动结束手动清理按下的键
        // window.app_event.emit(eventBaseName.setClearDownKeys)
        clearDownKeys()
      },
      onStart() {
        isDragging = true
        window.app_event.dragStart()
      },
      onEnd() {
        isDragging = false
        window.app_event.dragEnd()
      },
    })
  })

  onBeforeUnmount(() => {
    sortable?.destroy()
    listElement?.removeEventListener('pointerdown', handlePointerDown, true)
    listElement?.removeEventListener('click', handleClick, true)
    listElement?.removeEventListener('contextmenu', handleContextMenu, true)
    if (isDragging) window.app_event.dragEnd()
  })

  return {
    setDelay(delay) {
      sortable?.option('delay', delay)
    },
  }
}
