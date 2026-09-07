<template>
  <div data-plugin-settings="audio-visualizer">
    <p class="p">
      <base-checkbox id="plugin_visualizer_player" :model-value="appSetting['player.audioVisualization']" :label="$t('setting__plugins_visualizer_player')" @update:model-value="setVisualization('player.audioVisualization', $event)" />
    </p>
    <p class="p">
      <base-checkbox id="plugin_visualizer_desktop" :model-value="appSetting['desktopLyric.audioVisualization']" :label="$t('setting__desktop_lyric_audio_visualization')" @update:model-value="setVisualization('desktopLyric.audioVisualization', $event)" />
    </p>
  </div>
</template>

<script setup>
import { appSetting } from '@renderer/store/setting'
import { setVisualization } from './settings'
</script>
