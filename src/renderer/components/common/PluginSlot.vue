<template><component :is="component" v-if="component" /></template>

<script setup>
import { computed } from '@common/utils/vueTools'
import { pluginRuntime } from '@renderer/store/optionalPlugins'
const props = defineProps({ plugin: { type: String, required: true }, name: { type: String, required: true } })
const component = computed(() => pluginRuntime.components[props.plugin]?.[props.name])
</script>
