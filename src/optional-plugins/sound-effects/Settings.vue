<template>
  <div :class="$style.settings" data-plugin-settings="sound-effects">
    <BiquadFilter />
    <AudioConvolution />
    <PitchShifter />
    <AudioPanner />
  </div>
</template>

<script setup>
import BiquadFilter from './components/BiquadFilter.vue'
import AudioConvolution from './components/AudioConvolution.vue'
import PitchShifter from './components/PitchShifter.vue'
import AudioPanner from './components/AudioPanner.vue'
</script>

<style lang="less" module>
.settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
  :global(.player__sound_effect_title) { padding-bottom: 10px; }
}
</style>
