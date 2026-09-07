<template>
  <button :class="{[$style.active]: appSetting['player.audioVisualization']}" :aria-label="$t('audio_visualization')" @click="setVisualization('player.audioVisualization', !appSetting['player.audioVisualization'])">
    <svg width="95%" viewBox="0 0 24 24"><use xlink:href="#icon-audio-wave" /></svg>
  </button>
</template>

<script setup>
import { appSetting } from '@renderer/store/setting'
import { setVisualization } from './settings'
</script>

<style lang="less" module>
.active { color: var(--color-primary) !important; opacity: .8 !important; }
</style>
