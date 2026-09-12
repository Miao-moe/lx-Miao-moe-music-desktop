# LX Music 2.12.3 / 2.12.4 合并核对

对照日期：2026-09-12。来源为用户提供的 `../lx-music-desktop-master`，其 `package.json` 版本为 `2.12.4`，`CHANGELOG.md` 中这两个版本的更新与截图一致。

本次逐项合并截图中的功能修复；LX-M 的版本号、插件机制、界面和额外音质保持现有实现。

| 官方更新 | 合并位置与结果 |
| --- | --- |
| 优化 kw 歌单列表数据显示 | `renderer/utils/musicSdk/kw/songList.js`：推荐分组按 `songlist`、`list`、`album` 类型取卡片，不再因缺少分组标签丢弃歌单，也不混入歌手等卡片。 |
| 同步连接允许 URL 重定向 | `main/modules/sync/client/client.ts`：WebSocket 设置 `followRedirects: true`。 |
| Linux 点击托盘显示主界面 | `main/modules/tray.ts`：Windows、Linux 均注册点击显示窗口；macOS 保留现有菜单行为。 |
| 优化自动换源匹配 | `renderer/utils/musicSdk/index.js`、`versionChars.ts`：合入官方版本关键词，区分现场、伴奏、翻唱、混音等，时长差允许到 5 秒。保留插件音源注册及 LX-M 的音质降级逻辑。 |
| kg 搜索显示修复 #2782 | `renderer/utils/musicSdk/kg/musicSearch.js`：使用 AndroidFilter 参数，优先原始歌名加版本后缀，兼容旧字段。增加 `albumAudioId` 的解析和新旧歌曲结构传递，并覆盖歌单、排行榜、歌手、详情及备用搜索。 |
| 开放 API 初始音量修复 #2790 | `main/app.ts`：应用初始化完成时发布保存的音量和静音状态，避免未调整音量前 API 一直返回默认值。保留 LX-M 局域网 API 令牌。 |
| mg 图片、歌词获取修复 | `renderer/utils/musicSdk/mg/pic.js`、`lyric.js`：封面从资源详情取得，接入现有共享缓存；明确为空的逐字歌词地址可直接使用已有普通歌词地址。 |
| tx 部分歌单无法打开 #1060 | `renderer/utils/musicSdk/tx/songList.js`：旧接口子状态异常、缺少或空 `cdlist` 时，转用 `uniform_get_Dissinfo`，保留歌单信息及歌曲元数据。 |
| 添加、移动后的歌曲顺序 #2842 | `main/worker/dbService/modules/list/{index,dbHelper,statements}.ts`：查询末尾歌曲的持久化序号后追加，避免删除造成序号空洞时与旧序号重叠；新建歌单也使用已有末尾位置。 |
| 歌词时间标签标准 #2855 | `common/utils/lyric-font-player/line-player.js`、`common/utils/lyricUtils/kg.js` 及 mg/tx/wy 歌词模块：按小数位数转换毫秒，保留前导零；生成时间标签补足三位；主歌词、翻译、罗马音按同一毫秒时间匹配。 |
| tx 歌曲搜索失败 #2848 | `renderer/utils/musicSdk/tx/{musicSearch,searchFallback,entitySearch}.js`：主接口改为签名 Desktop 搜索，使用官方 PC 请求参数及 37 位 `searchid`，读取 `song.list` 和 `meta.sum`，兼容两种响应入口；同步适配实体搜索。Mobile 和 Smartbox 继续作为备用，保留有限重试、退避、并发合并及分页固定接口。 |
| 2.12.4 自定义主题背景 | `common/utils/common.ts`、`main/utils/index.ts`、`renderer/store/utils.ts`：使用 `pathToFileURL` 完整编码本地路径，去除重复的 `file:///` 拼接，CSS URL 加引号以支持括号等字符。主题编辑预览和本地音乐路径也使用同一转换方法。 |

## 合并时的适配

- 官方列表排序修复新增了一个位置缓存。LX-M 直接读取已缓存歌单对象的 `position`，保持同样的排序语义，也能处理尚未调用 `getAllUserList` 时直接新建歌单的情况。
- 官方歌词修复以整份歌词是否出现三位小数判断精度。这里按每个标签的原始小数位数解析，避免 `.05` 前导零被去掉后变成 500 毫秒，也让 `.05` 与 `.050` 的翻译正确对应。网易云的毫秒头信息统一生成三位标签；QQ、网易云对齐歌词时也修正了分钟换算及小数精度。
- 匹配歌曲前会去掉空格，因此官方版本关键词中的 `backing track`、`sped up` 等也经过相同处理，保证多词版本标记参与匹配。
- 咪咕详情的批量查询函数已经返回 Promise，外层原来再次执行 `Promise.all(Promise)` 会报错。接入新的封面路径时一并修正，保留 LX-M 的 `contentId` 等扩展字段。
- 已有的共享封面缓存、五平台备用搜索、WebDAV、手动换源五个平台选项和界面调整均沿用现有实现。

## 验证

- 主进程、主界面、桌面歌词构建成功。
- 修改的源码通过 ESLint 和 `git diff --check`。
- `upstream-2.12.test.cjs` 加上搜索、封面、换源、Folia 歌词单元测试共 69 项通过，包含真实本地 WebSocket 302 重定向。
- `upstream-2.12.electron.test.cjs` 7 项通过：隔离数据目录中添加、删除、移动和重启，实际 SQLite 顺序、主题图片解码与切换，以及真实 HTTP 开放 API 返回值。
- QQ 搜索、五平台备用搜索、共享封面 Electron 回归共 10 项通过，包含失败重试和离线重启读取封面。
- Folia 歌词、页面及播放详情动画、手动换源、WebDAV Electron 回归共 44 项通过。

上述自动化检查合计 130 项通过。

接口测试使用可控的本地响应验证请求、解析、退避和界面行为，不代表各平台线上服务的持续可用性。Linux 托盘在 Windows 环境中验证了平台分支和点击事件，尚未在 Linux 桌面环境实测。

测试日志位于 `logs/upstream-*.log`，各 Electron 测试使用独立临时数据目录。
