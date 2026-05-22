# T8-penguin-canvas · skill.md

> 项目能力 / 接口 / 文件用途速查手册。
> 版本：v1.2.0 ｜ 仓库：<https://github.com/T8mars/T8-penguin-canvas>

---

## 1. 项目定位

T8-penguin-canvas 是 PenguinPravite 画布功能的 **轻量化重构版**，定位为 **纯 Web 端 AI 创作画布工具**：

- 仅运行于浏览器（前端 Vite 5180 端口 + 后端 Node Express 18766 端口）。
- 严格剔除桌面端封装、CLI、登录系统、创意库等非画布能力。
- 26 个业务节点（含 upload + output）全部落地，覆盖文本 / 图像 / 视频 / 音频 / LLM / 工作流 / 工具 / 辅助 / 工具箱 / 输出预览。
- 支持 **批量执行（拓扑顺序串行）**、**节点对齐辅助线（snap-to-grid + 智能吸附）**、**双主题（科技风 / 像素糖果风）**、**终端日志面板**。
- 支持 **打组（GroupBox）** —— 框选多节点后一键套色框容器，可拖拽联动成员、一键执行、换色改名（12 色调色板）。
- 支持 **右键画布空白区快速添加节点** —— 菜单列出 input + core 7 个高频节点（upload / text / image / video / seedance / audio / llm），点击后节点出现在鼠标点击位置。
- 支持 **框选 ≥2 节点后自动弹出操作菜单**（组执行 / 复制 / 快复制 / 删除 / 打组），无需右键。

---

## 2. 仓库结构

```
T8-penguin-canvas/
├── backend/                     # Node + Express 后端
│   └── src/
│       ├── server.js            # 入口，挂载 5 类路由
│       ├── config.js            # 端口/目录/上游 baseUrl
│       ├── utils/
│       │   └── whitePng.js      # 零依赖 PNG 编码器（GPT2 文生图占位白图）
│       └── routes/
│           ├── canvas.js        # 画布 CRUD（防空覆盖）
│           ├── settings.js      # 三套 API Key 持久化（脱敏 GET / 明文 raw）
│           ├── files.js         # 上传 / list / base64 转存
│           ├── imageOps.js      # sharp：resize/upscale/grid-crop/combine/remove-bg
│           └── proxy.js         # 上游代理：image/llm/video/audio/runninghub（全异步对齐主项目）
├── src/                         # 前端 React + TS
│   ├── App.tsx                  # 三栏布局 + 状态栏
│   ├── components/
│   │   ├── Canvas.tsx           # 画布主体（xyflow）+ 批量运行 + 对齐辅助
│   │   ├── CanvasToolbar.tsx    # 顶部浮动工具栏（运行/吸附/历史/复制/导入导出/模板/帮助/终端）
│   │   ├── TerminalPanel.tsx    # 底部抽屉式日志面板（双主题）
│   │   ├── CanvasManager.tsx    # 多画布管理列
│   │   ├── Sidebar.tsx          # 节点拖拽侧边栏
│   │   ├── ApiSettings.tsx      # 三套 Key 设置弹窗
│   │   └── nodes/               # 27 个节点组件文件
│   ├── stores/
│   │   ├── canvas.ts            # 画布列表 store
│   │   ├── apiKeys.ts           # 三套 Key store
│   │   ├── theme.ts             # 浅/深色 + 科技/像素双主题
│   │   ├── runBus.ts            # 运行总线（批量执行）
│   │   └── logs.ts              # 日志总线 logBus（对齐 gpt-image-2-web log()）
│   ├── hooks/
│   │   ├── useCanvasHistory.ts  # Undo/Redo 栈
│   │   └── useRunTrigger.ts     # 节点订阅运行总线
│   ├── services/
│   │   ├── api.ts               # 后端 REST 封装
│   │   ├── generation.ts        # 图像/视频/音频/LLM 生成调用封装
│   │   └── imageOps.ts          # /api/image/* 工具调用
│   ├── providers/               # 模型注册表（image/video/audio/llm）
│   ├── config/
│   │   ├── nodeRegistry.ts      # 26 节点元数据（label/icon/color）
│   │   └── canvasTemplates.ts   # 工作流模板预设
│   ├── utils/
│   │   └── topologicalSort.ts   # Kahn 拓扑排序（批量运行依赖序）
│   ├── types/canvas.ts          # 节点 / 画布 / Key 类型
│   └── styles/index.css         # Tailwind 入口
├── data/                        # 画布 JSON / 设置 JSON（gitignore）
├── input/  output/  thumbnails/ # 用户上传 / 生成产物 / 缩略（gitignore）
├── features.json                # 节点防丢失锁 + 接口快照
├── vite.config.ts               # 5180 端口 + /api → 18766 代理
├── package.json
└── tsconfig.json
```

---

## 3. 后端接口（http://127.0.0.1:18766）

### 3.1 健康检查

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/status` | 返回 `{ ok, service, version, port, time }` |

### 3.2 画布 CRUD（routes/canvas.js）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/canvas` | 画布列表 |
| POST | `/api/canvas` | 新建画布 `{ name? }` |
| GET | `/api/canvas/:id` | 画布数据 `{ nodes, edges, viewport }` |
| PUT | `/api/canvas/:id` | 保存画布数据，**拒绝空数据覆盖非空画布** |
| DELETE | `/api/canvas/:id` | 删除画布及数据文件 |
| PATCH | `/api/canvas/:id/name` | 重命名 `{ name }` |

> 数据文件位置：`data/canvas_list.json` + `data/canvas_<id>.json`。

### 3.3 设置（routes/settings.js）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/settings` | 三套 Key 设置（Key 字段被 `****xxxx` 脱敏） |
| GET | `/api/settings/raw` | 内部接口，明文（仅供 proxy.js 调用） |
| POST | `/api/settings` | 更新设置；`zhenzhenBaseUrl` / `llmBaseUrl` 强制为配置值 |

字段：`zhenzhenApiKey / rhApiKey / llmApiKey + 各自 baseUrl + preferences{ theme, language }`。

### 3.4 文件（routes/files.js）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/files/upload` | multipart 上传到 `input/`，限 10MB |
| GET | `/api/files/list` | 列出 `output/` 中的 png/jpg/webp/gif/mp4/webm/mp3/wav |
| POST | `/api/files/upload-base64` | dataURL 转存到 `output/`（手绘画板 / 抽帧使用） |

静态托管：`/files/output`、`/files/input`、`/files/thumbnails`、`/output`、`/input`。

### 3.5 图像处理（routes/imageOps.js · sharp）

| 方法 | 路径 | body |
|---|---|---|
| POST | `/api/image/resize` | `{ imageUrl, width?, height?, fit? }` |
| POST | `/api/image/upscale` | `{ imageUrl, scale }`（1~8，lanczos3） |
| POST | `/api/image/grid-crop` | `{ imageUrl, rows, cols }`，返回 `urls[]` |
| POST | `/api/image/combine` | `{ imageUrls[], direction: 'horizontal' \| 'vertical' }`，等比缩放后拼接 |
| POST | `/api/image/remove-bg` | `{ imageUrl }`（**占位实现**，仅 PNG 化） |

输入支持本地 URL（`/files/output|input` / `/output|input`）、HTTP(S)、`data:image/...;base64,` 三种形态。

### 3.6 上游代理（routes/proxy.js）

> 隐藏 Key、自动注入 Key、产物自动转存到 `output/` 并返回本地 URL。

#### 图像（全异步 · 1:1 对齐 gpt-image-2-web）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/image` | 同步入口：内部提交异步任务并轮询至完成，返回本地图片 URL（兼容同步响应的上游） |
| POST | `/api/proxy/image/submit` | 提交异步任务，返回 `{ sync, taskId?, urls?, status, progress }` |
| GET  | `/api/proxy/image/status/:tid` | 轮询 `/v1/images/tasks/{tid}`，返回 `{ status, progress, urls? }` |

调用上游必加 `?async=true` 查询参数，GPT2 始终走 multipart `/v1/images/edits?async=true`（无参考图时插入 1024×1024 白图占位）；nano-banana 文生图 JSON `/v1/images/generations?async=true`、图生图 multipart `/v1/images/edits?async=true`。详见 §11 异步任务规范。

#### 同步：LLM
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/llm` | 贞贞工坊 `/v1/chat/completions`，使用 **LLM 独立 Key** |

#### 异步：视频（全异步 · 1:1 对齐 gpt-image-2-web）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/video/submit` | 上游 `/v2/videos/generations`；**后端根据 `model` 名自动选择 Veo3.1 / Grok / Seedance 三种 payload 协议**，返回 `taskId` |
| GET | `/api/proxy/video/query?taskId` | 轮询；SUCCESS 时下载视频到本地，返回 `videoUrl` |

Grok 路径另依赖上游 `POST /v1/files`（multipart `file`）上传参考图拿 URL，后端在 [`uploadRefToZhenzhen`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) 内部完成，前端可传 base64 或 `/files/*` 本地 URL。详见 §11.6。

#### 异步：Suno 音频（v5.5 三模式）
| 方法 | 路径 | mode |
|---|---|---|
| POST | `/api/proxy/audio/submit` | `generate / cover / extend`，自动选 `mv` |
| GET | `/api/proxy/audio/query?clipIds` | 解析 `audio_url`，返回 `tracks[]` |

模型映射：`suno-v5.5 → chirp-fenix`、`v5 → chirp-v3-5`、`v4.5 → chirp-v4-5`、`v4 → chirp-v4`。

