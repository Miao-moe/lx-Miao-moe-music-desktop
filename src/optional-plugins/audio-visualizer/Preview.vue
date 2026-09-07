<template>
  <canvas ref="canvas" :class="$style.canvas" :data-visualizer-preview="kind" aria-hidden="true" />
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { isPlay } from '@renderer/store/player/state'
import { acquirePreview, getFrequencyData } from './analyser'
import { drawSpectrum } from './spectrum'
import { demoSpectrum } from './styles'

const props = defineProps({ kind: { type: String, required: true }, live: Boolean })
const canvas = ref(null)
let frame = null
let mounted = false
let observer
let release
const stop = () => { if (frame != null) cancelAnimationFrame(frame); frame = null }
const draw = (time = 1400) => {
  frame = null
  if (!mounted) return
  const data = props.live && isPlay.value ? getFrequencyData() : demoSpectrum(time)
  drawSpectrum(canvas.value, data, { style: props.kind, preview: true, time })
  if (props.live && !document.hidden) frame = requestAnimationFrame(draw)
}
const refresh = () => { stop(); draw() }
watch(() => props.kind, refresh)
watch(isPlay, refresh)
onMounted(() => {
  mounted = true
  if (props.live) release = acquirePreview()
  observer = new ResizeObserver(refresh)
  observer.observe(canvas.value)
  document.addEventListener('visibilitychange', refresh)
  draw()
})
onBeforeUnmount(() => {
  mounted = false
  stop()
  observer?.disconnect()
  release?.()
  document.removeEventListener('visibilitychange', refresh)
})
</script>

<style lang="less" module>
.canvas { display: block; width: 100%; height: 100%; pointer-events: none; }
</style>
