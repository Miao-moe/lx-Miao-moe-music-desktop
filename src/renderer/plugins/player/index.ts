interface HTMLAudioElementChrome extends HTMLAudioElement {
  setSinkId: (id: string) => Promise<void>
}
let audio: HTMLAudioElementChrome | null = null
let audioContext: AudioContext
let mediaSource: MediaElementAudioSourceNode
let gainNode: GainNode
let defaultChannelCount = 2
let processor: { input: AudioNode, output: AudioNode } | null = null
const workletModules = new Map<string, Promise<void>>()

export const createAudio = () => {
  if (audio) return
  audio = new window.Audio() as HTMLAudioElementChrome
  audio.controls = false
  audio.autoplay = true
  audio.preload = 'auto'
  audio.crossOrigin = 'anonymous'

  // https://developer.chrome.com/blog/autoplay
  audio.addEventListener('playing', () => {
    if (audioContext?.state == 'suspended') {
      void audioContext.resume().catch((err) => {
        console.error('Resume audio context failed:', err)
        throw err
      })
    }
  })
}

export const getAudioElement = (): HTMLAudioElement => {
  if (!audio) throw new Error('audio not defined')
  return audio
}

const reconnectSource = () => {
  mediaSource.disconnect()
  mediaSource.connect(processor?.input ?? gainNode)
}
const initAdvancedAudioFeatures = () => {
  if (audioContext) return
  if (!audio) throw new Error('audio not defined')
  audioContext = new window.AudioContext({ latencyHint: 'playback' })
  defaultChannelCount = audioContext.destination.channelCount
  mediaSource = audioContext.createMediaElementSource(audio)
  gainNode = audioContext.createGain()
  gainNode.connect(audioContext.destination)
  reconnectSource()
  window.app_event.on('playerDeviceChanged', reconnectSource)
}
export const getAudioContext = () => {
  initAdvancedAudioFeatures()
  return audioContext
}
export const attachAudioProcessor = (input: AudioNode, output: AudioNode) => {
  initAdvancedAudioFeatures()
  if (processor) throw new Error('An audio processor is already connected')
  const attached = { input, output }
  processor = attached
  output.connect(gainNode)
  reconnectSource()
  return () => {
    if (processor !== attached) return
    processor = null
    output.disconnect(gainNode)
    reconnectSource()
  }
}
export const createAudioAnalyser = () => {
  initAdvancedAudioFeatures()
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
  // A separate branch observes the audio without adding processing to playback.
  gainNode.connect(analyser)
  let disposed = false
  return {
    analyser,
    dispose() {
      if (disposed) return
      disposed = true
      gainNode.disconnect(analyser)
      analyser.disconnect()
    },
  }
}
export const loadAudioWorklet = async(name: string, url: string) => {
  initAdvancedAudioFeatures()
  let promise = workletModules.get(name)
  if (!promise) {
    promise = audioContext.audioWorklet.addModule(url).catch((error) => {
      workletModules.delete(name)
      throw error
    })
    workletModules.set(name, promise)
  }
  return promise
}

let unsubMediaListChangeEvent: (() => void) | null = null
export const setMaxOutputChannelCount = (enable: boolean) => {
  if (enable) {
    initAdvancedAudioFeatures()
    audioContext.destination.channelCountMode = 'max'
    audioContext.destination.channelCount = audioContext.destination.maxChannelCount
    // navigator.mediaDevices.addEventListener('devicechange', handleMediaListChange)
    if (!unsubMediaListChangeEvent) {
      let handleMediaListChange = () => {
        setMaxOutputChannelCount(true)
      }
      window.app_event.on('playerDeviceChanged', handleMediaListChange)
      unsubMediaListChangeEvent = () => {
        window.app_event.off('playerDeviceChanged', handleMediaListChange)
        unsubMediaListChangeEvent = null
      }
    }
  } else {
    unsubMediaListChangeEvent?.()
    if (audioContext && audioContext.destination.channelCountMode != 'explicit') {
      audioContext.destination.channelCount = defaultChannelCount
      // audioContext.destination.channelInterpretation
      audioContext.destination.channelCountMode = 'explicit'
    }
  }
}