#### 异步：RunningHub
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/runninghub/submit` | `/task/openapi/ai-app/run`，返回 `taskId` |
| GET | `/api/proxy/runninghub/query?taskId` | 轮询；code `0/804/813/805` → `SUCCESS/RUNNING/QUEUED/FAILED`，转存所有产物 |
| GET | `/api/proxy/runninghub/app-info?webappId` | 调 `/api/webapp/apiCallDemo`，返回 `nodeInfoList` 等 |

---

## 4. 前端服务封装

### `src/services/api.ts`
- `checkBackendStatus()` / `listCanvases()` / `createCanvas(name?)`
- `getCanvasData(id)` / `saveCanvasData(id, data)` / `deleteCanvas(id)` / `renameCanvas(id, name)`
- `getSettings()` / `updateSettings(patch)`

### `src/services/generation.ts`
统一封装 image / video / audio / llm 的提交 + 轮询，向上层节点暴露 Promise。

### `src/services/imageOps.ts`
对 `/api/image/*` 的薄封装，供工具节点 `ResizeNode / UpscaleNode / GridCropNode / CombineNode / RemoveBgNode` 使用。

---

## 5. 节点清单（26 个）

| 分组 | 节点 type | 入口 | 可批量运行 |
|---|---|---|---|
| 核心 | text | TextNode | ✗ |
| 输出素材 | upload | UploadNode（图像/音频/视频自适应） | ✗ |
| 输出素材 | output | OutputNode（文本/图像/视频/音频 终端预览，原始宽高比 + 文本双击编辑） | ✗ |
| 核心 | image | ImageNode（异步轮询，对齐 gpt-image-2-web） | ✓ |
| 核心 | video | VideoNode | ✓ |
| 核心 | seedance | VideoNode（model=seedance-2.0） | ✓ |
| 核心 | audio | AudioNode | ✓ |
| 核心 | llm | LLMNode | ✓ |
| 核心 | runninghub | RunningHubNode | ✓ |
| 核心 | rh-config | RhConfigNode | ✗ |
| 特殊 | multi-angle-3d / panorama-720 / penguin-portrait | PresetImageNode | ✓ |
| 特殊 | portrait-metadata | PortraitMetadataNode | ✗ |
| 特殊 | storyboard-grid | StoryboardGridNode | ✗ |
| 工具 | drawing-board | DrawingBoardNode | ✗ |
| 工具 | browser | BrowserNode | ✗ |
| 工具 | image-compare | ImageCompareNode | ✗ |
| 工具 | frame-extractor | FrameExtractorNode | ✓ |
| 工具 | resize / upscale / grid-crop / combine / remove-bg | ImageOpFrame | ✓ |
| 辅助 | edit | ImageNode（mode=edit） | ✓ |
| 辅助 | idea / bp / relay / video-output | IdeaNode / BpNode / RelayNode / VideoOutputNode | ✗ |
| 工具箱 | cinematic / video-motion | ToolboxParamNode | ✗ |

> 「可批量运行」= 已通过 `useRunTrigger(nodeId, runFn)` 接入运行总线。

---

## 6. 运行总线（批量执行）

### `src/stores/runBus.ts` · zustand
```
state: { currentRunId, lastDone, mode, batchTotal, batchDoneCount }
actions: triggerRun(id, mode='single'|'batch'), markDone(id, ok, error?),
         cancelAll(), setBatchProgress(total, done)
```

### `src/hooks/useRunTrigger.ts`
节点端订阅 `currentRunId`，命中自身则 `await runFn()` → `markDone(id, true)`。
- 用 `runFnRef = useRef(runFn)` 保持闭包最新。
- `startedRef` 防 React StrictMode 二次挂载重入。
- 异常被节点内部 `try/catch` 消化（节点自管 `status='error'`），运行总线只关心「已完成」。

### `src/utils/topologicalSort.ts`
Kahn 算法：仅取可执行节点子图的入度，排序失败时按原始顺序补全（环兼容）。

### `Canvas.tsx · handleRunAll`
1. 拓扑排序得 `order: string[]`
2. `setBatchProgress(order.length, 0)` → 串行 `await new Promise(...)`，每个节点 5 分钟安全超时
3. 监听 `lastDone.id === order[i]` 推进
4. `cancelRunRef` 控制中断
5. 工具栏 Play/Square 按钮 + `done/total` 进度徽标

---

## 7. 节点对齐辅助

### snap-to-grid
ReactFlow 内置：`snapToGrid={snapEnabled} snapGrid={[20, 20]}`。

### 智能对齐辅助线（onNodeDrag）
对每对「拖拽节点 6 边 × 其他节点 6 边」做差，差 < `ALIGN_THRESHOLD=6px`：
- 记入 `guides.vertical / horizontal`
- 取最优差值做弱吸附（`setNodes` 直接调整位置）
- 通过 `<ViewportPortal>` + SVG 在世界坐标系绘制橙色虚线（`vectorEffect="non-scaling-stroke"`）
- `onNodeDragStop` 清空辅助线

工具栏 **磁铁 Magnet 按钮** 开关吸附与辅助线。

---

## 8. 画布交互

| 能力 | 实现 | 文件 |
|---|---|---|
| Undo/Redo | 节流 250ms 入栈 + 拖拽中暂停 | `useCanvasHistory.ts` |
| 复制/粘贴/快复制/删除 | 仅复制选中节点 + 子图边，paste 偏移 (40,40) | `Canvas.tsx · handleCopy/Paste/Duplicate/DeleteSelected` |
| 导入/导出 JSON | `{ version, exportedAt, nodes, edges }` | `Canvas.tsx · handleExport/handleImportFile` |
| 工作流模板 | 预设节点+连线，一键插入 | `config/canvasTemplates.ts` |
| 自动保存 | 800ms 防抖；防空数据覆盖（前端 + 后端双层） | `Canvas.tsx` 自动保存 effect |
| 后端连通检测 | 每 15s `GET /api/status` | `App.tsx` |

### 全局快捷键
`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` / `Ctrl+C` / `Ctrl+V` / `Ctrl+Shift+V` / `Ctrl+D` / `Ctrl+A` / `Delete` / `Backspace`。

- **`Ctrl+V`** 普通粘贴（仅复制选中节点 + 其内部边，偏移 40,40）
- **`Ctrl+Shift+V`** 连边粘贴（额外保留原节点与画布邻居的**外部入边 / 出边**。例：原有 文本→图像，复制图像节点 → Ctrl+Shift+V 后新图像节点的入口也连上原文本节点的出口）

### 拖线连接
- 拖动节点 Handle 拉到另一节点 Handle / 节点体 / 连线上 → ReactFlow 默认处理（连接成功或被 `isValidConnection` 拒绝）
- 拖动释放到**空白画布**（pane / background）→ 弹出候选节点菜单，选中后在拖落位置创建并自动连线
- 判断逻辑：`event.target.closest('.react-flow__handle | __node | __edge')` 任一命中则不弹菜单

### 鼠标交互

| 操作 | 效果 |
|---|---|
| 左键拖动空白 | 平移画布（ReactFlow 默认） |
| **Ctrl + 左键拖动** | 框选多个节点（`selectionKeyCode=['Control','Meta']`，Mac 下 ⌘ 同效） |
| **Ctrl + 点击节点** | 叠加多选（`multiSelectionKeyCode`） |
| **框选松手（选中 ≥2）** | 自动在鼠标位置弹出操作菜单（组执行 / 复制 / 快复制 / 删除 / **打组(N)**），无需右键 |
| **右键点击节点 / 选区** | 同上菜单（选中 ≥2 时额外出现「打组(N)」）|
| **右键画布空白** | **弹出「快速添加节点」菜单**，含 7 个高频节点：upload / text / image / video / seedance / audio / llm；点击后节点出现在鼠标点击位置（左上角对准鼠标）|
| 滚轮 / 触控板 | 缩放画布 |
| 空格 + 拖动 | 平移画布（备选） |

**节点添加默认定位策略**（[`addNode`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 双分支）：
- **左侧 Sidebar 点击添加** → 节点 **视觉中心对准当前视口中心**（`screenToFlowPosition` 将画布容器 `getBoundingClientRect()` 中心 → 画布坐标，避开侧栏）+ 小范围抖动避免重叠。
- **右键菜单点击添加** → 节点 **左上角贴鼠标点击位置**（鼠标自然落在 header 上，跳过中心偏移）。

**右键菜单 / 选区菜单定位**：节点对 / 画布菜单容器均用 `position: fixed`（直接相对视口，`clientX/Y` 一一对应），不受 Canvas 根容器 `<div className="flex-1 relative">` 的侧边 sidebar 偏移影响；边界保护用 `Math.min(x, innerWidth - 220)` 避免出屏。

**组执行**实现：[`Canvas.handleRunGroup(ids)`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 调 [`runNodesByOrder(subNodes, subEdges)`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 通用引擎 —— 仅保留所选子集**内部**的边作为依赖，拓扑排序后串行调 `runBus.triggerRun(id, 'batch')`，与全量批量运行共享 `isRunning` 状态、`batchTotal/Done` 进度、停止机制。设计思路对齐 [`PenguinPravite/components/PebblingCanvas/index.tsx`](file:///e:/PenguinPravite/components/PebblingCanvas/index.tsx) 中 `executeGroup` 的“selection 临时组 + 可执行节点顺序执行”模式。

**框选自动弹菜单**实现：`onSelectionChange` 同步最新选中 ids 到 `lastSelectedIdsRef` 避免 React state 异步滞后；`onSelectionEnd(e)` 中读取 ref 赋值 `setContextMenu({ x: e.clientX, y: e.clientY, ids })`。仅 `ids.length ≥ 2` 才弹（遵循[框选多节点自动弹出列表按钮触发条件](file:///e:/PenguinPravite/T8-penguin-canvas/skill.md)）。

---

## 9. 三套 API Key

| Key | 默认 BaseUrl | 是否固定 | 影响节点 |
|---|---|---|---|
| `zhenzhenApiKey` | `https://ai.t8star.org` | ✓ | image / video / audio |
| `runninghubApiKey` | `https://www.runninghub.cn` | ✗（仅 Key） | runninghub / rh-config |
| `llmApiKey` | `https://ai.t8star.org` | ✓ | llm / vision（**额度独立**） |

后端 `routes/settings.js` 在保存时强制将 `zhenzhenBaseUrl / llmBaseUrl` 还原为配置常量，防止前端篡改。

---

## 10. 启动 / 构建

```powershell
# 安装
npm install
cd backend; npm install; cd ..

# 开发（前端 5180 + 后端 18766，concurrently 并发）
npm run dev

# 类型检查 / 构建
npm run type-check
npm run build
```

或 Windows 双击 `start-dev.bat`。

---

## 11. 异步任务对齐外部参考项目规范（重要·以图像节点改造为参考样板）

> 本节记录的是 **通用规范**，适用于后续 **任何节点** 对齐外部参考项目（gpt-image-2-web / suno-web / runninghub-web 等）的改造。
> **字段名、路径、查询参数、枚举值并非固定**，每次都以当次参考项目的源码为准。

### 11.1 三原则

1. **参照源于参考项目的运行时代码**：优先读 `index.html` / `main.js` 中的 `fetch(...)` 调用点，而不是口头描述或官方文档。
2. **字段严格原样复制**：包括大小写（`aspectRatio` vs `aspect_ratio`）、枚举值大小写（`1k` vs `1K`）、是否传空串、是否增加 `?async=true` 查询参数、multipart vs JSON。
3. **反向验证**：提交后上游后台必须能看到 **异步任务**，而不是只看到同步请求；否则表示代理未走对应路径。

### 11.2 后端处理范式

上游调用集中抽取为 **单一 helper**（主项目例：[`callImageUpstreamAsync`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)），同步入口（`/image`）与异步入口（`/image/submit`）**必须复用同一 helper**，避免双实现漂移。

```
request → callXUpstreamAsync(...) → fetch(`?async=true`) → normalize →
  - kind=='sync'  → 转存产物 → 返回 urls
  - kind=='async' → 返回 taskId（/image/submit）或 pollXTask(taskId) → urls（/image）
```

轮询路径（图像示例）：`GET {baseUrl}/v1/images/tasks/{taskId}`。响应结构可能是多层嵌套（`data.data.data[0].url`），要同时兼容 `data.data[0]` 与 `data.data.data[0]` 两种布局，详见 [proxy.js#image/status](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)。

状态字段同样不固定，要同时识别 `SUCCESS / completed / done / success`、与失败类 `failure / failed / error`，**全部转小写后判断**。

### 11.3 前端节点执行范式

```ts
// 1) 提交
const submit = await submitXAsync({ ... });
// 2) 同步完成分支
if (submit.sync && submit.urls?.length) { update(success); return; }
// 3) 异步轮询分支
for (let i = 0; i < MAX; i++) {
  await sleep(INTERVAL);
  const q = await queryXStatus(submit.taskId!);
  update({ progress: q.progress });
  const st = String(q.status).toLowerCase();
  if (['completed','success','done'].includes(st)) { update(success(q.urls)); return; }
  if (['failed','failure','error'].includes(st))   throw new Error(q.error);
}
throw new Error('超时');
```

默认参数：`MAX=60`、`INTERVAL=2000ms`（与主项目一致）。各节点可根据任务平均耗时调整，但无特殊原因不要脱离这个量级。

### 11.4 特殊补丁（为什么需要白图）

某些上游端点（如 GPT2 的 `/v1/images/edits`）**必须传 `image` 字段**。主项目代码中文生图场景会以 canvas 制造 1024×1024 白图占位（`index.html` line 2861）。Node 端无 canvas，改以 [whitePng.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/utils/whitePng.js) 零依赖手写 PNG（zlib + CRC32 + IHDR/IDAT/IEND）生成，并缓存。其他节点遇到类似“上游要求字段但场景上没有”的问题时，**优先选择补默认体以保持一致**，不要反向修改分发逻辑。

### 11.5 代码定位索引（主项目 gpt-image-2-web）

| 关键点 | 文件·行号 |
|---|---|
| GPT2 全量参数 + 白图 + `?async=true` | `index.html` ~ line 2840-2883 |
| GPT_SIZE_MAP 完整表（13×3） | `index.html` line 2173 |
| nano-banana 文生图 JSON | `index.html` ~ line 2998-3008 |
| pollTask 轮询逻辑及状态字段调和 | `index.html` ~ line 4866-4908 |
| Veo3.1 `runVeo3` / `pollVeo3` | `index.html` line 3372 / 3422 |
| Grok Video `runGrok3` / `pollGrok3` | `index.html` line 3863 / 3917 |
| `uploadFileToAPI`（Grok 参考图上传） | `index.html` line 3104 |
| veo_model 13 子模型下拉 | `index.html` line 1350 |
| gk_ratio / gk_duration / gk_resolution | `index.html` line 1410-1414 |

后续改造 audio / sora 等节点时同样到参考项目 `index.html` 用 `grep_code` 搜“`/suno/generate`”、“`runSora`” 以定位。

### 11.6 视频节点协议对齐实例（Veo3.1 / Grok Video）

> 此例为 **可复用样本**：“一个上游路径、两种完全不同的 payload 字段”怎么在同一路由中优雅剩余。后续 sora2 / fal 渠道接入可参照同样“分支-不破坏”结构。

#### 两个模型的 payload 字段对照表（字段名严格以主项目为准）

| 范畴 | Veo3.1 （`runVeo3`） | Grok Video （`runGrok3`） |
|---|---|---|
| 上游路径 | `POST /v2/videos/generations` | `POST /v2/videos/generations`（同） |
| 轮询路径 | `GET /v2/videos/generations/{tid}` | （同） |
| 模型子选 | 13 个（veo3 / veo3-fast / veo3.1 / veo3.1-pro / veo3.1-4k …） | `grok-video-3` |
| 比例字段 | `aspect_ratio`（8 选项仅中 16:9/9:16） | `ratio`（2:3 / 3:2 / 16:9 / 9:16 / 1:1） |
| 时长 | —不传— | `duration`（**数字秒**：6/10/15/30） |
| 分辨率 | —不传— | `resolution`（`480P` / `720P`，**大写 P**） |
| 提示词增强 | `enhance_prompt:bool` | — |
| 上采样 | `enable_upsample:bool` | — |
| 随机种子 | `seed`（0 不传） | `seed`（0 不传） |
| 参考图上限 | 3 | 7 |
| 参考图格式 | `images: string[]`，**base64 dataURL** | `images: string[]`，**先 `POST /v1/files` 上传拿 URL** |

#### 后端处理分支（零破坏原则）

[`/api/proxy/video/submit`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) 内以 `model` 名包含 `'grok'` / `'veo'` 作为分支键。**未知模型（如 seedance）必须堆在 Veo 分支**，以保留历史画布中 “model=seedance-2.0 使用 aspect_ratio + images=base64” 的旧行为。这是“仅加不减”原则的典型设计。

Grok 参考图上传：
```js
// uploadRefToZhenzhen(): 接受 base64 dataURL 或 /files/* 本地 URL
// 内部 fetch 转 Buffer → multipart fd.append('file', blob, ...) → POST /v1/files → 取 j.url
```
前端不需要为 Grok 转 base64，直接传上游可访问的 URL 或本地 `/files/*` 即可。

#### 前端节点设计要点

- [`VIDEO_MODELS`](file:///e:/PenguinPravite/T8-penguin-canvas/src/providers/models.ts) 中 **每个项携带 `kind: 'veo' | 'grok' | 'seedance'`**，以该枚举控制 UI 列表（是否展示 duration / resolution / enhance/upsample）。
- [`VideoNode`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/VideoNode.tsx) 提交时按 `modelDef.kind` **选不同字段名**（`aspect_ratio` vs `ratio`），而不是走同一份字段让后端重映射。
- 参考图预处理：`kind === 'grok'` 直接传 URL 列表；其他 kind 调 `urlToBase64()`。
- 切主模型时调 `switchMainModel()` **重置** ratio/duration/resolution 为该 kind 默认值，避免跨模型参数遗留（如从 grok 切到 veo 还带着 `2:3`）。
- 旧画布兼容：接受 `model='veo-3.1'`/`'grok-video'` 这些旧值时 `find` 不到会退回 `VIDEO_MODELS[0]`，不报错。

### 11.7 FAL 渠道接入规范（后续 FAL 模型接入的唯一参考）

> **本节是 FAL 渠道的唯一接入规范**。任何后续 FAL 模型（无论 GPT FAL / NanoBanana FAL / Flux FAL / SDXL FAL 等）都须严格遵遵本节一部分 “协议核心” 与二部分 “零破坏三层架构”。三部分 “现有实例” 为代码参考，四部分 “接入新 FAL 子模型的 N 步法” 为可执行样板。
>
> 权威依据：[`gpt-image-2-web/SKILL.md` §FAL模型渠道接入规范](file:///E:/PenguinPravite/gpt-image-2-web/SKILL.md)。
> 运行时代码：[`gpt-image-2-web/index.html`](file:///E:/PenguinPravite/gpt-image-2-web/index.html) 中 `runGPTFal` / `runNanoFal`。
>
> **零破坏越界：**只允许修改 FAL 相关逻辑。`/v1/images/*` 路径上的 GPT2 / nano-banana-2 / nano-banana-pro 代码、参数、调用流程**均不得变更**。

#### 一、协议核心（所有 FAL 模型通用，不得偏离）

| 要素 | 取值 | 备注 |
|---|---|---|
| URL 前缀 | `${ZHENZHEN_BASE_URL}/fal/${endpoint}` | 贞贞工坊统一代理 `https://queue.fal.run`；**严禁**直调公网 fal.run |
| 认证 | `Authorization: Bearer ${zhenzhenApiKey}` | **重用贞贞工坊 Key**，不引入独立 FAL Key |
| Content-Type | `application/json` | submit / query 都是 JSON |
| 同步返回 | `result.images[]` 直接拿 URL（部分上游在 `sync_mode=true` 时会同步返） | 后端需 `saveRemoteImage()` 转存 |
| 异步返回 | `{ request_id, response_url }` → 轮询 | response_url 需域名修复 |
| **response_url 修复** | `queue.fal.run` → `${baseUrl}/fal` | 后端 `fixFalResponseUrl()` 在 submit 时**一次性**完成，query 不依赖前端 |
| 轮询接口 | `GET ${responseUrl}` 或 `${baseUrl}/fal/${endpoint}/requests/${requestId}` | response_url 优先 |
| **HTTP 非 200 处理** | body `status === 'IN_QUEUE'` / `'IN_PROGRESS'` 视为 pending，**必须重试不能抛错** | 其他才是真错误 |
| 完成识别 | body `images[]` 非空 | 取 `images[].url` |
| 失败识别 | body `status === 'FAILED'` 或 `'CANCELLED'` | 拋 `Error(body.error 或 status)` |
| 自定义尺寸 | 宽高必须 **16 整数倍** | 后端 `snap16(v, 256, 3840)` 自动对齐 |
| 参考图 | 上传 `${baseUrl}/v1/files` 拿 URL（复用现有 `uploadRefToZhenzhen()`） | 部分模型可选 base64 dataURI |
| 轮询上限 | 前端 600 × 3s = 30min | 与视频节点一致量级 |

#### 二、零破坏三层架构

FAL 走**独立路由 + 独立服务 + 独立 UI 面板**，**不**与原 `/v1/images/*` 协议合街。

```
模型注册（src/providers/models.ts）
  ├ FAL_REGISTRY[apiModel] = { endpoint, editEndpoint?, paramKind, maxRefs }
  └ isFalModel(apiModel)  → ImageNode 入口统一判断
         ↓
ReactFlow 节点（src/components/nodes/ImageNode.tsx）
  ├ isFal && falDef ：渲染 FAL 专属面板（蓝色边框）
  ├ FAL 专属 state 字段名（falXxx / nbXxx）与原 aspectRatio/sizeLevel **完全隔离**
  └ handleGenerate 内 if (isFal) 分支 → submitImageFal + 内置轮询
         ↓
服务层（src/services/generation.ts）
  ├ submitImageFal(req: FalSubmitRequest) → FalSubmitResult
  └ queryImageFal({ responseUrl, endpoint, requestId }) → FalQueryResult
         ↓
后端独立路由（backend/src/routes/proxy.js）
  ├ POST /api/proxy/image/fal/submit —— 仅服务 FAL
  ├ GET  /api/proxy/image/fal/query  —— 仅服务 FAL
  ├ snap16() / fixFalResponseUrl() / FAL_REGISTRY 同名与前端一致
  └ 同步拿到 images[] 时立即 saveRemoteImage 转存
```

**严禁在 `/api/proxy/image/submit` 内分流 fal**——FAL 参数集与原协议完全不同，混入会造成双路径同时漂移。

#### 三、现有实例（gpt-image-2-fal / nano-banana-pro-fal / nano-banana-2-fal镜像）

##### 3.1 payload 字段对照（字段名严格以主项目 `runGPTFal` / `runNanoFal` 为准）

| 范畴 | gpt-image-2-fal（paramKind=`gpt-fal`） | nano-banana-pro-fal（paramKind=`nbpro-fal`） |
|---|---|---|
| endpoint | `openai/gpt-image-2`（gen） / `openai/gpt-image-2/edit`（edit） | `fal-ai/nano-banana-pro/edit`（只有 edit） |
| 模式 | `mode: 'edit' \| 'gen'`（有参考图默认 edit） | 仅 edit |
| 尺寸 | `image_size: 'auto' \| 'square_hd' \| 'square' \| 'portrait_4_3' \| 'portrait_16_9' \| 'landscape_4_3' \| 'landscape_16_9'` 或 `{width,height}`（custom，16倍数） | `aspect_ratio: 'auto'/'21:9'/'16:9'/'3:2'/'4:3'/'5:4'/'1:1'/'4:5'/'3:4'/'2:3'/'9:16'` + `resolution: '1K' \| '2K' \| '4K'` |
| 张数 | `num_images: 1–4` | `num_images: 1–4` |
| 质量 | `quality: 'low' \| 'medium' \| 'high' \| 'auto'`（默认 medium） | — |
| 输出 | `output_format: 'png' \| 'jpeg' \| 'webp'` | `output_format`（同） |
| 同步开关 | `sync_mode: true` | — |
| 安全 | — | `safety_tolerance: '1'(严)..'6'(松)`，默认 `'4'` |
| 系统词 | — | `system_prompt`（可选） |
| 联网 | — | `enable_web_search: bool` |
| 种子 | — | `seed`（0 不传） |
| 参考图字段 | `image_urls: string[]`（仅 edit） | `image_urls: string[]`（必填） |
| 参考图上限 | **5** | **8** |
| 参考图编码 | URL（贞贞上传） | URL 或 base64 dataURI（`image_mode: 'image_url' \| 'base64'`） |

##### 3.1.1 镜像复用案例 —— `nano-banana-2-fal`

> 主项目 [`gpt-image-2-web/index.html · runGeminiFal`](file:///E:/PenguinPravite/gpt-image-2-web/index.html) 验证：`nano-banana-2-fal` 与 `nano-banana-pro-fal` **endpoint / paramKind / 参数集完全一致**，仅注册名不同。这种场景采用「**镜像注册**」策略，零增量后端/UI 代码：

```ts
// src/providers/models.ts —— 主模型 nano-banana-2 加一个子选项
{ value: 'nano-banana-2', label: 'nano-banana-2 (Flash)' },
{ value: 'nano-banana-2-fal', label: 'nano-banana-2-fal' },

// FAL_REGISTRY 完整镜像 nbpro-fal 的 endpoint/paramKind/maxRefs
'nano-banana-2-fal': {
  endpoint: 'fal-ai/nano-banana-pro/edit',
  editEndpoint: 'fal-ai/nano-banana-pro/edit',
  paramKind: 'nbpro-fal',   // **复用** 而非新建
  maxRefs: 8,
}
```

后端 `proxy.js` 的 `FAL_REGISTRY` **必须同步增加同一条**（前后端注册表是两份独立常量），但 `paramKind === 'nbpro-fal'` 分支**不动**——自动复用已有的 payload 拼装。

##### 3.2 关键代码位置

| 内容 | 位置 |
|---|---|
| 后端 FAL 路由双件 | [`backend/src/routes/proxy.js §/image/fal/submit + /image/fal/query`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) |
| 前端服务函数 | [`src/services/generation.ts §submitImageFal + queryImageFal`](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) |
| FAL 注册表 + 枚举 | [`src/providers/models.ts §FAL_REGISTRY / FalParamKind / isFalModel / GPT_FAL_SIZES / NBPRO_FAL_RATIOS / NBPRO_FAL_RESOLUTIONS`](file:///e:/PenguinPravite/T8-penguin-canvas/src/providers/models.ts) |
| 节点 UI 两套面板 | [`src/components/nodes/ImageNode.tsx §isFal && falDef`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx) |
| 主项目参考 | `gpt-image-2-web/index.html` `runGPTFal` line 2890–2973、`runNanoFal` line 3587–3679、`uploadFileToAPI` line 3104、`gf_panel` HTML line 1069–1080、`nano_fal_panel` HTML line 1154–1173 |

### 11.8 接入新 FAL 子模型的 N 步法（样板）

> 适用场景：后续需要接入**任何一个新 FAL 模型**（例如 `flux-pro-fal` / `seedream-fal` / `recraft-fal` / `imagen3-fal` 等）。以下是可执行清单，**严禁跳步骤**。

#### Step 0a：判断是否「镜像现有 paramKind」

> 若新模型与某已接入模型 endpoint + 参数集**完全一致**（如 `nano-banana-2-fal` ↔ `nano-banana-pro-fal`），**走镜像路径**：
>
> 1. `src/providers/models.ts · FAL_REGISTRY` 加一项，`paramKind` **复用现有**
> 2. `src/providers/models.ts · 主模型 apiModelOptions` 加一项子选项
> 3. `backend/src/routes/proxy.js · FAL_REGISTRY` **同步加同一项**（不加会报「未知的 FAL 模型」）
> 4. `features.json · modelRegistry.image` 加一项
> 5. 跳过 Step 3 / Step 4 / Step 5（已自动复用），直接做 Step 6 验收
>
> **特别注意**：`backend/package.json` 的 `dev` 是 `node src/server.js` 无 nodemon 热更，注册表改动须 `taskkill /PID <旧后端> /F` 后手动重启 `node src/server.js`。否则跑的是改前进程，提交会报「未知的 FAL 模型」。

#### Step 0：拿取官方参考

1. 查 [fal.ai 官方页](https://fal.ai/models) 拿到：
   - **endpoint slug**（如 `fal-ai/flux-pro/v1.1`，去掉 `https://queue.fal.run/` 前缀）
   - 是否有独立 `/edit` 变体
   - 请求 payload 完整字段表
   - 返回体中 `images[]` 位置是否主流（如 `images[0].url`）
2. 查主项目 `gpt-image-2-web/index.html` 是否已实现过（`grep_code` 搜 `"fal-ai/<模型名>"`）——优先拿主项目运行时代码作为准则。

#### Step 1：在注册表增加一项

```ts
// src/providers/models.ts
export const FAL_REGISTRY: Record<string, FalEndpointDef> = {
  'gpt-image-2-fal': { ... },
  'nano-banana-pro-fal': { ... },
  // 新增
  'flux-pro-fal': {
    endpoint: 'fal-ai/flux-pro/v1.1',
    editEndpoint: 'fal-ai/flux-pro/v1.1/redux',  // 如有独立 edit 才填
    paramKind: 'flux-fal',                        // 新 paramKind
    maxRefs: 4,                                   // 上限 = 官方限制
  },
};
```

同步增加枚举常量（参考 `GPT_FAL_SIZES` / `NBPRO_FAL_RATIOS`）——**独立名命名**不复用原有常量。

#### Step 2：在 nano-banana-pro / gpt-image-2 的 apiModelOptions 加子选项

```ts
// src/providers/models.ts —— 加到合适的主模型 TAB 下，**不新增 Tab**
IMAGE_MODELS【主模型】.apiModelOptions.push({
  value: 'flux-pro-fal',
  label: 'flux-pro-fal'  // 询问项目内部名。遵守设置：gpt-image-2 三档为 'gpt-image-2-all' / 'gpt-image-2' / 'gpt-image-2-fal'
});
```

#### Step 3：后端 `proxy.js` 加 paramKind 分支

在 [`POST /image/fal/submit`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) 内现有 `if (paramKind === 'gpt-fal')` / `else if (paramKind === 'nbpro-fal')` 后追加一个 `else if (paramKind === 'flux-fal') { ... }`。

```js
else if (paramKind === 'flux-fal') {
  payload = {
    prompt: prompt,
    num_images: clamp(n, 1, 4),
    image_size: size,
    enable_safety_checker: true,
    output_format: format,
    // 有参考图走 redux endpoint
    ...(image_urls.length ? { image_url: image_urls[0] } : {}),
  };
  if (image_urls.length) endpoint = def.editEndpoint;
}
```

**禁止**在其他 paramKind 分支上修改现有字段拼装 —— 零破坏。

#### Step 4：前端服务 `submitImageFal` 准许新字段

[`src/services/generation.ts §FalSubmitRequest`](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) 加可选字段：

```ts
export interface FalSubmitRequest {
  // ... 已有
  // flux-fal 专属
  enable_safety_checker?: boolean;
  num_inference_steps?: number;
  guidance_scale?: number;
}
```

#### Step 5：节点 UI 加 paramKind 面板

[`src/components/nodes/ImageNode.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx) 中原有：

```tsx
{isFal && falKind === 'gpt-fal' && (<GptFalPanel ... />)}
{isFal && falKind === 'nbpro-fal' && (<NbproFalPanel ... />)}
```

加一项：

```tsx
{isFal && falKind === 'flux-fal' && (
  // 独立 state字段名：fluxXxx，不与 falXxx/nbXxx 冲突
  // 参考图上限 falDef.maxRefs
  // 返回后走同一轮询 queryImageFal
)}
```

**绝对禁止**复用 falXxx 或 nbXxx 字段名，否则切 apiModel 时会携带上一个模型的设置（历史 bug。。）。

#### Step 6：验收清单（必跑）

1. `npx tsc --noEmit` 无错。
2. `node -e "require('./src/routes/proxy.js')"` 输出 OK。
3. 启动 `npm run dev`，选择新模型，提交后**上游后台能看到异步任务**（贞贞工坊控制台 · 任务类型=fal queue）。
4. 轮询能拿到 `images[]`，节点转存后显示本地 `/files/output/...` URL。
5. 双主题（科技 / 像素）的 FAL 面板都能正常点击 / 输入 / 复位。
6. 切回原标准模型（`gpt-image-2` / `nano-banana-2` / `nano-banana-pro`），原“比例 + 尺寸” UI 能正常显示，参数不串。

#### Step 7：同步 features.json

- 在 `modelRegistry.image[]` 添加一项： `{ id, label, provider: 'zhenzhen-fal', endpoint: '/fal/<endpoint>', paramKind, maxRefs }`
- 在 `phases` 添加一个新阶段项以锁住交付。

#### 常见陷阱清单

| 错误 | 表现 | 修法 |
|---|---|---|
| 用 `/v1/images/generations` 调 FAL | 400 “model not found” | 改走 `${baseUrl}/fal/${endpoint}` |
| 忘了修 response_url 域名 | 轮询走公网 fal.run 全安被拦 / 401 | submit 时 `fixFalResponseUrl()` 改为 `${baseUrl}/fal` |
| HTTP 200 外直接拋错 | 节点“任务取消”，但实际上游还在开始排队 | body `IN_QUEUE/IN_PROGRESS` 视为进行中重试 |
| 自定义尺寸被上游拒 | 400 “width must be multiple of 16” | snap16(v, 256, 3840) |
| 参考图走 nbpro-fal 却超过 8 张 | 400 “too many image_urls” | UI 上限走 `falDef.maxRefs` 动态限制 |
| 子模型划入错误的 TAB | UI 主模型在 nbpro 却拿到 gpt-fal 参数 | apiModel 选项需被初始化子选项继承主模型 TAB |
| 带走上个 FAL 模型参数 | 切 nbpro-fal 发现 num_images=4 / safety=4 什么都不动 | falXxx / nbXxx state 字段名**不能复用** |

---

### 11.9 音频节点对齐（Suno 三模式·无 FAL）

本小节专门描述如何对齐主项目 `gpt-image-2-web/index.html` 的 Suno 实现。
**注意：本项目的 audio 节点不提供 FAL 模式**，仅走贞贞工坊 Suno 渠道。

#### 11.9.1 三个起点函数（主项目可查行号）

| 实现 | 主项目函数 | 起始行 | 上游接口 |
| --- | --- | --- | --- |
| 生成（generate） | `runSuno` | L3979 | `POST /suno/generate` |
| 翻唱（cover） | `runSunoCover` | L4282 | `POST /suno/submit/music` (task=cover) |
| 续写（extend） | `runSunoExtend` | L4313 | `POST /suno/generate` (task=upload_extend) |
| 轮询 | `pollSuno` | L4015 | `GET /suno/feed/{clipIds}` |
| 本地上传 | `_sunoUploadAudio` | L4210 | 5 步：`/suno/uploads/audio` (init/finish/status/initialize-clip) + S3 |

#### 11.9.2 SUNO_MV_MAP 标准映射（8 者一致）

主项目 `index.html L3977` 与本项目后端 [proxy.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) 以及前端 [models.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/providers/models.ts) `SUNO_VERSIONS` 必须保持严格一致：

```js
{ 'v3.0':'chirp-v3.0', 'v3.5':'chirp-v3.5', 'v4':'chirp-v4',
  'v4.5':'chirp-auk', 'v4.5+':'chirp-bluejay', 'v5':'chirp-crow', 'v5.5':'chirp-fenix' }
```

后端 `resolveSunoMv()` 同时兼容带 `suno-` 前缀的旧调用方（如 `'suno-v5.5'`）只需 `String(version).replace(/^suno-/i,'')` 后查表。

#### 11.9.3 后端三条路由

| 路由 | 说明 |
| --- | --- |
| `POST /api/proxy/audio/submit` | body `{ mode, prompt, title, tags, version, seed?, cover_clip_id?, continue_clip_id?, continue_at? }`。cover 响应同时兼容 `code:'success'+data:taskId(string)` 与 `result.id+result.clips`。 |
| `GET  /api/proxy/audio/query?clipIds=&saveLocal=` | 调用上游 `/suno/feed/{ids}`；completed 轨面返回 `{ id, clipId, audioUrl(本地), remoteUrl(原始), imageUrl, title, tags, duration }`。默认 `saveLocal=true` 转存到 `output/audio_*.mp3`。 |
| `POST /api/proxy/audio/upload` | 中间件 `multer.single('file')` 内存接取多部分表单；服务器端 **原生 Node 18+ FormData/Blob** 代理主项目 `_sunoUploadAudio` 5 步流程，返回 `{ clipId, uploadId, filename, size, mime }`。 |

#### 11.9.4 前端 AudioNode 执行范式

[AudioNode](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/AudioNode.tsx) 严格遵循§11.3 执行范式：

1. **mode/version 下拉** — 使用 [SUNO_VERSIONS](file:///e:/PenguinPravite/T8-penguin-canvas/src/providers/models.ts)。默认 `v5.5`。
2. **上游采集** — `collectUpstream()` 同时拾取 `prompt` 与 `audioUrl`；后者作为 cover/extend 的报底参考音频。
3. **本地上传** — `<input type="file" accept="audio/*">` → `uploadAudioForSuno(file)` → 持久化到 `data.uploadedClipId / uploadedFilename`。
4. **起动** — cover/extend 优先用 `uploadedClipId`；没有但上游有 `audioUrl` 时，节点会在提交前 **自动 fetch URL → File → uploadAudioForSuno** 拿到 clipId。
5. **轮询** — 3000ms × 60 次（3 分钟）与主项目默认 `pollInt=3 / maxPoll=60` 对齐。
6. **输出** — `data.audioUrl = tracks[0].audioUrl`（主轨），`data.tracks[]` 保留双轨供页面展示。`PORT_COLOR.audio` (`#c4b5fd`) 驱动港 Handle 颜色。
7. **总线接入** — [`useRunTrigger`](file:///e:/PenguinPravite/T8-penguin-canvas/src/hooks/useRunTrigger.ts) 进入批量运行调度；轮询中不重复唤起。

#### 11.9.5 轮询与转存

* `queryAudio(clipIds, saveLocal=true)` 默认让后端 ·11.2 转存到 `OUTPUT_DIR/audio_*.mp3`，同时返回 `remoteUrl` 供需要原始 URL 的消费者。
* 重复 URL 检测：主项目 `pollSuno` L4057 对两轨同 URL 会重拉。后端未复现此逻辑，如需请在上游拉升轮询次数。

#### 11.9.6 代码定位索引

* 后端路由源：[proxy.js · 音频生成节](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)（搜 `SUNO_MV_MAP` / `/audio/upload`）。
* 前端服务封装：[generation.ts · audio 部分](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts)（`submitAudio` / `queryAudio` / `uploadAudioForSuno`）。
* 节点组件：[AudioNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/AudioNode.tsx)。
* 初始 data：[Canvas.tsx INITIAL_DATA.audio](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)（默认 `mode='generate' / version='v5.5' / continueAt=28`）。

#### 11.9.7 常见坑

| 坑 | 现象 | 防御 |
| --- | --- | --- |
| 后端多部分表单未启用 multer | `req.file` 为 undefined | `audioUpload.single('file')` 中间件必需；文件字段名严格 `file` |
| Cover 响应双格式 | 走 `code:'success'` 拿不到 clipIds | 后端 ·11.9.3 同时兼容 `Array.isArray(data.data)` / `result.clips` 两路径 |
| `'suno-v5.5'` 传入后端 → 查不到 mv | 返回退化 `chirp-fenix` | `resolveSunoMv` 手动 `replace(/^suno-/i,'')` |
| Node 原生 FormData/Blob | 某些环境优先装了 `form-data` 包会覆盖 | 该项目 `package.json` 未装 `form-data`，依赖 Node 18+ 全局 |

---

### 11.10 LLM 节点对齐（gpt-image-2-web Chat·无 FAL）

本小节描述如何对齐主项目 `gpt-image-2-web/index.html` 的 Chat Tab 实现，使本项目 LLM 节点具备：5 模型 / 多模态 / 多轮历史 / 系统提示词预设 / 流式 SSE / `gpt-image-2-all` 自动出图。
**注意：LLM 节点不提供 FAL 模式**，仅走贞贞工坊兼容 OpenAI 协议的 `/v1/chat/completions`。

> **严格复用主项目代码逻辑**（参考 memory · LLM 节点实现规范）：
> 本节点的请求构造 / 响应解析 / 错误处理 / 流式推送 / 中止机制 / 多模态装载 / 自动出图路径，须一一对应主项目 `_doSendChat`（L8128） + `_chatAutoGenImages`（L8316）中的实现，不允许自创另一套逻辑。本文档（skill.md §11.10）为唯一权威参考。

#### 11.10.1 起点函数与上游协议（主项目 `gpt-image-2-web/index.html` 行号）

| 实现 | 主项目位置 | 行号 | 上游接口 / 说明 |
| --- | --- | --- | --- |
| 发送一轮 chat | `_doSendChat` 函数声明 | L8128 | `POST {baseUrl}/v1/chat/completions` |
| 上游 URL 拼装 | `const url = baseUrl + '/v1/chat/completions'` | L8154 | 贞贞工坊 OpenAI 兼容端点 |
| `gpt-image-2-all` 专用非流式分支 | `if(model==='gpt-image-2-all')` | L8157 | `stream:false` 直接收取 image_url |
| 多模态 content 解析 | `if(Array.isArray(content))` | L8170–8182 | `[{type:'text',text} | {type:'image_url',image_url:{url}} | {type:'image',image_url:{url}}]` + `data.data[].url / b64_json` |
| 流式 SSE reader | `const reader = resp.body.getReader()` | L8269 | `data: {choices:[{delta:{content}}]}` 行流；`data: [DONE]` 结束 |
| 流式末尾回调 | `if(msg) _chatAutoGenImages(msg)` | L8313 | 流式输出完成后起动二段出图 |
| JSON 块二段出图 | `_chatAutoGenImages(text)` | L8316 | 正则检测 `"generate_image":[...]` JSON 块 → 调 `/v1/images/generations`（DALL·E） |

#### 11.10.2 5 模型清单（前后端必须一致）

[LLM_MODELS](file:///e:/PenguinPravite/T8-penguin-canvas/src/providers/models.ts) 与主项目 `index.html` chat_model `<select>` 完全对齐：

| modelId | 标签 | vision | stream | imageOutput |
| --- | --- | --- | --- | --- |
| `gemini-3.1-flash-lite-preview`（默认） | Gemini 3.1 Flash Lite | ✓ | ✓ | — |
| `gpt-4o` | GPT-4o | ✓ | ✓ | — |
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro | ✓ | ✓ | — |
| `gpt-5` | GPT-5 | ✓ | ✓ | — |
| `gpt-image-2-all` | GPT Image 2 All（图文） | ✓ | ✗（强制非流式） | ✓ 可返回 image_url |

常量 `DEFAULT_LLM_MODEL = 'gemini-3.1-flash-lite-preview'`；工具函数 `isImageOutputLlm(id)` 用于 UI 禁用流式开关。

#### 11.10.3 后端一条路由（SSE 透传）

[proxy.js · /llm](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)：

| 行为 | 说明 |
| --- | --- |
| 入参 | `{ model, messages, temperature=0.7, max_tokens=4096, stream }` |
| 上游 | `POST {ZHENZHEN_BASE_URL}/v1/chat/completions` + `Authorization: Bearer {llmApiKey}` |
| stream=true | 设置 `Content-Type: text/event-stream` + `X-Accel-Buffering: no`；`r.body.getReader()` → `TextDecoder` → `res.write` 逐块透传，结束 `res.end()` |
| stream=false | 解析 JSON，`choices[0].message.content` 兼容字符串或多模态数组（提取 text/image_url），同时合并 `data.data[].url / b64_json` → `imageUrls[]` |
| 返回 | `{ success, data: { content, imageUrls, raw, model } }` |

#### 11.10.4 前端服务双轨

[generation.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) 同时导出两个函数与多模态类型：

```ts
type LlmContentPart = { type:'text', text:string } | { type:'image_url', image_url:{url:string} }
interface LlmMessage { role:'system'|'user'|'assistant', content: string | LlmContentPart[] }
generateLlm(req): Promise<{ content, imageUrls?, raw, model }>   // 非流式
generateLlmStream(req, { onDelta, signal }): Promise<{ content }> // SSE
fileToDataUrl(file): Promise<string>                              // 本地图片转 dataURL
```

SSE 按行 `split('\n')` 解析；`data: [DONE]` 立即 return；`delta.content` 累加并通过 `onDelta` 回调推送给 UI。

#### 11.10.5 LLMNode 节点 UI 范式

[LLMNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LLMNode.tsx) 采用**左右双列布局**（外层 `flex items-start gap-0`）：

| 列 | 宽度 | 职责 |
|---|---|---|
| 左列·主体 | `w-[320px]` | 模型/参数/系统提示词/用户输入/图片上传/发送按钮，通过 `mainRef` 测量实际高度 |
| 右列·会话面板 | `w-[260px]` | 仅当 `hasChat` 时渲染；`overflow-y-auto` 超长滚动 |

> ⚠️ **底部对齐铁律（必读）**：
>
> 1. 右列 style 必须使用 **`height: mainH + 'px'`**（不是 maxHeight），确保右列与左列等高、底部对齐。
> 2. `mainH` 必须通过 **`useLayoutEffect` + `useState`** 测量，禁止直接在 render 中读取 `mainRef.current.offsetHeight`（首次渲染时 ref 未挂载，值为 undefined 导致高度丢失）。
> 3. `useLayoutEffect` 无依赖数组，每次渲染都重新测量，左列内容变化时右列自动跟随。
> 4. 左列高度为**只读约束**，任何操作禁止修改。
>
> 示例代码：
> ```tsx
> const [mainH, setMainH] = useState<number>(0);
> useLayoutEffect(() => {
>   if (mainRef.current) setMainH(mainRef.current.offsetHeight);
> });
> // 右列: style={{ height: mainH ? `${mainH}px` : undefined }}
> ```

左列必须覆盖以下 8 点，与§11.3 一致：

1. **5 模型下拉** — 来自 `LLM_MODELS`；默认 `DEFAULT_LLM_MODEL`。
2. **参数三件套** — `temperature 0~2 step 0.1`（默认 0.7）/ `max_tokens 100~128000`（默认 4096）/ `stream 开关`（`isImageOutputLlm(model)` 时强制禁用）。
3. **系统提示词 + 预设管理** — `localStorage` key `t8-llm-sys-presets`；UI 下拉 / `Save` / `Trash2` 删除。
4. **本地图片上传** — `<input type="file" multiple accept="image/*">` → `fileToDataUrl` → 缩略图 + ✕ 移除。
5. **上游采集** — `collectUpstream()` 同时拾取 `prompt` 与 `imageUrl/image/url` 单图、`images[]/imageUrls[]` 多图。
6. **多模态消息装配** — `buildMessages(text, imgs)`：`system`（如有）+ 历史轮（兼容图片轮 `LlmContentPart[]`）+ 当前 `user`（文本+图片）。
7. **发送/中止** — 与主项目 `_chatStreamCtrl`（L8152~L8153）对齐：节点内以 `abortRef.current = new AbortController()` 保存句柄，并把 `signal` 透传给 `generateLlmStream`；发送中按钮切换为 `Square` 中止。流式分支走 `generateLlmStream(onDelta)`；非流式（包括 `gpt-image-2-all` 和手动关闭 stream）走 `generateLlm`，取 `imageUrls` 写入 `data.generatedImages` 并下发到下游 image 端口。
8. **总线接入** — [`useRunTrigger`](file:///e:/PenguinPravite/T8-penguin-canvas/src/hooks/useRunTrigger.ts) + [`logBus`](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/logBus.ts)（`info/success/warn/error`）。

端口颜色：输入/输出 text 均使用 `PORT_COLOR.text` = `#7dd3fc`（[portTypes.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/utils/portTypes.ts)）。

#### 11.10.6 「自动出图」两条互补路径

主项目 chat 模块的「自动出图」实际有两条互补路径，本节点须**全部覆盖**以严格复用主项目逻辑：

**路径 A：`gpt-image-2-all` 原生多模态输出**（主项目 L8157–8182）

* `LLM_MODELS` 中 `nonStreaming: true` → UI 自动把 `stream` 强制设为 false 且禁用切换；
* 后端非流式分支按主项目 L8170–8182 顺序抽取 `imageUrls[]`，三种来源严格对齐：
  1. `content[].type === 'image_url'` → `image_url.url`
  2. `content[].type === 'image'` → `image_url.url`
  3. `data.data[]` → `d.url` 或 `'data:image/png;base64,' + d.b64_json`
* 节点把 `imageUrls` 写入 `data.generatedImages` 并通过 image 端口（黄色 Handle）下发到下游 `image-output` 等节点。

**路径 B：通用 LLM 输出 `"generate_image"` JSON 块 → 调 `/v1/images/generations`**（主项目 `_chatAutoGenImages` L8316，由 L8313 触发）

* 适用于 GPT-4o / Gemini 等通用 LLM：模型本身不直接出图，但被系统提示词（主项目 L8140 注入）要求输出 `{"generate_image":true,"prompt":"..."}` JSON 块；
* 流式输出完成后正则检测 `actionMatch = text.match(/"generate_image"\s*:/)`，提取 `prompt` 后调用 `/v1/images/generations`（DALL·E 兼容端点）；
* 本节点实现状态：基础检测已就位（`logBus.warn` 提示发现 generate_image 块），二次调用 images/generations 留作可选增强；如需启用，请在 [LLMNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LLMNode.tsx) `handleSend` 末尾追加调用 [generateImage](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) 服务，并把结果写入 `data.generatedImages`。

> **规范要求**：未来扩展任何新 LLM 模型，必须先判断它属于路径 A 还是路径 B，并在 `LLM_MODELS` 注册表中以 `imageOutput` / `nonStreaming` 字段精确声明。

#### 11.10.7 代码定位索引

* 后端路由：[proxy.js · /llm](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)（搜 `POST /llm`）。
* 前端服务：[generation.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) — `generateLlm` / `generateLlmStream` / `fileToDataUrl`。
* 模型注册：[models.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/providers/models.ts) — `LLM_MODELS` / `DEFAULT_LLM_MODEL` / `isImageOutputLlm`。
* 节点组件：[LLMNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LLMNode.tsx)。
* 初始 data：[Canvas.tsx INITIAL_DATA.llm](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)（`temperature=0.7 / maxTokens=4096 / stream=true / history=[]`）。

#### 11.10.8 常见坑

| 坑 | 现象 | 防御 |
| --- | --- | --- |
| Express 缓冲 SSE | 前端长时间无 delta | 显式 `setHeader('X-Accel-Buffering','no')` + 不要走 `res.json()`，必须 `res.write()` + `res.end()` |
| 前端把多模态 content 误转字符串 | 上游报 `content must be string or array` | `LlmMessage.content: string \| LlmContentPart[]`，渲染历史也按数组兼容 |
| `gpt-image-2-all` 走流式 | 上游直接 400 或空响应 | `isImageOutputLlm` 在节点 UI/payload 双重禁用流式 |
| AbortController 未挂载 | 「中止」按钮无效 | `abortRef.current = new AbortController()` 并把 `signal` 透传给 `generateLlmStream` |
| 系统提示词丢失 | 重开节点后 system 清空 | 写回 `data.system`（持久化在画布 JSON）+ 预设额外存 `localStorage` |

---

### 11.11 Midjourney 节点对齐（gpt-image-2-web `runMJ` · Comfly 渠道 · 无 FAL）

> Midjourney 复用 ImageNode（不新增独立节点类型），与 GPT2 / Nano Banana 2 / Nano Banana Pro 三家共用 [`ImageNode.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx)，通过 `modelDef.paramKind === 'mj'` 切到 MJ 专用面板与 MJ 提交分支。**MJ 没有 FAL 渠道**，仅经贞贞工坊 Comfly 代理。本节是唯一权威参考，请勿自创另一套实现。

#### 11.11.1 起点函数与上游协议（主项目 `gpt-image-2-web/index.html` 行号）

* `runMJ`（L4437–L4716）：MJ 主流程，负责 prompt 拼装、payload 构造、submit、轮询、image_urls JSON string 解析。
* `uploadMJImage`（L4407）：sref/oref 参考图上传换 URL 的独立函数。
* speed_map：`turbo → mj-turbo` / `fast → mj-fast` / `relax → mj-relax`，路径前缀 `${ZHENZHEN}/{speed_seg}/mj/...`。
* 三条上游接口：
  * `POST {ZHENZHEN}/{speed_seg}/mj/submit/imagine` — 提交 imagine 任务
  * `GET  {ZHENZHEN}/{speed_seg}/mj/task/{taskId}/fetch` — 任务轮询
  * `POST {ZHENZHEN}/{speed_seg}/mj/submit/upload-discord-images` — sref/oref 上传

#### 11.11.2 prompt 拼装规则（与 L4467~L4485 严格一致）

顺序固定：`{prompt} --{model} --ar {ar} [--no X] [--c N] [--s N] [--iw N] [--sw N] [--cw N] [--sv N] [--sref URL]... [--oref URL]...`。其中：
* `model`：11 项之一（`v 8.1`(默认) / `v 8` / `v 7` / `v 6.1` / `v 6.0` / `v 5.2` / `v 5.1` / `niji 7` / `niji 6` / `niji 5` / `niji 4`）；带空格直接跟在 `--` 后。
* `ar`：7 个比例（`1:1`(默) / `4:3` / `3:2` / `16:9` / `3:4` / `2:3` / `9:16`）。
* `sv`：`'1'`(默) 时 **不** 输出 `--sv`，仅当 `'2' | '3' | '4'` 时追加。
* `sref/oref`：每张参考图各追加一个 flag，URL 由 `uploadMjImage()` 上传后取得。
* 实现：[`buildMjPrompt()`](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts)。

#### 11.11.3 payload 字段（与 runMJ submit body 严格对齐）

```json
{
  "base64Array": ["data:image/png;base64,..."],
  "instanceId": "",
  "modes": [],
  "notifyHook": "",
  "prompt": "<拼装好的 fullPrompt>",
  "remix": true,
  "state": "",
  "ar": "1:1", "no": "", "c": null, "s": null,
  "iw": null, "tile": false, "r": null, "video": false,
  "sw": null, "cw": null, "sv": null, "seed": null
}
```

* 主参考图 / 垫图：走 `base64Array`（多张）。
* sref / oref：**不进 base64Array**，先 `uploadMjImage()` 换 URL，再以 `--sref / --oref` 拼进 prompt 字符串。
* 后端在 [`POST /api/proxy/mj/imagine`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) 中将上述字段重组上送 Comfly。

#### 11.11.4 响应判定（轮询）

* `data.code === 1` 视为成功；其它 code 视为未就绪 `continue`。
* `data.status === 'FAILURE'` 抛错（取 `fail_reason`）。
* `data.status === 'SUCCESS'`：
  * 主图：`data.image_url`。
  * 4 张子图：`data.image_urls` 可能是 **JSON 字符串**，需 `JSON.parse` 解析为数组（每项形如 `{ url: '...' }` 或纯 string，参 [queryMjTask](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) 兼容写法）。
* URL 域名替换：上游 `ai.comfly.chat` 一次性重写为 `ai.t8star.cn`，由后端代理统一完成。

#### 11.11.5 后端三条独立路由（`backend/src/routes/proxy.js`）

* `POST /api/proxy/mj/imagine` — 透传到 `${ZHENZHEN}/{speed_seg}/mj/submit/imagine`。
* `GET  /api/proxy/mj/task/:id?speed=` — 透传到 `${ZHENZHEN}/{speed_seg}/mj/task/{id}/fetch` 并替换 image URL 域名。
* `POST /api/proxy/mj/upload` — 透传 sref/oref 上传，body `{ base64Data, speed }`，返回 `{ url }`。

#### 11.11.6 前端服务（`src/services/generation.ts`）

* `buildMjPrompt(parts)`：纯函数，按 §11.11.2 顺序拼接。
* `submitMjImagine(req)`：调 `/mj/imagine`，校验 `code===1`，返 `{ taskId, raw }`。
* `queryMjTask(taskId, speed)`：调 `/mj/task/:id`，返 `{ status, progress, imageUrl, imageUrls, failReason, raw }`。
  * **字段全兼容**：`d.image_url || d.imageUrl`，`d.image_urls ?? d.imageUrls`（上游 snake_case 与 camelCase 均可）。
  * **image_urls 三种形态**均可解：JSON 字符串 / 对象数组 `[{url:'...'}]` / 字符串数组 `['...']`，对齐主项目 `runMJ` 的 `x.url || x` 写法（另兼容 `x.image_url / x.imageUrl`）。
* `uploadMjImage(file, speed)`：先 `fileToDataUrl`，再调 `/mj/upload` 取 URL。

#### 11.11.7 ImageNode 节点 UI 范式

[ImageNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx) 通过 `const isMj = modelDef.paramKind === 'mj'` 切换：

1. **隐藏不适用控件**：`isMj` 时 「具体模型」 / 「比例」 / 「尺寸」 三块隐藏（MJ 自有 ar 与 version）。
2. **MJ 专用面板**（紫色边框区）：版本(11) / 比例(7) / 速度(turbo|fast|relax) / `--c` / `--s` / `--iw` / `--sw` / `--sv`(0/1/2/3) / seed / `--no` / maxPoll / pollInt + sref(2 张) / oref(2 张) 上传组。
3. **参考图入口**：`isMj` 时主参考图标签改为「主参考图(垫图)」；上传 input 的 onChange 通过 `mjUploadKindRef.current = 'sref' | 'oref'` 分发到 `handleMjFiles`。
4. **handleGenerate MJ 分支**（紧贴 isFal 之前，与原模型路径互斥）：拉所有 allRefs → fetch+blob+FileReader 转 base64Array → `buildMjPrompt` → `submitMjImagine` → 轮询（默认 300×3s = 15min，可配置 10~2000 与 1~30s）→ `q.status==='SUCCESS'` 时 `imageUrl/imageUrls` 落到 data。
5. **零破坏**：原 GPT2 / 香蕉2 / 香蕉Pro / FAL 路径不动；MJ 状态字段全部 `mj*` 前缀，与 `aspectRatio / sizeLevel / falXxx` 完全隔离。

#### 11.11.8 代码定位索引

* 后端路由：[proxy.js · /mj/imagine|/mj/task|/mj/upload](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)。
* 前端服务：[generation.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) — `buildMjPrompt` / `submitMjImagine` / `queryMjTask` / `uploadMjImage`。
* 模型注册：[models.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/providers/models.ts) — `IMAGE_MODELS[3]=midjourney` / `MJ_VERSIONS` / `MJ_RATIOS` / `MJ_SPEEDS` / `MJ_SVS` / `DEFAULT_MJ_*` / `isMjModel`。
* 节点组件：[ImageNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx) — `isMj` 分支与 MJ 专用面板。

#### 11.11.9 常见坑

| 坑 | 现象 | 防御 |
| --- | --- | --- |
| sref/oref 走错通道 | 把 sref/oref 直接进 base64Array 导致提示词无 `--sref / --oref` | 严格区分：垫图→base64Array；sref/oref→先 upload 取 URL 再拼 prompt |
| `image_urls` 是字符串 / 对象数组 / camelCase | 误报 “MJ 任务完成但未返回图片” | `queryMjTask` 同时读 `image_urls/imageUrls`，对象元素取 `x.url \|\| x.image_url \|\| x.imageUrl \|\| x`；失败时 `ImageNode` 会 `logBus.warn` 输出 `raw` 报文便于定位 |
| `--sv 1` 多余 | 上游不识别报错 | `sv === '0' \|\| sv === '1'` 时 **不** 输出 `--sv` |
| URL 仍是 `ai.comfly.chat` | 浏览器图片加载失败（鉴权域不同） | 后端代理一次性 `replace('ai.comfly.chat','ai.t8star.cn')` |
| FAL 子模型混入 | 误以为 MJ 也有 FAL | MJ **无 FAL**，模型注册表中无 `midjourney-fal` |
| 轮询无上限 | 任务挂起永远轮 | 默认 `maxPoll=300 × 3s = 15min`；UI 可调 10~2000 / 1~30s |

---

## 12. 日志总线 / 终端面板规范

### 12.1 logBus

[`src/stores/logs.ts`](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/logs.ts) 提供双接口：
- 响应式：`useLogStore()` 订阅 entries / open / unread
- 命令式：`logBus.info|success|warn|error|debug(message, source?)`

调用点 = **gpt-image-2-web 中原型调 `log(...)` 的位置**（提交 / 进入轮询 / progress 变化 / 完成 / 失败）。实现参考 [ImageNode.handleGenerate](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx)。

**允许：** 改造其他节点（VideoNode / AudioNode / RunningHubNode / LLMNode 等）时在同样五个时机增加 `logBus.*` 调用，`source` 统一使用 `分类:节点 id 前6位`（如 `video:abc123`）。

**禁止：** 不要在节点 render 函数主体、useEffect deps 变化、父组件 rerender 路径上打日志，会造成狂刷。

### 12.2 TerminalPanel

[`src/components/TerminalPanel.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/TerminalPanel.tsx)：底部抽屉式（`absolute left-3 right-3 bottom-3`），高度 `min(48vh, 420px)`，不遮挡画布交互。备选能力：
- 5 级筛选 · 跟随尾部 · 清空 · ESC 关闭 · X 关闭
- 主题分支：`style==='pixel'` 走糖果风（mint 头 + yellow/pink 徽章 + 黑边硬阴影），否则走科技风（毛玻璃 + 霓虹色级别色）

[`CanvasToolbar.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/CanvasToolbar.tsx) 末尾附加 **终端按钮**：`useLogStore.toggleOpen()`，未读数额以双主题色徽章显示。

---

## 13. 节点改造原则（强约束）

> 以下原则适用于后续 **任何** 节点迭代、对齐外部项目、增加参数、修复 Bug 的工作。违反任何一条都可能造成 **原本已实现的功能被静默破坏**。

### 13.1 参数以参考项目为准，不要写死
- **错误示例：** 把 `aspectRatio` / `image_size` 等字段名写死在代码另一侧。
- **正确示例：** 每次改造先读参考项目 `index.html`，字段名、枚举值大小写、查询参数、是 multipart 还是 JSON、是否传空串，完全复制。
- **主项目参考位置：** [`gpt-image-2-web/index.html`](file:///e:/PenguinPravite/gpt-image-2-web/index.html)。

### 13.2 增量改动，不要重写整个路由/节点
- 优先抽取 helper 复用（如 [callImageUpstreamAsync](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)），**不要** 复制一份同步代码 + 一份异步代码走两条路。
- 修改节点 UI 时保留原有的父组件 contract（props / ref / `onMouseDown` 防拖拽冒泡等）。
- 修改 stores 时保留原有订阅字段名，只加不减。

### 13.3 双主题必须同步考虑
- 任何新 UI 均需加 `style === 'pixel'` 分支，否则像素风下会漏样式。
- 像素风主色使用 mint（薄荷绿） + yellow + pink，全局类名以 `var(--px-*)` 为准，详见 [theme-pixel.css](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles)。

### 13.4 连接校验不要调松
- [`portTypes.ts`](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/portTypes.ts) 中定义的端口语义不得随意删除或放宽，需增加节点时补全该节点的输入输出类型后再注册。
- Canvas.tsx 的 `isValidConnection` 不要提前绕过。

### 13.5 批量运行总线的接入
- 可执行节点必须 `useRunTrigger(id, runFn)` 接入，且 `runFn` 需与“点击生成”为同一个函数。
- 节点内部以 `try/catch` 消化异常，使 `markDone(id, true)` 始终可调，不会阻塞 `handleRunAll` 的拓扑串行。

## 13.6 验收清单（必跑）
1. `npx tsc --noEmit`
2. 后端启动无语法错（`node -e "require('./src/routes/proxy')"`）
3. **端到端**：提交后验证 `taskId` 是真的，轮询能拿到 `urls`，上游后台能看到异步任务。
4. 双主题选择“像素” 与 “科技” 各看一眼控件是否文本/底色选中态都正常。

---

## 14. 节点组容器（GroupBox / 打组功能）

> 设计参考：主项目 [`PebblingCanvas/NodeGroupBox.tsx`](file:///e:/PenguinPravite/components/PebblingCanvas/NodeGroupBox.tsx)（SVG 实现）。T8 用 ReactFlow（DOM 节点），不能直接复用 SVG 版本，需用 `div + flex` 重写为 ReactFlow 自定义节点类型。

### 14.1 三层解耦架构

ReactFlow 自定义节点（`NodeProps`）拿不到外部 Canvas 作用域里的回调（如 `handleRunGroup`、`setNodes`），不能写死 import 引入循环。**必须**走总线模式：

```
GroupBoxNode (UI)  ──触发──▶  groupBus store (请求总线 ts 时间戳)  ──监听 useEffect──▶  Canvas (执行/删除)
```

- [`src/stores/groupBus.ts`](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/groupBus.ts)：`executeReq` / `deleteReq` 字段为 `{ ts, ... }`，`requestExecute` / `requestDelete` 写入新 ts，Canvas 用 `useEffect(..., [executeReq?.ts])` 触发后调 `clearExecute()` 防重入。
- [`src/components/nodes/GroupBoxNode.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/GroupBoxNode.tsx)：用 `useReactFlow().setNodes` 改自身 data（颜色 / 名字），通过 `useGroupBusStore.getState().requestExecute / requestDelete` 触发 Canvas 行为。
- [`src/components/Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)：注册 `nodeTypes.groupBox = GroupBoxNode` + `handleCreateGroup` + 拖动联动 + useEffect 监听总线。

### 14.2 GroupBox 节点设计要点

| 关键属性 | 值 | 原因 |
|---|---|---|
| `type` | `'groupBox'` | 注册到 `nodeTypes` |
| `zIndex` | `-1000` | 置于普通节点之下；取 **-1000** 而非 -1 是为了抵消 ReactFlow 选中节点 +1000 提升后还能跨过组容器（需同时在 ReactFlow 上设 `elevateNodesOnSelect={false}` 彻底禁止提升，避免选中组后成员被遵掩）|
| `connectable` | `false` | 不参与连线校验，避免污染 `portTypes` |
| `deletable` | `true` | 支持 Delete 键删除 |
| `draggable` / `selectable` | `true` | 可被框选可拖动 |
| `data.memberIds` | `string[]` | 成员节点 id，dangling 容错由消费侧 `idSet.has(n.id)` 过滤 |
| `data.name` | 默认 `'My favourite girl is Go Younjung'`（常量 [`DEFAULT_GROUP_NAME`](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/groupBus.ts)）| 双击标题进入输入框模式 |
| `data.color` | 从 [`GROUP_COLORS`](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/groupBus.ts) **12 色**随机 | 顶部颜色点点击可换色（与主项目 NodeGroupBox.GROUP_COLORS 对齐）|
| 内部按钮 | `className="nodrag"` + `onMouseDown stopPropagation` | 防止 ReactFlow 把按钮点击当作节点拖拽 |

### 14.3 拖动联动 delta 法

**不能**用 ReactFlow 的 parentNode 父子嵌套（会破坏成员的绝对坐标和现有连线相对参考）。改用 `onNodeDrag` 顶部拦截 + ref 计算每帧 delta：

```ts
if (node.type === 'groupBox') {
  const ref = groupDragRef.current;
  if (!ref || ref.groupId !== node.id) {
    groupDragRef.current = { groupId: node.id, lastX: node.position.x, lastY: node.position.y };
    return;
  }
  const dx = node.position.x - ref.lastX;
  const dy = node.position.y - ref.lastY;
  if (dx === 0 && dy === 0) return;
  ref.lastX = node.position.x; ref.lastY = node.position.y;
  const idSet = new Set((node.data as any)?.memberIds ?? []);
  setNodes(prev => prev.map(n =>
    idSet.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n));
  return;
}
```

`onNodeDragStop` 中 `groupDragRef.current = null;` 清理。

### 14.4 打组创建 (handleCreateGroup)

- 入参：`ids: string[]`（来自右键菜单选区）。
- 过滤：`n.type !== 'groupBox'` —— **禁止嵌套**，组里不能再套组。
- bounding box：`PAD = 30`、`HEADER = 40`，`groupX = minX - PAD`、`groupY = minY - PAD - HEADER`，让标题栏浮在成员上方。
- 新组节点 unshift 进 nodes 头部并清空其它 selected。

### 14.5 组执行复用拓扑

- 不在 `EXECUTABLE_NODE_TYPES` 加 `groupBox` —— 让全局批量运行自动跳过组容器。
- 组执行直接调 Canvas 已有的 `handleRunGroup(memberIds)`（从右键菜单"组执行"复用而来），它会对子图做拓扑排序后串行触发。
- 已删除成员通过 `nodes.filter(n => idSet.has(n.id))` 自然过滤，不报错。

### 14.6 双主题样式分支

```ts
const outerStyle = isPixel
  ? { border: `3px solid ${selected ? '#3B82F6' : '#1A1410'}`, borderRadius: 14, boxShadow: `4px 4px 0 ${color}` }  // 像素风：硬阴影
  : { border: `2px solid ${color}`, borderRadius: 16, boxShadow: selected ? `0 0 0 2px ${color}33, 0 8px 32px rgba(0,0,0,.18)` : `0 4px 18px rgba(0,0,0,.14)`, backdropFilter: 'blur(2px)' };  // 科技风：柔光 + 模糊
```

半透明底色用 `${color}26` （HEX 8 位 alpha = **15%**） 让组内成员仍能透出底色与背景。调高会遮住节点，调低会看不出色块。

#### 像素风全局白底规则排除（重要 ⚠️）

[`src/styles/theme-pixel.css`](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/theme-pixel.css) 中有两条用 `!important` 强刷节点根 `<div>` 的规则（为了让所有业务节点在像素主题下统一白底糖果色）。必须用 `:not(.react-flow__node-groupBox)` 排除组容器，否则 `GroupBoxNode` 的 inline `bodyBg` 会被覆盖成不透明白色：

```css
/* 错误：会覆盖 GroupBox 透明底 */
html[data-theme-style="pixel"] .react-flow__node > div:first-child { background: var(--px-surface) !important; }

