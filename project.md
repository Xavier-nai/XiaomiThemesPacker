# Xiaomi Theme Packer

Windows 桌面端小米主题打包工具，技术栈为 `Electron + React + TypeScript + Vite`。

## 项目目标

- 管理 Xiaomi 主题工程目录和 MTZ 文件。
- 提供打包、日志、更多三个主页面。
- 通过 Electron 调用文件选择、剪贴板、ADB、窗口控制等原生能力。
- UI 按 Figma 设计稿对齐，包含浅色/深色模式、平滑圆角、固定侧栏和主内容区域。

## 当前页面

- `打包`
  - 选择主题目录。
  - 导出 MTZ。
  - 应用到手机。
  - 选择 MTZ 并解包。
- `日志`
  - 实时显示运行日志。
  - 支持筛选、自动滚动、时间戳开关、导出、清空。
  - 日志滚动条视觉隐藏，保留鼠标滚轮滚动。
- `更多`
  - 主题模式切换：跟随系统、浅色模式、深色模式。
  - 清理主题缓存。
  - 重启 ADB。
  - 复制当前界面包名。
  - 当前界面类名包名复制为 MAML 代码。

## 本轮变更记录

### 1. ThemeEngine 架构收敛：移除预览导向设计

- 当前 ThemeEngine 定位收敛为 MTZ 工具引擎，只服务：
  - `pack(folder -> mtz)`
  - `unpack(mtz -> folder)`
  - `deploy(mtz -> device)`
- contract 主 API 已收敛为：
  - `pack(input): Promise<PackResult>`
  - `unpack(input): Promise<UnpackResult>`
  - `deploy(input): Promise<DeployResult>`
- `parseThemeModel(input)` 仅作为可选结构校验入口保留，不作为 UI/预览/渲染链路入口。
- 删除 contract 层预览导向接口：
  - `resolveResource(input)`
  - `ResourceHandle`
- `UnpackResult` 不再返回 `ThemeModel`，只返回：
  - `success`
  - `outputPath`
  - `files`
  - `warnings`
- `runtime/resourceResolver.ts` 保留 lazy resource resolver，但用途限定为文件访问、结构识别和结构校验，不作为 UI 或渲染基础设施。
- 搜索确认 ThemeEngine 内没有 `render/`、`snapshot/`、`diff/`、`trace/` 模块，也没有 `RenderTree`、渲染 snapshot、渲染 trace 或 preview API 残留。

相关文件：

- `electron/theme-engine/contract/types.ts`
- `electron/theme-engine/contract/index.ts`
- `electron/theme-engine/index.ts`
- `electron/theme-engine/service/index.ts`
- `electron/main.ts`
- `project.md`

### 2. ThemeEngine 第三阶段：契约层建设

- 新增 `electron/theme-engine/contract/`，作为 ThemeEngine 当前唯一对外入口。
- 当前稳定 API 契约：
  - `pack(input): Promise<PackResult>`
  - `unpack(input): Promise<UnpackResult>`
  - `deploy(input): Promise<DeployResult>`
  - `parseThemeModel(input): Promise<ThemeModel>`，仅用于结构校验
- 标准化 ThemeEngine 返回结构：
  - `PackResult`：`success`、`outputPath`、`duration`、`warnings`
  - `UnpackResult`：`success`、`outputPath`、`files`、`warnings`
  - `DeployResult`：`success`、`device`、`status`
- `electron/main.ts` 改为初始化 `createThemeEngineAPI`，主题打包、解包、部署只转发到 contract API。
- `electron/theme-engine/index.ts` 不再从根入口暴露 service/runtime resolver，只暴露 contract API 和纯类型。
- `core` 与 `runtime` 的跨层依赖已切断；`core/parser.ts` 只依赖纯 reader 契约，不再引用 runtime resolver 类型。
- 现有设备状态监听、清缓存、ADB、MAML 工具作为 contract 层 host 扩展保留，避免 renderer 现有 IPC 协议被架构改动破坏。

