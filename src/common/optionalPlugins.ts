export const OFFICIAL_PLUGIN_ROOT = 'https://raw.githubusercontent.com/Miao-moe/lx-m_lx-Miao-moe-music-desktop/master/plugins/official/'
export const PLUGIN_API_VERSION = 1
export const PLUGIN_IDS = ['sound-effects', 'audio-visualizer'] as const
export type PluginId = typeof PLUGIN_IDS[number]

export interface PluginManifest {
  id: PluginId
  version: string
  apiVersion: number
  entry: string
  lyricEntry?: string
  styles: string[]
  lyricStyles?: string[]
  files: Array<{ path: string, bytes: number, sha256: string }>
}

export interface PluginCatalogEntry {
  id: PluginId
  version: string
  apiVersion: number
  path: string
  bytes: number
  sha256: string
}

export interface PluginCatalog {
  schemaVersion: 1
  plugins: PluginCatalogEntry[]
}

export interface InstalledPlugin {
  manifest: PluginManifest
  directory: string
}

export interface PluginStoreSnapshot {
  revision: number
  catalog: PluginCatalogEntry[]
  installed: Partial<Record<PluginId, InstalledPlugin>>
  errors: Partial<Record<PluginId, string>>
  catalogError: string | null
}

export const PLUGIN_IPC = {
  list: 'optional_plugins:list',
  refresh: 'optional_plugins:refresh',
  install: 'optional_plugins:install',
  uninstall: 'optional_plugins:uninstall',
  changed: 'optional_plugins:changed',
} as const

export const isPluginId = (value: unknown): value is PluginId => typeof value == 'string' && PLUGIN_IDS.includes(value as PluginId)
