import LyricVisualizer from './LyricVisualizer.vue'
import type { PluginContext } from '@common/optionalPluginTypes'
import { initPreferences } from './preferences'

export default { activate: (context: PluginContext) => initPreferences(context, true), components: { LyricVisualizer } }