相关文件：

- `electron/theme-engine/contract/types.ts`
- `electron/theme-engine/contract/index.ts`
- `electron/theme-engine/index.ts`
- `electron/theme-engine/core/model.ts`
- `electron/theme-engine/core/parser.ts`
- `electron/theme-engine/core/path.ts`
- `electron/main.ts`

### 3. ThemeEngine 架构边界收口

- 将 ThemeEngine 收口为三层：
  - `electron/theme-engine/core/`
  - `electron/theme-engine/service/`
  - `electron/theme-engine/runtime/`
- `core` 层只输出纯数据模型：
  - `ThemeModel`
  - `manifest`
  - `resources`
  - `modules`
- `runtime` 层负责 lazy resource resolver：
  - `listResources(): string[]`
  - `getResource(path): Promise<Buffer>`
  - `streamResource(path)`
  - `hasResource(path)`
- 移除旧的全量 `Map<string, Buffer>` 资源模型，不再对外暴露 Buffer Map。
- `service` 层只提供操作入口：
  - `pack`
  - `unpack`
  - `deploy`
  - `restartAdb`
  - `copyPackage`
  - `copyPackageMaml`
  - `parseFolderTheme`
  - `parseMtzTheme`
- `parser` 已升级为 `parseThemeModel`，依赖 resolver 的资源列表和按需读取，输出纯 `ThemeModel`，不包含 UI 或渲染逻辑。
- ThemeEngine 内不包含 Electron IPC、React、DOM、renderer 状态。

相关文件：

- `electron/theme-engine/core/model.ts`
- `electron/theme-engine/core/parser.ts`
- `electron/theme-engine/runtime/resourceResolver.ts`
- `electron/theme-engine/service/index.ts`

### 4. 架构重构第一阶段：剥离 ThemeEngine

- 新增 `electron/theme-engine/` 独立主题引擎目录。
- 从 `electron/main.ts` 中移出 MTZ 打包逻辑：
  - `zipSync`
  - 主题目录遍历
  - 顶层模块 zip 构建
  - `description.xml` / `wallpaper` 存储策略
- 从 `electron/main.ts` 中移出 MTZ 解包逻辑：
  - `unzipSync`
  - zip entry 遍历
  - 输出路径构建
  - 解包路径安全校验
- 新增资源统一访问层，后续已升级为 `runtime/resourceResolver.ts`：
  - `listResources(): string[]`
  - `getResource(path): Promise<Buffer>`
  - `streamResource(path)`
  - `hasResource(path)`
- 新增主题资源解析入口：
  - `description.xml`
  - `lockscreen` manifest
  - `icons`
  - `wallpapers`
- 将主题部署、ADB 设备状态、包名解析和 MAML 生成纳入 ThemeEngine 门面，主进程只负责 IPC、文件选择、剪贴板和窗口生命周期。
- `electron/main.ts` 从 1062 行降到 610 行，减少约 42.6%。
- `electron/main.ts` 不再包含 `zipSync` / `unzipSync` / `Zippable`。

相关文件：

- `electron/theme-engine/index.ts`
- `electron/theme-engine/service/packer.ts`
- `electron/theme-engine/service/unpacker.ts`
- `electron/theme-engine/core/parser.ts`
- `electron/theme-engine/runtime/resourceResolver.ts`
- `electron/theme-engine/service/adb.ts`
- `electron/theme-engine/service/deployer.ts`
- `electron/theme-engine/service/maml.ts`
- `electron/main.ts`

### 5. 删除预览功能