export const hasInitedAdvancedAudioFeatures = (): boolean => audioContext != null

export const setResource = (src: string) => {
  if (audio) audio.src = src
}

export const setPlay = () => {
  void audio?.play()
}

export const setPause = () => {
  audio?.pause()
}

export const setStop = () => {
  if (audio) {
    audio.src = ''
    audio.removeAttribute('src')
  }
}

export const isEmpty = (): boolean => !audio?.src

export const setLoopPlay = (isLoop: boolean) => {
  if (audio) audio.loop = isLoop
}

export const getPlaybackRate = (): number => {
  return audio?.defaultPlaybackRate ?? 1
}

export const setPlaybackRate = (rate: number) => {
  if (!audio) return
  audio.defaultPlaybackRate = rate
  audio.playbackRate = rate
}

export const setPreservesPitch = (preservesPitch: boolean) => {
  if (!audio) return
  audio.preservesPitch = preservesPitch
}

export const getMute = (): boolean => {
  return audio?.muted ?? false
}

export const setMute = (isMute: boolean) => {
  if (audio) audio.muted = isMute
}

export const getCurrentTime = () => {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return audio?.currentTime || 0
}

export const setCurrentTime = (time: number) => {
  if (audio) audio.currentTime = time
}

export const setMediaDeviceId = async(mediaDeviceId: string): Promise<void> => {
  if (!audio) return
  return audio.setSinkId(mediaDeviceId)
}

export const setVolume = (volume: number) => {
  if (audio && volume > 1 && !gainNode) {
    initAdvancedAudioFeatures()
  }
  if (gainNode) {
    if (audio) audio.volume = 1
    gainNode.gain.value = volume
  } else if (audio) {
    audio.volume = volume
  }
}

export const getDuration = () => {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return audio?.duration || 0
}

// export const getPlaybackRate = () => {
//   return audio?.playbackRate ?? 1
// }

type Noop = () => void

export const onPlaying = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio.addEventListener('playing', callback)
  return () => {
    audio?.removeEventListener('playing', callback)
  }
}

export const onPause = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio?.addEventListener('pause', callback)
  return () => {
    audio?.removeEventListener('pause', callback)
  }
}

export const onEnded = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio.addEventListener('ended', callback)
  return () => {
    audio?.removeEventListener('ended', callback)
  }
}

export const onError = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio.addEventListener('error', callback)
  return () => {
    audio?.removeEventListener('error', callback)
  }
}

export const onLoadeddata = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio.addEventListener('loadeddata', callback)
  return () => {
    audio?.removeEventListener('loadeddata', callback)
  }
}

export const onLoadstart = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio.addEventListener('loadstart', callback)
  return () => {
    audio?.removeEventListener('loadstart', callback)
  }
}

export const onCanplay = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio.addEventListener('canplay', callback)
  return () => {
    audio?.removeEventListener('canplay', callback)
  }
}

export const onEmptied = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio.addEventListener('emptied', callback)
  return () => {
    audio?.removeEventListener('emptied', callback)
  }
}

export const onTimeupdate = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio.addEventListener('timeupdate', callback)
  return () => {
    audio?.removeEventListener('timeupdate', callback)
  }
}

// 缓冲中
export const onWaiting = (callback: Noop) => {
  if (!audio) throw new Error('audio not defined')

  audio.addEventListener('waiting', callback)
  return () => {
    audio?.removeEventListener('waiting', callback)
  }
}

// 可见性改变
export const onVisibilityChange = (callback: Noop) => {
  document.addEventListener('visibilitychange', callback)
  return () => {
    document.removeEventListener('visibilitychange', callback)
  }
}


export const getErrorCode = () => {
  return audio?.error?.code
}
