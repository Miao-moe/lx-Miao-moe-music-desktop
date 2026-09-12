import { httpFetch } from '../../request'
import { decodeName } from '../../index'
import musicSearch from './musicSearch'

export default {
  // Album tracks must come from the album ID, not a keyword song search.
  async getAlbumDetail(mid, page = 1, limit = 100) {
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid album pagination')
    const { statusCode, body } = await httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: {
        Referer: 'https://y.qq.com/',
      },
      body: {
        comm: { ct: 24, cv: 0, format: 'json', inCharset: 'utf-8', outCharset: 'utf-8', uin: 0 },
        req: {
          module: 'music.musichallAlbum.AlbumSongList',
          method: 'GetAlbumSongList',
          param: {
            albumMid: mid,
            albumID: 0,
            begin: (page - 1) * limit,
            num: limit,
            order: 2,
          },
        },
      },
    }).promise
    const data = body?.req?.data
    if (statusCode !== 200 || body?.code != 0 || body?.req?.code != 0 || !Array.isArray(data?.songList) ||
      !Number.isSafeInteger(data.totalNum) || data.totalNum < 0 || data.songList.some(item => !item?.songInfo?.mid || !item.songInfo.title)) {
      throw new Error(`QQ album request failed (HTTP ${statusCode}, code ${body?.code}, req.code ${body?.req?.code})`)
    }
    const list = musicSearch.handleResult(data.songList.map(item => item.songInfo))
    if (!list.length && (page - 1) * limit < data.totalNum) throw new Error('Invalid QQ album song list')
    return {
      list,
      page,
      limit,
      total: data.totalNum,
      source: 'tx',
    }
  },
  /**
   * 通过专辑 mid 获取专辑信息
   * @param {*} mid
   */
  getAlbumInfo(mid, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))
    return httpFetch(`https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg?albummid=${mid}&format=json`, {
      headers: {
        Referer: 'https://y.qq.com',
      },
    }).promise.then(({ statusCode, body }) => {
      if (statusCode !== 200 || !body || body.code != 0 || !body.data) return this.getAlbumInfo(mid, ++retryNum)

      const data = body.data
      return {
        name: decodeName(data.name ?? ''),
        author: decodeName(data.singername ?? data.singer_name ?? ''),
        img: mid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${mid}.jpg` : '',
        desc: decodeName(data.desc ?? ''),
        time: data.aDate ?? '',
        total: Array.isArray(data.list) ? data.list.length : undefined,
      }
    })
  },
}
