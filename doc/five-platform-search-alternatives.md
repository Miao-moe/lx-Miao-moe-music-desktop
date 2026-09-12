# 五个平台的备用搜索接口核查（2026-09-09）

2026-09-12 更新：合入官方 2.12.3 / 2.12.4 后，QQ 默认使用 Desktop，Mobile 改为备用；酷狗默认参数改为 AndroidFilter；咪咕封面改走资源详情接口。下文保留 9 月 9 日的调查和接入记录，当前行为见 [合并核对](upstream-2.12.3-2.12.4-merge.md)。

范围为 LX-M 当前内置的酷我（kw）、酷狗（kg）、QQ 音乐（tx）、网易云（wy）、咪咕（mg）。前半部分记录接口调查；文末记录后续接入与验证。

## 结论与实测

五个平台都找到并验证了替代搜索路径。2026-09-09 00:00–00:04（北京时间），使用当前项目的 `request.js`、Needle 和 Electron 40.9.2 / Node 24.14.1，搜索“晴天”，请求每页 10 首，不使用账号 Cookie 或软件代理，不做自动重试。网易云另用“海阔天空”复核异常结果。共发出 32 次请求；各平台内部串行，不同平台并行。

| 平台 | LX-M 当前的歌曲搜索 | 已验证的其他方式 | 第 1 / 2 页结果 |
| --- | --- | --- | --- |
| 酷我 | `search.kuwo.cn/r.s` | `www.kuwo.cn/search/searchMusicBykeyWord` | 10 / 10 首，平台报告总数 3595 |
| 酷狗 | `song_search_v2` 的 `WebFilter` 参数 | `msearch.kugou.com/api/v3/search/song`；`mobilecdn.kugou.com/api/v3/search/song` | 两种调用各 10 / 10 首，总数 480 |
| QQ 音乐 | 带签名的 `DoSearchForQQMusicMobile` | 带签名的 `DoSearchForQQMusicDesktop`；另有 Smartbox 建议加歌曲详情 | PC 搜索 10 / 10 首，总数 995；建议接口返回 4 首 |
| 网易云 | EAPI `/api/search/song/list/page` | EAPI `/api/cloudsearch/pc`；另有 WEAPI `/search/suggest/web` | Cloudsearch 10 / 10 首，总数 335；建议接口返回 4 首 |
| 咪咕 | `jadeite.migu.cn/music_search/v3/search/searchAll` | PC 的 `/pc/resource/song/item/search/v1.0`；旧 App 的 `/MIGUM3.0/v1.0/content/search_all.do` | 两种调用各 20 / 20 首；旧 App 接口报告总数 158 |

上表 7 种完整搜索调用方式的两页均含歌曲标识、返回了与关键词相关的歌曲，两页歌曲标识没有重复。这是接口及有限分页验证，不代表它们拥有互相独立的后端，也不保证以后每次都成功。

## 酷我

