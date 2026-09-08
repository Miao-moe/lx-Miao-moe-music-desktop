import { computed } from '@common/utils/vueTools'
import type { FoliaMode } from './protocol'

const styles: Record<FoliaMode, [string, string, string]> = {
  classic: ['流光', '流光', 'Luminous'],
  fume: ['浮名', '浮名', 'Fume'],
  partita: ['云阶', '雲階', 'Partita'],
  tilt: ['倾诉', '傾訴', 'Tilt'],
  cadenza: ['心象', '心象', 'Mindscape'],
  cappella: ['群唱', '群唱', 'Cappella'],
  claddagh: ['回环', '迴環', 'Claddagh'],
  diorama: ['镜台', '鏡台', 'Diorama'],
  monet: ['莫奈', '莫奈', 'Monet'],
  pendolo: ['时计', '時計', 'Pendolo'],
  sonnet: ['商籁', '商籟', 'Sonnet'],
  tempera: ['凝彩', '凝彩', 'Tempera'],
  still: ['静止', '靜止', 'Still'],
}
export const useLabels = () => computed(() => {
  window.i18n.t('setting__plugins_folia_title')
  const language = window.i18n.locale === 'zh-tw' ? 1 : window.i18n.locale.startsWith('zh') ? 0 : 2
  return {
    title: ['Folia 歌词动效', 'Folia 歌詞動效', 'Folia lyrics'][language],
    enable: ['在播放详情页启用 Folia', '在播放詳細頁啟用 Folia', 'Enable Folia in player details'][language],
    style: ['歌词样式', '歌詞樣式', 'Lyric style'][language],
    standard: ['标准歌词', '標準歌詞', 'Standard lyrics'][language],
    demo: ['演示预览 · 不会播放声音', '示範預覽 · 不會播放聲音', 'Demo preview · no sound'][language],
    hint: ['选择样式即可启用，设置会自动保存。支持逐字歌词与普通 LRC。', '選擇樣式即可啟用，設定會自動儲存。支援逐字歌詞與一般 LRC。', 'Selecting a style enables Folia and saves your preference. Supports word-timed lyrics and plain LRC.'][language],
    error: ['歌词动效加载失败，可重试或切回标准歌词。', '歌詞動效載入失敗，可重試或切回標準歌詞。', 'Could not load the animation. Retry or switch to standard lyrics.'][language],
    saveError: ['设置读写失败，请检查用户数据目录。', '設定讀寫失敗，請檢查使用者資料目錄。', 'Could not read or save preferences. Check the user data folder.'][language],
    retry: ['重试', '重試', 'Retry'][language],
    styles: Object.fromEntries(Object.entries(styles).map(([id, names]) => [id, names[language]])) as Record<FoliaMode, string>,
  }
})
