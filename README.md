<p align="center"><img width="200" src="./doc/images/icon.png" alt="LX-M Music"></p>

<h1 align="center">LX-M Music 桌面版</h1>

<p align="center">基于 LX Music 桌面版扩展，提供平滑动效、歌单与封面缓存、Cookie 歌单导入和播放体验增强。</p>

<p align="center">
  <a href="https://github.com/Miao-moe/lx-m_lx-Miao-moe-music-desktop/releases">下载发布版本</a> ·
  <a href="https://github.com/Miao-moe/lx-m_lx-Miao-moe-music-desktop/issues">问题反馈</a> ·
  官方 QQ 群：<strong>1083366464</strong>
</p>

当前版本：**2.1.0**。本项目使用 Electron + Vue 3，原始上游为 [lyswhut/lx-music-desktop](https://github.com/lyswhut/lx-music-desktop)。

## 2.1.0 更新

- **窗口控制**：主界面和播放详情页新增最大化／还原按钮，支持全屏及鼠标退出全屏。
- **布局适配**：调整不同分辨率下的侧栏、列表行高和播放详情布局；最大化及全屏时使用更紧凑的侧栏。
- **全屏快捷键**：在“设置 → 快捷键”中可配置切换全屏，软件内默认 F11，支持改绑、清除和全局快捷键。
- **歌曲右键菜单**：修复歌名文字区域无法呼出菜单，以及列表变化后右键换源可能选错歌曲的问题。
- **平台名称**：平台标签按设置显示原名或别名。

## 2.0.0 更新

- **动画系统升级**：在保留原有组件和按钮布局的基础上，为主要页面、设置面板、弹窗和菜单加入过渡；播放详情页支持封面展开与收回、封面背景淡入淡出和歌词平滑滚动。
- **动画设置持久化**：可调整动画速率，并单独选择是否跟随系统的“减少动态效果”设置，修复重启调试模式后动效消失的问题。
- **歌单与封面缓存**：“我的列表”优先读取本地歌单数据；已加载并缓存的封面可在重启后复用，减少切页重复请求。
- **平台歌单分组**：Cookie 导入的歌单按平台显示为可折叠分组，列表内显示歌单原名；分组展开状态会保存。
- **长按拖动排序**：“我的列表”中的歌单可长按约 450 毫秒后上下拖动，也保留按住 Ctrl / Command 直接拖动的方式；在所属分组内排序。
- **桌面歌词背景**：新增 0%–100% 的背景不透明度设置，支持数值输入和一键设为完全不透明。
- **反馈入口**：“设置 → 关于”中加入官方 QQ 群 **1083366464**，也可通过本仓库 Issues 反馈问题。

## 功能与使用

### 搜索、歌单与歌手详情

- 支持歌曲、歌单、歌手和专辑搜索，可在酷我、酷狗、QQ 音乐、网易云和咪咕等平台间切换；具体搜索类型以所选平台的能力为准。
- 点击歌曲列表中的歌手或专辑信息，可进入独立详情页；歌手详情可显示简介、歌曲和专辑等平台返回的信息。
- 提供在线歌单、排行榜、推荐歌单、我的列表和播放队列。
- 歌曲列表与下载列表支持显示封面；在“设置 → 列表设置”中可输入封面大小，范围为 **20–100 px**。
- 加载失败时，支持的列表会提供重试入口；页面异常时可通过错误页重试或切换页面恢复。

部分平台不会为所有歌手返回头像或简介，缺少这些信息时会显示占位内容。

### 歌单和封面缓存

“我的列表”中的歌曲数据保存在本地数据库。打开已读取的歌单时优先复用内存数据，启动时预读取上次选中的列表，避免重复等待远程歌单接口。增删歌曲和调整顺序会同步更新本地数据。

小封面按显示尺寸请求缩略图，同一封面的并发请求会合并，并按可见区域加载。缩略图失败时会尝试原图；封面图片和获取到的封面地址会写入磁盘缓存，下次启动时优先复用。

封面缓存有容量限制，达到约 **256 MiB 或 10,000 条记录**时会清理较早写入的内容。可在“设置 → 其他设置 → 资源缓存”中查看和清理；清理资源缓存不会删除本地歌单。缓存只覆盖已成功保存的资源，未加载或被清理的封面仍需联网获取，音频播放不属于这项封面缓存。

### Cookie 登录与同步

入口：**设置 → Cookie 同步设置**。

支持为网易云、QQ 音乐、酷狗、酷我和咪咕分别填写 Cookie，也可使用“一键登录”。一键登录会调用系统默认浏览器，需要该浏览器支持 Chromium 自动化；无法完成时可手动填写 Cookie。

- **测试获取歌单**：检查登录状态是否能读取个人歌单，显示结果及数量；测试操作不会修改本地歌单。
- **立即同步**：将平台返回的自建歌单及歌曲导入“我的列表”。重复同步会更新对应的本地副本，使用云端内容覆盖该副本中的歌曲。
- **同步平台自建歌单到本地**：开启后，在软件启动时自动同步一次；手动同步可单独执行。
- **将播放记录同步回平台**：当前实现了网易云、QQ 音乐和酷狗的上报；歌曲自然播放完成或自动衔接下一首时触发，同一首歌在 30 分钟内去重，上报失败不影响播放。
- **推荐歌单**：支持的平台推荐请求会携带已保存的 Cookie，实际推荐内容由平台返回。

歌单同步的方向是**云端到本地**，本地编辑不会自动上传到平台。酷我和咪咕暂不支持播放记录上报。Cookie 被识别只代表具备必要字段，是否仍处于登录状态需通过实际请求确认。

### 自定义音源与音质

播放和下载使用所选音源返回的音频地址。当前程序保留平台搜索、歌单和歌词等接口，音频地址需要配置可用的自定义源。

1. 打开“设置 → 基本设置 → 自定义源管理”。
2. 通过“导入”选择本地 JavaScript 音源脚本，或通过“在线导入”填写脚本地址；本地导入支持一次选择多个文件。
3. 在基本设置中选中已导入的音源。
4. 在“设置 → 播放设置 → 优先播放的音质”中选择音质。
5. 可使用基本设置中的“音源音质检测”，检查当前自定义源各平台的音质请求结果。

界面提供 **128k / 320k / flac / flac24bit / hires / atmos / master** 七档优先音质，下载品质和列表标记会结合音源声明及歌曲信息显示。高音质获取或播放失败时，会尝试可用的较低音质。

音质选项不保证每首歌都可用，最终取决于自定义源和音频资源。Cookie 同步设置本身不提供高音质解锁；音质检测主要检查样本歌曲能否返回音频地址，不代表所有歌曲均可播放。

### 插件商店

在 **设置 → 插件商店** 中，可以从本仓库 GitHub `master` 分支安装或卸载 **音效增强** 和 **音频可视化**。两个插件独立安装，即时生效；音效插件提供均衡器、混响、环绕和变调，可视化插件提供播放详情页及桌面歌词频谱。

升级后按需安装插件即可继续使用原有音效设置和预设。卸载会移除插件文件并停止对应功能，保留个人配置；已安装插件支持离线使用。维护者的构建、发布说明见 [官方插件说明](plugins/README.md)。

音频可视化 1.1.1 提供经典频谱、律动音柱、镜像光谱、柔波曲线、环形脉冲、星点跃动六种样式，环形脉冲的音柱已加粗。点击播放详情页的可视化按钮打开选择窗口，支持预览，并为播放详情和桌面歌词分别保存样式。已安装旧版插件时，可直接在商店更新。

### 动画、歌词与播放设置

| 功能 | 入口或操作 | 范围与说明 |
| --- | --- | --- |
| 平滑动画 | 设置 → 高级 → 界面增强 | 页面切换、菜单和弹窗等动效，还受基本设置中的动画总开关控制 |
| 动画速率 | 设置 → 高级 → 动画速率 | 0.5x–1.5x，默认 1.0x |
| 跟随系统减少动态效果 | 设置 → 高级 → 界面增强 | 默认关闭；开启后再根据系统偏好减少动效 |
| 桌面歌词背景 | 设置 → 桌面歌词设置 → 背景不透明度 | 0% 完全透明，100% 完全不透明；锁定歌词后仍生效 |
| 歌词翻译与罗马音 | 播放详情页的歌词右键菜单 | 根据音源返回的歌词内容切换显示 |
| 无缝衔接与渐入渐出 | 设置 → 高级 → 播放增强 | 预加载下一首并通过双音频元素衔接，可设置 100–3000 ms 淡化时长；效果取决于音源响应和预加载情况 |
| 音量控制 | 播放栏音量按钮、设置 → 播放设置 | 音量条支持鼠标滚轮；最大音量可设置为 100%–200% |
| 设置搜索 | 设置页左上角搜索框 | 按设置名称和条目文本筛选 |
| 设置页切换 | Alt + ← / Alt + → | 切换上一个或下一个设置面板 |
| 歌单搜索快捷键 | 设置 → 快捷键设置 | 可配置聚焦列表搜索框的快捷键 |
| 自定义主题 | 设置 → 基本设置 | 支持编辑、导入和导出主题 |

### 数据存储

LX-M Music 使用独立的应用标识和用户数据目录。常规安装下，Windows 的用户数据位于 `%APPDATA%\LX-M Music`，其中 `LxDatas` 保存设置和歌单等数据。

从旧版共享目录迁移时，程序会复制可迁移的数据到 LX-M 自己的目录，后续分别保存；便携模式使用自己的用户数据目录。备份和恢复可在“设置 → 备份与恢复”中操作。

## 历史更新摘要

以下根据项目更新日志整理；具体功能入口和限制以本文上方说明为准。

| 版本 | 主要变化 |
| --- | --- |
| 1.3.2 | 修复进入歌单时卡死的问题，分离 LX-M 与原版 LX 的用户数据 |
| 1.3.1 | 修复搜索后切换歌单卡死、音源检测失败的问题 |
| 1.3.0 | 修正网易云歌手页歌曲时长；改进高音质失败后的降级重试；增加歌手简介和歌词翻译、罗马音的右键切换 |
| 1.2.1 | 修复歌手及专辑加载问题；兼容平台未返回歌手头像的情况 |
| 1.2.0 | 增加歌手、专辑独立详情页及点击跳转；下载列表显示封面；改进封面显示和加载失败重试，修复部分切页白屏问题 |
| 1.1.0 | 增加歌手、专辑搜索，设置搜索和歌单搜索快捷键；封面大小支持数值调节；优化音量调节与播放地址缓存刷新 |
| 1.0.5 | 支持封面大小调节、本地音源批量导入及自定义主题导入导出；修正关于页面文字 |
| 1.0.4 | 增加歌曲封面、播放队列、音源音质检测和推荐内容获取 |
| 1.0.3 | 增加部分平台播放记录上报、音量滚轮调节和最高 200% 的音量设置；改进更新逻辑 |
| 1.0.2 | 增加 hires / atmos / master 音质选项，调整下载图标与应用标识，优化 Cookie 歌单同步 |
| 1.0.1 | 修复软件更新页的版本检测问题 |

## 开发与构建

环境要求：**Node.js 22 或更高版本、npm 8.5.2 或更高版本**。依赖版本以 `package-lock.json` 为准。

```bash
# 按锁文件安装依赖，并准备当前平台的 Electron 原生模块
npm ci

# 开发模式：Electron + 渲染进程热更新
npm run dev

# 编译生产代码
npm run build

# 重新编译并生成 Windows x64 安装包
npm run pack
```

Windows PowerShell 若提示无法运行 `npm.ps1`，可将命令中的 `npm` 换成 `npm.cmd`。

`npm run dev` 启动前会自动准备当前平台和架构的 Electron 原生依赖。跨架构打包后如需单独恢复开发依赖，可运行 `npm run postinstall`。

生产编译入口 `npm run build` 以及会先编译的 `pack` 命令会清理已有 `dist/` 和 `build/` 输出。需要保留旧安装包时，请先将其移到这些输出目录之外。单独运行分架构打包命令只打包现有 `dist`，修改源码或版本号后应先重新编译。

### Windows 全部架构与格式

可生成以下 **11 个安装或分发包**：

| 架构 | 安装版 Setup.exe | 便携单文件 .exe | 绿色压缩包 .7z |
| --- | --- | --- | --- |
| x64 | ✓ | ✓ | ✓ |
| x86（32 位） | ✓ | ✓ | ✓ |
| ARM64 | ✓ | ✓ | ✓ |
| x86 + x64 合集（x86_64） | ✓ | ✓ | — |

在 Windows 环境中依次执行：

```bash
# 编译，并生成四种安装版及 x64 绿色压缩包
npm run pack:win

# 生成 x64、x86、x86_64 三种便携包
npm run pack:win:portable

# 补齐 ARM64 便携包与 x86、ARM64 绿色压缩包
node build-config/build-pack.js target=win arch=arm64 type=portable
node build-config/build-pack.js target=win arch=x86 type=green
npm run pack:win:7z:arm64
```

产物输出到 `build/`。`npm run pack:win` 本身只包含上述第一步。项目也保留了 macOS 和 Linux 构建脚本，命令及目标架构可查看 [package.json](./package.json)；不同平台的构建需要相应环境和原生依赖。

### 验证

```bash
npm run lint

# Cookie 歌单、缩略图、歌单缓存、封面地址缓存和生产请求回归
node --test tests/cookie-playlists.test.cjs tests/cover-thumbnail.test.cjs tests/list-data-cache.test.cjs tests/music-cover-cache.test.cjs tests/request.production.test.cjs

# 先保持 npm run dev 运行，再在另一个终端执行 Electron 界面回归
node --test --test-concurrency=1 tests/motion.electron.test.cjs tests/motion-restart.electron.test.cjs tests/cover-image.electron.test.cjs tests/list-cache.electron.test.cjs
```

界面测试使用临时用户数据目录，覆盖快速切页、播放详情展开收回、动效设置在重启后的保持，以及歌单和封面缓存复用。

## 代码入口

| 模块 | 位置 |
| --- | --- |
| 动画开关与时序 | [smoothAnimation.ts](./src/renderer/utils/smoothAnimation.ts)、[motion.ts](./src/renderer/utils/motion.ts) |
| 页面切换与播放详情动效 | [MotionView.vue](./src/renderer/components/common/MotionView.vue)、[usePlayerDetailMotion.ts](./src/renderer/utils/compositions/usePlayerDetailMotion.ts) |
| 封面组件与磁盘缓存 | [CoverImage.vue](./src/renderer/components/common/CoverImage.vue)、[artworkStorage.ts](./src/renderer/utils/artworkStorage.ts) |
| 本地歌单读取与预热 | [rendererListManage.ts](./src/renderer/store/list/listManage/rendererListManage.ts)、[useDataInit.ts](./src/renderer/core/useApp/useDataInit.ts) |
| 平台歌单导入与分组 | [cookieSync.ts](./src/renderer/utils/cookieSync.ts)、[useFolders.ts](./src/renderer/views/List/MyList/useFolders.ts) |
| 播放记录上报 | [playHistoryReporter.ts](./src/renderer/utils/playHistoryReporter.ts) |
| 桌面歌词 | [SettingDesktopLyric.vue](./src/renderer/views/Setting/components/SettingDesktopLyric.vue)、[App.vue](./src/renderer-lyric/App.vue) |

仓库还提供面向开发者的扩展音源加载器，通过 `window.__lxExtSourcePlugins__` 配置本地工厂函数或远程脚本。它与用户界面中的“自定义源管理”是不同机制，当前没有独立的插件管理面板。接口和配置可参考 [扩展音源说明](./ext-source-plugins/README.md)及[加载器代码](./src/renderer/utils/musicSdk/plugins/loader.js)，集成时需自行适配搜索、歌单等调用方。

## 致谢与协议

- [lyswhut/lx-music-desktop](https://github.com/lyswhut/lx-music-desktop)：原始上游及桌面播放器基础。
- [WalnutBai/lx-lxnetease-music-mobile-pro](https://github.com/WalnutBai/lx-lxnetease-music-mobile-pro)：Cookie 同步等功能的参考思路。

本项目继承上游 [Apache License 2.0](./LICENSE) 协议，并受[补充协议](./licenses/license_zh.txt)约束。平台别名仅用于标识对应平台；本项目不对数据的合法性、准确性负责。请遵守当地法律法规，尊重版权，支持正版。
