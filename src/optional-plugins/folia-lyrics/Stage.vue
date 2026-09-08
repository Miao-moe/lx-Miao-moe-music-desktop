<template>
  <div :class="$style.stage" :data-folia-stage="preview ? 'preview' : 'player'">
    <div :class="$style.toolbar">
      <span>{{ preview ? labels.demo : labels.title }}</span>
      <label :class="$style.picker">
        <span>{{ labels.style }}</span>
        <select :value="preferences.mode" data-folia-mode @change="selectMode">
          <option v-for="mode in FOLIA_MODES" :key="mode" :value="mode">{{ labels.styles[mode] }}</option>
        </select>
      </label>
      <button v-if="!preview" type="button" @click="savePreferences({ enabled: false })">{{ labels.standard }}</button>
    </div>
    <div :class="$style.surface">
      <iframe v-if="!failed && (!preview || !isShowPlayerDetail)" ref="element" :src="engineUrl" :title="labels.title" sandbox="allow-scripts allow-same-origin" data-folia-frame />
      <div v-if="failed" :class="$style.error" role="alert">
        <p>{{ labels.error }}</p>
        <button type="button" @click="retry">{{ labels.retry }}</button>
      </div>
    </div>
    <p v-if="preferencesError" role="alert" :class="$style.saveError">{{ labels.saveError }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from '@common/utils/vueTools'
import { isShowPlayerDetail } from '@renderer/store/player/state'
import { FOLIA_MODES, type FoliaMode } from './protocol'
import { engineUrl, preferences, preferencesError, savePreferences } from './preferences'
import { useLabels } from './labels'
import useStage from './useStage'

const props = defineProps({ preview: { type: Boolean, default: false } })
const labels = useLabels()
const element = ref<HTMLIFrameElement | null>(null)
const { failed, retry } = useStage(element, props.preview)
const selectMode = (event: Event) => { savePreferences({ mode: (event.target as HTMLSelectElement).value as FoliaMode, enabled: true }) }
</script>

<style lang="less" module>
.stage { display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; color: #f5f7fb; background: radial-gradient(ellipse at 25% 90%, #244346, #111b2c 70%); border-radius: 12px; }
.toolbar { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 10px 14px; font-size: 12px; position: relative; z-index: 1; }
.picker { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.toolbar select, .toolbar button, .error button { color: inherit; background: #22364a; border: 1px solid #52717d; border-radius: 6px; padding: 5px 9px; font: inherit; cursor: pointer; }
.toolbar option { color: #f5f7fb; background: #22364a; }
.surface { position: relative; flex: auto; min-height: 0; }
.surface iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; }
.error { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 16px; padding: 16px; text-align: center; }
.saveError { flex: none; padding: 8px 14px; font-size: 12px; }
</style>
