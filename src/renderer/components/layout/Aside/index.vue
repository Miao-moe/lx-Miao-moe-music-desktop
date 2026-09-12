<template>
  <div ref="dom_aside" :class="[$style.aside, { [$style.fullscreen]: isFullscreen, [$style.resizing]: resizing }]" :style="sidebarStyle" tabindex="-1" @contextmenu="openMenu">
    <ControlBtns v-if="appSetting['common.controlBtnPosition'] == 'left'" />
    <div v-else :class="$style.logo">LX-M</div>
    <NavBar @dragging="handleDragging" />
    <div :class="$style.blankArea" data-sidebar-empty />
    <div
      v-if="!locked" :class="$style.resizeHandle" data-sidebar-resize role="separator" tabindex="0" aria-orientation="vertical" aria-controls="right"
      :aria-label="$t('sidebar__resize')" :aria-valuemin="SIDEBAR_MIN_WIDTH" :aria-valuemax="maxWidth" :aria-valuenow="Math.round(currentWidth)"
      @pointerdown.stop="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="cancelResize"
      @lostpointercapture="cancelResize" @keydown="onKeyDown" @dblclick.prevent.stop="resetWidth"
    />
    <ContextMenu v-model="menuVisible" :xy="menuPosition" @reset-width="resetWidth" />
  </div>
</template>

<script setup lang="ts">
import { ref } from '@common/utils/vueTools'
import { SIDEBAR_MIN_WIDTH } from '@common/sidebar'
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'

import ControlBtns from './ControlBtns.vue'
import NavBar from './NavBar.vue'
import ContextMenu from './ContextMenu.vue'
import useResize from './useResize'

const dom_aside = ref<HTMLElement>()
const menuVisible = ref(false)
const menuPosition = ref({ x: 0, y: 0 })
let dragging = false
const { style: sidebarStyle, locked, resizing, currentWidth, maxWidth, onPointerDown, onPointerMove, onPointerUp, cancelResize, onKeyDown, resetWidth } = useResize(dom_aside)
const handleDragging = (value: boolean) => {
  dragging = value
  if (value) menuVisible.value = false
}
const openMenu = (event: MouseEvent) => {
  event.preventDefault()
  if (resizing.value || dragging || (event.target as Element).closest('a, button, [data-sidebar-resize]')) return
  menuPosition.value = { x: event.clientX, y: event.clientY }
  menuVisible.value = true
}

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.aside {
  position: relative;
  min-height: 0;
  outline: none;
  // box-shadow: 0 0 5px rgba(0, 0, 0, .3);
  transition: @transition-normal;
  transition-property: background-color;
  // background-color: @color-theme-sidebar;
  // background-color: @color-aside-background;
  // border-right: 2px solid var(--color-primary);
  -webkit-app-region: no-drag;
  -webkit-user-select: none;
  display: flex;
  flex-flow: column nowrap;

  &.fullscreen {
    -webkit-app-region: no-drag;
    .logo {
      display: none;
    }
  }
}

.logo {
  box-sizing: border-box;
  padding: 0 13%;
  height: 50px;
  color: var(--color-nav-font);
  opacity: .8;
  flex: none;
  text-align: center;
  line-height: 50px;
  font-size: min(28px, calc(var(--sidebar-current-width, 90px) * .21));
  font-weight: bold;
  white-space: nowrap;
  -webkit-app-region: drag;
}

.resizeHandle {
  position: absolute;
  z-index: 5;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
  outline: none;
  -webkit-app-region: no-drag;
  &:before {
    content: '';
    position: absolute;
    inset: 0 3px;
    opacity: 0;
    background: var(--color-primary);
    transition: opacity var(--duration-fast);
  }
  &:hover:before, &:focus-visible:before { opacity: .65; }
}
.resizing .resizeHandle:before { opacity: .8; }
.blankArea { height: 24px; flex: none; }

</style>

<style lang="less">
.sidebar-resizing, .sidebar-resizing * { cursor: col-resize !important; }
</style>
