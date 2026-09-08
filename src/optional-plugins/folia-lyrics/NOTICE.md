# Folia lyrics for LX-M

This plugin adapts the 13 built-in lyric renderers from Folia 0.7.4 by chthollyphile and its contributors: https://github.com/chthollyphile/folia-major.

Folia and this adaptation are distributed under GNU AGPL version 3. The full license is included as `LICENSE`. Original rendering files and comments are retained byte for byte in `engine/vendor`; `upstream.json` records their SHA-256 hashes. The LX-M adapter replaces Folia's application shell, bottom playback-bar spacing, and optional custom-image storage. It supplies LX-M's parsed lyric lines, per-word timing, playback clock and audio bands. A build-time adapter positions Fume's camera immediately on paused draws, so entering a style or seeking while paused shows the current lyric without waiting for a camera transition. Folia's account services, online sources, AI features, custom background library and separate desktop application are not included.

Corresponding plugin source, assets, dependency lockfile and build instructions are included in `source.tar.gz` and maintained at https://github.com/Miao-moe/lx-m_lx-Miao-moe-music-desktop/tree/master/src/optional-plugins/folia-lyrics. Extract with `tar -xzf source.tar.gz`. In the repository run `npm ci --prefix src/optional-plugins/folia-lyrics/engine`, then `npm run build:plugins -- folia-lyrics`.

The engine bundles React/React DOM, Motion, PixiJS, Three.js/React Three Fiber, pretext, Lucide, i18next/react-i18next, Zustand, xmldom and AMLL's TTML parser. Their licenses are included in `licenses`. Runtime rendering does not download code or access Folia accounts. The package retains source through updates and can run offline after installation.
