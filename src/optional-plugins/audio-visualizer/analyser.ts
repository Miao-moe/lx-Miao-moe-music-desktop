import { createAudioAnalyser } from '@renderer/plugins/player'
import { appSetting } from '@renderer/store/setting'
import { watch } from '@common/utils/vueTools'
import { setDesktopAnalyserProvider } from '@renderer/core/lyric'

let active = false
let source: ReturnType<typeof createAudioAnalyser> | null = null
const enabled = () => appSetting['player.audioVisualization'] || (appSetting['desktopLyric.enable'] && appSetting['desktopLyric.audioVisualization'])
const release = () => {
  source?.dispose()
  source = null
}
export const getFrequencyData = () => {
  if (!active || !enabled()) return new Uint8Array()
  source ??= createAudioAnalyser()
  const data = new Uint8Array(source.analyser.frequencyBinCount)
  source.analyser.getByteFrequencyData(data)
  return data
}
export const activate = () => {
  active = true
  setDesktopAnalyserProvider(getFrequencyData)
  const stop = watch(enabled, value => { if (!value) release() })
  return () => {
    active = false
    stop()
    setDesktopAnalyserProvider(null)
    release()
  }
}
