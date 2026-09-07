# 官方插件

在软件的 **设置 → 插件商店** 中安装、更新或卸载插件。当前提供两个可独立安装的插件：

- **音效增强**：十段均衡器、环境混响、环绕音效、变调，以及原有的个人音效预设。
- **音频可视化**：播放详情页和桌面歌词的频谱显示，可分别开关。

插件安装后立即生效，卸载后对应按钮、设置和功能退出运行，并删除插件文件。歌曲继续播放，另一个插件可继续使用。原有音效参数、个人预设和可视化开关保留，重新安装后恢复使用。升级到插件商店版本时，需要在商店中安装所需插件。

## 下载来源和存储

商店从本仓库 `master` 分支的 [官方目录](https://raw.githubusercontent.com/Miao-moe/lx-m_lx-Miao-moe-music-desktop/master/plugins/official/catalog.json) 获取版本和包地址。首次安装及更新需要连接 GitHub；启动时只校验并加载本地已安装插件，离线时可继续使用。刷新目录失败会显示提示，下载或校验失败保留原有安装。

安装文件位于用户数据目录的 `LxDatas/plugins` 下，`installed.json` 记录已安装版本。音效和可视化的实现、样式、混响资源及变调处理器均由插件包提供，应用安装包只保留商店、加载接口和基础播放功能。

当前只接受目录中声明的这两个官方插件 ID。插件代码在应用渲染进程中运行，使用应用提供的 Vue、播放器和设置接口；此接口供仓库内的官方插件使用，不是第三方插件沙箱。

## 构建和发布

在仓库根目录执行：

```sh
npm run build:plugins
```

源代码在 `src/optional-plugins/<id>`。每个插件的 `manifest.json` 声明版本、接口版本和入口。构建产物先写入 `build/optional-plugins`，随后生成：

```text
plugins/official/catalog.json
plugins/official/<id>/<version>/<sha256>.lxplugin
```

`.lxplugin` 是 gzip 压缩的 JSON，包含清单和 Base64 编码的文件。目录声明整包大小及 SHA-256，清单声明每个文件的大小及 SHA-256。安装时先验证完整下载和全部文件，再切换安装记录；启动时重新检查本地文件。损坏的安装可在商店中重新安装修复。

修改插件后递增其版本并重新构建，将源码、目录和生成的插件包一起提交到 `dev` 并同步 `master`，商店即可发现新版本。发布后保留旧的哈希文件，避免正在使用旧目录的客户端下载失败。修改宿主接口时，同时维护 `src/common/optionalPlugins.ts` 的 `PLUGIN_API_VERSION` 和插件清单的 `apiVersion`；不兼容的包会阻止安装并提示更新软件。

应用本身仍按原有流程构建。`build:plugins` 不构建 Windows 安装包，也不会清理已有版本的安装包。

## 验证

先生成插件包，再执行安装管理测试：

```sh
node --test tests/optional-plugins.test.cjs
```

构建主进程、主界面和桌面歌词后，可执行真实 Electron 集成测试：

```sh
npm run build:main
npm run build:renderer
npm run build:renderer-lyric
node --test tests/plugin-store.electron.test.cjs
```

集成测试使用隔离的临时用户目录，拦截 GitHub 请求并提供实际构建的插件包，验证独立安装、播放中的卸载、重复安装、频谱绘制、离线重启和不同窗口尺寸下的布局。测试音频在输出前静音。
