import { onMounted, onBeforeUnmount, watch, reactive, ref } from '@common/utils/vueTools'


export default ({ visible, location, onHide }) => {
  const transition1 = 'transform, opacity'
  const transition2 = 'transform, opacity, top, left'
  let show = false
  let offset = { x: 0, y: 0 }
  const dom_menu = ref(null)
  const menuStyles = reactive({
    left: 0,
    top: 0,
    opacity: 0,
    transitionProperty: 'transform, opacity',
    transform: 'translate(0, 8px) scale(.98)',
    pointerEvents: 'none',
  })

  const handleShow = () => {
    show = true
    offset = handleGetOffsetXY(location.value.x, location.value.y)
    menuStyles.opacity = 1
    menuStyles.transform = `translate(${offset.x}px, ${offset.y}px) scale(1)`
    menuStyles.pointerEvents = 'auto'
  }
  const handleHide = () => {
    menuStyles.opacity = 0
    menuStyles.transitionProperty = transition1
    menuStyles.transform = `translate(${offset.x}px, ${offset.y + 8}px) scale(.98)`
    menuStyles.pointerEvents = 'none'
    show = false
  }
  const handleGetOffsetXY = (left, top) => {
    if (!dom_menu.value?.offsetParent) return { x: 0, y: 0 }
    const listWidth = dom_menu.value.clientWidth
    const listHeight = dom_menu.value.clientHeight
    const dom_container_parant = dom_menu.value.offsetParent
    const containerWidth = dom_container_parant.clientWidth
    const containerHeight = dom_container_parant.clientHeight
    const offsetWidth = containerWidth - left - listWidth
    const offsetHeight = containerHeight - top - listHeight
    let x = 0
    let y = 0
    if (containerWidth > listWidth && offsetWidth < 12) {
      x = offsetWidth - 12
    }
    if (containerHeight > listHeight && offsetHeight < 5) {
      y = offsetHeight - 5
    }
    return { x, y }
  }
  const handleDocumentClick = (event) => {
    if (!show) return

    if (event.target == dom_menu.value || dom_menu.value.contains(event.target)) return

    if (show && menuStyles.transitionProperty != transition1) menuStyles.transitionProperty = transition1

    onHide()
  }
  const handleKeyDown = (event) => {
    if (!show || event.key != 'Escape') return
    onHide()
  }

  watch(visible, visible => {
    visible ? handleShow() : handleHide()
  }, { immediate: true })

  watch(location, location => {
    menuStyles.left = location.x - window.lx.rootOffset + 2 + 'px'
    menuStyles.top = location.y - window.lx.rootOffset + 'px'
    offset = handleGetOffsetXY(location.x, location.y)
    // nextTick(() => {
    if (show) {
      if (menuStyles.transitionProperty != transition2) menuStyles.transitionProperty = transition2
      menuStyles.transform = `translate(${offset.x}px, ${offset.y}px) scale(1)`
    } else {
      menuStyles.transform = `translate(${offset.x}px, ${offset.y + 8}px) scale(.98)`
    }
    // })
  }, { deep: true })

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('keydown', handleKeyDown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick)
    document.removeEventListener('keydown', handleKeyDown)
  })

  return {
    dom_menu,
    menuStyles,
  }
}
