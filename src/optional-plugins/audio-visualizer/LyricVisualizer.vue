<template>
  <div :class="$style.content" data-plugin-visualizer="desktop" :data-visualizer-style="preferences.desktop"><canvas ref="canvas" :class="$style.canvas" /></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from '@common/utils/vueTools'
import { useEvent, getAnalyserDataArray } from '@lyric/core/mainWindowChannel'
import { isPlay } from '@lyric/store/state'
import { drawSpectrum } from './spectrum'
import { preferences } from './preferences'

const canvas = ref(null)
let mounted = false
let frame = null
let pending = false
let observer
let lastData = new Uint8Array()
const draw = () => { if (mounted) drawSpectrum(canvas.value, lastData, { desktop: true, style: preferences.desktop, time: performance.now() }) }
const stop = () => {
  if (frame != null) cancelAnimationFrame(frame)
  frame = null
}
const request = () => {
  frame = null
  if (!mounted || pending) return
  pending = true
  getAnalyserDataArray()
}
useEvent(event => {
  if (event.action !== 'send_analyser_data_array' || !mounted) return
  pending = false
  lastData = event.data
  draw()
  stop()
  if (isPlay.value) frame = requestAnimationFrame(request)
})
watch(isPlay, playing => { stop(); if (playing) request() })
watch(() => preferences.desktop, draw)
onMounted(() => {
  mounted = true
  observer = new ResizeObserver(draw)
  observer.observe(canvas.value)
  if (isPlay.value) request()
})
onBeforeUnmount(() => { mounted = false; stop(); observer?.disconnect(); lastData = new Uint8Array() })
</script>

<style lang="less" module>
.content { position: absolute; inset: 0; pointer-events: none; z-index: -1; }
.canvas { width: 100%; height: 100%; }
</style>
