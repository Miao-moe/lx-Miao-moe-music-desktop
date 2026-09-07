<template>
  <button ref="trigger" v-bind="$attrs" :class="{[$style.active]: appSetting['player.audioVisualization']}" :aria-label="$t('audio_visualization')" aria-haspopup="dialog" :aria-expanded="visible" @click="visible = true">
    <svg width="95%" viewBox="0 0 24 24"><use xlink:href="#icon-audio-wave" /></svg>
  </button>
  <material-modal :show="visible" :bg-close="true" :close-btn="false" width="700px" max-width="calc(100% - 32px)" max-height="calc(100% - 32px)" @close="close" @after-enter="focusPanel">
    <div ref="panel" :class="$style.panel" role="dialog" aria-modal="true" :aria-label="text.title" tabindex="-1" data-visualizer-dialog @keydown="handleKey">
      <header :class="$style.header"><h2>{{ text.title }}</h2><base-btn min @click="close">{{ text.close }}</base-btn></header>
      <div :class="['scroll', $style.body]"><StylePicker /></div>
    </div>
  </material-modal>
</template>

<script setup>
import { ref, watch, nextTick } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import StylePicker from './StylePicker.vue'
import { useLabels } from './labels'

const visible = ref(false)
const trigger = ref(null)
const panel = ref(null)
const text = useLabels()
const close = () => { visible.value = false; trigger.value?.focus() }
const focusPanel = () => { if (visible.value) panel.value?.focus() }
watch(visible, async(value) => {
  if (!value) return
  // The host modal mounts its content, then makes it visible in the next Vue update.
  await nextTick()
  await nextTick()
  focusPanel()
})
const handleKey = (event) => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
  if (event.key !== 'Tab') return
  const controls = [...panel.value.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter(element => element.getClientRects().length && (element.type !== 'radio' || element.checked))
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>

<script>
export default { inheritAttrs: false }
</script>

<style lang="less" module>
.active { color: var(--color-primary) !important; opacity: .8 !important; }
.panel { min-height: 0; display: flex; flex-direction: column; outline: none; }
.header { padding: 14px 18px 12px; display: flex; flex: none; align-items: center; justify-content: space-between; gap: 16px; }
.header h2 { margin: 0; color: var(--color-font); font-size: 17px; }
.body { min-height: 0; overflow-y: auto; padding: 0 18px 18px; }
</style>