**网页搜索可作为备用完整搜索。** 实现参考：[Listen1 酷我 Provider](https://github.com/listen1/listen1_chrome_extension/blob/master/js/provider/kuwo.js)。

- 方法：`GET https://www.kuwo.cn/search/searchMusicBykeyWord`。
- 核心参数：`all=晴天`、`pn=0`、`rn=10`；`pn` 从 0 开始。其余参数见探测脚本 `kwParams`，包括 `client=kt`、`ft=music`、`rformat=json` 等。
- 本次使用 `Referer: https://www.kuwo.cn/`，没有账号 Cookie 或 Secret 请求头，成功返回数据。
- 歌曲列表在 `abslist`，总数在 `HIT`；歌曲中包含 `MUSICRID`、`DC_TARGETID`、`SONGNAME`、`ARTIST`、`N_MINFO` 等。
- 接入时需要处理总数字段与当前 `TOTAL` 的差异；歌曲仍使用真实的酷我 RID。

另外测试了 `/api/www/search/searchMusicBykeyWord`，本轮 HTTP 200 但没有歌曲结果，不能与上面的 `/search/` 路由混淆。当前 `tips.kuwo.cn/t.s` 返回 10 条关键词提示，只有 `RELWORD` 等字段，没有歌曲 ID，不能像 QQ Smartbox 那样直接接歌曲详情。

## 酷狗

**移动端 v3 搜索可作为备用完整搜索。** 接口参考：[Kugou-api 音乐搜索](https://github.com/ecitlm/Kugou-api#音乐搜索)。项目自己的 `kg/entitySearch.js` 也已使用 `msearch.kugou.com` 的同系列接口搜索歌手、专辑。

1. `GET https://msearch.kugou.com/api/v3/search/song`：本次参数包含 `keyword`、`page`、`pagesize`、`version=9108`、`plat=0`、`sver=2`、`iscorrection=1`、`with_res_tag=1`、`highlight=em`。
2. `GET http://mobilecdn.kugou.com/api/v3/search/song`：本次参数为 `format=json`、`keyword`、`page`、`pagesize`、`showtype=1`。

二者均从 `data.info` 取歌曲、`data.total` 取总数，具有 `hash`、`audio_id`、`album_audio_id`、歌手和音质字段。`msearch` 本次把 JSON 包在 `<!--KG_TAG_RES_START-->` / `<!--KG_TAG_RES_END-->` 标记中，且歌名带 `<em>` 高亮，需要先去掉固定包装及高亮。当前 SDK 读取 `data.lists`、`FileHash` 等字段，不能直接原样复用返回解析。

注意两项实测差异：

- 对 `mobilecdn` 使用 HTTPS 时发生 `ERR_TLS_CERT_ALTNAME_INVALID`；按其文档中的 HTTP 地址测试，两页正常。没有关闭 TLS 证书验证。
- [上游 #2849](https://github.com/lyswhut/lx-music-desktop/pull/2849) 的 `AndroidFilter` 也是候选，但本轮 HTTP 第一页为空；改用 HTTPS 后第一页返回 10 首，第二页却为空且总数变成 0。因此暂不将这组结果算作通过分页验证。

`searchtip.kugou.com/getSearchTip` 返回了 10 条关键词提示，本次提取的 `RecordDatas` 没有可直接调用歌曲详情的歌曲 ID。

## QQ 音乐

**完整搜索优先验证带签名的 PC 方案，Smartbox 可做有限结果兜底。** 请求和参数参考：[LX 上游 #2848](https://github.com/lyswhut/lx-music-desktop/pull/2848)。

- `POST https://u.y.qq.com/cgi-bin/musics.fcg?sign=...`，方法为 `music.search.SearchCgiService / DoSearchForQQMusicDesktop`。保留上游对应的 PC 参数和 `searchid`，签名继续使用现有 `zzcSign`。
- 本次两页各 10 首成功，列表在模块 `data.body.song.list`，总数在 `data.meta.sum`；需要兼容模块名和 `req` 两种响应入口。
- `GET https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg` 搜索“晴天”返回 4 首，位于 `data.song.itemlist`，含真实 `songmid`。再用 `music.pf_song_detail_svr / get_song_detail_yqq` 补全媒体信息；此前已用 `Talullah Jamiroquai` 验证这条详情补全链路。

**修正前一轮推荐：** 简化的无签名 `musicu.fcg` 请求之前用 `Talullah Jamiroquai` 测通，但本轮用“晴天”两次都返回 HTTP 200、模块 `code=2001`。所以不能把“无需签名”当成更可靠的保证，不宜把它作为唯一搜索入口。详见[QQ 专项记录](./qq-search-alternatives.md)。

## 网易云

**Cloudsearch 可作为备用完整搜索，搜索建议可做有限结果兜底。** 路由参考：[Cloudsearch 实现](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/main/module/cloudsearch.js)、[搜索建议实现](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/main/module/search_suggest.js)。

- 复用当前 `eapiRequest('/api/cloudsearch/pc', data)`；参数为 `s=关键词`、`type=1`、`limit`、`offset`、`total`。实际请求仍由现有 EAPI 加密封装发送。
- 两页均成功；读取 `result.songs`、`result.songCount`。歌曲直接包含 `id`、`ar`、`al`、`privilege`、音质信息，而不是当前 `baseInfo.simpleSongData` 的包装。
- `POST https://music.163.com/weapi/search/suggest/web`，以现有 WEAPI 加密发送 `{s: 关键词}`。本轮返回 4 首，含 ID，可再补全详情；不等同于完整分页搜索。

排除了两个看似可用的候选：

- `POST /api/search/pc` 本轮返回业务码 `-462`。
- `/api/search/get` 的 EAPI、WEAPI 调用虽返回 `code=200` 和歌曲列表，但搜索“晴天”主要返回“93”，更换“海阔天空”后主要返回“42”，结果明显不匹配。已解密核对 EAPI 发出的路径和关键词，确认传入值正确。不能仅凭成功码、非空数组或页码不同就判定可接入。

## 咪咕

**PC 与旧 App 接口均可作为备用完整搜索。** PC 路径及历史候选参考：[Listen1 咪咕 Provider](https://github.com/listen1/listen1_chrome_extension/blob/master/js/provider/migu.js)。

1. `GET https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0`，参数 `text`、`pageNo`、`pageSize`。响应直接是歌曲数组，含 `songId`、`copyrightId`、`songName`、`audioFormats` 等；本次响应没有总数，不应仿照一些实现随意填写 `1000`。
2. `GET https://pd.musicapp.migu.cn/MIGUM3.0/v1.0/content/search_all.do`，参数 `text`、`pageNo`、`pageSize`、`ua=Android_migu`、`version=5.0.1` 和开启歌曲搜索的 `searchSwitch`。本次业务码为 `000000`，读取 `songResultData.result` 与 `songResultData.totalCount`，字段包含 `id`、`copyrightId`、`name`、`singers`、`newRateFormats` 等。

两种调用在请求 `pageSize=10` 时实际都返回每页 20 首，第一页与第二页不同；接入时需按实际分页行为处理。PC 接口缺少总数，适合按是否还有下一页加载，不能直接假定当前 SDK 的总数分页逻辑适用。旧 App 方案本次带有总数，适配现有列表更直接。

本轮 H5 `scr_search_tag` 与网页 `search/suggest` 的初始请求都返回 301，没有取得歌曲；未验证它们重定向后的 API 行为，不作“全局失效”的结论。

## 接入顺序与验证边界

建议优先给当前接口增加按平台选择的备用路径：酷我网页搜索；酷狗移动端 v3；QQ 带签名 PC 搜索，必要时再用 Smartbox；网易云 Cloudsearch，必要时再用歌曲建议；咪咕优先旧 App 搜索，PC 数组接口另处理分页。

这些方法都直接请求对应平台，没有增加第三方中转服务器。本次仅验证歌曲搜索与返回结构，没有测试音频播放、登录态、深页、所有关键词或各种网络环境。切换备用接口时还需统一返回结构、保留平台歌曲标识、区分业务失败与合法空结果，并避免把建议结果伪装成完整搜索分页。

复查材料位于 `.npm/five-platform-search/`：

- `probe.cjs`：探测代码，普通运行产生初轮记录，带 `--followup` 产生针对异常的复核记录。
- `results.json`：初轮 23 次请求。
- `followup-results.json`：复核 9 次请求。

结果中的 `pageChecks` 只记录数量和重复 ID，不能单独作为通过判据；例如网易云 `search-get-eapi` 数量正常却不匹配关键词，已明确排除。最终采纳范围以上表及各平台说明为准。

## 已接入的自动备用搜索

按用户要求保留原有官方接口优先，失败后依次使用同平台的其他接口，全部直接请求平台域名：

| 平台 | 默认主接口 | 备用顺序 |
| --- | --- | --- |
| 酷我 | `search.kuwo.cn/r.s` | 网页 `/search/searchMusicBykeyWord` |
| 酷狗 | `song_search_v2` / WebFilter | HTTPS `msearch` v3 → HTTP `mobilecdn` v3 |
| QQ | 签名 Mobile 搜索，保留有间隔的 2001 最多 6 次尝试 | 签名 Desktop 搜索 → Smartbox + 按 MID 获取详情 |
| 网易云 | EAPI `/api/search/song/list/page` | EAPI Cloudsearch → WEAPI 建议 + 按 ID 批量详情 |
| 咪咕 | `jadeite` v3 | 旧 App 3.0 搜索 → PC 搜索 |

统一入口 `src/renderer/utils/musicSdk/searchFallback.js` 合并同关键词、页码和条数的并发调用。正常的空结果直接返回；网络错误、业务失败、无效响应才进入下一备用接口。取消和服务器明确要求退避时停止。各接口的重试与备用数量均有限。

同一关键词和每页条数在后续页沿用已选接口，避免各接口排序不同造成跨页重复或漏歌；若该接口后续页失败，保留失败重试，不把另一套排序拼接进来。重新从第一页发起搜索时恢复主接口优先。只保留最近 30 组查询的接口选择，不保存关键词到磁盘。

QQ、网易云的建议兜底只返回详情校验成功的少量歌曲，最多 10 首、一页；不会重复充当第二页，也不会根据歌曲名重新匹配 ID。酷狗保留 `audio_id` 和音质 hash，咪咕分别保留歌曲 ID 与版权 ID。

咪咕两条备用接口按实际每页 20 首重组界面分页，支持普通搜索与聚合搜索的不同条数。旧 App 使用服务端总数；PC 没有总数，只根据已经取到的歌曲扩展可翻页范围，需要时预取下一物理页，返回 `totalIsExact: false` 标记已知数量下界。到达末尾后标记为精确数量，不填写虚构总数。

接入后再次用 Electron 40.9.2 的真实请求链路测试：7 种完整搜索方案各取两页，均正确归一化为 SDK 歌曲，页间 ID 无重复；QQ 使用 `Talullah Jamiroquai`，其余使用“晴天”。QQ Smartbox 补全 1 首、网易云建议补全 4 首。记录位于 `.npm/search-fallback/smoke-results.json`。

界面回归还复现并修复了咪咕缺少封面时的旧问题：`pic.js` 未返回转换后的 URL Promise，失败重试又把裸 ID 传给需要歌曲对象的方法，产生未处理异常。现在返回可等待的 URL，重试保留原歌曲 ID 且最多 3 次，失败由现有封面占位逻辑处理。

回归检查包括 `tests/search-fallback.test.cjs`、已有 QQ 重试/并发/诊断测试，以及 `tests/search-fallback.electron.test.cjs` 和 `tests/qq-search.electron.test.cjs` 的生产界面故障模拟。没有修改安装包版本、构建 Windows 安装包或上传远端。

最终结果：上述检查及 `tests/music-cover-cache.test.cjs` 合计 41 项全部通过；两个 Electron 界面用例无未处理异常。修改的 SDK 文件通过 ESLint，生产 renderer 构建成功，`git diff --check` 通过。日志为 `.npm/search-fallback/regression.log`、`.npm/search-fallback/renderer-build.log`。
