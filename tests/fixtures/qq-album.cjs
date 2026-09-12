const mid = '000f01724fd7TH'
const titles = ['可爱女人', '完美主义', '星晴', '娘子', '斗牛', '黑色幽默', '伊斯坦堡', '印第安老斑鸠', '龙卷风', '反方向的钟']
const songs = (count = titles.length) => Array.from({ length: count }, (_, index) => ({
  songInfo: {
    id: 97750 + index, mid: `album-song-${index}`, title: titles[index] ?? `Track ${index + 1}`, type: 0, interval: 239,
    index_album: index + 1, singer: [{ id: 4558, mid: '0025NhlN2yWrP4', name: '周杰伦' }],
    album: { id: 8218, mid, name: 'Jay' },
    file: { media_mid: `album-media-${index}`, size_128mp3: 3825776, size_320mp3: 9564040, size_flac: 27700038, size_hires: 0 },
  },
}))
const response = (list, total = list.length) => ({
  statusCode: 200,
  body: { code: 0, req: { code: 0, data: { albumMid: mid, totalNum: total, songList: list } } },
})
const info = { statusCode: 200, body: { code: 0, data: { name: 'Jay', singername: '周杰伦', aDate: '2000-11-07', desc: 'Album fixture', list: songs() } } }

module.exports = { mid, titles, songs, response, info }
