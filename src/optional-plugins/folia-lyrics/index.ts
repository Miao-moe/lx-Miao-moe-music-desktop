import { initPreferences, enabled } from './preferences'
import Stage from './Stage.vue'
import Settings from './Settings.vue'
import Toggle from './Toggle.vue'

export default { activate: initPreferences, components: { Settings, Toggle }, slots: { playDetailControls: Toggle }, playDetail: { component: Stage, enabled } }
