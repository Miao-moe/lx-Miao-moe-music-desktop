<template>
  <img ref="element" :src="displaySrc || undefined" :loading="loading" decoding="async" data-cover-image @error="handleError">
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { ref, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { getCoverThumbnail } from '@renderer/utils/coverThumbnail'
import { acquireCover } from '@renderer/utils/coverCache'

const props = defineProps({
  src: { type: String, required: true },
  size: { type: Number, default: 32 },
  // Virtualized lists already limit mounted rows, so start those images immediately.
  loading: { type: String as PropType<'eager' | 'lazy'>, default: 'eager' },
})
const emit = defineEmits<(event: 'error', error: Event) => void>()
const element = ref<HTMLImageElement | null>(null)
const displaySrc = ref('')
const visible = ref(props.loading !== 'lazy')
let observer: IntersectionObserver | undefined
let generation = 0
let release: (() => void) | undefined

const load = async() => {
  const current = ++generation
  release?.()
  release = undefined
  displaySrc.value = ''
  if (!visible.value || !props.src) return
  const thumbnail = getCoverThumbnail(props.src, props.size * Math.max(1, window.devicePixelRatio))
  try {
    const cover = await acquireCover(thumbnail, props.src)
    if (current !== generation) { cover.release(); return }
    // The generation check above prevents an old request from replacing this lease.
    // eslint-disable-next-line require-atomic-updates
    release = cover.release
    displaySrc.value = cover.src
  } catch {
    if (current === generation) emit('error', new Event('error'))
  }
}

watch([() => props.src, () => props.size, visible], () => { void load() }, { immediate: true, flush: 'sync' })
onMounted(() => {
  if (visible.value || !element.value) return
  observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    visible.value = true
    observer?.disconnect()
  }, { rootMargin: '200px' })
  observer.observe(element.value)
})
onBeforeUnmount(() => {
  generation++
  observer?.disconnect()
  release?.()
})
const handleError = (event: Event) => {
  if (displaySrc.value) emit('error', event)
}
</script>
