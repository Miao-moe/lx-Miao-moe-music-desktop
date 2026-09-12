import Sortable from 'sortablejs/modular/sortable.core.esm'
import { onMounted, onBeforeUnmount, watch } from '@common/utils/vueTools'
import { clearDownKeys } from '@renderer/event'

export default ({ element, disabled, ghostClass, onReorder, onDragging }) => {
  let sortable
  let list
  let nextSibling
  let dragging = false
  let suppressClick = false
  const resetClick = () => { suppressClick = false }
  const handleClick = event => {
    if (!suppressClick || !event.detail) return
    event.preventDefault()
    event.stopImmediatePropagation()
    suppressClick = false
  }
  const updateMotion = () => { sortable?.option('animation', document.documentElement.dataset.motionEnabled === 'false' ? 0 : 150) }
  watch(disabled, value => { sortable?.option('disabled', value) }, { flush: 'sync' })
  onMounted(() => {
    list = element.value
    if (!list) return
    list.addEventListener('pointerdown', resetClick, true)
    list.addEventListener('click', handleClick, true)
    sortable = Sortable.create(list, {
      disabled: disabled.value,
      draggable: '[data-sidebar-nav]',
      direction: 'vertical',
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 5,
      ghostClass,
      onChoose(event) { nextSibling = event.item.nextSibling },
      onStart() {
        dragging = true
        suppressClick = true
        onDragging(true)
        window.app_event.dragStart()
      },
      onEnd(event) {
        dragging = false
        onDragging(false)
        window.app_event.dragEnd()
        clearDownKeys()
        if (event.oldDraggableIndex == event.newDraggableIndex) return
        // Let Vue perform the final move so its keyed children stay in sync with the DOM.
        event.item.remove()
        const anchor = nextSibling?.parentNode === list ? nextSibling : list.children[event.oldIndex]
        list.insertBefore(event.item, anchor ?? null)
        onReorder(event.item.dataset.sidebarNav, event.newDraggableIndex)
      },
    })
    updateMotion()
    window.addEventListener('lx-motion-change', updateMotion)
  })
  onBeforeUnmount(() => {
    sortable?.destroy()
    list?.removeEventListener('pointerdown', resetClick, true)
    list?.removeEventListener('click', handleClick, true)
    window.removeEventListener('lx-motion-change', updateMotion)
    if (dragging) window.app_event.dragEnd()
  })
}
