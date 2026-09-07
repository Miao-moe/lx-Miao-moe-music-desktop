<template>
  <div :class="$style.content" data-plugin-visualizer="main"><canvas ref="canvas" :class="$style.canvas" /></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from '@common/utils/vueTools'
import { isPlay } from '@renderer/store/player/state'
import { getFrequencyData } from './analyser'
import { drawSpectrum } from './spectrum'

const canvas = ref(null)
let frame = null
let mounted = false
const stop = () => {
  if (frame != null) cancelAnimationFrame(frame)
  frame = null
}
const render = () => {
  frame = null
  if (!mounted) return
  drawSpectrum(canvas.value, getFrequencyData())
  if (isPlay.value) frame = requestAnimationFrame(render)
}
watch(isPlay, () => { stop(); if (mounted) render() })
onMounted(() => { mounted = true; render() })
onBeforeUnmount(() => { mounted = false; stop() })
</script>

<style lang="less" module>
.content { position: absolute; inset: 0; pointer-events: none; z-index: 100; }
.canvas { width: 100%; height: 100%; }
</style>
