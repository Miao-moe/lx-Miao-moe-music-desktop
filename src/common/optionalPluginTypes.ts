import type { Component } from 'vue'

export interface PluginContext {
  version: string
  assetUrl: (name: string) => string
  readAsset: (name: string) => Promise<Uint8Array>
}
export interface PluginModule {
  components: Record<string, Component>
  activate?: (context: PluginContext) => (() => void)
}
