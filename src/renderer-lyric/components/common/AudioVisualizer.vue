<template><component :is="component" v-if="component" /></template>

<script setup>
import { computed } from '@common/utils/vueTools'
import { pluginRuntime } from '@lyric/store/optionalPlugins'
const component = computed(() => pluginRuntime.components['audio-visualizer']?.LyricVisualizer)
</script>
