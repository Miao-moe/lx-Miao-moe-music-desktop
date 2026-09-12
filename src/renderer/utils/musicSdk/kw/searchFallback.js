import { httpFetch } from '../../request'
import { assertSearch, readSearchBody, searchResult } from '../searchFallback'

export async function webSearch(str, page, limit) {
  const params = new URLSearchParams({
    vipver: 1,
    client: 'kt',
    ft: 'music',
    cluster: 0,
    strategy: 2012,
    encoding: 'utf8',
    rformat: 'json',
    mobi: 1,
    issubtitle: 1,
    show_copyright_off: 1,
    pn: page - 1,
    rn: limit,
    all: str,
  })
  const body = readSearchBody(await httpFetch(`https://www.kuwo.cn/search/searchMusicBykeyWord?${params}`, {
    headers: { Referer: 'https://www.kuwo.cn/' },
  }).promise)
  assertSearch(Array.isArray(body?.abslist))
  return searchResult('kw', this.handleResult(body.abslist), body.HIT, page, limit)
}
