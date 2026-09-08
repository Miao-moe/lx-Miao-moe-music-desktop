# 我的列表换源错位：抓取诊断日志

适用于“右键的是 A 歌曲，换源弹窗却显示 B 歌曲”的问题。脚本在应用运行期间读取界面状态并写入本机临时目录；每次右键使用独立的 `traceId`，便于对比点击、菜单操作和弹窗中的歌曲。

## 给出现问题的用户

1. 把本目录的 `music-toggle-debug.js` 发给用户。
2. 在软件中打开 **设置 → 软件更新**，连续点击“当前版本”文字 **6 次**，相邻两次点击间隔不超过 1 秒，打开开发者工具。
3. 选择 **Console（控制台）**，把 JS 文件的完整内容粘贴进去并执行。出现 `[MusicToggleDebug] Ready` 后开始记录。请在复现之前运行脚本。
4. 回到“我的列表”，按平常的操作右键歌曲并选择换源。脚本会记录到磁盘，可以关闭开发者工具后继续操作。
5. 出现问题后，重新打开 Console，执行：

   ```js
   lxMusicToggleDebug.stop()
   lxMusicToggleDebug.openLog()
   ```

6. 文件管理器会定位到 `music-toggle.jsonl`。把该文件、问题发生时间，以及原本右键的歌名和弹窗截图一起反馈。请注明：是弹窗底部的原歌曲已经不对，还是原歌曲正确、候选搜索结果不对。

日志位置也可以在 Console 中通过 `lxMusicToggleDebug.logPath` 查看。Windows 下位于 `%TEMP%\lx-music-toggle-debug-随机字符\music-toggle.jsonl`；即使软件已经退出，也可以在那里找到已写入的日志。重启软件或刷新页面后，需要重新执行脚本。每次执行会建立独立目录；达到 2 MB 后停止记录并在 Console 提示，可重新执行脚本继续抓取。

日志包含所操作歌曲的 ID、名称、歌手、专辑、来源、列表 ID、列表下标、查询词和各来源前 5 条候选摘要。脚本只提取这些字段，不保存 Cookie、Token、播放地址或整份歌单，也不上传日志。

## 开发者如何判断

同一次操作的记录使用相同 `traceId`，按 `time` 顺序查看：

| 阶段 | 重点字段 | 用途 |
| --- | --- | --- |
| `right-click` | `visibleTitle`、`renderedSong`、`clickedIndex`、`songAtClickedIndex` | 比较屏幕显示的歌曲、虚拟列表缓存中的歌曲和当前数组中的歌曲。 |
| `list-state` | `listId`、`listLength`、`menuIndex`、`clickedSongCurrentIndex` | 检查菜单打开期间是否切换了歌单或歌曲位置发生变化。 |
| `choose-toggle-source` | `songAtMenuIndex`、`songAtClickedIndex`、`clickedSongCurrentIndex` | 记录点击“换源”、业务处理前的列表状态；弹窗实际拿到的歌曲以 `modal-target` 为准。 |
| `modal-target` | `originalSong` | 确认父组件传给换源弹窗的歌曲。 |
| `modal-state` | `originalSong`、`queryText`、`searchKey`、`results`、`selectedCandidate` | 比较搜索发起时的歌曲和后续结果；同一搜索通过 `searchKey` 对照。 |

- 如果 `right-click.renderedSong.id` 已经与 `songAtClickedIndex.id` 不同，优先查列表渲染与数据更新的时序。
- 如果右键时一致，但 `choose-toggle-source.songAtMenuIndex.id` 变了，优先查菜单打开期间列表刷新、增删、排序或切换造成的下标变化。
- 如果以上 ID 一致，且 `modal-target.originalSong` 也正确，再检查 `modal-state` 的查询词、搜索批次和候选结果。
- 如果候选正确而试听播放其他歌曲，检查是否误用“下一首”：它会使用随机播放或播放历史。试听应直接定位到新插入的候选队列条目。此版诊断脚本只记录候选选择，不记录实际播放目标，不能仅凭 `selectedCandidate` 判定试听结果。

当前换源窗口默认筛选匹配版本，按匹配程度排列平台；取消筛选可查看其他搜索结果。`results` 仍记录原始搜索候选摘要，因此它可能包含已被界面筛掉的歌曲。切换平台、关闭窗口或重新搜索都会清空已选候选，确认替换通过一次本地事务保存。

旧版本在右键时保存下标，选择换源时再访问 `list[index]`，因此列表变化是需要验证的方向，不能仅凭现象认定为用户问题的根因。当前修复会保存右键时的歌曲 ID 和歌单 ID，在执行菜单操作时重新定位歌曲；歌曲已被删除或歌单已切换时取消操作。在修复后的版本中，菜单操作前的旧下标可能发生变化，但 `modal-target.originalSong.id` 应与 `right-click.renderedSong.id` 一致。

脚本面向本仓库当前的 Vue 组件结构。它记录界面可见状态和候选摘要，不拦截网络请求；平台接口内部的错误详情不会自动出现在此日志里。如果出现 `diagnostic-error`、无法识别 `renderedSong` 或提示无法检查弹窗，应连同软件版本一起反馈。

## 现有主进程日志

当前源码配置的 Windows 日志位置：

- 普通安装：`%APPDATA%\LX-M Music\logs\main.log`。
- 使用 `portable` 数据目录：软件旁的 `portable\userData\logs\main.log`。

主进程日志可以辅助排查异常，但目前不会自动记录上述歌曲选择过程；没有抛出异常时，也可能没有相关报错。
