<template>
  <dt id="plugin_store">{{ $t('setting__plugins') }}</dt>
  <dd>
    <div :class="$style.header">
      <p :class="$style.description">{{ $t('setting__plugins_intro') }}</p>
      <base-btn min :disabled="refreshing" @click="refresh">{{ $t(refreshing ? 'setting__plugins_refreshing' : 'setting__plugins_refresh') }}</base-btn>
    </div>
    <p v-if="pluginStore.catalogError || pluginStoreError" :class="$style.notice" role="status">{{ $t('setting__plugins_catalog_error') }}</p>
    <div :class="$style.grid">
      <article v-for="item in items" :key="item.id" :class="$style.card" :data-plugin-id="item.id">
        <div :class="$style.cardHeader">
          <span :class="$style.icon" aria-hidden="true"><svg viewBox="0 0 24 24"><use :xlink:href="item.icon" /></svg></span>
          <div>
            <h3 :class="$style.title">{{ $t(item.title) }}</h3>
            <p :class="$style.meta">{{ $t('setting__plugins_official') }}<span v-if="item.version"> · v{{ item.version }}</span></p>
          </div>
          <span :class="[$style.badge, {[$style.installed]: item.loaded}]">{{ $t(item.broken ? 'setting__plugins_broken' : item.installed ? 'setting__plugins_installed' : 'setting__plugins_available') }}</span>
        </div>
        <p :class="$style.description">{{ $t(item.description) }}</p>
        <p v-if="item.bytes" :class="$style.meta">{{ (item.bytes / 1024 / 1024).toFixed(2) }} MB</p>
        <p v-if="item.incompatible" :class="$style.notice" role="status">{{ $t('setting__plugins_incompatible') }}</p>
        <p v-if="item.broken || pluginOperationErrors[item.id]" :class="$style.notice" role="alert">{{ $t('setting__plugins_operation_error') }}</p>
        <div :class="$style.actions">
          <base-btn v-if="!item.installed || item.update || item.broken" min :disabled="pluginBusy[item.id] || !item.available || item.incompatible" @click="changePluginInstallation(item.id, true)">
            {{ $t(pluginBusy[item.id] ? 'setting__plugins_working' : item.broken ? 'setting__plugins_reinstall' : item.update ? 'setting__plugins_update' : 'setting__plugins_install') }}
          </base-btn>
          <base-btn v-if="item.loaded" min :disabled="pluginBusy[item.id]" @click="expanded = expanded === item.id ? null : item.id">{{ $t(expanded === item.id ? 'setting__plugins_close_settings' : 'setting__plugins_settings') }}</base-btn>
          <base-btn v-if="item.installed" min outline :disabled="pluginBusy[item.id]" @click="uninstall(item.id)">{{ $t(pluginBusy[item.id] ? 'setting__plugins_working' : 'setting__plugins_uninstall') }}</base-btn>
        </div>
      </article>
    </div>
    <p :class="$style.note">{{ $t('setting__plugins_preserve_settings') }}</p>
    <section v-if="expanded && pluginRuntime.components[expanded]" :class="$style.settings">
      <h3>{{ $t(expanded === 'sound-effects' ? 'setting__plugins_sound_effects_title' : 'setting__plugins_visualizer_title') }}</h3>
      <common-plugin-slot :plugin="expanded" name="Settings" />
    </section>
  </dd>
</template>

<script setup>
import { computed, onMounted, ref } from '@common/utils/vueTools'
import { PLUGIN_API_VERSION } from '@common/optionalPlugins'
import { pluginStore, pluginRuntime, pluginBusy, pluginOperationErrors, pluginStoreError, refreshPlugins, changePluginInstallation } from '@renderer/store/optionalPlugins'

const expanded = ref(null)
const refreshing = ref(false)
const definitions = [
  { id: 'sound-effects', title: 'setting__plugins_sound_effects_title', description: 'setting__plugins_sound_effects_description', icon: '#icon-tune-variant' },
  { id: 'audio-visualizer', title: 'setting__plugins_visualizer_title', description: 'setting__plugins_visualizer_description', icon: '#icon-audio-wave' },
]
const items = computed(() => definitions.map(item => {
  const installed = pluginStore.value.installed[item.id]
  const available = pluginStore.value.catalog.find(plugin => plugin.id === item.id)
  return {
    ...item,
    installed: !!installed || !!pluginStore.value.errors[item.id],
    loaded: !!pluginRuntime.components[item.id],
    broken: !!pluginStore.value.errors[item.id] || !!pluginRuntime.errors[item.id],
    available: !!available,
    version: installed?.manifest.version ?? available?.version,
    bytes: available?.bytes,
    update: installed && available && installed.manifest.version !== available.version,
    incompatible: available && available.apiVersion !== PLUGIN_API_VERSION,
  }
}))
const refresh = async() => {
  if (refreshing.value) return
  refreshing.value = true
  try { await refreshPlugins() } finally { refreshing.value = false }
}
const uninstall = async(id) => {
  if (expanded.value === id) expanded.value = null
  await changePluginInstallation(id, false)
}
onMounted(() => { void refresh() })
</script>

<style lang="less" module>
.header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.header button { flex: none; }
.description { color: var(--color-font); font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px; max-width: 1000px; }
.card { border: 1px solid var(--color-primary-light-100-alpha-700); border-radius: var(--radius-lg); padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.cardHeader { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.title { margin: 0 0 4px !important; font-size: 15px !important; }
.icon { display: flex; width: 36px; height: 36px; padding: 7px; box-sizing: border-box; border-radius: var(--radius-md); color: var(--color-primary); background: var(--color-primary-alpha-900); }
.icon svg { width: 100%; height: 100%; }
.badge { margin-left: auto; color: var(--color-font-label); font-size: 11px; }
.installed { color: var(--color-primary); }
.meta { font-size: 11px; line-height: 1.4; color: var(--color-font-label); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 4px; }
.note { margin: 16px 15px; font-size: 12px; line-height: 1.6; color: var(--color-font-label); }
.notice { margin: 8px 15px; color: var(--color-font); font-size: 12px; line-height: 1.6; }
.card .notice { margin: 0; }
.settings { max-width: 960px; padding: 0 15px 15px; }
</style>
