<template>
  <button type="button" :aria-label="labels.title" :aria-pressed="enabled" data-folia-toggle @click="savePreferences({ enabled: !enabled })"><span :class="$style.label">F</span></button>
</template>
<script setup lang="ts">
import { enabled, savePreferences } from './preferences'
import { useLabels } from './labels'
const labels = useLabels()
</script>
<style lang="less" module>
.label { font: italic 700 23px Georgia, serif; }
</style>
