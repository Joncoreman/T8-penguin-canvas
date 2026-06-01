# 网站：[https://ai.t8star.org](https://ai.t8star.org/register?aff=dP7j)
# 致谢企鹅-企鹅的在线画布：[https://art.pebbling.cn](https://art.pebbling.cn/?invite=T8STAR)
# Online workflow overseas：
https://www.runninghub.ai/?inviteCode=rh-v1121
# 在线工作流国内版：
https://www.runninghub.cn/?inviteCode=rh-v1121
# 👋🏻 Welcome to Zhenzhen

<img src="https://github.com/T8mars/Comfyui-zhenzhen/blob/main/pic/1.png" width="30%" alt="My favorite girl">
My favorite girl Go YounJung
# 🐧 贞贞的无限画布（企鹅共创版） · T8-penguin-canvas

> AI 节点画布工作流工具 · Web + Electron 桌面端｜v1.9.1
>
> GitHub：<https://github.com/T8mars/T8-penguin-canvas>

一个面向 AI 创作的 **节点式画布**：拖拽节点、连线编排、生成图像 / 视频 / 音频、调用 LLM、串接 RunningHub 工作流，叠加批量执行、智能对齐、打组、主题模板与终端日志。Web 浏览器即可使用，亦可一键打包为 Windows 桌面端（NSIS 安装包）。

