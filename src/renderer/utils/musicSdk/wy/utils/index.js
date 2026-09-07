import { httpFetch } from '../../../request'
import { eapi, weapi } from './crypto'

export const eapiRequest = (url, data) => {
  return httpFetch('http://interface.music.163.com/eapi/batch', {
    method: 'post',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      origin: 'https://music.163.com',
    },
    form: eapi(url, data),
  })
  // requestObj.promise = requestObj.promise.then(({ body }) => {
  //   // console.log(raw)
  //   console.log(body)
  //   // console.log(eapiDecrypt(raw))
  //   // return eapiDecrypt(raw)
  //   return body
  // })
  // return requestObj
}

export const weapiRequest = (url, data) => {
  return httpFetch(`https://music.163.com/weapi${url}`, {
    method: 'post',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://music.163.com/',
      Origin: 'https://music.163.com',
      Cookie: 'os=pc; appver=2.9.7',
    },
    form: weapi(data),
  })
}
