<template>
  <div
    v-if="detailMounted" v-show="detailDisplayed" ref="detailRoot" data-player-detail
    :class="[$style.container, { fullscreen: isFullscreen }]" :aria-hidden="!isShowPlayerDetail"
    :inert="!isShowPlayerDetail ? '' : null" @contextmenu="handleContextMenu"
  >
    <div :class="$style.bg" />
    <AmbientBackground v-if="visibled" :cover="musicInfo.pic" />
    <ControlBtnsLeftHeader v-if="appSetting['common.controlBtnPosition'] == 'left'" data-detail-part="chrome" />
    <ControlBtnsRightHeader v-else data-detail-part="chrome" />
    <div :class="[$style.main, {[$style.showComment]: isShowPlayComment}]">
      <div class="left" :class="$style.left">
        <div :class="$style.info">
          <img
            v-if="musicInfo.pic" ref="detailCover" :class="[$style.img, {[$style.coverTravelling]: coverTravelling}]" :src="musicInfo.pic"
            @mousemove="handleCoverMove" @mouseleave="resetCoverTilt"
          >
          <div class="description scroll" :class="$style.description" data-detail-part="info">
            <p>{{ $t('player__music_name') }}{{ musicInfo.name }}</p>
            <p>{{ $t('player__music_singer') }}{{ musicInfo.singer }}</p>
            <p v-if="musicInfo.album">{{ $t('player__music_album') }}{{ musicInfo.album }}</p>
          </div>
        </div>
      </div>
      <LyricPlayer v-if="visibled" data-detail-part="lyrics" />
      <music-comment v-if="visibled" :class="$style.comment" :show="isShowPlayComment" :music-info="playMusicInfo.musicInfo" @close="hideComment" />
    </div>
    <play-bar v-if="visibled" data-detail-part="controls" />
    <common-audio-visualizer v-if="appSetting['player.audioVisualization'] && visibled" />
  </div>
</template>


<script>
import { watch } from '@common/utils/vueTools'
import usePlayerDetailMotion from '@renderer/utils/compositions/usePlayerDetailMotion'
import AmbientBackground from './AmbientBackground.vue'
import { isFullscreen } from '@renderer/store'
import {
  isShowPlayerDetail,
  isShowPlayComment,
  musicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setShowPlayerDetail,
  setShowPlayComment,
  setShowPlayLrcSelectContentLrc,
} from '@renderer/store/player/action'
import LyricPlayer from './LyricPlayer.vue'
import PlayBar from './PlayBar.vue'
import MusicComment from './components/MusicComment/index.vue'
import ControlBtnsLeftHeader from './ControlBtnsLeftHeader.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'
import { appSetting } from '@renderer/store/setting'
import { closeWindow, maxWindow, minWindow, setFullScreen } from '@renderer/utils/ipc'

export default {
  name: 'CorePlayDetail',
  components: {
    AmbientBackground,
    ControlBtnsLeftHeader,
    ControlBtnsRightHeader,
    LyricPlayer,
    PlayBar,
    MusicComment,
  },
  setup() {
    let clickTime = 0

    const hide = () => {
      setShowPlayerDetail(false)
    }
    const handleContextMenu = () => {
      if (window.performance.now() - clickTime > 400) {
        clickTime = window.performance.now()
        return
      }
      clickTime = 0
      hide()
    }

    const hideComment = () => {
      setShowPlayComment(false)
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()
    }

    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment(false)

      unregisterAutoHideMounse()
    }

    const detailMotion = usePlayerDetailMotion({ onOpened: handleAfterEnter, onClosed: handleAfterLeave })

    watch(isFullscreen, isFullscreen => {
      (isFullscreen ? registerAutoHideMounse : unregisterAutoHideMounse)()
    })


    return {
      appSetting,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      musicInfo,
      hide,
      handleContextMenu,
      hideComment,
      handleAfterEnter,
      handleAfterLeave,
      ...detailMotion,
      isFullscreen,
      fullscreenExit() {
        void setFullScreen(false).then((fullscreen) => {
          isFullscreen.value = fullscreen
        })
      },
      min() {
        minWindow()
      },
      max() {
        maxWindow()
      },
      close() {
        closeWindow()
      },
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@control-btn-width: @height-toolbar * .26;

.container {
  position: absolute;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background-color: var(--color-content-background);
  z-index: 10;
  // -webkit-app-region: drag;
  overflow: hidden;
  border-radius: @radius-border;
  color: var(--color-font);
  // border-left: 12px solid var(--color-primary-alpha-900);
  -webkit-app-region: no-drag;
  contain: strict;

  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
}
.bg {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background: var(--background-image) var(--background-image-position) no-repeat;
  background-size: var(--background-image-size);
  // background-size: 110% 110%;
  // filter: blur(60px);
  opacity: .7;
  z-index: -1;
  &:before {
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background-color: var(--color-app-background);
  }
  &:after {
    position: absolute;
    left: 0;
    top: 0;
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background-color: var(--color-main-background);
  }
}
// .bg2 {
//   position: absolute;
//   width: 100%;
//   height: 100%;
//   top: 0;
//   left: 0;
//   z-index: -1;
//   background-color: rgba(255, 255, 255, .8);
// }

.main {
  flex: auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  margin: 0 30px;
  position: relative;

  &.showComment {
    :global {
      .left {
        flex-basis: 18%;
        .description p {
          font-size: 12px;
        }
      }
      .right {
        flex-basis: 30%;
        .lyricSelectContent {
          font-size: 14px;
        }
      }
      .comment {
        opacity: 1;
        transform: scaleX(1);
      }
    }
  }
}
.left {
  flex: 0 0 40%;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  padding: 13px;
  overflow: hidden;
  transition: flex-basis @transition-normal;
}

.info {
  display: flex;
  flex-flow: column nowrap;
  justify-content: flex-start;
  max-width: 300px;
  min-height: 0;
}
.img {
  max-width: 100%;
  max-height: 80%;
  min-width: 100%;
  box-shadow: 0 0 6px var(--color-primary-alpha-500);
  border-radius: 6px;
  opacity: .8;
  transition: transform var(--duration-normal) var(--ease-standard);
}
.coverTravelling {
  visibility: hidden;
}
.description {
  max-width: 300px;
  margin-top: 15px;
  padding-bottom: 15px;
  min-height: 0;
  p {
    line-height: 1.5;
    font-size: 14px;
    overflow-wrap: break-word;
  }
}


.comment {
  position: absolute;
  right: 0;
  top: 0;
  width: 50%;
  height: 100%;
  opacity: 1;
  margin-left: 10px;
  transform: scaleX(0);
}


</style>
