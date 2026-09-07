import { attachAudioProcessor, getAudioContext, getAudioElement, loadAudioWorklet } from '@renderer/plugins/player'
import type { PluginContext } from '@common/optionalPluginTypes'
import { convolutions, freqs } from './presetsData'

export const createSoundEffects = (context: PluginContext) => {
  const audioContext = getAudioContext()
  const audio = getAudioElement()
  const filters = freqs.map(frequency => {
    const filter = audioContext.createBiquadFilter()
    filter.type = 'peaking'
    filter.frequency.value = frequency
    filter.Q.value = 1.4
    return filter
  })
  const convolver = audioContext.createConvolver()
  const dry = audioContext.createGain()
  const wet = audioContext.createGain()
  const compressor = audioContext.createDynamicsCompressor()
  const panner = audioContext.createPanner()
  wet.gain.value = 0
  for (let i = 1; i < filters.length; i++) filters[i - 1].connect(filters[i])
  const lastFilter = filters[filters.length - 1]
  const connectReverb = (source: AudioNode) => {
    source.connect(dry)
    source.connect(convolver)
  }
  connectReverb(lastFilter)
  convolver.connect(wet)
  dry.connect(compressor)
  wet.connect(compressor)
  compressor.connect(panner)
  const detach = attachAudioProcessor(filters[0], panner)
  let disposed = false
  let pannerTimer: ReturnType<typeof setInterval> | null = null
  let convolutionName = ''
  let convolutionRequest = 0
  let pitch: AudioWorkletNode | null = null
  let pitchLoading = false
  let pitchFactor = 1
  let pitchConnected = false
  const processorName = `lx-sound-effects-${context.version}`
  const buffers = new Map<string, AudioBuffer>()

  const syncPitch = () => {
    if (disposed) return
    const connect = pitch != null && pitchFactor !== 1 && !audio.paused
    if (pitch) pitch.parameters.get('pitchFactor')!.value = pitchFactor
    if (connect === pitchConnected) return
    lastFilter.disconnect()
    pitch?.disconnect()
    if (connect) {
      lastFilter.connect(pitch!)
      connectReverb(pitch!)
    } else connectReverb(lastFilter)
    pitchConnected = connect
  }
  const pausePitch = () => {
    if (!pitchConnected) return
    lastFilter.disconnect()
    pitch?.disconnect()
    connectReverb(lastFilter)
    pitchConnected = false
  }
  audio.addEventListener('playing', syncPitch)
  audio.addEventListener('pause', pausePitch)
  audio.addEventListener('waiting', pausePitch)
  audio.addEventListener('emptied', pausePitch)

  const setPitch = (value: number) => {
    pitchFactor = value
    syncPitch()
    if (value === 1 || pitch != null || pitchLoading) return
    pitchLoading = true
    void loadAudioWorklet(processorName, context.assetUrl('pitch-shifter/phase-vocoder.js')).then(() => {
      if (disposed) return
      pitch = new AudioWorkletNode(audioContext, processorName, { outputChannelCount: [2] })
      syncPitch()
    }).catch(error => {
      if (!disposed) console.error('Sound effect pitch processor failed:', error)
    }).finally(() => { pitchLoading = false })
  }

  const setConvolution = async(name: string, mainGain: number, sendGain: number) => {
    dry.gain.value = name ? mainGain : 1
    wet.gain.value = name ? sendGain : 0
    if (name === convolutionName) return
    convolutionName = name
    const request = ++convolutionRequest
    convolver.buffer = null
    if (!name) return
    try {
      if (!convolutions.some(item => item.source === name)) throw new Error('Unknown convolution preset')
      let buffer = buffers.get(name)
      if (!buffer) {
        const bytes = await context.readAsset('filters/' + name)
        if (disposed || request !== convolutionRequest) return
        buffer = await audioContext.decodeAudioData(Uint8Array.from(bytes).buffer)
        if (disposed || request !== convolutionRequest) return
        buffers.set(name, buffer)
      }
      if (!disposed && request === convolutionRequest) convolver.buffer = buffer
    } catch (error) {
      if (disposed || request !== convolutionRequest) return
      // The request token above prevents an older request from resetting a newer preset.
      // eslint-disable-next-line require-atomic-updates
      convolutionName = ''
      dry.gain.value = 1
      wet.gain.value = 0
      console.error('Sound effect convolution failed:', error)
    }
  }

  return {
    apply(setting: LX.AppSetting) {
      for (const [index, frequency] of freqs.entries()) filters[index].gain.value = setting[`player.soundEffect.biquadFilter.hz${frequency}`]
      if (pannerTimer) clearInterval(pannerTimer)
      pannerTimer = null
      panner.positionX.value = panner.positionY.value = panner.positionZ.value = 0
      if (setting['player.soundEffect.panner.enable']) {
        let angle = 0
        const radius = setting['player.soundEffect.panner.soundR'] / 10
        pannerTimer = setInterval(() => {
          angle = (angle + 1) % 360
          panner.positionX.value = Math.sin(angle * Math.PI / 180) * radius
          panner.positionY.value = panner.positionZ.value = Math.cos(angle * Math.PI / 180) * radius
        }, Math.max(2, setting['player.soundEffect.panner.speed'] * 2))
      }
      void setConvolution(setting['player.soundEffect.convolution.fileName'] ?? '', setting['player.soundEffect.convolution.mainGain'] / 10, setting['player.soundEffect.convolution.sendGain'] / 10)
      setPitch(setting['player.soundEffect.pitchShifter.playbackRate'])
    },
    dispose() {
      if (disposed) return
      disposed = true
      convolutionRequest++
      if (pannerTimer) clearInterval(pannerTimer)
      audio.removeEventListener('playing', syncPitch)
      audio.removeEventListener('pause', pausePitch)
      audio.removeEventListener('waiting', pausePitch)
      audio.removeEventListener('emptied', pausePitch)
      detach()
      for (const node of [...filters, convolver, dry, wet, compressor, panner]) node.disconnect()
      pitch?.disconnect()
      pitch?.port.close()
      convolver.buffer = null
      buffers.clear()
    },
  }
}