/* 正确：排除 groupBox */
html[data-theme-style="pixel"] .react-flow__node:not(.react-flow__node-groupBox) > div:first-child {
  background: var(--px-surface) !important;
  ...
}
html[data-theme-style="pixel"] .react-flow__node.selected:not(.react-flow__node-groupBox) > div:first-child {
  outline: 3px dashed var(--px-pink-deep) !important;
  ...
}
```

后续新增任何「结构上能被业务节点区分」的画布辅助节点类型时，都需同步在该选择器中添 `:not(.react-flow__node-XXX)`。

### 14.6.1 组容器 4 角缩放手柄

- 在 `<div style={outerStyle}>` 内部 4 个角绝对定位的 16×16 热区（偏移 -7px 跨边），中间放一个小色块/色点作为视觉提示。
- `cursor`：`tl` / `br` = `nwse-resize`；`tr` / `bl` = `nesw-resize`。
- 默认小色块 8px 透明度 0.55；悬停或选中时 12px 不透明（过渡 120ms）。像素风：黑色方块 + 组色边框 + 1px 硬阴影；科技风：组色圆点 + 白边 + 柔阴。
- `className="nodrag"` + `onMouseDown` 里 `e.stopPropagation() / preventDefault()` 防 ReactFlow 误作为节点拖拽。
- **拖拽逻辑**（`startResize(corner)`）：
  - 记录 `startX/Y/W/H/posX/posY` 与当前 `getZoom()`
  - 全局 `mousemove`：`dx = (clientX - startX) / zoom`（屏幕 → 画布坐标换算）
  - 按角位调整：
    - `br`: `width += dx`, `height += dy`
    - `bl`: `width -= dx`, `height += dy`, `position.x += dx`
    - `tr`: `width += dx`, `height -= dy`, `position.y += dy`
    - `tl`: `width -= dx`, `height -= dy`, `position.x += dx`, `position.y += dy`
  - 最小尺寸 `MIN_W=160 / MIN_H=100`；封顶后 **补正 position** 避免拖越后反向跳动
  - `mouseup` 移除监听
- **不联动成员**：组容器只是视觉框，缩放仅改自身 `width/height/position`；成员可超出边界，与主项目 `NodeGroupBox` 一致。

### 14.7 验收清单
1. 框选多个普通节点 → 右键 → "打组" → 出现颜色框；标题栏可双击改名；颜色点点击可换色。
2. 拖拽组容器，组内所有成员同步位移；松手不残留 ref（再拖另一个组不会从老位置开始）。
3. 右上角 ▶ 触发 `handleRunGroup`，按拓扑顺序跑完。
4. 右上角 X 仅删除组容器本身，成员节点保留。
5. 删除组内某成员后再点 ▶，不报错（dangling 容错）。
6. 双主题（科技 / 像素）切换样式正常；**选中组后成员节点仍可见**（验证 `elevateNodesOnSelect={false}` + `zIndex: -1000` + `:not(.react-flow__node-groupBox)` 三重保护生效）。
7. 鼠标悬停组的 4 角 → 小色块高亮 + cursor 变为 `nwse-resize` / `nesw-resize`；拖动可拉大拉小。拖到最小尺寸后不会反向跳动。

---

## 15. 右键画布快速添加菜单（paneMenu）

### 15.1 交互设计

- 触发：右键点击画布**空白**区（`onPaneContextMenu`）。如果右键落在节点 / Handle / Edge 上则走 `onNodeContextMenu` / `onSelectionContextMenu`（另一个菜单体系），互不干扰。
- 菜单项：[`NODE_REGISTRY`](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/nodeRegistry.ts) 中 `category === 'input' \|\| category === 'core'` 过滤出的 7 个高频节点：`upload / text / image / video / seedance / audio / llm`。
- 图标：`import * as LucideIcons from 'lucide-react'` + `(LucideIcons as any)[meta.icon] || LucideIcons.Box`，与 [Sidebar.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Sidebar.tsx) 同源动态查，**保证两处图标一致**。
- 颜色：内置 `COLOR_HEX` 映射表将 nodeRegistry 里的 Tailwind 调色名（`sky / amber / rose / fuchsia / violet / emerald / cyan / indigo / orange / pink / slate`）转为 HEX，供圆形色块图标背景使用。
- 定位：`position: fixed` + `left/top = clientX/Y`，边界保护 `Math.min(x, innerWidth - 220)` / `Math.min(y, innerHeight - 360)`。遵循[画布右键菜单定位规范](file:///e:/PenguinPravite/T8-penguin-canvas/skill.md)。
- 关闭：点击遮罩层 / 点击菜单项后 / 右键遮罩。

### 15.2 点击后节点生成位置

```ts
onClick={() => {
  const at = { x: paneMenu.x, y: paneMenu.y };  // 快照点击位置
  closePaneMenu();
  addNode(meta.type as NodeType, at);            // 传入 atScreen
}}
```

[`addNode`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 识别到 `atScreen` 后：
```ts
position: atScreen
  ? { x: center.x, y: center.y }                 // 左上角对准鼠标
  : { x: center.x - 160 + jitter, y: center.y - 100 + jitter2 }; // Sidebar: 中心对齐视口中心
