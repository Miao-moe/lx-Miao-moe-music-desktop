import type { PluginContext } from '@common/optionalPluginTypes'
import { activate as activateAnalyser } from './analyser'
import { initPreferences } from './preferences'
import MainVisualizer from './MainVisualizer.vue'
import Settings from './Settings.vue'
import Toggle from './Toggle.vue'

const activate = (context: PluginContext) => {
  const stopPreferences = initPreferences(context)
  const stopAnalyser = activateAnalyser()
  return () => { stopAnalyser(); stopPreferences() }
}
export default { activate, components: { MainVisualizer, Settings, Toggle } }
