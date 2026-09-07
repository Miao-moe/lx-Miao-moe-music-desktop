import { computed } from '@common/utils/vueTools'
import type { VisualizerStyle } from './styles'

interface Labels {
  title: string
  main: string
  desktop: string
  enabled: string
  hint: string
  demo: string
  live: string
  close: string
  error: string
  styles: Record<VisualizerStyle, [string, string]>
}
const zh: Labels = {
  title: '音频可视化',
  main: '播放详情',
  desktop: '桌面歌词',
  enabled: '启用可视化',
  hint: '选择样式即可启用，自动保存。两个位置可以分别设置。',
  demo: '演示预览 · 播放后随音乐律动',
  live: '正在预览当前音乐',
  close: '完成',
  error: '样式设置读写失败，请检查用户数据目录后重试。',
  styles: {
    spectrum: ['经典频谱', '沿底部铺开的连续频谱'],
    bars: ['律动音柱', '清晰音柱随节拍起落'],
    mirror: ['镜像光谱', '上下对称的光谱倒影'],
    wave: ['柔波曲线', '层叠曲线如波浪流动'],
    ring: ['环形脉冲', '环绕圆心绽放的节奏'],
    particles: ['星点跃动', '随音乐升起的点点星光'],
  },
}
const tw: Labels = {
  title: '音訊視覺化',
  main: '播放詳情',
  desktop: '桌面歌詞',
  enabled: '啟用視覺化',
  hint: '選擇樣式即可啟用，自動儲存。兩個位置可以分別設定。',
  demo: '示範預覽 · 播放後隨音樂律動',
  live: '正在預覽目前音樂',
  close: '完成',
  error: '樣式設定讀寫失敗，請檢查使用者資料目錄後重試。',
  styles: {
    spectrum: ['經典頻譜', '沿底部鋪開的連續頻譜'],
    bars: ['律動音柱', '清晰音柱隨節拍起落'],
    mirror: ['鏡像光譜', '上下對稱的光譜倒影'],
    wave: ['柔波曲線', '層疊曲線如波浪流動'],
    ring: ['環形脈衝', '環繞圓心綻放的節奏'],
    particles: ['星點躍動', '隨音樂升起的點點星光'],
  },
}
const en: Labels = {
  title: 'Audio visualization',
  main: 'Player',
  desktop: 'Desktop lyrics',
  enabled: 'Enable visualization',
  hint: 'Choose a style to enable it. Each view saves its own selection.',
  demo: 'Demo preview · reacts to music during playback',
  live: 'Previewing your music',
  close: 'Done',
  error: 'Could not read or save the style. Check the user data folder and try again.',
  styles: {
    spectrum: ['Classic spectrum', 'A continuous spectrum along the bottom'],
    bars: ['Rhythm bars', 'Distinct columns moving with the beat'],
    mirror: ['Mirror spectrum', 'A symmetrical reflection of the music'],
    wave: ['Flowing waves', 'Layered curves that flow with the sound'],
    ring: ['Pulse ring', 'A circle of sound that pulses outward'],
    particles: ['Starlight', 'Points of light rising with the music'],
  },
}
export const useLabels = () => computed(() => {
  window.i18n.t('audio_visualization') // Track the host's reactive language selection.
  return window.i18n.locale === 'zh-tw' ? tw : window.i18n.locale.startsWith('zh') ? zh : en
})
