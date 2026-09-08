<template>
  <component :is="item.component" v-for="item in contributions" :key="item.id" v-bind="$attrs" />
</template>
<script setup>
import { computed } from '@common/utils/vueTools'
import { pluginRuntime } from '@renderer/store/optionalPlugins'
defineOptions({ inheritAttrs: false })
const props = defineProps({ name: { type: String, required: true } })
const contributions = computed(() => Object.entries(pluginRuntime.slots).map(([id, slots]) => ({ id, component: slots?.[props.name] })).filter(item => item.component))
</script>