```
`center = screenToFlowPosition({ x, y })` 将屏幕坐标转为画布坐标，不受画布缩放 / 平移影响。

### 15.3 验收清单

1. 右键画布任意位置（包括贴近 sidebar / 右下角）菜单均贴鼠标弹出，不走到极远位置。
2. 点击任意 7 个节点项，节点出现位置与右键点击位置重合（左上角）；连续右键不同位置加节点，节点不重叠。
3. 双主题下菜单样式正常（科技：毛玻璃深色；像素：糖果黄底 + 黑边硬阴影）。
4. 右键画布 → 出现菜单后再右键另一位置，菜单重新定位不重叠。
5. 左侧 Sidebar 点击添加节点仍出现在视口中心（两个入口策略不互相破坏）。

---

## 16. 画布节点添加与菜单定位总结

> 本节是项目「画布交互 UI 定位」的唯一规范，后续任何弹出 / 添加节点类型的交互都需遵循。

### 16.1 坐标三重体系

| 坐标系 | 含义 | API |
|---|---|---|
| **屏幕坐标** | 鼠标事件 `clientX/Y`，相对视口 (0,0) | `e.clientX`, `e.clientY` |
| **画布坐标** | ReactFlow 世界坐标，受缩放/平移影响 | `screenToFlowPosition({ x, y })` |
| **节点 position** | 节点左上角在画布坐标系中的位置 | `node.position = { x, y }` |

### 16.2 三种入口的定位策略

| 入口 | 期望 | 实现 |
|---|---|---|
| 左侧 Sidebar 点击 | 节点中心 = 画布容器中心 | 取 `.react-flow` 容器 `getBoundingClientRect()` 中心 → `screenToFlowPosition` → 减去半宽半高 (160, 100) |
| 右键画布菜单项 | 节点左上角 = 鼠标点击位置 | `clientX/Y` → `screenToFlowPosition` → 不减偏移 |
| 拖线到空白创建 | 节点左上角 = 鼠标拖落位置 | 同上 |

### 16.3 弹层 / 菜单定位原则

- **一律用 `position: fixed`**，不用 `absolute`。原因：Canvas 根容器 `<div className="flex-1 relative">` 位于侧栏右侧，`absolute` 会被偏移一个 sidebar 宽度。
- 菜单 `left/top` 直接使用 `clientX/Y`。
- 边界保护：`Math.min(x, innerWidth - menuW)` / `Math.min(y, innerHeight - menuH)`。
- 遮罩层同样用 `fixed inset-0 z-30`，菜单本体 `z-40`，点击遮罩关闭。
- 选区菜单（contextMenu）与画布菜单（paneMenu）是两个独立 state，同时只能存在一个。

---

## 17. Handle（端口）渲染规范与像素风兼容

### 17.1 Handle 位置与层级

| 要素 | 要求 | 说明 |
|---|---|---|
| 定位层 | **外层容器 div** 内的直接子级 | Handle 必须放在节点最外层容器中，不能嵌套在内部面板内，否则双列布局下连接点位置会偏移 |
| z-index | **`!z-10`** | Handle 必须浮在节点主体面板之上，否则会被 `box-shadow` / `border` / 背景遮挡 |
| className 不用 inline style | `className="!bg-sky-300 !border-0 !z-10"` | 禁止用 `style={{ background, width, height }}` —— 会阻止像素风 CSS 覆盖 |

### 17.2 像素风 Handle 样式（theme-pixel.css 第 494–506 行）

```css
html[data-theme-style="pixel"] .react-flow__handle {
  width: 10px !important;
  height: 10px !important;
  border-radius: 2px !important;
  border: 2px solid var(--px-ink) !important;
  background: var(--px-yellow) !important;
}
.react-flow__handle.target { background: var(--px-mint) !important; }
.react-flow__handle.source { background: var(--px-pink) !important; }
```

任何节点的 Handle 在像素风下必须是：**target=薄荷绿方块** / **source=粉色方块** / **2px 黑边** / **2px 圆角（方形）**。若看到 Handle 变成白色卡片样式或不可见，说明被其他 CSS 选择器覆盖（见 §17.3）。

### 17.3 CSS 特异性踩坑：LLM 节点双列 Handle 被覆盖

**问题**：像素风 CSS 选择器 `.react-flow__node-llm > div:first-child > div` 会匹配到 Handle 元素（因为 Handle 渲染为 div.react-flow__handle），将其强制设为卡片样式（白底+黑边+硬阴影）。

**修复**：加 `:not(.react-flow__handle)` 排除：

```css
html[data-theme-style="pixel"] .react-flow__node-llm > div:first-child > div:not(.react-flow__handle) {
  /* 只影响主体面板和聊天面板，不影响 Handle */
}
```

**规则**：任何新的像素风 CSS 选择器如果会匹配到节点内部的 `div`，必须显式排除 `.react-flow__handle`。

### 17.4 端口类型与色彩映射

| PortType | 颜色 HEX | Tailwind | 节点 |
|---|---|---|---|
| `text` | `#7dd3fc` | sky-300 | text / llm / idea / bp / cinematic / video-motion |
| `image` | `#fcd34d` | amber-300 | image / upload(image) / resize / upscale / grid-crop / combine / remove-bg / edit / drawing-board / storyboard-grid / multi-angle-3d / panorama-720 / penguin-portrait |
| `video` | `#fda4af` | rose-300 | video / seedance / frame-extractor / video-output |
| `audio` | `#c4b5fd` | violet-300 | audio / upload(audio) |
| `metadata` | `#67e8f9` | cyan-300 | portrait-metadata |
| `config` | `#a5b4fc` | indigo-300 | rh-config / runninghub |
| `any` | `#cbd5e1` | slate-300 | relay |

