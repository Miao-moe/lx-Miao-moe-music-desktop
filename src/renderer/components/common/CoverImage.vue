<template>
  <img ref="element" :src="displaySrc || undefined" :loading="visible ? 'eager' : loading" decoding="async" data-cover-image @error="handleError">
</template>

<script setup lang="ts">
import { inject, type PropType } from 'vue'
import { nextTick, ref, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { getCoverThumbnail } from '@renderer/utils/coverThumbnail'
import { acquireCover } from '@renderer/utils/coverCache'
import { getMusicCoverUrl } from '@renderer/utils/musicCover'
import { listLoadingKey } from '@renderer/utils/compositions/useListLoading'

const props = defineProps({
  src: { type: String, default: '' },
  musicInfo: { type: Object as PropType<LX.Music.MusicInfo>, default: null },
  size: { type: Number, default: 32 },
  // Virtualized lists already limit mounted rows, so start those images immediately.
  loading: { type: String as PropType<'eager' | 'lazy'>, default: 'eager' },
})
const emit = defineEmits<(event: 'error', error: Event) => void>()
const element = ref<HTMLImageElement | null>(null)
const displaySrc = ref('')
const visible = ref(props.loading !== 'lazy')
const listLoading = inject(listLoadingKey, null)
let observer: IntersectionObserver | undefined
let generation = 0
let release: (() => void) | undefined
let finish: (() => void) | undefined

const load = async() => {
  const current = ++generation
  finish?.()
  finish = undefined
  release?.()
  release = undefined
  displaySrc.value = ''
  if (!visible.value || (!props.src && !props.musicInfo)) return
  const done = listLoading?.hold()
  // A stalled URL lookup or download must eventually show the placeholder.
  const timeout = setTimeout(() => {
    if (current !== generation) return
    generation++
    displaySrc.value = ''
    release?.()
    release = undefined
    emit('error', new Event('error'))
    finish?.()
  }, 15000)
  const complete = () => { clearTimeout(timeout); done?.() }
  finish = complete
  try {
    const url = props.src || await getMusicCoverUrl(props.musicInfo)
    if (current !== generation) return
    if (!url) throw new Error('No artwork URL')
    const thumbnail = getCoverThumbnail(url, props.size * Math.max(1, window.devicePixelRatio))
    const cover = await acquireCover(thumbnail, url)
    if (current !== generation) { cover.release(); return }
    // The generation check above prevents an old request from replacing this lease.
    // eslint-disable-next-line require-atomic-updates
    release = cover.release
    displaySrc.value = cover.src
    await nextTick()
    if (current !== generation) return
    // Wait for the actual displayed element, including data/file URLs.
    await element.value?.decode()
  } catch {
    if (current === generation) {
      displaySrc.value = ''
      emit('error', new Event('error'))
    }
  } finally {
    complete()
  }
}

watch([() => props.src, () => props.musicInfo, () => props.musicInfo?.meta?.picUrl, () => props.size, visible], () => { void load() }, { immediate: true, flush: 'sync' })
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
  finish?.()
  observer?.disconnect()
  release?.()
})
const handleError = (event: Event) => {
  if (displaySrc.value) emit('error', event)
}
</script>