![status](https://img.shields.io/badge/version-v1.9.1-brightgreen) ![node](https://img.shields.io/badge/node-%E2%89%A518-blue) ![react](https://img.shields.io/badge/react-19-61dafb) ![electron](https://img.shields.io/badge/electron-33-47848f) ![license](https://img.shields.io/badge/license-MIT-yellow)

---

## 📺 基础功能教程

从 0 到 1 上手，推荐初次使用者先过一遍视频教程了解整体节点拖拽、连线、API Key 配置、批量运行、组合与终端日志等核心能力：

| 平台 | 链接 |
|---|---|
| 🅱️ B 站教程 | <https://www.bilibili.com/video/BV18sG76AE9Y/> |
| ▶️ Youtube 教程 | <https://www.youtube.com/watch?v=V8oCBhemmCQ> |

> 如果你是首次上手，建议先跳转视频看一遍再动手，可避免在 API Key / 节点连线语义 / 模型选择上走弯路。

---

## ✨ 功能亮点

- 🎨 **41 个节点**，覆盖文本 / 图像 / 视频 / 音频 / LLM / RunningHub / 工具 / 辅助 / 工具箱 / 输出预览 / 上传素材 / 素材集
- 🧺 **画布级批量导入 + 素材合集打散**：上传节点支持一次选择多张图 / 多个视频 / 多段音频；也可直接把剪贴板或文件拖到画布，同类型多素材自动形成合集，上传和输出合集都可一键打散为多个独立素材节点
- 👁️ **上传 / 输出图像原图悬停预览**（v1.8.7）：上传素材与输出素材的图像卡片在 hover 时显示小眼睛按钮，鼠标停在按钮上可按 100% 原尺寸预览，超出视口时自动等比收进可见区域，输出素材入口位于图像对比按钮下方
- 🧹 **生成节点上游素材单项排除**（v1.8.8）：图像 / 视频 / SD2.0 / 音频 / LLM / RunningHub / RH 工具节点的上游素材缩略图右下角可点 X，从当前节点排除单个传入素材但不切断连线，并可用“恢复N”一键恢复
- 🗂️ **素材集节点 + 资源库整套复用**：可把同类型文本 / 图像 / 视频 / 音频合并为素材集，支持拖拽排序、反转 / 文件名 / 随机排序、导入素材集 / 导出素材集、保存到资源库、从资源库整套插入画布；未选中节点时按 `R` 可快速打开 / 关闭资源库
- 🚚 **跨画布节点 / 素材发送 + Eagle 本地入库**：框选多个带连线节点可用“节点片段”发送到其他画布并保留内部连线；上传素材、输出素材或素材集仍支持智能保持 / 合并素材集 / 上传素材 / 拆分上传 / 输出素材，发送弹窗提供最近画布、发送历史和重复素材提示，发送后可自动切换并定位到新内容，资源库素材也可一键发送，Eagle 入库仅允许本机 localhost 接口
- 🔢 **画布 NodeID 快速连线 / 查找**（v1.8.9）：每个画布内节点都会显示独立递增的 `NodeID`，删除不回退；角标按真实可见节点卡片右上角锚定，避免因节点外层测量框变化漂离节点；拖线菜单顶部可用“发送到ID”输入编号自动连线，顶部工具栏可按 ID 查找并居中定位节点，复制 / 发送 / 导入到其他画布时按目标画布继续编号
- ⌨️ **自定义快捷键设置**（v1.9.1）：顶部工具栏 `?` 打开快捷键设置，可录制组合键、清空单项、单项 / 全部恢复默认；撤销、重做、复制粘贴、打组、画布定位、资源库和连线导航都走统一配置并本地持久化，冲突与浏览器保留键会即时提示
- 🔔 **任务完成提示音**：顶部工具条可独立开关，默认开启；图像 / 视频 / SD2.0 / 音频 / LLM 任务成功完成后播放轻提示音，5 秒内最多响一次，和主题音乐通道分开，主题音乐静音时仍可提示
- 📁 **跨平台本地路径默认值**：Windows 继续默认 `D:\zhenzhen`，macOS / Linux 默认 `~/zhenzhen`；旧版非 Windows 配置若仍是硬编码默认值会自动迁移，自定义路径不会被覆盖
- 🏷️ **生成提示词 @ 素材提及**：图像 / 视频 / SD2.0 / 音频 / LLM / RunningHub / RH 钱包应用 / RH 超市文本参数可输入 `@` 选择当前上游素材，输入框内显示小预览图，提交时稳定解析为 `@image1` / `@video1` / `@audio1`
- 📝 **文本节点自由缩放**：文本节点四角拖拽可独立调整宽高，输出端口固定贴合右侧中点，并在尺寸变化后刷新 ReactFlow internals，避免连线和端口脱离
- 🔗 **RH 文本 NodeID 绑定**（v1.9.0）：文本节点可填写 RH 节点序号，RunningHub / RH 钱包应用 / RH 超市会按应用参数里的 RH nodeId 自动匹配上游文本；节点内也能手动选择绑定文本，冲突和错误序号会保留清晰状态提示
- 🧩 **xyflow 12** 画布引擎：缩放、平移、连线、迷你地图、控制条、SPA 兜底
- 🔑 **四套独立 API Key 隔离**：贞贞工坊 / RunningHub / RH 钱包应用 / LLM —— 全部经后端代理脱敏，前端永远拿不到明文
- 📈 **一键批量运行**：Kahn 拓扑排序串行触发可执行节点，进度可视化，支持中断
- 🖼️ **图像编辑模态·五模式**：裁剪 / 蒙版 / 笔刷 / 网格 / 组合；非组合模式会按弹窗舞台真实可视尺寸完整显示原图，避免双击上传 / 输出素材编辑时上下被工具栏遮住；组合模式支持多图层拖拽 / 4 角同比缩放 + Shift 自由比例 + Alt 中心缩放 + 旋转 15° 吸附 + 50 深独立撤销栈
- ✂️ **宫格剪裁去缝预览**：独立宫格剪裁节点支持 gap 去缝、常用宫格预设、指定序号导出、输出顺序和上游合集批量拆分；批量拆分兼容上传多图与资源库素材集，并在节点内直接预览切线与被裁掉的缝隙区域
- 🎬 **电影感组合器**：电影感节点支持成片风格、镜头、光影、调色、质感各 50 项，带中英文 prompt、强度控制、收藏复用、JSON 导入/导出和一键运行输出
- 🎥 **视频运镜组合器**：视频运镜节点支持成片场景、运镜动作、路径、节奏、稳定和主体约束各 50 项，带可响应 50 项动作 / 50 项路径的路线示意、中英文 prompt、收藏复用、JSON 导入/导出和一键运行输出
- 🧍 **肖像大师**：工具箱新增捏人 Prompt 设计器，内置 9 大类词库，每个小参数 100 个可选词条，支持不选、锁定、权重、自定义补充、Avatar 分层方向预览、角色库收藏、JSON 导入导出、资源库角色分类、跨画布发送配置 / Prompt、高级随机、风格随机包、种子复现和批量输出文本节点 / 文本素材集
- 🧍‍♂️ **姿势大师**：支持 100 种常用姿势、多人骨架、MediaPipe 识别、手部控制、A/B 关键帧、姿势库、批量分镜，并可在节点内切换线稿 / OpenPose / COCO 预览与运行输出；OpenPose/COCO keypoints JSON 可单独导出给 ComfyUI / ControlNet 复用
- 🧪 **Grok Image / Sora2 FAL / Grok Video FAL**：图像节点新增 Grok Image TAB；视频节点模型类型默认 `Grok Video → Veo 3.1 → Sora2`，Grok Video TAB 默认 `Grok Video 1.5 (FAL)`，图像传入默认 base64，最多 1 张参考图且不发送比例参数；旧版 Grok FAL / Sora2 FAL 仍保留兼容入口
- 🧾 **文本分割二版**：文本分割节点支持段落 / 行 / 自定义分隔 / Markdown / 序号 / 智能分镜 / 正则高级 / 字数切块；按段落严格以至少一个空行切段，按行才逐行切分，内置模式说明、中文输入稳定编辑、双列预览布局、分段收藏、JSON 导入导出，并一键创建前置文本循环器链路；循环器执行完成后可自动打散为多个文本节点
- 🖌️ **图层画板节点**（v1.9.0 增强）：工具分类开放画板节点，支持 16:9 / 9:16 等画布比例、空白图层、图层组折叠、可见 / 锁定状态、载入上游或本地图片、手绘 / 文字 / 图形 / 箭头、缩放旋转、套索 / 钢笔非破坏式抠图、放大编辑窗口、导入导出画板 JSON 与运行输出 PNG；放大窗口复用完整图层面板并按设备像素比重绘，避免图片被低清预览二次放大
- 🔑 **分类独立 API Key 可选 · 默认折叠**（v1.2.6）：gpt-image / nano-banana / mj / veo / grok / seedance / suno 七个分类 Key 未填自动 fallback 贞贞通用 Key，新手默认折叠不被干扰
- 🧭 **扩展 API 平台高级入口**（v1.8.5）：API 设置页默认折叠的「扩展 API 平台【高级/可选】」可配置 OpenAI 兼容、ModelScope、火山引擎、本地 ComfyUI、即梦 CLI；面板已按平台用途、适用节点、连接配置、模型列表和高级项分区说明，启用后图像 / 视频 / SD2.0 / LLM 节点可选择高级来源，默认不改变主流程
- 🧽 **去AI水印辅助节点**（v1.8.6）：桥接 `wiltodelta/remove-ai-watermarks`，支持可见水印识别去除、框选擦除（cv2 / LaMA）、隐形水印、AI 元数据检查 / 清理和来源鉴别；开发环境可使用本地 Python 包，用户 Electron 完整包可通过 `tools/remove-ai-watermarks-runtime` sidecar runtime 随包分发
- 🧲 **智能对齐辅助线 + snap-to-grid**：拖动时检测同列 / 同行 / 居中对齐并弱吸附
- 📦 **GroupBox 打组**：框选 ≥2 节点一键套色框容器，可拖拽联动、整体执行、12 色调色板
- 🖱️ **右键画布快速添加节点**：菜单列出 7 个高频节点（upload / text / image / video / seedance / audio / llm）
- 🎯 **框选自动菜单**：≥2 节点框选后自动弹出操作面板（组执行 / 复制 / 快复制 / 删除 / 打组）
- ⏪ **Undo / Redo / 复制粘贴 / 导入导出 / 工作流模板** 完整画布交互
- 🌗 **主题模板系统**：科技风 / 像素糖果风 / OP 风格 / RH 风格 / 火影忍者风格 / EVA 风格 / 幽游白书风格 / 灌篮高手风格八套内置模板，支持浅色 / 深色、导入导出、编辑保存、自定义路径与默认静音主题音乐；灌篮高手风格提供木地板球场、计分牌节点、传球弧线和战术板 MiniMap，幽游白书肖像大师隐藏模式会自动切换专用隐藏音乐
- 🧭 **主题悬浮控件统一**：小图标按钮使用固定语义类，避免 OP / 像素等强风格按钮膨胀；火影小地图、控制条和音乐按钮对齐到与 RH 一致的底部悬浮体验
- 🎭 **公开主题设计规范**：见 [`docs/theme-design-guide.md`](docs/theme-design-guide.md)，用户可按规范制作、导入和分享更好看的主题画布
- 🖥️ **终端日志面板**：底部抽屉式实时日志，对齐主项目 logBus 协议
- 🛡️ **防空数据覆盖**：双层防护（前端 + 后端）保护已保存画布数据
- 📦 **一键 Electron 打包**：bytenode + T8ENC1 加密后端 + NSIS 安装包，开箱即用桌面端

---

## 🚀 快速开始

### 环境要求

- **Node.js ≥ 18**
- Windows / macOS / Linux 浏览器（推荐 Chromium 内核）
- （可选）Windows 系统用于 Electron 桌面端打包

### 安装

```bash
git clone https://github.com/T8mars/T8-penguin-canvas.git
cd T8-penguin-canvas
npm install
cd backend && npm install && cd ..
```

### 启动开发模式

```bash
npm run dev
```

`concurrently` 会同时拉起：

- 后端：<http://127.0.0.1:18766>
- 前端：<http://127.0.0.1:11422>

浏览器自动打开前端地址即可使用。Windows 下也可以双击 `start-dev.bat` 一键启动。

### 配置 API Key

首次进入点击右上角 ⚙️ 打开设置弹窗，按需填入：

| Key | 用途 | 默认 BaseUrl |
|---|---|---|
| 贞贞工坊 API Key | image / video / audio | `https://ai.t8star.org` |
| LLM 独立 API Key | llm / vision（额度隔离） | OpenAI 兼容协议任意上游 |
| RunningHub API Key | RunningHub 个人工作流 | `https://www.runninghub.cn` |
| RH 钱包应用 APIKEY | RH 企业级共享 APIKEY（钱包应用专用） | `https://www.runninghub.cn` |

Key 保存到 `data/settings.json`；前端 GET 接口仅返回 `****xxxx` 脱敏值，明文仅供后端代理本地使用，永不泄露。

> **不需要全部配置**：只填需要使用的那一类即可，其它节点会在运行时友好提示「未配置 XXX API Key」。

---

## 🖥️ Electron 桌面端打包

```bash
# 一键出 Windows NSIS 安装包
npm run dist
```

产物：`dist_electron/T8-PenguinCanvas-Setup-<version>.exe`（安装包大小以实际构建为准）

打包链路：`vite build` → `bytenode + T8ENC1` 加密后端为 `.t8c` 字节码 → `electron-builder --win --x64` 出 NSIS 安装包 → `_post_build.cjs` 自动校验后端加密路由、前端 dist、主题音乐资源和去AI水印 runtime slot 完整性。

去AI水印完整能力依赖 Python / Torch / 上游 `remove-ai-watermarks`。源码默认不提交这类大体积运行时；如果要做可离线使用的用户 Electron 包，请先把准备好的 sidecar runtime 放入 `tools/remove-ai-watermarks-runtime/`，打包时会复制为 `resources/tools/remove-ai-watermarks/`。正式分发包建议设置 `T8_REQUIRE_AI_WATERMARK_RUNTIME=1` 后再执行 `npm run dist`，这样缺少 runtime 会直接失败，避免用户装包后节点不可用。

详细 SOP 与历史踩坑修复记录维护在本地私有 `skill.md`，该文件不随公开仓库发布。

---

## 🧱 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 · TypeScript 5 · Vite 6 |
| 样式 | Tailwind CSS 3 · CSS Modules · 主题模板（科技风 / 像素糖果风 / OP 风格 / RH 风格 / 火影忍者风格 / EVA 风格 / 幽游白书风格 / 灌篮高手风格） |
| 画布引擎 | @xyflow/react 12 · zustand 5 · lucide-react |
| 后端 | Node.js · Express · sharp（图像处理） · multer（上传） |
| 桌面端 | Electron 33 · electron-builder 25 · bytenode 1.5 · T8ENC1（自研 AES-256-CBC 二次加密） |
| AI 上游 | 贞贞工坊（图像/视频/Suno）· RunningHub · 任意 OpenAI 兼容 LLM |

---

## 📁 目录结构

```
T8-penguin-canvas/
├── backend/                 # Express 后端（端口 18766）
│   └── src/
│       ├── server.js        # 入口，挂载 5 类路由 + SPA 兜底
│       ├── config.js        # 端口 / 目录 / 上游 baseUrl
│       └── routes/          # canvas / settings / files / imageOps / proxy
├── src/                     # 前端
│   ├── App.tsx              # 三栏布局 + 状态栏
│   ├── components/
│   │   ├── Canvas.tsx       # 画布主体 + 批量运行 + 对齐辅助 + GroupBox
│   │   ├── CanvasToolbar.tsx
│   │   ├── TerminalPanel.tsx
│   │   ├── CanvasManager.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ApiSettings.tsx
│   │   └── nodes/           # 节点组件
│   ├── stores/              # canvas / apiKeys / theme / runBus / logs
│   ├── hooks/               # useCanvasHistory / useRunTrigger
│   ├── services/            # api / generation / imageOps
│   ├── config/              # nodeRegistry / canvasTemplates / portTypes
│   ├── providers/           # 模型注册表
│   ├── utils/               # topologicalSort / wheelBlock
│   └── types/canvas.ts
├── electron/                # Electron 主进程（CommonJS）
│   ├── main.cjs             # 主进程 + 后端拉起 + IPC
│   ├── loader.cjs           # bytenode .jsc loader 复刻 + MODULE_NOT_FOUND 兜底
│   ├── encrypt.cjs          # T8ENC1 加密脚本
│   ├── preload.cjs          # IPC 桥接
│   └── _post_build.cjs      # 打包后置校验
├── features.json            # 节点防丢失锁 + 接口快照 + 打包 SOP
├── skill.md                 # 本地私有手册（不提交 GitHub）
├── vite.config.ts           # 前端 11422 + /api → 18766 代理
├── start-dev.bat            # Windows 一键启动
└── package.json
```

详细字段见本地私有 `skill.md`。

---

## 🎛️ 画布快捷键

默认快捷键如下；可在顶部工具栏 `?` →「快捷键设置」里自定义、清空单项或恢复默认，配置会保存在本机浏览器 / Electron 用户数据中。

| 快捷键 | 作用 |
|---|---|
| `Ctrl + Z` | 撤销 |
| `Ctrl + Shift + Z` / `Ctrl + Y` | 重做 |
| `Ctrl + C` / `Ctrl + V` / `Ctrl + D` | 复制 / 粘贴 / 快速复制 |
| `Delete` / `Backspace` | 删除选中节点或连线 |
| `Ctrl + A` | 全选节点 |
| `Z` | 画布空白处缩放到全貌 |
| `G` | 画布空白处定位当前视野最近节点 |
| 拖线中 `Space` | 开启 / 关闭连线导航模式，远距离连线时可松开鼠标拖动画布后再点目标接口 |
| `空格 + 拖拽` | 平移画布 |
| `滚轮 / 触控板` | 缩放画布 |

工具栏图标：▶ 批量运行 · 🧲 网格吸附 · ↶↷ 历史 · ⧉ 复制 · 📋 粘贴 · 🗑️ 删除 · ⬆️ 导入 · ⬇️ 导出 · ✨ 模板 · ❓ 快捷键设置

---

## ⚙️ 批量执行（拓扑串行）

工具栏 ▶ 按钮一键运行画布上所有 **可执行节点**：

1. `topologicalSort()` 在「仅含可执行节点」的子图上做 Kahn 排序
2. 串行 `triggerRun(id)` → 等待运行总线 `lastDone.id === id` 推进
3. 进度徽标 `done/total` 实时显示，再次点击（■）中断

可执行节点包含：image / edit / multi-angle-3d / panorama-720 / penguin-portrait / video / seedance / audio / llm / runninghub / runninghub-wallet / rh-tools / resize / upscale / grid-crop / remove-bg / combine / image-compare / frame-extractor / frame-pair / upload / loop / pick-from-set / drawing-board / cinematic / video-motion / multi-angle-visual。

---

## 🧲 节点对齐辅助

- **snap-to-grid**：xyflow 原生 20×20 网格吸附
- **智能辅助线**：拖动时检测每对节点的 6 条边（左/中/右、上/中/下），距离 < 6px 触发：
  - SVG 橙色虚线在世界坐标系（随视口缩放）渲染
  - 自动取差值最小者做弱吸附

工具栏「磁铁」按钮统一控制开关。

---

## 🛠️ 后端接口速览

完整接口表见本地私有 `skill.md` 的后端接口章节。

| 分组 | 主要路径 |
|---|---|
| 健康 | `GET /api/status` |
| 画布 | `GET/POST /api/canvas`、`GET/PUT/DELETE /api/canvas/:id`、`PATCH /api/canvas/:id/name` |
| 设置 | `GET/POST /api/settings`、`GET /api/settings/raw`（内部） |
| 文件 | `POST /api/files/upload`、`GET /api/files/list`、`POST /api/files/upload-base64` |
| 图像处理 | `/api/image/{resize,upscale,grid-crop,combine,remove-bg}` |
| 上游代理 | `/api/proxy/image`、`/api/proxy/llm`、`/api/proxy/video/{submit,query}`、`/api/proxy/audio/{submit,query}`、`/api/proxy/runninghub/{submit,query,app-info}` |

代理层会 **自动转存** 上游图像 / 视频 / 音频到 `output/`，前端永远拿到稳定的本地 `/files/output/*` URL。

---

## 📦 构建 / 部署

```powershell
npm run type-check    # tsc --noEmit
npm run build         # tsc -b && vite build
npm run preview       # 本地预览构建产物
```

后端为纯 Node 服务，部署时直接 `node backend/src/server.js` 即可，注意：

- `data/` 持久化设置和画布
- `input/ output/ thumbnails/` 持久化用户素材与生成产物（首次自动创建）

---

## 📋 节点清单（39 个，可见 + 隐藏）

| 分组 | 节点 |
|---|---|
| 素材资源 (3) | upload（上传素材） · material-set（素材集） · output（输出素材终端预览） |
| 核心 (6) | text · image · video · seedance · audio · llm |
| RunningHub (4) | runninghub · runninghub-wallet（RH 钱包应用） · rh-config（隐藏） · rh-tools（RH 超市） |
| 特殊 (5, 隐藏) | multi-angle-3d · panorama-720 · penguin-portrait · portrait-metadata · storyboard-grid |
| 工具 (13) | drawing-board · browser · image-compare · frame-extractor · frame-pair · loop · pick-from-set · text-split · resize · combine · remove-bg · upscale · grid-crop |
| 辅助 (5) | edit（隐藏） · idea · bp · relay · video-output（隐藏） |
| 工具箱 (3) | cinematic · video-motion · multi-angle-visual |

> 任何节点的删减都需在 [features.json](./features.json) 中说明，并同步本地私有 `skill.md`。

---

## 🤝 贡献

欢迎 Issue / PR ！

- 提交 Issue 前请先搜索是否已存在；附上复现步骤、期望与实际行为、截图（如有）
- 提交 PR 前请保证：
  - `npm run type-check` 通过
  - `npm run build` 通过
  - 涉及节点变动需同步 [features.json](./features.json) 与本地私有 `skill.md`
  - Commit 信息使用 [Conventional Commits](https://www.conventionalcommits.org/) 风格（`feat:` `fix:` `chore:` `docs:` 等）

---

## 📜 License

MIT License © T8mars

本项目以 MIT 协议开源。允许在保留版权与许可声明的前提下自由使用、复制、修改、合并、出版、分发、再授权及销售本软件副本。详见 [LICENSE](./LICENSE)（如未单独提供，请参考 [MIT 协议全文](https://opensource.org/licenses/MIT)）。

---

## 🐧 Credits

- 主作者：[T8mars](https://github.com/T8mars)
- 灵感来源：PenguinPravite · Infinite Canvas · zhenzhen-web
- 致谢上游服务：贞贞工坊（T8star）· RunningHub · OpenAI 兼容生态
- 去AI水印辅助节点桥接 [wiltodelta/remove-ai-watermarks](https://github.com/wiltodelta/remove-ai-watermarks)（MIT License），算法能力由上游 Python 包 / CLI 提供；完整 Electron 用户包可随 `resources/tools/remove-ai-watermarks` sidecar runtime 分发
- 桌面端打包方案：bytenode + electron-builder + NSIS

如果这个项目对你有帮助，欢迎给一个 ⭐ Star！