**连接校验**：`arePortsCompatible(sourceOutputs, targetInputs)` —— 两侧端口类型集合必须有交集，或任一侧含 `any`。

---

## 18. LLM 节点双列布局与双击编辑实现规范

### 18.1 双列架构

```
╔═════════════════════════════════════════════════════════════════╗
║ div.relative.flex.items-start.gap-0  (外层容器)                 ║
║                                                                   ║
║  [Handle target !z-10]         [Handle source !z-10]              ║
║                                                                   ║
║  ┌─ 左列 w-[320px] ──────┐    ┌─ 右列 w-[260px] ─────┐      ║
║  │ 模型 / 参数 / 提示词    │    │ 会话历史            │      ║
║  │ 图片上传 / 发送按钮  │    │ 双击编辑模式        │      ║
║  │ ref=mainRef          │    │ height=mainH          │      ║
║  └─────────────────────┘    └────────────────────┘      ║
╚═════════════════════════════════════════════════════════════════╝
```

**关键实现**：

```tsx
// 外层容器
return (
  <div className="relative flex items-start gap-0">
    <Handle type="target" position={Position.Left} className="!bg-sky-300 !border-0 !z-10" />
    <Handle type="source" position={Position.Right} className="!bg-sky-300 !border-0 !z-10" />
    {/* 左列主体 */}
    <div ref={mainRef} className="w-[320px] ..." />
    {/* 右列会话 */}
    {hasChat && <div style={{ height: mainH ? `${mainH}px` : undefined }} ... />}
  </div>
);
```

