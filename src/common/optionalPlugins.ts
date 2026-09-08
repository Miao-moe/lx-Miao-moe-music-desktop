export const OFFICIAL_PLUGIN_ROOT = 'https://raw.githubusercontent.com/Miao-moe/lx-m_lx-Miao-moe-music-desktop/master/plugins/official/'
export const PLUGIN_API_VERSION = 2
export const PLUGIN_CATALOG_FILE = 'catalog-v2.json'
export const isPluginApiSupported = (version: number) => version === 1 || version === PLUGIN_API_VERSION
export type PluginId = string
export type PluginText = string | Record<string, string>

export interface PluginDisplayInfo {
  name?: PluginText
  description?: PluginText
  icon?: string
}

export interface PluginManifest extends PluginDisplayInfo {
  id: PluginId
  version: string
  apiVersion: number
  entry: string
  lyricEntry?: string
  styles: string[]
  lyricStyles?: string[]
  files: Array<{ path: string, bytes: number, sha256: string }>
}

export interface PluginCatalogEntry extends PluginDisplayInfo {
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

// Catalog membership grants installation; this validates names used as paths and object keys.
export const isPluginId = (value: unknown): value is PluginId => typeof value == 'string' && value.length <= 64 &&
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) &&
  !/^(constructor|prototype|con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(value)

export const pluginText = (value: PluginText | undefined, language: string, fallback = '') => {
  if (typeof value === 'string') return value
  if (!value) return fallback
  return value[language] ?? value[language.split('-')[0]] ?? value['en-us'] ?? value['zh-cn'] ?? Object.values(value)[0] ?? fallback
}

export const comparePluginVersions = (left: string, right: string) => {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
  return 0
}
