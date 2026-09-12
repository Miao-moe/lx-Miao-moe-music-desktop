import { getMusicInfo } from './musicInfo'

export default {
  async getPic(songInfo) {
    const info = await getMusicInfo(songInfo.songmid)
    const url = info?.img
    if (typeof url != 'string' || !/^(https?:)?\/\//.test(url)) throw new Error('图片获取失败')
    return url.startsWith('//') ? 'https:' + url : url
  },
}
