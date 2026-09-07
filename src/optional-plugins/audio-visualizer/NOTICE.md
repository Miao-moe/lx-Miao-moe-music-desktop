# Audio visualization plugin

This plugin includes audioMotion-analyzer 4.5.4 by Henrique Avila Vianna,
Copyright (c) 2018-2026, licensed under AGPL-3.0-or-later.

- Upstream: https://github.com/hvianna/audioMotion-analyzer
- Exact upstream package: https://registry.npmjs.org/audiomotion-analyzer/-/audiomotion-analyzer-4.5.4.tgz
- License: `licenses/audioMotion-AGPL-3.0.txt` in this package
- Plugin and build source: https://github.com/Miao-moe/lx-m_lx-Miao-moe-music-desktop/tree/master/src/optional-plugins/audio-visualizer
- Build adapter: https://github.com/Miao-moe/lx-m_lx-Miao-moe-music-desktop/blob/master/build-config/plugins/audiomotion-loader.js

The combined audio visualization plugin is distributed under AGPL-3.0-or-later.
Original LX-M code remains available under Apache-2.0. The host and other plugins
retain their respective licenses.

The pinned upstream renderer is bundled locally. The build adapter adds a
single-frame rendering method and fixes click-listener and delayed-resize cleanup.
The plugin supplies 8192-point FFT data through a rendering-only context adapter,
so previews and desktop lyrics use the same upstream radial rendering without
opening extra audio devices. No upstream radial drawing algorithm is replaced.
