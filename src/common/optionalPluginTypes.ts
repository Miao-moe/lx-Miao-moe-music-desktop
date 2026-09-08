import type { Component, Ref } from 'vue'

export interface PluginContext {
  id: string
  apiVersion: number
  version: string
  assetUrl: (name: string) => string
  readAsset: (name: string) => Promise<Uint8Array>
}
export interface PluginModule {
  components: Record<string, Component>
  slots?: { playDetailControls?: Component, desktopLyricOverlay?: Component }
  playDetail?: { component: Component, enabled: Readonly<Ref<boolean>> }
  activate?: (context: PluginContext) => (() => void)
}
