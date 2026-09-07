// Pinned upstream 4.5.4: support the host's frame loop and release all listeners
// and delayed resize work when a plugin/preview is unmounted.
module.exports = source => {
  const replacements = [
    ['class AudioMotionAnalyzer {', `class AudioMotionAnalyzer {
      renderFrame(timestamp) {
        if (!this._ready || this._destroyed) return;
        this._time ??= timestamp;
        this._frames ??= 0;
        this._fps ||= 60;
        try { this._draw(timestamp); } finally { this.stop(); }
      }
    `],
    ['window.addEventListener( EVENT_CLICK, unlockContext );', 'window.addEventListener( EVENT_CLICK, unlockContext, { signal } );'],
    ['this._destroyed = true;', 'this._destroyed = true; window.clearTimeout(this._fsTimeout);'],
  ]
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error('audioMotion 4.5.4 bridge no longer matches upstream')
    source = source.replace(before, after)
  }
  return source
}