### 18.2 高度同步铁律

| 规则 | 实现 | 原因 |
|---|---|---|
| 右列 height = 左列 offsetHeight | `style={{ height: mainH + 'px' }}` | 确保底部对齐 |
| `mainH` 必须用 `useLayoutEffect` + `useState` | 见下方代码 | 首次渲染时 ref 未挂载，直接读为 undefined |
| `useLayoutEffect` 无依赖数组 | 每次渲染重新测量 | 左列内容变化时右列自动跟随 |
| 禁止修改左列高度来适配右列 | 左列为只读约束 | 防止布局死循环 |

```tsx
const [mainH, setMainH] = useState<number>(0);
useLayoutEffect(() => {
  if (mainRef.current) setMainH(mainRef.current.offsetHeight);
});
```

### 18.3 双击编辑功能

| 要素 | 实现 |
|---|---|
| 双击触发 | 右列 assistant 消息 `onDoubleClick={() => handleDoubleClickMsg(i)}` |
| 编辑状态 | `editingIdx: number \| null` + `editText: string` |
| 编辑模式 UI | 整个右列切换为 `flex flex-col` + 单个 textarea `flex-1` 擑满面板 |
| 保存 | `onBlur` 自动保存，更新 history + 同步最后 assistant 消息到 `data.prompt` 输出 |
| 取消 | `Escape` 键取消编辑，不保存 |
| 单滚动条 | 编辑时隐藏所有历史消息，仅渲染 textarea，避免父容器 + textarea 双滚动条 |

**关键代码模式**：
```tsx
// 右列容器 className 根据编辑状态切换
className={`... ${editingIdx !== null ? 'flex flex-col' : 'overflow-y-auto space-y-1.5'}`}

// 内容区域三元切换
{editingIdx !== null ? (
  <textarea className="w-full flex-1 resize-none ... overflow-y-auto" />
) : (
  <>{/* 正常历史消息列表 */}</>
)}
```

### 18.4 禁止事项

