// Minimal reproduction from music-toggle.jsonl; no account or playlist identifiers are retained.
const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#297c88"/></svg>')
const song = (id, source, name, singer, interval) => ({
  id, source, name, singer, interval,
  meta: { songId: id, albumName: name, picUrl: cover, qualitys: [], _qualitys: {} },
})
const original = song('wy_3348197008', 'wy', 'ブレインロット', '東京真中、重音テト', '02:02')
const match = song('541262275_FC9C380552EC6CE86DC46F75240BF83A', 'kg', 'ブレインロット', '東京真中', '02:02')
const unrelated = song('447465057_91AB1E3FC4C33B70C7900F0545D834D6', 'kg', 'シスターに懺悔を (feat. 重音テト)', '廃原メモリ、重音テト', '03:06')
const results = [
  { source: 'kw', list: [song('kw_644708635', 'kw', '東京真中 - パラノイア（feat. 重音テト）', 'Kaozaki', '02:15')] },
  { source: 'kg', list: [match, unrelated] },
  { source: 'wy', list: [original, song('wy_3379487709', 'wy', '脑蚀 ブレインロット （颓废女低）', '芝士', '01:05')] },
]
module.exports = { original, match, unrelated, results, song }
