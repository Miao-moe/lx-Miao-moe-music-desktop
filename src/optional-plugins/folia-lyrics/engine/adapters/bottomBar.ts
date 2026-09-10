import { motionValue, useTransform } from 'framer-motion'

// The player renders edge to edge beneath LX-M's controls. Preview frames have
// no controls, while the player supplies the measured height after UI scaling.
export const playerBottomInset = motionValue(0)
export const usePlayerBottomBarBottomPx = (base = 24) => useTransform(playerBottomInset, inset => inset + base)
export const usePlayerSubtitleBottomPx = () => usePlayerBottomBarBottomPx()
