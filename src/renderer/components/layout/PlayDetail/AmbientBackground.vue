<template>
  <div :class="$style.background" aria-hidden="true">
    <transition name="ambient-cover">
      <div v-if="cover" :key="cover" :class="$style.colors">
        <img :src="cover" :class="$style.first" alt="" decoding="async">
        <img :src="cover" :class="$style.second" alt="" decoding="async">
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  cover: { type: String as PropType<string | null>, default: undefined },
})
</script>

<style lang="less" module>
.background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: .16;
}
.colors { position: absolute; inset: 0; }
.first, .second {
  position: absolute;
  inset: -30%;
  width: 160%;
  height: 160%;
  object-fit: cover;
  filter: blur(64px) saturate(1.2);
  animation: drift calc(24s / var(--motion-speed, 1)) ease-in-out infinite alternate;
}
.second {
  opacity: .6;
  animation-direction: alternate-reverse;
  animation-delay: -8s;
}
@keyframes drift {
  from { transform: translate(-8%, -3%) rotate(-12deg) scale(1.05); }
  to { transform: translate(8%, 5%) rotate(12deg) scale(1.15); }
}
:global(.ambient-cover-enter-active), :global(.ambient-cover-leave-active) {
  transition: opacity var(--duration-image) ease;
}
:global(.ambient-cover-enter-from), :global(.ambient-cover-leave-to) { opacity: 0; }
</style>
