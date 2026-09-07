<template>
  <div :class="$style.content" data-plugin-visualizer="desktop"><canvas ref="canvas" :class="$style.canvas" /></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from '@common/utils/vueTools'
import { useEvent, getAnalyserDataArray } from '@lyric/core/mainWindowChannel'
import { isPlay } from '@lyric/store/state'
import { drawSpectrum } from './spectrum'

const canvas = ref(null)
let mounted = false
let frame = null
let pending = false
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
  drawSpectrum(canvas.value, event.data, true)
  stop()
  if (isPlay.value) frame = requestAnimationFrame(request)
})
watch(isPlay, playing => { stop(); if (playing) request() })
onMounted(() => { mounted = true; if (isPlay.value) request() })
onBeforeUnmount(() => { mounted = false; stop() })
</script>

<style lang="less" module>
.content { position: absolute; inset: 0; pointer-events: none; z-index: -1; }
.canvas { width: 100%; height: 100%; }
</style>
