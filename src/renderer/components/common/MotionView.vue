<template>
  <div :class="$style.root" data-motion-view>
    <div ref="outlet" :class="$style.outlet" data-motion-outlet><slot /></div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { nextTick, onBeforeUnmount, ref, watch } from '@common/utils/vueTools'
import { isMotionEnabled, playMotion } from '@renderer/utils/motion'

const props = defineProps({
  motionKey: { type: [String, Number] as PropType<string | number | null>, default: '' },
  distance: { type: Number, default: 16 },
  page: { type: Boolean, default: false },
})
const outlet = ref<HTMLElement | null>(null)
let revision = 0
let running: Animation | null = null

const clear = () => {
  running?.cancel()
  running = null
}

// Animate the stable outlet without cloning an entire list and its images on every switch.
watch(() => props.motionKey, async() => {
  const token = ++revision
  const live = outlet.value
  if (!live) return
  clear()
  await nextTick()
  if (token !== revision || !live.isConnected || !isMotionEnabled()) return
  // Nested panels share their page's motion instead of adding a second translation.
  const parent = live.parentElement?.parentElement?.closest('[data-motion-outlet]')
  if (parent?.getAnimations().some(animation => animation.playState === 'running')) return
  running = playMotion(live, [
    { transform: `translateY(${props.distance}px)`, opacity: 0.92 },
    { transform: 'translateY(0)', opacity: 1 },
  ], props.page ? 'page' : 'panel')
  if (running) await running.finished.catch(() => {})
  if (token === revision) clear()
}, { flush: 'pre' })

onBeforeUnmount(() => { ++revision; clear() })
</script>

<style lang="less" module>
.root {
  position: relative;
  min-width: 0;
  min-height: 0;
  height: 100%;
  flex: auto;
  overflow: hidden;
  isolation: isolate;
}
.outlet {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--color-main-background);
}
</style>
