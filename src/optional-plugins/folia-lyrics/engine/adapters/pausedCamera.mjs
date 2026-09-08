// A newly mounted, paused Fume renderer cannot advance its camera transition.
// Snap its camera on a paused draw so opening/seeking lyrics remains readable.
// Keep the imported source unchanged and fail clearly if the upstream hook moves.
export const patchPausedFumeCamera = source => {
  const anchor = '            const cameraDistance = Math.hypot('
  if (source.split(anchor).length !== 2) throw new Error('Folia Fume paused-camera hook changed')
  return source.replace(anchor, `            if (paused) {
                Object.assign(cameraRef.current, {
                    x: targetCameraX, y: targetCameraY, scale: targetCameraScale,
                    focusX: targetCameraX, focusY: targetCameraY, focusScale: targetCameraScale,
                    velocityX: 0, velocityY: 0, velocityScale: 0,
                });
                cameraRetargetRef.current.bridgeMode = 'none';
            }

${anchor}`)
}
