<template>
  <div :class="$style.container" data-list-loading :aria-busy="!ready">
    <div :class="[$style.content, { [$style.pending]: !ready }]" :aria-hidden="!ready || undefined" :inert="!ready || undefined">
      <slot />
    </div>
    <div v-if="!ready" :class="[$style.status, 'ui-state']" role="status">
      <span class="ui-spinner" />
      <p>{{ $t('list__loading') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import useListLoading from '@renderer/utils/compositions/useListLoading'

const props = defineProps<{
  loadKey: unknown
  loading?: boolean
}>()
const ready = useListLoading([() => props.loadKey, () => props.loading], () => !!props.loading)
</script>

<style lang="less" module>
.container, .content {
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
  min-height: 0;
  min-width: 0;
}
.content {
  flex: auto;
}
.pending {
  visibility: hidden;
  pointer-events: none;
}
.status {
  position: absolute;
  inset: 0;
}
</style>