- 禁止给编辑框加 `backdropFilter: 'blur(...)'`（会导致文字模糊）
- 禁止在右列和 textarea 同时设置 `overflow-y-auto`（双滚动条）
- 禁止给 textarea 设置 `style={{ height: mainH }}` + 右列也有 `overflow-y-auto`（上一版导致双滚动条的根因）
- Handle 禁止放在左列主体 div 内部（会导致连接点偏移到主体中央而非整体左右两侧）

---

## 19. 像素风主题 CSS 规范与踩坑总结

### 19.1 设计原则

- 触发条件：`html[data-theme-style="pixel"]`
- 变量体系：`--px-bg` / `--px-surface` / `--px-ink` / `--px-mint` / `--px-pink` / `--px-yellow` / `--px-sky` 等
- 全局强制覆盖：通过高特异性 + `!important` 将所有科技风暗色节点转为奶油白底 + 糖果色

### 19.2 关键 CSS 规则级别

| 规则 | 用途 | 特异性级别 |
|---|---|---|
| `.react-flow__node:not(.react-flow__node-groupBox) > div:first-child` | 节点根元素白底 + 黑边 + 硬阴影 | (0,0,3,3) |
| `.react-flow__node-llm > div:first-child > div:not(.react-flow__handle)` | LLM 双列子面板 | (0,0,4,3) |
| `.react-flow__handle` | Handle 小方块样式 | (0,0,2,1) |
| `.react-flow__handle.target / .source` | target=mint / source=pink | (0,0,3,1) |

### 19.3 常见踩坑清单

| 坑 | 现象 | 修复 |
|---|---|---|
| 新节点内部 div 被强制白底 | 暗色 `bg-white/5` 等无效 | 正常行为，像素风就是白底 |
| GroupBox 透明底被覆盖 | 组容器变不透明 | 选择器加 `:not(.react-flow__node-groupBox)` |
| Handle 变成卡片样式 | 连接点变成白色大块 | 加 `:not(.react-flow__handle)` |
| 节点文字色异常 | `text-white/80` 变成黑色 | `[class*="text-white/"]` 规则将其转为 `--px-ink-soft`，正常行为 |
| button 颜色不对 | `bg-orange-500/20` 等浅色按钮在奶油底上看不清 | 全局 `button.w-full` 强制 mint 糖果背景 |
| inline style 覆盖了像素风 | `style={{ background: 'xxx' }}` 优先级最高 | 改用 Tailwind className，让像素风 CSS `!important` 可以覆盖 |
| 滚动条太粗 | 像素风下滚动条很明显 | 已设置 `scrollbar-width: thin` + `width: 2px` |

### 19.4 新增节点时像素风检查清单

1. 背景色不用 `style={{ background }}` —— 用 Tailwind class 或让像素风 CSS 统一覆盖
2. Handle 只用 `className` 不用 inline style，并加 `!z-10`
3. 如果节点有双列/多 div 布局，检查 `.react-flow__node-xxx > div:first-child > div` 是否会误伤 Handle
4. 组容器类型节点必须在全局选择器中用 `:not()` 排除

---

## 20. 连接点与端口设计规范

### 20.1 单端口 vs 多端口

| 节点 | 输入 | 输出 | 说明 |
|---|---|---|---|
| 多数节点 | 1×target(Left) | 1×source(Right) | 默认单端口 |
| AudioNode | 1×target(Left) | 2×source(Right): `audio-0` / `audio-1` | 双轨输出 |
| SeedanceNode | 4×target(Left): text/image/video/audio | 1×source(Right) | 多类型输入 |
| RunningHubNode | 5×target(Left) | 2×source(Right): image/video | 最多端口的节点 |

### 20.2 多 Handle 定位策略

当节点有多个同侧 Handle 时，用 `top` 百分比分散：

```tsx
<Handle id="audio-0" position={Position.Right} style={{ top: '33%' }} />
<Handle id="audio-1" position={Position.Right} style={{ top: '66%' }} />
```

下游节点 `collectUpstream` 通过 `edge.sourceHandle` 区分来源。

### 20.3 上游数据采集模式

所有可执行节点内部的 `collectUpstream()` 函数遍历：
1. `getEdges().filter(e => e.target === id)` —— 获取所有指向当前节点的边
2. 通过 `edge.source` 找到上游节点
3. 从 `node.data` 中提取 `prompt` / `imageUrl` / `videoUrl` / `audioUrl` 等
4. 多 Handle 场景用 `edge.sourceHandle` 匹配字段

---

## 21. 项目约定与注意事项汇总

### 21.1 文件结构补充（src/components/nodes 全部 30 文件）

```
nodes/
├── useUpdateNodeData.ts    # 共享 hook：获取 setNodes 并封装 update(patch) 便捷方法
├── LLMNode.tsx             # 核心 | 656 行 | 双列布局 + 双击编辑 + SSE流式
├── ImageNode.tsx           # 核心 | 51KB | GPT2/NanoBanana/Pro/FAL/MJ 五套面板
├── VideoNode.tsx           # 核心 | Veo3.1/Grok/FAL 三套
├── SeedanceNode.tsx        # 核心 | 独立节点(2.0+)，多 role 参考图/视频/音频
├── AudioNode.tsx           # 核心 | Suno 三模式 + 双轨输出
├── RunningHubNode.tsx      # 核心 | ComfyUI 工作流任务
├── GroupBoxNode.tsx        # 特殊 | 组容器(打组)
├── UploadNode.tsx          # 输出素材 | 图片/视频/音频自适应
├── OutputNode.tsx          # 输出素材 | 上游 文本/图像/视频/音频 终端预览（原始宽高比 + 文本双击编辑）
├── TextNode.tsx            # 输入 | 纯文本提示词
├── DrawingBoardNode.tsx    # 工具 | 手绘画板
├── BrowserNode.tsx         # 工具 | iframe 网页
├── ImageCompareNode.tsx    # 工具 | 图片对比
├── FrameExtractorNode.tsx  # 工具 | 视频抽帧
├── ResizeNode.tsx          # 工具 | 缩放
├── UpscaleNode.tsx         # 工具 | 超分辨率
├── GridCropNode.tsx        # 工具 | 网格裁剪
├── CombineNode.tsx         # 工具 | 拼接
├── RemoveBgNode.tsx        # 工具 | 去背景
├── ImageOpFrame.tsx        # 工具 | 通用图像操作框架
├── PresetImageNode.tsx     # 特殊 | 多角度/全景/企鹅胖像
├── PortraitMetadataNode.tsx# 特殊 | 胖像元数据
├── StoryboardGridNode.tsx  # 特殊 | 分镜网格
├── IdeaNode.tsx            # 辅助 | 灵感输入
├── BpNode.tsx              # 辅助 | 分镜处理
├── RelayNode.tsx           # 辅助 | 中继透传
├── VideoOutputNode.tsx     # 辅助 | 视频输出展示
├── ToolboxParamNode.tsx    # 工具箱 | 电影感/动态参数
└── PlaceholderNode.tsx     # 占位符
```

### 21.2 Store 清单

| Store | 文件 | 职责 |
|---|---|---|
| useCanvasStore | stores/canvas.ts | 画布列表 CRUD |
| useApiKeyStore | stores/apiKeys.ts | 三套 API Key |
| useThemeStore | stores/theme.ts | 浅/深色 + 科技/像素双主题 |
| useRunBusStore | stores/runBus.ts | 批量运行调度 |
| useLogStore | stores/logs.ts | 日志总线 + 终端面板 |
| useGroupBusStore | stores/groupBus.ts | GroupBox 执行/删除请求 |

### 21.3 Hooks 清单

| Hook | 文件 | 职责 |
|---|---|---|
| useCanvasHistory | hooks/useCanvasHistory.ts | Undo/Redo 栈(250ms节流) |
| useRunTrigger | hooks/useRunTrigger.ts | 节点订阅运行总线，命中自身则执行 runFn |
| useUpdateNodeData | nodes/useUpdateNodeData.ts | 节点内部更新 data 的便捷方法 |

### 21.4 全局约定

| 约定 | 说明 |
|---|---|
| 前端端口 | `5180`（Vite dev server） |
| 后端端口 | `18766`（Express） |
| Vite 代理 | `/api/*` → `http://127.0.0.1:18766` |
| 数据目录 | `data/`（画布JSON） / `input/`（上传） / `output/`（生成产物） / `thumbnails/` |
| 节点内部防拖拽 | `onMouseDown={(e) => e.stopPropagation()}` 必加在可交互区域 |
| 节点内部防滚轮缩放 | **全局自动拦截**：[`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 启动 [`installGlobalWheelBlockObserver`](file:///e:/PenguinPravite/T8-penguin-canvas/src/utils/wheelBlock.ts)，以 MutationObserver 自动给 `.react-flow` 下所有 `input / textarea / select / [contenteditable]` 挂 `wheel.stopPropagation()`（capture + bubble 双拦截，仅 `stopPropagation`不 `preventDefault`，保留原生文本滚动）。**新节点 / 新控件加上去不需任何额外代码**。历史中个别节点如 LLM 节点内部仍保留了本地 `attachWheelBlock(el)` 调用，通过同一个 `__wheelBlocked` 标记位保证幂等，不会重复挂载 |
| 节点内部防滚轮（滚动容器） | 可选调 [`attachWheelBlock(el)`](file:///e:/PenguinPravite/T8-penguin-canvas/src/utils/wheelBlock.ts)，适用于需要防护但不是 input/textarea/select/contenteditable 的滚动容器（如会话面板外层 div） |
| 节点状态字段 | `data.status: 'idle' \| 'generating' \| 'success' \| 'error'` |
| 默认系统提示词 | `你是一个提示词专家，将用户的提示词优化` |
| logBus 调用时机 | 提交 / 轮询中 / 完成 / 失败 / 警告 五个点 |
| 批量运行接入 | `useRunTrigger(id, handleSend)` —— runFn 必须与手动点击“发送”同一函数 |
| IDE TS 报错 | `./useUpdateNodeData` / `../../hooks/useRunTrigger` 找不到模块 → **IDE 缓存问题**，`tsc --noEmit` 实际编译零错误 |

### 21.5 Git 工作流

- 主分支：`main`
- 推送命令：`git add -A && git commit -m "..." && git push origin main`
- 恢复到远程最新：`git fetch origin main && git reset --hard origin/main`
- 禁止强制推送 `--force`

### 21.6 开发环境注意事项

 项目 | 说明 |
|---|---|
| Node 版本 | 18+ （依赖原生 FormData/Blob） |
| 后端无热重载 | `backend/package.json` 的 `dev` 是 `node src/server.js`，修改后端代码必须手动重启 |
| Windows 目录重命名 | 常因进程占用失败，改用 `git reset --hard` 替代 |
| Tailwind JIT | 新的 class 在开发服务器运行时自动生成，但必须在 tsx 中写完整 class名（不能字符串拼接） |
| Sharp (imageOps) | 后端图像处理依赖 sharp，首次 `npm install` 会编译原生模块 |

---

## 22. xyflow 渲染稳定性 / 死循环踩坑总结（v1.2.x）

> 本章为 2026-05-23 排查「OutputNode + RelayNode 触发 Maximum update depth exceeded 白屏」全过程沉淀的硬核经验，所有节点开发都必须遵守。

### 22.1 现象与症状

- 现象：进入特定画布瞬间整页白屏，仅左侧 Sidebar 残留；F12 Console 抛 `Uncaught Error: Maximum update depth exceeded`，调用栈关键节点：
  ```
  forceStoreRerender → @xyflow_react.js:6297 (Set.forEach) → setState → setNodes → @xyflow_react.js:6586 (StoreUpdater.useIsomorphicLayoutEffect)
  ```
- 触发画布：含 `RelayNode → OutputNode` 的链路（任何节点拓扑只要踩中下面任一陷阱都可能复现）。

### 22.2 真正的根因（已修复 commit 5aac649）

[`RelayNode.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RelayNode.tsx) 中的自动透传 `useEffect(() => {...})` **没有 deps 数组**：

```tsx
// ❌ 反例：每次 render 都跑
useEffect(() => {
  // 读上游 → merged → if (cur !== next) update(merged)
});
```

死循环路径：
1. 节点 mount → useEffect 跑 → `update(merged)` → 走 useReactFlow().setNodes（写入 batchContext.nodeQueue）
2. BatchProvider 处理队列 → 触发 onNodesChange → Canvas 的 useState setNodes → store 更新
3. store 通知所有订阅者 → 节点自身 re-render
4. **没有 deps**，useEffect 又执行 → 又调一次 update → 又触发 setNodes → 进入风暴

#### 修复模板（**所有"自动透传 / 上游聚合"型节点必须遵守**）

```tsx
const upstreamSignature = useMemo(() => {
  const edges = getEdges();
  const nodes = getNodes();
  return edges
    .filter((e) => e.target === id)
    .map((e) => {
      const n = nodes.find((x) => x.id === e.source);
      const ud = (n?.data as any) || {};
      return `${e.source}|${ud.imageUrl || ''}|${(ud.imageUrls || []).length}|${ud.videoUrl || ''}|${ud.audioUrl || ''}|${(ud.reply || ud.prompt || ud.text || '').slice(0, 80)}`;
    })
    .join('::');
}, [id, p.data, getEdges, getNodes]);

useEffect(() => {
  // 计算 + 调 update(merged)；签名相等时永不再跑
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [upstreamSignature]);
```

关键点：
- 用 **字符串签名**（拼接上游核心字段）当 `useEffect` 唯一 deps，xyflow store 频繁通知时，签名相等 → effect 跳过。
- `useMemo` 的 deps 里放 `p.data` 是为了节点自身 data 变化也能重算签名（防止误判），但因为上游没变 → 字符串相同 → effect 不重跑，**不会循环**。
- **绝对禁止** `useEffect(() => {...})`（无 deps）+ 内部调 `update()` / `setNodes()` 的写法。

### 22.3 ReactFlow `<ReactFlow>` 组件 props 的引用稳定性陷阱

