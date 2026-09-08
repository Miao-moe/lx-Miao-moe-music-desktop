import { useMotionValue } from 'framer-motion'

// The host's playback controls sit outside the iframe, so subtitles need no reserved bar.
export const usePlayerSubtitleBottomPx = () => useMotionValue(24)
export const usePlayerBottomBarBottomPx = (base = 24) => useMotionValue(base)
