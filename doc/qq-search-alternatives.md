# QQ 音乐其他搜索方式实测（2026-09-08）

目标是寻找可接入 LX-M 的其他 QQ 歌曲搜索方式。测试关键词为 `Talullah Jamiroquai`，使用 Electron 40.9.2、当前 LX-M 的 `request.js` 和 Needle，无账号 Cookie、关闭软件代理、每次请求不重试。此次只验证接口，没有修改业务代码。

2026-09-09 补充：在[五平台复核](./five-platform-search-alternatives.md)中，简化无签名请求搜索“晴天”两次均返回模块 `code=2001`，而带签名 PC 请求的两页均成功。因此下面保留的成功记录只代表当时的实测结果，推荐顺序调整为带签名 PC 搜索优先，无签名方式作为可选候选，Smartbox 作为有限结果兜底。

## 1. 简化的 musicu.fcg 搜索：完整搜索候选

请求 `POST https://u.y.qq.com/cgi-bin/musicu.fcg`，附带 `Referer: https://y.qq.com/`，JSON 正文如下：

```json
{
  "music.search.SearchCgiService": {
    "module": "music.search.SearchCgiService",
    "method": "DoSearchForQQMusicDesktop",
    "param": {
      "search_type": 0,
      "query": "Talullah Jamiroquai",
      "page_num": 1,
      "num_per_page": 30
    }
  }
}
```

本次请求没有 `sign`、Cookie、`comm` 或手工生成的 `searchid`。第一页、第二页均 HTTP 200、业务 code 0，各返回 30 首，平台报告总数 570；两页没有重复 songmid。第一页首条为 `Talullah — Jamiroquai`，songmid 为 `004N3IuW3aOkqg`，并返回媒体 ID、专辑等歌曲信息。

读取 `response['music.search.SearchCgiService'].data.body.song.list` 和 `data.meta.sum`。

此方案简化了请求参数与签名流程，但底层仍调用 PC 搜索方法，与上游 #2848 共享 `DoSearchForQQMusicDesktop`，不能把两者视为完全独立的后端。该调用形式也见于 [qq-music-api 的接口讨论](https://github.com/Rain120/qq-music-api/issues/113)。本次验证的是直接 HTTP 调用，没有抓取 QQ 网页浏览器的完整请求流程。

## 2. 搜索建议 + 歌曲详情：另一条搜索路径

请求 `GET https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg`，参数：

```text
format=json
key=Talullah Jamiroquai
inCharset=utf8
outCharset=utf-8
platform=yqq
```

`key` 作为 URL 参数编码，歌曲列表位于 `data.song.itemlist`。

完整关键词和仅歌名 `Talullah` 各测试一次，均返回 1 首 `Talullah — Jamiroquai`，songmid 为 `003Nt0ko156Zzm`。建议结果含名称、歌手、ID，但不含完整媒体信息。

随后调用当前项目 `src/renderer/utils/musicSdk/tx/musicInfo.js` 所用的 `music.pf_song_detail_svr / get_song_detail_yqq`，用这个 songmid 获取详情。本次 HTTP 200、业务 code 0，成功取得同一首歌的完整详情及媒体 ID `002QAtBA4fCFAb`。未在本次验证中请求音频播放地址。

这条路径适合普通搜索失败后的有限结果兜底或输入联想。它不能等同于完整搜索，不应沿用完整搜索的总数或宣称支持相同的翻页范围。它可能返回歌曲的另一专辑版本，应始终使用实际返回的 QQ songmid 及其对应详情。

LX-M 的歌手/专辑搜索已经在 `src/renderer/utils/musicSdk/tx/entitySearch.js` 中调用这个建议接口，因此无需另接第三方中转服务。

## 3. 旧版 client_search_cp：本地未测通

请求路径为 `https://c.y.qq.com/soso/fcgi-bin/client_search_cp`。

第三方开源实现近期修复过 `new_json=1` 导致空列表的问题，见 [Rain120/qq-music-api #121](https://github.com/Rain120/qq-music-api/pull/121)。据此测试了不带 `new_json`、带 `new_json=1`、带 `new_json=0`、最少参数、不同 Referer、第一页和第二页，本轮合计 6 次均返回 HTTP 500、HTML 响应，未取得歌曲。

这只能说明它在本次环境下没有通过验证，不能据此认定接口已被全局下线。目前不将其列为 LX-M 可直接采用的可靠替代方案。

## 接入判断与记录

- 方案 1 在本记录中通过了真实分页查询，但后续复核也出现业务失败，现优先验证带签名 PC 方案；接入时仍需同步响应解析与相关调用者。
- 方案 2 可作为有限结果兜底，需要补全详情、区分总数与分页行为。
- 本轮成功不代表已解决反馈者环境下的间歇性问题，也没有改变原有 2.4.0 安装包。

探测脚本与完整结果：`.npm/qq-search-alternatives/probe.cjs`、`results.json`、`legacy-results.json`。共 11 次直接请求，结果如下：

| 调用 | 请求次数 | 结果 |
| --- | --- | --- |
| musicu.fcg 简化搜索，第 1、2 页 | 2 | 各 30 首，均成功 |
| smartbox 建议，完整关键词和仅歌名 | 2 | 各 1 首，均成功 |
| 建议结果的歌曲详情 | 1 | 成功补全媒体信息 |
| client_search_cp 参数对照 | 6 | 均 HTTP 500 |
