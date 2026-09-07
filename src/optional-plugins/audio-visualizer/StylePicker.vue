<template>
  <div :class="$style.picker" data-visualizer-picker>
    <div :class="$style.toolbar">
      <div :class="$style.tabs" role="tablist" :aria-label="text.title">
        <button v-for="target in ['main', 'desktop']" :key="target" type="button" role="tab" :aria-selected="surface === target" :tabindex="surface === target ? 0 : -1" :data-visualizer-surface="target" :disabled="pending" @click="surface = target" @keydown="handleTabKey">{{ text[target] }}</button>
      </div>
      <base-checkbox :id="`${instanceId}_enabled`" :model-value="enabled" :label="text.enabled" :disabled="pending" @update:model-value="toggleEnabled" />
    </div>
    <div :class="$style.preview">
      <Preview :kind="preferences[surface]" live />
      <div :class="$style.previewLabel"><strong>{{ text.styles[preferences[surface]][0] }}</strong><span>{{ isPlay ? text.live : text.demo }}</span></div>
    </div>
    <div :class="$style.grid" role="radiogroup" :aria-label="text.title" @keydown.left.stop @keydown.right.stop @keydown.up.stop @keydown.down.stop @keydown.space.stop>
      <label v-for="kind in STYLE_IDS" :key="kind" :class="[$style.card, { [$style.selected]: preferences[surface] === kind }]" :data-visualizer-option="kind">
        <input :name="`${instanceId}_${surface}`" type="radio" :value="kind" :checked="preferences[surface] === kind" :disabled="pending || !preferencesReady" :aria-label="text.styles[kind][0]" @change="select(kind)" @click="preferences[surface] === kind && !enabled && select(kind)">
        <div :class="$style.thumbnail"><Preview :kind="kind" /></div>
        <span :class="$style.name">{{ text.styles[kind][0] }}<svg v-if="preferences[surface] === kind" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></span>
        <span :class="$style.description">{{ text.styles[kind][1] }}</span>
      </label>
    </div>
    <p :class="$style.hint">{{ text.hint }}</p>
    <p v-if="preferencesError || operationError" :class="$style.error" role="alert">{{ text.error }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { isPlay } from '@renderer/store/player/state'
import { preferences, preferencesReady, preferencesError, saveStyle } from './preferences'
import { setVisualization } from './settings'
import { STYLE_IDS } from './styles'
import { useLabels } from './labels'
import Preview from './Preview.vue'

const text = useLabels()
const instanceId = `visualizer_${Math.random().toString(36).slice(2)}`
const surface = ref('main')
const pending = ref(false)
const operationError = ref(false)
const enabledKey = computed(() => surface.value === 'main' ? 'player.audioVisualization' : 'desktopLyric.audioVisualization')
const enabled = computed(() => appSetting[enabledKey.value])
const handleTabKey = (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  surface.value = event.key === 'Home' ? 'main' : event.key === 'End' ? 'desktop' : surface.value === 'main' ? 'desktop' : 'main'
  event.currentTarget.parentElement.querySelector(`[data-visualizer-surface="${surface.value}"]`)?.focus()
}
const toggleEnabled = async(value) => {
  if (pending.value) return
  pending.value = true
  operationError.value = false
  try { await setVisualization(enabledKey.value, value) } catch (error) {
    operationError.value = true
    console.error('Visualizer setting failed:', error)
  } finally { pending.value = false }
}
const select = async(kind) => {
  if (pending.value || !preferencesReady.value) return
  pending.value = true
  operationError.value = false
  const target = surface.value
  try {
    if (await setVisualization(enabledKey.value, true)) saveStyle(target, kind)
  } catch (error) {
    operationError.value = true
    console.error('Visualizer setting failed:', error)
  } finally { pending.value = false }
}
</script>

<style lang="less" module>
.picker { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 12px; }
.tabs { display: flex; padding: 3px; border-radius: var(--radius-md); background: var(--color-primary-alpha-900); }
.tabs button { cursor: pointer; border: none; border-radius: var(--radius-sm); padding: 7px 12px; color: var(--color-font); background: transparent; }
.tabs button[aria-selected="true"] { color: var(--color-primary); background: var(--color-surface-elevated); box-shadow: 0 1px 4px #0001; }
.tabs button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.preview { position: relative; height: 156px; overflow: hidden; border-radius: var(--radius-md); border: 1px solid var(--color-primary-alpha-800); background: linear-gradient(135deg, var(--color-primary-alpha-900), transparent); }
.previewLabel { position: absolute; top: 12px; left: 14px; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.previewLabel strong { font-size: 13px; color: var(--color-font); }
.previewLabel span { font-size: 11px; color: var(--color-font-label); }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.card { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--color-primary-alpha-800); border-radius: var(--radius-md); cursor: pointer; min-width: 0; background: var(--color-surface-elevated); }
.card:hover { background: var(--color-primary-alpha-900); }
.card:focus-within { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.selected { border-color: var(--color-primary); background: var(--color-primary-alpha-900); }
.card input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.thumbnail { height: 64px; overflow: hidden; }
.name { display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 13px; color: var(--color-font); }
.name svg { flex: none; width: 14px; height: 14px; stroke: var(--color-primary); stroke-width: 2; fill: none; }
.description { font-size: 11px; color: var(--color-font-label); line-height: 1.5; overflow-wrap: anywhere; }
.hint, .error { margin: 0 !important; font-size: 11px; color: var(--color-font-label); line-height: 1.6; }
.error { color: var(--color-font); }
@media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
@media (max-height: 620px) { .preview { height: 96px; } .picker { gap: 10px; } .thumbnail { height: 48px; } }
</style>