- 从侧边栏导航中移除 `预览` 页面入口。
- 删除 React 侧预览状态、页面组件、机模渲染、模式切换、预览日志和导出截图逻辑。
- 删除渲染进程类型中的 `PreviewMode`、`PreviewDocument`、`PreviewSurface`、`RenderedNode`、`PreviewLog` 等预览模型。
- 删除 `electron/preload.ts` 暴露的 `preview` API 和 `events.onPreviewChanged`。
- 删除 `electron/main.ts` 中的静态预览解析、资源扫描、文件监听和 `preview:*` IPC handler。
- 删除开发环境 mock API 中的预览数据和预览方法。
- 清理预览页面、机模、预览日志、预览响应式布局相关 CSS。
- 删除未再使用的 iPhone 14 Pro 机模资源。

相关文件：

- `src/App.tsx`
- `src/types.ts`
- `src/devApi.ts`
- `src/styles.css`
- `src/icons.tsx`
- `electron/main.ts`
- `electron/preload.ts`
- `electron/types.ts`
- `public/assets/iphone-14-pro-bezel.png`

### 6. 保留并整理现有功能

- 打包、解包、部署到手机、日志、更多页工具功能保留。
- `清理主题缓存` 文案改为面向主题显示异常，不再引用预览刷新。
- `npm run preview` 仍是 Vite 标准构建产物预览脚本，不属于已删除的主题预览功能。

## 关键实现位置

- `src/App.tsx`
  - 页面路由和状态。
  - 打包页、日志页、更多页 UI。
  - 更多页 `copyPackageMaml` 调用。
- `src/styles.css`
  - Figma 对齐样式。
  - 平滑圆角标记。
  - 主内容拖动区和控件命中区域。
  - 滚动条视觉隐藏。
- `src/hooks.ts`
  - 平滑圆角路径生成。
  - SVG mask 应用。
- `electron/main.ts`
  - Electron 窗口创建。
  - IPC 注册。
  - 初始化并调用 ThemeEngine contract API。
  - 日志和进度推送。
- `electron/theme-engine/`
  - `contract`：MTZ 工具引擎 API 契约和结构化返回值。
  - `core`：manifest 解析、目录结构识别、资源分类。
  - `runtime`：按需资源访问，仅服务文件访问和结构校验。
  - `service`：打包、解包、部署、ADB、包名解析、MAML 生成。
- `electron/preload.ts`
  - 通过 `contextBridge` 暴露安全 IPC API。
- `src/devApi.ts`
  - 浏览器 Vite 开发模式下的 Electron API 兜底实现。

## 运行脚本

```bash
npm install
npm run dev
npm run build
npm run dist
```

## 已验证

- `npm run build` 通过。
- 全局搜索确认主题预览功能引用已移除；仅保留 `package.json` 中 Vite 自带的 `npm run preview` 脚本名。
- `electron/main.ts` 已完成第一阶段 ThemeEngine 剥离，行数减少超过 30%。
- ThemeEngine 已拆为 `core/service/runtime` 三层；旧 `Map<string, Buffer>` 全量资源接口已移除。
- ThemeEngine 已新增 `contract` 层；`main.ts`、`preload`、renderer 没有直接引用 `theme-engine/service`、`theme-engine/runtime` 或 `theme-engine/core`。
- `runtime/resourceResolver.ts` 的 MTZ 访问已改为资源列表索引 + 按需 filter 解压，不再创建全量 `Map<string, Buffer>` 或 `Map<string, Uint8Array>`。
- ThemeEngine contract 已收敛为 `pack/unpack/deploy` 主 API；`parseThemeModel` 仅作为可选结构校验入口。
- 搜索确认不存在 `render/`、`snapshot/`、`diff/`、`trace/` 模块，也不存在 `resolveResource`、`ResourceHandle` 或 preview IPC/API 残留。

## 已知边界

- `E:\mini-editor-pro.exe` 是二进制程序。本项目未做反编译；MAML 输出格式按功能名和小米 MAML 常见用法实现。
- 如果需要 100% 复刻 `mini-editor-pro.exe` 的输出格式，需要提供该软件实际输出样例，或允许进一步逆向分析。
