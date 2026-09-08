import React, { forwardRef } from 'react'
import { resolveThemeFontStack, resolveThemeFontWeight } from '../vendor/src/utils/fontStacks'

// Folia supplies the lyric layout; LX-M owns the surrounding player and background.
export default forwardRef<HTMLDivElement, any>(function Shell({ theme, children, className = '' }, ref) {
  return <div ref={ref} className={`absolute inset-0 overflow-hidden ${className}`} style={{ fontFamily: resolveThemeFontStack(theme), fontWeight: resolveThemeFontWeight(theme), color: theme.primaryColor }}>{children}</div>
})
