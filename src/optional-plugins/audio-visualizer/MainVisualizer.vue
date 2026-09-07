<template>
  <div :class="$style.content" data-plugin-visualizer="main" :data-visualizer-style="preferences.main"><canvas ref="canvas" :class="$style.canvas" /></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from '@common/utils/vueTools'
import { isPlay } from '@renderer/store/player/state'
import { getFrequencyData } from './analyser'
import { drawSpectrum } from './spectrum'
import { preferences } from './preferences'

const canvas = ref(null)
let frame = null
let mounted = false
let observer
const stop = () => {
  if (frame != null) cancelAnimationFrame(frame)
  frame = null
}
const render = (time = performance.now()) => {
  frame = null
  if (!mounted) return
  drawSpectrum(canvas.value, getFrequencyData(), { style: preferences.main, time })
  if (isPlay.value) frame = requestAnimationFrame(render)
}
const refresh = () => { stop(); if (mounted) render() }
watch(isPlay, refresh)
watch(() => preferences.main, refresh)
onMounted(() => {
  mounted = true
  observer = new ResizeObserver(refresh)
  observer.observe(canvas.value)
  render()
})
onBeforeUnmount(() => { mounted = false; stop(); observer?.disconnect() })
</script>

<style lang="less" module>
.content { position: absolute; inset: 0; pointer-events: none; z-index: 100; }
.canvas { width: 100%; height: 100%; }
</style>