xyflow v12 内部 [`StoreUpdater`](file:///e:/PenguinPravite/T8-penguin-canvas/node_modules/@xyflow/react/dist/esm/index.js) 的 `useIsomorphicLayoutEffect` **没有 deps 数组**，每次 render 后都遍历下面这个 `fieldsToTrack` 列表（节选）：

```
nodes / edges / defaultNodes / defaultEdges /
onConnect / onConnectStart / onConnectEnd /
nodesDraggable / nodesConnectable / nodesFocusable / edgesFocusable /
elevateNodesOnSelect / elevateEdgesOnSelect /
minZoom / maxZoom / nodeExtent /
onNodesChange / onEdgesChange /
elementsSelectable / connectionMode / snapGrid / snapToGrid /
translateExtent / connectOnClick / defaultEdgeOptions /
fitView / fitViewOptions /
onNodesDelete / onEdgesDelete / onDelete /
onNodeDrag / onNodeDragStart / onNodeDragStop /
onSelectionDrag / onSelectionDragStart / onSelectionDragStop /
onMoveStart / onMove / onMoveEnd /
noPanClassName / nodeOrigin /
autoPanOnConnect / autoPanOnNodeDrag / onError /
connectionRadius / isValidConnection /
selectNodesOnDrag / nodeDragThreshold / connectionDragThreshold /
onBeforeDelete / debug / autoPanSpeed / ariaLabelConfig / zIndexMode
```

只要 `Object.is(props[field], previousFields.current[field])` 失败 → 调 `store.setState`。setState 通知所有订阅者，订阅者重渲染若产生新引用 → 又触发 → 死循环。

#### 强制规范：传给 `<ReactFlow>` 的所有「字段属于 fieldsToTrack」的 props 必须**引用稳定**

[`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 已修正示例：

```tsx
// ✅ 正确：useMemo 锁住引用
const memoSelectionKeyCode      = useMemo(() => ['Control', 'Meta'], []);
const memoMultiSelectionKeyCode = useMemo(() => ['Control', 'Meta', 'Shift'], []);
const memoProOptions            = useMemo(() => ({ hideAttribution: true }), []);
const memoDefaultEdgeOptions    = useMemo(
  () => ({ style: { stroke: edgeStroke, strokeWidth: isPixel ? 2.5 : 2 }, animated: false }),
  [edgeStroke, isPixel]
);

// ❌ 反例：内联字面量 → 每次 render 新引用
<ReactFlow
  defaultEdgeOptions={{ style: {...}, animated: false }}
  selectionKeyCode={['Control', 'Meta']}
  proOptions={{ hideAttribution: true }}
/>
```

#### 回调函数也要稳定

`onConnect / onIsValidConnection / onNodesChange / onEdgesChange` 等**禁止**把 `nodes / edges` 列入 deps，应改为：

```tsx
const nodesRef = useRef<Node[]>(nodes);
const edgesRef = useRef<Edge[]>(edges);
useEffect(() => { nodesRef.current = nodes; }, [nodes]);
useEffect(() => { edgesRef.current = edges; }, [edges]);

const onConnect = useCallback((params) => {
  const curNodes = nodesRef.current;
  const curEdges = edgesRef.current;
  // ... 用 ref 拿最新值，回调本身保持空 deps
}, []);
```

### 22.4 OutputNode 单输入产品约束（已落地）

- 设计：[OutputNode](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx) 是终端展示节点，理论可接多源，但多源同时连入会显著放大渲染压力，且语义上"一个 output 节点 = 一份输出"更直观。
- 约束实现位置：[Canvas.tsx · onConnect](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)
  ```tsx
  if (tgt && tgt.type === 'output') {
    const targetHasConn = curEdges.some((e) => e.target === tgt.id);
    if (targetHasConn) {
      // 派生新 output 节点，放在原节点右侧 360px
      const newNode = { id: newId, type: 'output', position: {...}, data: {} };
      setNodes((prev) => [...prev, newNode]);
      params = { ...params, target: newId };
    }
  }
  ```
- 用户体验：第一根线连 output → 正常；第二根线再来 → 自动在右侧生成新 output 节点，线指向新节点，原节点保持单一上游。

### 22.5 ErrorBoundary 兜底（强制）

[`<ErrorBoundary>`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/ErrorBoundary.tsx) 在 [`App.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/App.tsx) 中包裹 `<Canvas>`：

```tsx
<ErrorBoundary fallbackTitle="画布渲染出错了，已被错误边界捕获">
  <Canvas onAddNodeRef={addNodeRef} />
</ErrorBoundary>
```

效果：
- 任何节点抛出运行时异常 / 死循环 / Maximum update depth 都不会让整页白屏
- 显示红色错误面板 + 错误堆栈 + "重试渲染" / "刷新页面" 两个按钮
- 关键意义：**让 bug 暴露在 UI 上而不是被吞掉**，用户截图 = 我们诊断现场

**今后所有挂 ReactFlow 子树的根级 UI 必须配 ErrorBoundary。**

### 22.6 dev 环境踩坑

| 现象 | 根因 | 处理 |
|---|---|---|
| 启动后整页米色空白，但 Vite 控制台无报错 | concurrently 把 Vite + 后端起在一起，后端因端口 18766 被占用 (`EADDRINUSE`) 崩溃，把 Vite 一起拖死，浏览器持有旧 chunk 但 HMR 不工作 | `Get-Process node \| Stop-Process -Force` 杀干净再 `npm run dev` |
| 修代码后浏览器仍报旧版本错（chunk 哈希 `?v=cef6e763` 不变） | 浏览器 / Service Worker 缓存了旧 module | **Ctrl + F5** 硬刷新；必要时 Ctrl+Shift+Del 清缓存 |
| F12 报错文字含乱码 / git commit 中文乱码 | PowerShell 7 默认 OEM 编码渲染 UTF-8 中文出错，**仓库内文件本身正常** | 看 GitHub 网页确认即可，不要徒劳改终端编码 |
| `tsc --noEmit` 通过但 IDE 红线 | IDE TS Server 缓存陈旧 | 重启 TS Server / 重开窗口 |

### 22.7 节点开发自检清单（强约束）

新写一个节点 / 改老节点前，逐条核对：

- [ ] 没有 `useEffect(() => {...})` 写法（必须带 deps 数组）
- [ ] effect 里若调 `update()` / `setNodes`，deps 必须是**字符串签名**或**精确字段**，**绝不是 `[nodes]` / `[edges]`**
- [ ] 自动透传逻辑使用 `useMemo` 计算 `upstreamSignature`，effect 仅依赖该签名
- [ ] 节点内部不调用 `useStore((s) => ...)` 自定义 selector，除非 selector 返回**原始类型**（string / number / boolean）且经实测稳定
- [ ] 节点向 `<ReactFlow>` 暴露的回调（如通过 `onAddNodeRef`）保持引用稳定
- [ ] 在 `<ErrorBoundary>` 包裹下做白屏压测（拓扑：自身 + 至少 2 个上游 + 1 个下游 OutputNode）

### 22.8 关键 Commit 索引

| Commit | 修复内容 |
|---|---|
| `459f746` | Sidebar / Canvas 的 `COLOR_HEX` 补 `teal: '#5eead4'`（OutputNode 图标底色） |
| `a9ddb2d` | OutputNode 移除 `setInterval/setTick`，初版改 `useStore` 订阅（后续被 0fb11e7 撤掉） |
| `f56e701` | 引入 ErrorBoundary 兜底；OutputNode 撤回 useStore 订阅，对齐 VideoOutputNode |
| `0fb11e7` | Canvas memoize `defaultEdgeOptions / proOptions / selectionKeyCode / multiSelectionKeyCode`；onConnect / onIsValidConnection 改 ref 模式；onConnect 实现 output 单输入自动派生新节点 |
| `5aac649` | **根因修复** —— RelayNode `useEffect` 加 `[upstreamSignature]` deps，彻底杜绝 setState 风暴 |

---

## 23. 下游节点订阅上游 data 变化的官方做法（useNodeConnections + useNodesData）

> 2026-05-23 修复"OutputNode 连上上传节点后不刷新"bug 后沉淀。**所有纯读上游型节点（如 OutputNode / VideoOutputNode / ImageCompareNode / StoryboardGridNode）都应遵守。**

### 23.1 现象

- 拖一个 `上传素材` 节点上传图片 → 连到 `输出素材` 节点
- `输出素材` 始终显示 `0 项` + "连入上游..."占位，不刷新
- 刷新页面后能看到图片。原因：进入画布后上游再变就不刷新。

### 23.2 根因

之前的实现依赖 `useReactFlow().getEdges() / getNodes()` 在 `useMemo([id, getEdges, getNodes, p.data])` 里读上游：

- `getEdges` / `getNodes` 是 xyflow 提供的稳定 callback，永远不变
- `p.data` 是本节点自身的 data，上游 data 变化**不会**带动本节点 props
- 节点被 `React.memo` 包裹 → props 浅比较 → 跳过重渲染 → useMemo 不重算

### 23.3 正确做法（强制）

```tsx
import { useNodeConnections, useNodesData } from '@xyflow/react';

// 订阅连入 target handle 的连接变化
const connections = useNodeConnections({ id, handleType: 'target' });
const upstreamIds = useMemo(
  () => Array.from(new Set(connections.map((c) => c.source))),
  [connections]
);

// 订阅上游节点 data 变化（返回 [{id, type, data}, ...]）
const upstreamNodes = useNodesData(upstreamIds);

const collected = useMemo(() => {
  const list = Array.isArray(upstreamNodes) ? upstreamNodes : [];
  for (const n of list) {
    const ud: any = n?.data || {};
    // ... 提取 imageUrl / videoUrl / audioUrl / prompt ...
  }
  return out;
}, [upstreamNodes]);
```

原理：
- `useNodeConnections({ id, handleType })` 订阅 store 的 edges + handle map，连接增删会触发重渲染
- `useNodesData(ids)` 订阅这些节点的 data，任何一个上游 data 变化都会触发重渲染
- 两个官方 hook 在 store 内部做了高效的 selector + Object.is 比较，**不会造成多余重渲染**

### 23.4 与 22.2 RelayNode 修复的差异

| 场景 | 应用方案 |
|---|---|
| **中继型节点**（如 RelayNode）要把上游透传到自身 data | `useMemo` 计算 `upstreamSignature` + `useEffect([upstreamSignature])` 调 `update()`（见 22.2） |
| **终端型节点**（如 OutputNode / VideoOutputNode / ImageCompareNode）仅渲染上游 | `useNodeConnections` + `useNodesData`（本章），**绝不调 update()**避免循环 |

记住：终端型节点 ≠ 中继型节点。不写自身 data 的节点优先用 23.3 方案。

### 23.5 节点视觉多层阴影叠加陷阱

同次修复中发现：

```tsx
// ❌ 三层阴影同时生效 → 节点右下方出现多余白色方框
<div
  className={`... ${selected ? 'shadow-2xl' : 'hover:border-white/30'}`}
  style={{ boxShadow: selected ? `0 12px 40px ${accent}33` : undefined }}
>
```
+ 像素风全局 CSS `box-shadow: var(--px-shadow-hard-lg)` (5px 5px 0)

三层阴影叠加：`shadow-2xl`（Tailwind 25px+ blur） + inline `boxShadow`（teal 40px blur） + 像素风硬阴影 → 节点右下角出现错位的白色方块。

修复原则：
- selected 状态只靠 `borderColor` 变化提示（像素风额外有 outline-dashed）
- 不要同时加 `shadow-2xl` className 与 inline `boxShadow`
- 空状态占位区不要用 `border-2 border-dashed`，改为纯文本提示，避免与节点边框叠加产生双重框

### 23.6 节点交互减法原则（以 UploadNode 为例）

原设计：创建 → 选择类型（图像/视频/音频） → 上传（三步）。
重构后：创建 → 点击/拖拽上传 → 自动识别（一步）。

关键：
- `<input type="file" accept="image/*,video/*,audio/*">`（三合一）
- `inferKindFromFile(file: File)` 按 `file.type` 前缀推断到 `image/video/audio`
- 上传成功后 `update({ uploadType: kind, [dataField]: url })`，节点自动切换到预览模式并染色 Handle
- 可点击右上角重置重选

**交互减法原则**：节点默认状态应该是「用户能立即开始产出价值」的状态。能用 MIME 识别的就不要让用户选，能从上下文推断的就不要重复输入。



---

## 24. xyflow 内置保留 type 名陷阱（极重要）

### 24.1 现象

OutputNode 在科技风（深色）主题下，节点本体（深色圆角矩形）外**还包了一圈白色矩形**：
- 比节点本体每边大约多出 8–12 px
- 是实心白色填充，不是边框线
- 在浅色主题下因画布也偏白，视觉对比低，几乎察觉不到
- 在科技风深色画布上一眼就看见，像「节点被裹了一层白色信封」
- 改 OutputNode.tsx 内部任何样式（去 shadow / 去 backdropFilter / 加 overflow:hidden / 不透明 background）都**完全无效**

### 24.2 真正的根因

xyflow 自带 `@xyflow/react/dist/style.css`（被 main.tsx 全局 import）里有这一段：

```css
.react-flow__node-input,
.react-flow__node-default,
.react-flow__node-output,
.react-flow__node-group {
  padding: 10px;
  border-radius: var(--xy-node-border-radius, 3px);
  width: 150px;
  font-size: 12px;
  color: var(--xy-node-color, #222);
  text-align: center;
  border: var(--xy-node-border, 1px solid #1a192b);
  background-color: var(--xy-node-background-color, #fff);
}
.react-flow__node-output.selectable.selected {
  box-shadow: 0 0 0 0.5px #1a192b;
}
```

xyflow 把 `input` / `output` / `default` / `group` 视为**保留内置节点类型名**，自动给打上 `react-flow__node-output` class 的元素套上一套老风格皮肤（白底 + 1px 黑边 + 10px padding + 150px 固定宽度）。

我们项目在 [`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 用 `output: OutputNode` 注册业务节点，DOM 上就被 xyflow 自动加了 `react-flow__node-output` class，于是「白底 + padding:10px」叠加在我们自定义容器外面 —— 那圈「白色矩形」就是 xyflow 默认 padding 把白色 background-color 露出来的部分，根本不是我们 OutputNode.tsx 内部画出来的，难怪改 OutputNode.tsx 怎么改都没用。

### 24.3 修复方案（已落地）

**最稳妥**：在 [`src/styles/index.css`](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/index.css) 加一段防御性 CSS，重置所有保留 type 名的默认皮肤：

```css
/* === xyflow 内置保留 type 名防御 === */
.react-flow__node-input,
.react-flow__node-output,
.react-flow__node-default,
.react-flow__node-group {
  padding: 0 !important;
  width: auto !important;
  font-size: inherit !important;
  color: inherit !important;
  text-align: left !important;
  border: none !important;
  background-color: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}
.react-flow__node-input.selectable:hover,
.react-flow__node-output.selectable:hover,
.react-flow__node-default.selectable:hover,
.react-flow__node-group.selectable:hover,
.react-flow__node-input.selectable.selected,
.react-flow__node-output.selectable.selected,
.react-flow__node-default.selectable.selected,
.react-flow__node-group.selectable.selected {
  box-shadow: none !important;
}
```

**替代方案**（更彻底但工作量大）：把节点 type 改名避开保留字，例如 `output` → `outputAsset`、`input` → `materialInput`。要同步改 NODE_REGISTRY、SPECIFIC_NODES、所有持久化 graph 数据的迁移逻辑，**风险高**，不推荐。

### 24.4 xyflow v12 保留 type 名清单

截至 @xyflow/react v12.x，**禁止**直接用以下名字作为业务节点 `type`，否则 DOM 会被 xyflow 默认皮肤吞掉：

| 保留名 | xyflow 默认效果 |
|---|---|
| `input` | 白底 + 黑边 + padding:10 + width:150 + 圆点 source handle |
| `output` | 白底 + 黑边 + padding:10 + width:150 + 圆点 target handle |
| `default` | 白底 + 黑边 + padding:10 + width:150 + 双向 handle |
| `group` | 半透明背景 + 1px 边框，作为 sub-flow 容器 |

如果一定要用这些名字（例如历史遗留无法改名），**必须**在全局 CSS 用 24.3 的方式重置默认样式。

### 24.5 排查方法（DOM 层面）

遇到「节点视觉上多出一圈背景 / 边框 / 颜色，改组件内部代码无效」时：

1. F12 打开 DevTools → Elements 选中节点最外层（`.react-flow__node`）
2. 看它的 class 列表里有没有 `react-flow__node-input/-output/-default/-group`
3. 切到 Styles 面板，**关键：要看『来源』列**。如果命中规则来自 `style.css`（xyflow 包自带），不来自我们的 `index.css` / `theme-pixel.css`，**就是踩了这个坑**
4. 任何「component 内部怎么改都没用，外圈样式纹丝不动」的现象，几乎肯定是上层（xyflow 默认 / 全局 CSS）覆盖了，要去 DOM 里逐层找命中规则

### 24.6 节点 type 命名规范（强制）

- **业务节点禁止使用** `input` / `output` / `default` / `group` 这四个名字
- 推荐命名：业务语义 + 后缀，例如 `outputAsset`、`textInput`、`imageRelay`、`videoOutput`
- `groupBox` 已经是我们项目的容器节点（避开了 `group`），是正确范例
- 新增节点 type 前先 grep `node_modules/@xyflow/react/dist/style.css` 看 `.react-flow__node-` 后面有没有同名规则

### 24.7 关键 Commit 索引

- `a211575` 错误尝试：去 backdropFilter + overflow:hidden + Handle 显式定位（**无效**，因为根本没改对地方）
- `feb1b72` 真正修复：在 index.css 重置 `.react-flow__node-output` 等保留 type 名默认样式（**有效**）

---
