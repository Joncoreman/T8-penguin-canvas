# T8-penguin-canvas · skill.md

> 项目能力 / 接口 / 文件用途速查手册。
> 版本：v1.2.10.13 ｜ 仓库：<https://github.com/T8mars/T8-penguin-canvas>
>
> v1.2.10.13 增量：Electron 用户分发包增加充值密钥安全闸；`_post_build.cjs` 会拦截源码非空 `RECHARGE_DEFAULT_ENC`，以及 `data/recharge.private.json`、非空 `AGENT_HMAC_KEY / DULUPAY_KEY`、遗留 `RECHARGE_DEFAULT_ENC` 密文进入 resources。给用户充值的包不得携带 agent HMAC，正式方案必须让 VPS 持有密钥并提供无需客户端 HMAC 的公开充值接口。
>
> v1.2.10.12 增量：恢复本地开发充值配置入口；GitHub 仍保持 `RECHARGE_DEFAULT_ENC` 为空，本地通过忽略文件 `data/recharge.private.json` 或 `RECHARGE_*` 环境变量注入私有 agent 配置。
>
> v1.2.10.11 增量：开源推送前密钥清理规则落地；`RECHARGE_DEFAULT_ENC` 默认留空，代理 HMAC / 支付回调密钥仅允许通过本地环境变量或私有部署注入，禁止进入 GitHub。
>
> v1.2.10.10 增量：充值创建订单前新增同主题强提醒确认框；充值后端补安全硬化（本地 CORS 限制、支付通知空密钥拒绝、订单号随机性增强、订单列表脱敏）。
>
> v1.2.10.9 增量：迁移 gpt-image-2-web 已验证的充值系统到 T8 Express/React 架构，复用加密支付代理配置，新增临时 1 元测试档位，保留原 7 个算力档位，暂不迁移余额查询。
>
> v1.2.1 增量（§47）：Electron 打包加密链路 3 处根因修复 + 标准化 SOP 沉淀 — bytenode .jsc loader 复刻（vm.Script + cachedData 直跑、跳过 tmpFile 二次 require）+ asar 外 .t8c 的 require MODULE_NOT_FOUND 回退 loader.cjs 自身（解析 app.asar/node_modules/express|cors|multer|sharp）+ backend/src/config.js 识别 T8PC_PACKAGED/T8PC_USER_DATA/T8PC_FRONTEND_DIST 三环境变量（数据写 userData、NODE_ENV=production）+ backend/src/server.js 打包模式 express.static + SPA 兑底（regex 排除 api/files/input/output 4 前缀）+ main.cjs 三处版本号同步 v1.2.0 + 6 项打包前必检 checklist + 完整 SOP 写入本章作为下次打包唯一参考依据。
>
> v1.6.0 增量（§46）：RH LIST/SELECT 字段识别 + KNOWN_FIELD_OPTIONS 词典兜底、多素材协议约束（fieldValue 必须单 fileName）、RunningHubNode 接入 logBus 统一日志面板、像素风全局禁用 backdrop-filter（一次修复 18+ 节点字模糊）、ResizeNode 默认 fit=cover + ImageOpFrame 有下游 OutputNode 时隐藏内部预览
>
> v1.5.9 增量（§45）：默认主题改像素风(light) + RH 钱包应用节点 + RH 钱包独立 APIKEY全链路透传 + 永久规则『未明确指令不主动打包』
>
> v1.5.8 增量：API Key 设置眼睛预览修复 + 7 类分类独立 Key（gpt-image / nano-banana / mj / veo / grok / seedance / suno）以模型名路由，未填 fallback 贞贞通用（41）
>
> v1.5.7 增量：LLM 节点 上游图片实时预览 + collectUpstream 取同源 · 让用户所见即所发（40）
>
> v1.5.6 增量：Shift+拖拽剪刀模式 黑色未选中 edge 命中丢失修复（插值采样避免鼠标跳点 + cut-mode 加宽 stroke）（39）
> v1.5.5 增量：图像轮询超时上限 120s → 3600s（GPT2 / nano-banana / nano-banana-pro 标准异步路径），避免复杂任务被提前中断（38）
> v1.5.4 增量：LLM 多模态 image_url 预处理 · 修复上游 /files/* 本地路径透传被上游误读为 base64 导致 convert_request_failed（37）
>
> v1.5.3 增量：节点拖出候选菜单 中继节点置顶（36）
>
> v1.5.2 增量：RelayNode 全字段透传修复 · 文本/图像/视频/音频四类素材统一中继 · 修复 Upload→Relay→Output 视频/音频断流 bug（35）
>
> v1.5.1 增量：侧边栏节点暂时隐藏（13 个：特殊 5 + 工具 6 + 辅助 2）· NodeMeta 增加 hidden 开关（34）
>
> v1.5.0 增量：跨节点素材拖拽（Ctrl+拖 图/视/音/文）· 拦截 ReactFlow Pane onPointerDownCapture· 全节点 source/target 覆盖（33）
>
> v1.4.0 增量：输出图片双击编辑·裁剪+宫格切分+自定义切线+gap 边缘去缝(32)
>
> v1.3.0 增量：组容器输出口连接修复(27) · Video/Seedance/Audio 接入素材聚合预览区(28) · 三处用户反馈修复(29) · Handle 光标语义化+命中区外扩 8px(30) · SHIFT+空白拖动剪刀划线断连(31)

---

## 1. 项目定位

T8-penguin-canvas 是 PenguinPravite 画布功能的 **轻量化重构版**，定位为 **纯 Web 端 AI 创作画布工具**：

- 仅运行于浏览器（前端 Vite 11422 端口 + 后端 Node Express 18766 端口）。
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
├── backend/                         # Node + Express 后端 (18766 端口)
│   └── src/
│       ├── server.js                # 入口，挂载 5 类路由 + SPA 兜底
│       ├── config.js                # 端口/目录/baseUrl/打包模式环境变量
│       ├── utils/
│       │   └── whitePng.js          # 零依赖 PNG 编码器（GPT2 文生图占位白图）
│       └── routes/
│           ├── canvas.js            # 画布 CRUD（防空覆盖）
│           ├── settings.js          # API Key 持久化 + RH 工具分类/应用 CRUD
│           ├── files.js             # 上传/list/base64/save-to-disk
│           ├── imageOps.js          # sharp: resize/upscale/grid-crop/combine/remove-bg
│           └── proxy.js             # 上游代理: image/llm/video/audio/runninghub
├── electron/                        # Electron 桌面端打包
│   ├── main.cjs                     # 主进程 (窗口+后端启动+IPC)
│   ├── loader.cjs                   # .t8c 解密 require hook
│   ├── preload.js                   # 渲染进程预加载
│   ├── encrypt.cjs                  # bytenode+T8ENC1 加密工具
│   └── _post_build.cjs              # 打包后自动校验
├── src/                             # 前端 React + TypeScript
│   ├── App.tsx                      # 应用根组件 (主题/状态栏/布局)
│   ├── main.tsx                     # Vite 入口
│   ├── components/
│   │   ├── Canvas.tsx               # 画布主体 (xyflow) — 2900+ 行核心文件
│   │   ├── CanvasToolbar.tsx        # 顶部浮动工具栏
│   │   ├── TerminalPanel.tsx        # 底部日志面板
│   │   ├── CanvasManager.tsx        # 多画布列表管理
│   │   ├── Sidebar.tsx              # 节点拖拽侧边栏 + 版本号
│   │   ├── ApiSettings.tsx          # API Key 设置弹窗 + 获取Key按钮
│   │   ├── NodeActionBar.tsx        # 节点悬浮操作条 (执行/复制/删除)
│   │   ├── MaterialDragOverlay.tsx  # Ctrl+拖拽素材覆盖层
│   │   ├── ErrorBoundary.tsx        # React 错误边界
│   │   ├── edges/                  # 自定义 Edge 组件
│   │   └── nodes/                  # 38+ 节点组件文件 (含 hooks)
│   │       ├── ImageNode.tsx        # GPT2/NanoBanana 图像生成
│   │       ├── VideoNode.tsx        # Veo/Grok 视频生成
│   │       ├── SeedanceNode.tsx     # SD2.0 视频分镜
│   │       ├── AudioNode.tsx        # Suno 音频
│   │       ├── LLMNode.tsx          # GPT-5/Claude/Gemini
│   │       ├── RunningHubNode.tsx   # RH 工作流主节点
│   │       ├── RHToolsNode.tsx      # RH 超市 (启动器)
│   │       ├── RHToolEditorModal.tsx # RH 超市分类/应用管理弹窗
│   │       ├── OutputNode.tsx       # 输出素材预览
│   │       ├── UploadNode.tsx       # 上传素材
│   │       ├── LoopNode.tsx         # 循环器
│   │       ├── GroupBoxNode.tsx     # 组容器
│   │       ├── FramePairNode.tsx    # 首尾帧获取
│   │       ├── ImageEditModal.tsx   # 图像编辑器 (裁剪/遮罩/画板/宫格/图层)
│   │       ├── ResizableCorners.tsx # 四角缩放控件
│   │       ├── useUpstreamMaterials.ts # hook: 收集上游素材
│   │       ├── useHasAutoOutput.ts    # hook: 是否有自动输出节点
│   │       ├── useOrderedMaterials.ts  # hook: 有序素材列表
│   │       └── useUpdateNodeData.ts   # hook: 更新节点data
│   ├── config/
│   │   ├── nodeRegistry.ts          # 34 节点元数据 (type/label/icon/color/hidden)
│   │   ├── portTypes.ts             # 端口类型注册表 + 连接校验 + 颜色映射
│   │   └── canvasTemplates.ts       # 工作流模板预设
│   ├── stores/                      # Zustand 状态库
│   │   ├── canvas.ts                # 画布列表 CRUD
│   │   ├── apiKeys.ts               # API Key 状态
│   │   ├── theme.ts                 # 主题状态 (tech/pixel × light/dark)
│   │   ├── runBus.ts                # 运行总线 (批量执行)
│   │   ├── logs.ts                  # 日志总线 logBus
│   │   ├── dragMaterial.ts          # 素材拖拽状态 (Ctrl+拖)
│   │   └── groupBus.ts              # 组容器事件总线
│   ├── hooks/
│   │   ├── useCanvasHistory.ts      # Undo/Redo 栈
│   │   ├── useRunTrigger.ts         # 节点订阅运行总线
│   │   ├── useMaterialDragSource.ts # 素材拖拽源 (Ctrl+拖素材到其他节点)
│   │   └── useMaterialDropTarget.ts # 素材拖拽目标
│   ├── services/
│   │   ├── api.ts                   # 后端 REST 封装 (画布/设置/文件/RH工具)
│   │   ├── generation.ts            # 生成调用: image/video/audio/llm/RH
│   │   └── imageOps.ts              # 图像工具: resize/crop/combine + uploadFileBlob
│   ├── providers/
│   │   ├── models.ts                # 模型注册表 (image/video/audio/llm 参数)
│   │   └── RHToolsProvider.tsx      # RH 工具 Context (分类/应用共享状态)
│   ├── utils/
│   │   ├── nodePlacement.ts         # 节点落点防重叠 (螺线+向右扫描+兜底)
│   │   ├── topologicalSort.ts       # Kahn 拓扑排序
│   │   ├── pinyinMatch.ts           # 拼音首字母模糊匹配
│   │   └── wheelBlock.ts            # 防止节点内滚轮穿透到画布缩放
│   ├── types/canvas.ts              # TS 类型定义
│   └── styles/index.css             # Tailwind + 双主题变量
├── data/                            # 画布/设置 JSON (gitignore)
├── input/ output/ thumbnails/       # 用户上传/生成产物/缩略图 (gitignore)
├── dist/                            # Vite 前端构建产物
├── dist_electron/                   # Electron 打包产物
├── features.json                    # 节点防丢失锁 + phase历史 + 打包信息
├── skill.md                         # 本文件 (能力速查手册)
├── vite.config.ts                   # 前端配置 (11422端口 + proxy→18766)
├── vite.config.js                   # 打包专用 (define __APP_VERSION__)
├── package.json                     # 依赖 + scripts + electron-builder 配置
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
| GET | `/api/settings/raw` | 明文设置（供 proxy.js 及前端眼睛预览用） |
| POST | `/api/settings` | 更新设置；`zhenzhenBaseUrl` / `llmBaseUrl` 强制配置值 |
| GET | `/api/settings/rh-tool-categories` | RH 工具分类列表 |
| POST | `/api/settings/rh-tool-categories` | 新建分类 `{name}` |
| PUT | `/api/settings/rh-tool-categories/:id` | 重命名分类 `{name}` |
| DELETE | `/api/settings/rh-tool-categories/:id` | 删除分类 |
| POST | `/api/settings/rh-tool-categories/reorder` | 分类排序 `{ids[]}` |
| GET | `/api/settings/rh-tool-apps` | RH 工具应用列表 |
| POST | `/api/settings/rh-tool-apps` | 新增应用 `{webappId, title, ...}` |
| PUT | `/api/settings/rh-tool-apps/:id` | 更新应用 |
| DELETE | `/api/settings/rh-tool-apps/:id` | 删除应用 |
| POST | `/api/settings/rh-tool-apps/reorder` | 应用排序 `{ids[]}` |

Key 字段：`zhenzhenApiKey / rhApiKey / llmApiKey + 各自 baseUrl + preferences{ theme, language }`。
数据文件：`data/settings.json`、`data/rh_tool_categories.json`、`data/rh_tool_apps.json`。

### 3.4 文件（routes/files.js）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/files/upload` | multipart 上传到 `input/`，限 10MB |
| GET | `/api/files/list` | 列出 `output/` 中的 png/jpg/webp/gif/mp4/webm/mp3/wav |
| POST | `/api/files/upload-base64` | dataURL 转存到 `output/`（手绘画板 / 抽帧使用） |
| POST | `/api/files/save-to-disk` | 下载 URL 到本地 output/ (OutputNode 自动保存) |

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
| POST | `/api/proxy/image` | 同步入口：内部提交异步任务并轮询至完成，返回本地图片 URL |
| POST | `/api/proxy/image/submit` | 提交异步任务，返回 `{ sync, taskId?, urls?, status, progress }` |
| GET  | `/api/proxy/image/status/:tid` | 轮询 `/v1/images/tasks/{tid}`，返回 `{ status, progress, urls? }` |

#### 图像 FAL 渠道
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/image/fal/submit` | FAL 异步提交 (endpoint + input) |
| POST | `/api/proxy/image/fal/query` | FAL 状态查询 (responseUrl / requestId) |

#### 图像 Midjourney 渠道
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/mj/imagine` | MJ 生成提交 (prompt + speed) |
| GET | `/api/proxy/mj/task/:id` | MJ 任务状态查询 |
| POST | `/api/proxy/mj/upload` | MJ 参考图上传 |

#### LLM
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/llm` | 贞贞工坊 `/v1/chat/completions`，支持 stream=true SSE |

#### 视频（全异步）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/video/submit` | Veo3.1/GrokVideo 提交 |
| GET | `/api/proxy/video/query?taskId` | 轮询，SUCCESS 时下载视频到本地 |
| POST | `/api/proxy/video/fal/submit` | 视频 FAL 渠道提交 |
| POST | `/api/proxy/video/fal/query` | 视频 FAL 状态查询 |

#### Seedance (SD2.0)
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/seedance/submit` | SD2.0 视频提交 (prompt/image/video/audio) |
| GET | `/api/proxy/seedance/query?taskId` | SD2.0 状态轮询 |

#### Suno 音频（v5.5 三模式）
| 方法 | 路径 | mode |
|---|---|---|
| POST | `/api/proxy/audio/submit` | `generate / cover / extend`，自动选 `mv` |
| GET | `/api/proxy/audio/query?clipIds` | 解析 `audio_url`，返回 `tracks[]` |
| POST | `/api/proxy/audio/upload` | 翻唱/续写模式参考音频上传 |

模型映射：`suno-v5.5 → chirp-fenix`、`v5 → chirp-v3-5`、`v4.5 → chirp-v4-5`、`v4 → chirp-v4`。

#### RunningHub
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/proxy/runninghub/submit` | `/task/openapi/ai-app/run`，返回 `taskId` |
| GET | `/api/proxy/runninghub/query?taskId` | 轮询；code `0/804/813/805` → `SUCCESS/RUNNING/QUEUED/FAILED` |
| POST | `/api/proxy/runninghub/upload-asset` | 上传素材到 RH 获取 fileName (base64/本地URL) |
| GET | `/api/proxy/runninghub/app-info?webappId` | 获取 RH 应用配置 (nodeInfoList 等) |

---

## 4. 前端服务封装

### `src/services/api.ts` — 后端 REST 全量接口

| 分类 | 函数 | 说明 |
|---|---|---|
| 状态 | `checkBackendStatus()` | GET /api/status → boolean |
| 画布 | `listCanvases()` | GET /api/canvas → CanvasListItem[] |
| 画布 | `createCanvas(name?)` | POST /api/canvas |
| 画布 | `getCanvasData(id)` | GET /api/canvas/:id → CanvasData |
| 画布 | `saveCanvasData(id, data)` | PUT /api/canvas/:id |
| 画布 | `deleteCanvas(id)` | DELETE /api/canvas/:id |
| 画布 | `renameCanvas(id, name)` | PATCH /api/canvas/:id/name |
| 设置 | `getSettings()` | GET /api/settings → ApiSettings (脱敏) |
| 设置 | `getRawSettings()` | GET /api/settings/raw → ApiSettings (明文) |
| 设置 | `updateSettings(patch)` | POST /api/settings |
| 文件 | `saveAssetToDisk(url, filename?)` | POST /api/files/save-to-disk → {ok,path,exist} |
| RH工具分类 | `getRHToolCategories()` | GET /api/settings/rh-tool-categories |
| RH工具分类 | `addRHToolCategory(name)` | POST |
| RH工具分类 | `renameRHToolCategory(id, name)` | PUT /:id |
| RH工具分类 | `deleteRHToolCategory(id)` | DELETE /:id |
| RH工具分类 | `reorderRHToolCategories(ids)` | POST /reorder |
| RH工具应用 | `getRHTools()` | GET /api/settings/rh-tool-apps |
| RH工具应用 | `addRHTool(payload)` | POST |
| RH工具应用 | `updateRHTool(id, payload)` | PUT /:id |
| RH工具应用 | `deleteRHTool(id)` | DELETE /:id |
| RH工具应用 | `reorderRHTools(ids)` | POST /reorder |

### `src/services/generation.ts` — 生成调用封装

| 函数 | 说明 |
|---|---|
| `generateImage(req)` | POST /api/proxy/image → {urls[]} 同步模式 |
| `submitImageAsync(req)` | POST /api/proxy/image/submit → {sync,taskId,urls,status} |
| `queryImageStatus(taskId, apiModel?)` | GET /api/proxy/image/query → 轮询状态 |
| `submitImageFal(req)` | POST /api/proxy/fal/submit → FAL 异步提交 |
| `queryImageFal(params)` | GET /api/proxy/fal/query → FAL 状态查询 |
| `submitMjImagine(req)` | POST /api/proxy/mj/imagine → MJ 异步 |
| `queryMjTask(taskId, speed)` | GET /api/proxy/mj/query → MJ 状态 |
| `uploadMjImage(file, speed)` | POST /api/proxy/mj/upload-image |
| `buildMjPrompt(parts)` | 纯工具: 拼 MJ prompt 字符串 |
| `generateLlm(req)` | POST /api/proxy/llm → {text} 同步 |
| `generateLlmStream(req, onChunk)` | POST /api/proxy/llm (stream) SSE |
| `submitVideoFal(req)` | POST /api/proxy/fal/submit → 视频 FAL |
| `queryVideoFal(params)` | GET /api/proxy/fal/query → 视频 FAL |
| `uploadFile(file)` | POST /api/files/upload → {url, filename} |
| `fileToDataUrl(file)` | 纯工具: File→base64 |

### `src/services/imageOps.ts` — 图像工具

| 函数 | 后端路由 | 使用者 |
|---|---|---|
| `opResize(url, w, h, fit)` | /api/image/resize | ResizeNode |
| `opUpscale(url, scale)` | /api/image/upscale | UpscaleNode |
| `opCrop(url, x, y, w, h)` | /api/image/crop | ImageEditModal |
| `opGridCrop(url, rows, cols, gap, rectsPx?)` | /api/image/grid-crop | GridCropNode |
| `opCombine(urls[], direction)` | /api/image/combine | CombineNode |
| `opRemoveBg(url)` | /api/image/remove-bg | RemoveBgNode |
| `uploadDataUrl(dataUrl, prefix)` | /api/files/upload-base64 | 图像编辑器 mask/brush |
| `uploadFileBlob(file, filename?)` | /api/files/upload (multipart) | 图像编辑器图层拖入 |

### `src/providers/models.ts` — 模型注册表

集中定义所有可选模型的参数配置，新增模型只需追加数组元素。

| 导出 | 类型 | 说明 |
|---|---|---|
| `IMAGE_MODELS` | ImageModelDef[] | 图像模型 (GPT2/NanoBanana/MJ) |
| `VIDEO_MODELS` | VideoModelDef[] | 视频模型 (Veo3.1/GrokVideo + FAL渠道) |
| `AUDIO_MODELS` | AudioModelDef[] | 音频模型 (Suno V5.5) |
| `LLM_MODELS` | LlmModelDef[] | LLM模型 (GPT-5/Claude/Gemini) |
| `SEEDANCE_MODELS` | SeedanceModelDef[] | SD2.0 视频分镜 |

每个 ModelDef 包含: `id` / `apiModel` / `label` / `tabLabel` / `provider` / `paramKind` / `capabilities` / 尺寸选项等。

### `src/providers/RHToolsProvider.tsx` — RH 工具共享上下文

提供 `useRHTools()` hook，全局加载 RH 工具分类/应用数据，供 `RHToolsNode` + `RHToolEditorModal` 共享状态。

---

## 5. 节点清单（34 个注册类型）

| 分组 | 节点 type | 组件文件 | 可批量运行 | 是否隐藏 | 备注 |
|---|---|---|---|---|---|
| 素材资源 | upload | UploadNode.tsx | ✗ | | 图/视/音三合一 |
| 素材资源 | output | OutputNode.tsx | ✗ | | 终端预览+中继 |
| 核心 | text | TextNode.tsx | ✗ | | 提示词 |
| 核心 | image | ImageNode.tsx | ✓ | | GPT2/NanoBanana/MJ |
| 核心 | video | VideoNode.tsx | ✓ | | Veo3.1/GrokVideo |
| 核心 | seedance | SeedanceNode.tsx | ✓ | | SD2.0 视频分镜 |
| 核心 | audio | AudioNode.tsx | ✓ | | Suno V5.5 |
| 核心 | llm | LLMNode.tsx | ✓ | | GPT-5/Claude/Gemini |
| RH | runninghub | RunningHubNode.tsx | ✓ | | RH 工作流 |
| RH | runninghub-wallet | RunningHubNode.tsx | ✓ | | RH 钱包应用 |
| RH | rh-config | RhConfigNode.tsx | ✗ | hidden | 参数注入(已废弃) |
| RH | rh-tools | RHToolsNode.tsx | ✓ | | RH 超市启动器 |
| 特殊 | multi-angle-3d | PresetImageNode.tsx | ✓ | hidden | 3D 多视角 |
| 特殊 | panorama-720 | PresetImageNode.tsx | ✓ | hidden | 720°全景 |
| 特殊 | penguin-portrait | PresetImageNode.tsx | ✓ | hidden | 企鹅肖像 |
| 特殊 | portrait-metadata | PortraitMetadataNode.tsx | ✗ | hidden | 肖像元数据 |
| 特殊 | storyboard-grid | StoryboardGridNode.tsx | ✗ | hidden | 分镜九宫格 |
| 工具 | drawing-board | DrawingBoardNode.tsx | ✗ | hidden | 手绘涂抹 |
| 工具 | browser | BrowserNode.tsx | ✗ | hidden | 网页内嵌 |
| 工具 | image-compare | ImageCompareNode.tsx | ✗ | hidden | 前后对比 |
| 工具 | frame-extractor | FrameExtractorNode.tsx | ✓ | hidden | 视频抽帧 |
| 工具 | frame-pair | FramePairNode.tsx | ✓ | | 首尾帧获取 |
| 工具 | loop | LoopNode.tsx | ✗ | | 循环器(串/并联驱动) |
| 工具 | pick-from-set | PickFromSetNode.tsx | ✗ | | 从合集取单个 |
| 工具 | resize | ImageOpFrame.tsx | ✓ | | 尺寸调整 |
| 工具 | upscale | ImageOpFrame.tsx | ✓ | hidden | 放大 |
| 工具 | grid-crop | ImageOpFrame.tsx | ✓ | | 宫格剪裁 |
| 工具 | combine | ImageOpFrame.tsx | ✓ | | 图像合并 |
| 工具 | remove-bg | ImageOpFrame.tsx | ✓ | hidden | 抠图 |
| 辅助 | edit | ImageNode.tsx (mode=edit) | ✓ | hidden | 图像编辑 |
| 辅助 | idea | IdeaNode.tsx | ✗ | | 灵感记录 |
| 辅助 | bp | BpNode.tsx | ✗ | | BP 蓝图 |
| 辅助 | relay | RelayNode.tsx | ✗ | | 数据中转(any透传) |
| 辅助 | video-output | VideoOutputNode.tsx | ✗ | hidden | 视频结果展示 |
| 工具箱 | cinematic | ToolboxParamNode.tsx | ✗ | | 电影感参数 |
| 工具箱 | video-motion | ToolboxParamNode.tsx | ✗ | | 运镜参数 |
| 容器 | groupBox | GroupBoxNode.tsx | ✓(组执行) | | 组容器(框选打组) |

> 「可批量运行」= 已通过 `useRunTrigger(nodeId, runFn)` 接入运行总线。
> 「hidden」= 仅从 Sidebar 隐藏，类型注册保留，老画布仍可正常渲染。

---

## 5.1 端口类型系统 (`src/config/portTypes.ts`)

连线校验核心：只允许 source.outputs 与 target.inputs 有交集的节点相连。

**PortType 枚举**：`text` | `image` | `video` | `audio` | `metadata` | `config` | `any`

**关键导出**：
| 导出 | 说明 |
|---|---|
| `NODE_PORTS: Record<string, NodePorts>` | 全量节点端口注册表 (inputs/outputs) |
| `getNodeInputs(node)` | 取节点可接受的输入类型 |
| `getNodeOutputs(node)` | 取节点输出类型 (upload 动态解析) |
| `arePortsCompatible(sOut, tIn)` | 交集判定 + any 透传兼容 |
| `isConnectionValid(source, target)` | ReactFlow isValidConnection 主校验函数 |
| `PORT_COLOR: Record<PortType, string>` | 端口颜色映射 |
| `PORT_LABEL: Record<PortType, string>` | 端口中文标签 |

**特殊规则**：
- `any` 与任何类型互通 (用于 relay/output/groupBox)
- upload 节点输出由 `data.uploadType` 动态决定，未上传时 outputs=[] 不允许连出
- 禁止 loop → output 直连 (循环器不产出最终结果)

## 5.2 状态库 Stores (`src/stores/`)

| 文件 | Store Hook | 职责 |
|---|---|---|
| `canvas.ts` | `useCanvasStore` | 画布列表 CRUD + activeId |
| `apiKeys.ts` | `useApiKeysStore` | 三套 Key 状态 (zhenzhen/llm/rh) + 分类 Key |
| `theme.ts` | `useThemeStore` | 主题切换 (mode: tech/pixel, dark: bool) |
| `runBus.ts` | `useRunBusStore` | 运行总线 (triggerRun/triggerRunMany/markDone/cancelAll) |
| `logs.ts` | `useLogStore` | 日志总线 (log/clear/open/unread) — 500条上限 |
| `dragMaterial.ts` | `useDragMaterialStore` | Ctrl+拖素材状态 (kind/url/sourceNodeId) |
| `groupBus.ts` | `useGroupBusStore` | 组容器事件 (runGroup/lastGroupDone) |

## 5.3 Hooks (`src/hooks/`)

| 文件 | 签名 | 职责 |
|---|---|---|
| `useCanvasHistory.ts` | `useCanvasHistory(nodes, edges)` | Undo/Redo 栈 (Ctrl+Z/Y) |
| `useRunTrigger.ts` | `useRunTrigger(nodeId, runFn)` | 节点订阅运行总线，命中则 await runFn |
| `useMaterialDragSource.ts` | `useMaterialDragSource(nodeId, data)` | 素材拖拽源 (Ctrl+拖从节点出) |
| `useMaterialDropTarget.ts` | `useMaterialDropTarget(nodeId, onDrop)` | 素材拖拽目标 (Ctrl+放入节点) |

## 5.4 节点内部 Hooks (`src/components/nodes/`)

| 文件 | 签名 | 职责 |
|---|---|---|
| `useUpstreamMaterials.ts` | `useUpstreamMaterials(nodeId)` | 收集所有上游节点的素材 (image/video/audio/text) |
| `useHasAutoOutput.ts` | `useHasAutoOutput(nodeId)` | 检测下游是否已有 OutputNode → 抑制重复 autoOutput |
| `useOrderedMaterials.ts` | `useOrderedMaterials(nodeId)` | 按连线顺序返回素材列表 |
| `useUpdateNodeData.ts` | `useUpdateNodeData(nodeId)` | `setData(patch)` 快捷更新节点data |

## 5.5 Utils (`src/utils/`)

| 文件 | 导出 | 职责 |
|---|---|---|
| `nodePlacement.ts` | `resolveSingleSpawn` / `resolveBatchSpawn` | 节点落点防重叠 (3阶段: 螺线→向右扫描→兜底) |
| `topologicalSort.ts` | `topologicalSort(nodes, edges)` | Kahn 拓扑排序 (批量运行依赖序) |
| `pinyinMatch.ts` | `pinyinMatch(query, text)` | 拼音首字母模糊匹配 (RH超市搜索) |
| `wheelBlock.ts` | `useWheelBlock(ref)` | 防止节点内滚轮穿透到画布缩放 |

## 5.6 节点落点算法 (`src/utils/nodePlacement.ts`)

**三阶段搜索策略**：
1. **Pass 1 螺线搜索** — 阿基米德方形螺线，右→下→左→上 扩展，step=80px，maxTries=64，覆盖约400px
2. **Pass 2 向右线性扫描** — 每步右移 step，尝试 Y 偏移 [0, +step, -step]，最远 3000px
3. **Pass 3 兜底** — 把整组挖到现有节点的最右侧

**关键函数**：
| 函数 | 说明 |
|---|---|
| `resolveSingleSpawn(desired, existing, step, maxTries, gap)` | 单节点避让 |
| `resolveBatchSpawn(desiredRects, existing, baseStep, maxTries, gap)` | 多节点整组避让 |
| `spiralSearchSingle(desired, existing, step, maxTries, gap)` | 螺线搜单个 |
| `spiralSearchBatch(rects, existing, step, maxTries, gap)` | 螺线搜整组 |
| `rightwardScanSingle(desired, existing, step, gap)` | 向右扫描单个 |
| `rightwardScanBatch(rects, existing, step, gap)` | 向右扫描整组 |
| `rectOf(node)` | 取节点的 Rect (x/y/w/h)(优先measured) |
| `defaultSizeOf(type)` | 取节点默认尺寸 |

**接入点**（Canvas.tsx 中 6 处调用）：
1. 拖拽新节点落下 (onDrop)
2. 右键菜单添加节点
3. autoOutput 通用路径 (图像/视频/LLM/RH 生成后自动创建 OutputNode)
4. autoOutput FramePair 路径 (双输出)
5. autoOutput Suno 路径 (多首歌)
6. reorder-grid (节点位置重排时确保不重叠)

## 5.7 版本号规则

| 位置 | 格式 | 示例 | 说明 |
|---|---|---|---|
| `vite.config.ts` define | `x.y.z.p` (4段) | `1.2.10.8` | 显示版本 (Sidebar底部) |
| `package.json` version | `x.y.zp` (3段 semver) | `1.2.1008` | electron-builder 严格校验 |
| `electron/main.cjs` title | 任意 | `v1.2.10.8` | 窗口标题 |
| `features.json` version | `x.y.z.p` | `1.2.10.8` | 元数据记录 |

版本更新时需同步的 5 个文件：package.json / vite.config.ts / vite.config.js / electron/main.cjs / features.json

---

## 6. 运行总线（批量执行）

### `src/stores/runBus.ts` · zustand
```
state: {
  currentRunId,     // 当前单节点运行 ID
  runningIds,       // 并发运行中的节点集合 (循环器并联)
  lastDone,         // 最后一次完成信息 {id, ok, ts, error?}
  mode,             // 'idle' | 'single' | 'batch'
  batchTotal,       // 批量总数
  batchDoneCount    // 批量已完成数
}
actions:
  triggerRun(id, mode='single'|'batch')   // 单节点调度
  triggerRunMany(ids, mode)               // 并发调度 (循环器专用)
  markDone(id, ok, error?)                // 节点完成回调
  cancelAll()                             // 取消全部
  setBatchProgress(total, done)           // 设置进度
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

# 开发（前端 11422 + 后端 18766，concurrently 并发）
npm run dev

# 类型检查 / 前端构建
npm run type-check
npm run build

# Electron 打包 (prepack:enc 加密后端 → electron-builder NSIS → _post_build.cjs 校验)
npm run dist
# 产物: dist_electron/T8-PenguinCanvas-Setup-x.x.xxxx.exe
```

打包前必做：
1. 确认 5 个文件版本号同步 (package.json / vite.config.ts / vite.config.js / electron/main.cjs / features.json)
2. `npm run type-check` 无报错
3. 用户分发包不得包含 `data/recharge.private.json`、非空 `AGENT_HMAC_KEY / DULUPAY_KEY`、`RECHARGE_DEFAULT_ENC` 可逆密文；`_post_build.cjs` 会强制检查
4. 详细 SOP 见 §47.6

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

### 11.11 Midjourney 节点对齐（gpt-image-2-web `runMJ` ·  渠道 · 无 FAL）

> Midjourney 复用 ImageNode（不新增独立节点类型），与 GPT2 / Nano Banana 2 / Nano Banana Pro 三家共用 [`ImageNode.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx)，通过 `modelDef.paramKind === 'mj'` 切到 MJ 专用面板与 MJ 提交分支。**MJ 没有 FAL 渠道**，本节是唯一权威参考，请勿自创另一套实现。

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
* 后端在 [`POST /api/proxy/mj/imagine`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) 中将上述字段重组上送。

#### 11.11.4 响应判定（轮询）

* `data.code === 1` 视为成功；其它 code 视为未就绪 `continue`。
* `data.status === 'FAILURE'` 抛错（取 `fail_reason`）。
* `data.status === 'SUCCESS'`：
  * 主图：`data.image_url`。
  * 4 张子图：`data.image_urls` 可能是 **JSON 字符串**，需 `JSON.parse` 解析为数组（每项形如 `{ url: '...' }` 或纯 string，参 [queryMjTask](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) 兼容写法）。

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
| `video` | `#fda4af` | rose-300 | video / seedance / frame-extractor / frame-pair / video-output |
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
├── FramePairNode.tsx       # 工具 | 首尾帧获取 (v1.2.7 新增、双 source handle)
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
| 前端端口 | `11422`（Vite dev server） |
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
- 推送命令：优先显式 `git add <path...>`，只有确认整个 worktree 都属于本次变更且通过安全扫描后才允许 `git add -A`
- 恢复到远程最新：`git fetch origin main && git reset --hard origin/main`
- 禁止强制推送 `--force`

### 21.5.1 GitHub 推送安全规范（强制）

> **MUST**：每次执行 `git push` 前必须逐条执行本节。任何一条不满足，立刻停止推送，先修复。

**充值密钥边界**：
- 公开仓库里的 `backend/src/routes/recharge.js::RECHARGE_DEFAULT_ENC` 必须保持空字符串：`const RECHARGE_DEFAULT_ENC = '';`
- 严禁把真实 `AGENT_HMAC_KEY`、`DULUPAY_KEY`、支付平台密钥、代理签名密钥、admin token、可逆加密后的同等内容写入源码、`skill.md`、`features.json`、提交信息、截图、日志或构建产物。
- 本地开发密钥只允许放在被 Git 忽略的 `data/recharge.private.json`，或通过环境变量注入：`RECHARGE_AGENT_BASE_URL`、`RECHARGE_AGENT_HMAC_KEY`、`RECHARGE_WEBSITE_URL`、`RECHARGE_DULUPAY_KEY`。
- `data/recharge.private.json` 可以存在于本机，但永远不能被 stage / commit / push；推送前必须确认它被忽略。

**Electron 用户分发包密钥边界**：
- 发给用户充值的 Electron 包绝不能内置 `AGENT_HMAC_KEY`。即使放进 `.t8c`、asar、NSIS 安装包、环境变量默认值或可逆密文，用户拿到包后仍可逆向提取。
- 当前 `data/recharge.private.json` 只允许用于本地开发/内测机器；不得随安装包、压缩包、更新包、资源目录或用户数据模板分发。
- 若要做正式用户充值包，安全架构必须改为：VPS/agent 持有 HMAC、支付平台密钥和转账权限；桌面端只调用无需客户端 HMAC 的公开下单/查单接口，并由 VPS 在支付成功后完成转账。
- `_post_build.cjs` 必须保留充值密钥安全闸：发现源码 `RECHARGE_DEFAULT_ENC` 非空，或 packaged `resources` 中有 `recharge.private.json`、非空 `AGENT_HMAC_KEY / DULUPAY_KEY`、`RECHARGE_DEFAULT_ENC` 可逆密文时，打包后校验直接失败。

**推送前必跑检查**：
```powershell
git status --short --branch
git status --short --ignored
git check-ignore -v data/recharge.private.json
rg -n "AGENT_HMAC_KEY|DULUPAY_KEY|RECHARGE_DEFAULT_ENC|secret|token|password|admin[_-]?token" backend/src src electron features.json skill.md package.json .gitignore
git diff --stat
git diff --cached --name-only
```

**扫描结果判定**：
- `git check-ignore -v data/recharge.private.json` 必须命中 `.gitignore`；若未命中，停止推送。
- `git status --short --ignored` 中 `data/recharge.private.json` 只能作为 ignored 文件出现，不能出现在 `A/M/??` 的待提交列表里。
- `rg` 只允许命中变量名、空配置和安全说明；若出现真实值、长 token、可逆密文、URL+密钥组合，停止推送。
- `git diff --cached --name-only` 不得包含 `data/`、`backend/data/`、`input/`、`output/`、`thumbnails/`、`build/`、`dist/`、`dist_electron/`、`.env*`、`*.log`。
- 如果 `backend/src/` 有改动，正式打包前必须重新 `npm run encrypt`；但 `build/backend-enc` 只用于本地打包验证，不推 GitHub。

**允许提交的内容**：
- 读取私有配置的代码、`.gitignore` 规则、安全文档、空配置占位。
- `data/recharge.private.json` 的路径说明和字段名说明。

**禁止提交的内容**：
- `data/recharge.private.json` 文件本身。
- 任何真实 HMAC / 支付回调密钥 / VPS agent 管理密钥。
- 从本地私有配置复制出来的 JSON、日志、调试输出、终端截图。
- `build/`、`dist/`、`dist_electron/`、本地输入输出素材、数据库和订单记录。

**本地密钥恢复原则**：
- 如果本地充值再次显示“支付服务未配置”，只能恢复 `data/recharge.private.json` 或设置 `RECHARGE_*` 环境变量。
- 不得为了恢复本地可用性把密钥写回 `RECHARGE_DEFAULT_ENC`、源码常量、文档或 tracked JSON。
- 若任何真实密钥曾经进入 GitHub、公开日志、压缩包或聊天截图，必须立即轮换。

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

## 25. 生成节点输出自动外挂 OutputNode 机制（极重要）

针对业务场景：生成类节点（ImageNode / VideoNode / SeedanceNode / AudioNode / RunningHubNode 等）输出的图像 / 视频 / 音频不宜在节点内部占位展示，需以独立 OutputNode 的形式自动外挂到右侧，便于后续接入其他下游节点。

### 25.1 总体架构

```
[生成节点 ImageNode]
   |├─> [output-auto-... #1]   pickKind=image, pickIndex=0
   |├─> [output-auto-... #2]   pickKind=image, pickIndex=1
   |├─> [output-auto-... #3]   pickKind=image, pickIndex=2
   |└─> [output-auto-... #4]   pickKind=image, pickIndex=3
```

- **三个独立 useEffect 协同完成**（1）创建、（2）拾取、（3）重排
- **限定 id 前缀 `output-auto-` + edge 前缀 `e-auto-`** 以与手动 OutputNode 区开，避免误伤
- **节点内预览隐藏**：生成节点内部预览区域通过 [`useHasAutoOutput`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useHasAutoOutput.ts) 检测下游是否已连 OutputNode，是则不渲染

### 25.2 三个 useEffect 职责

#### 第一个：自动创建外挂 OutputNode

位置：[`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 「自动创建输出素材节点」区块

```ts
const SKIP_TYPES = new Set(['output', 'groupBox', 'bulkPhantom', 'upload']);
const autoOutputProcessedRef = useRef<Map<string, string>>(new Map());

useEffect(() => {
  for (const n of nodes) {
    if (SKIP_TYPES.has(n.type)) continue;
    // 抽取输出项并按 kind 独立计算 kindIndex
    const items = [
      ...imgs.map((url, i) => ({ kind: 'image', url, kindIndex: i })),
      ...vids.map((url, i) => ({ kind: 'video', url, kindIndex: i })),
      ...auds.map((url, i) => ({ kind: 'audio', url, kindIndex: i })),
    ];
    const sig = items.map(x => `${x.kind}:${x.url}`).join('|');
    if (autoOutputProcessedRef.current.get(n.id) === sig) continue;
    // 按差额补创: needCount = items.length - existingOutputCount
    // 每个 OutputNode data 寫入 { pickKind, pickIndex: kindIndex }
  }
}, [nodes, edges, loaded]);
```

**防循环四重保险**：
1. SKIP_TYPES 跳过 OutputNode/groupBox/bulkPhantom/upload（避免链式爆炸）
2. autoOutputProcessedRef Map 记忆同 sig 不重复创建
3. 先写 ref 后 setNodes，避免下轮 useEffect 重进重复创建
4. needCount 差额报备，已有下游 OutputNode 不重复补

#### 第二个：OutputNode 按 pickKind/pickIndex 拾取单项

位置：[`OutputNode.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx) 的 `collected` useMemo 末尾

```ts
const pickKind = d.pickKind;        // 'image' | 'video' | 'audio'
const pickIndex = d.pickIndex;       // number
if (pickKind && typeof pickIndex === 'number') {
  if (pickKind === 'image') {
    out.images = out.images[pickIndex] ? [out.images[pickIndex]] : [];
    out.videos = []; out.audios = [];
  } else if (pickKind === 'video') { /* 同理 */ }
  else if (pickKind === 'audio')   { /* 同理 */ }
}
```

**为什么必须这么做**：OutputNode 原本会全量收集上游的 imageUrls，MJ 生成 5 图时 5 个 OutputNode 会全部重复显示 5 图。pickKind/pickIndex 让每个 OutputNode 只拾对应索引的那一项。

**手动连连的 OutputNode 不带 pickKind → 保留原语义（显示上游全部）**。

#### 第三个：按 measured 真实尺寸重排网格

位置：[`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 「自动外挂 OutputNode 的网格重排」区块

背景：创建时用了固定占位 350x360，但 OutputNode 实际高度取决于内部图片的 measured，小图节点 280 / 大图节点 600+，固定行高会造成节点上下遮挡。

```ts
const REORDER_GAP = 30;
const REORDER_COLS = 3;
useEffect(() => {
  // 1. 按 source 分组收集自动外挂节点 (id 以 'output-auto-' 开头)
  // 2. 按 pickIndex 排序
  // 3. dims = measured.width/height 优先, 未渲染出来前回退 320/360
  // 4. colMaxW[c] = max(该列节点 width)
  //    rowMaxH[r] = max(该行节点 height)
  // 5. colX[c] = colX[c-1] + colMaxW[c-1] + GAP
  //    rowY[r] = rowY[r-1] + rowMaxH[r-1] + GAP
  // 6. 误差 > 1px 才 setNodes (防 measured 微量抖动无限重渲染)
}, [nodes, edges, loaded]);
```

**效果**：
- 大图小图混排：第 1 行高度按该行最高节点决定，第 2 行从该高度之后开始 → 永不重叠
- 同列宽度对齐，节点左边缘沿列对齐
- 首屏：measured 还没有 → 用 320x360 占位，xyflow 渲染完一帧后 measured 出来再重排（用户感知为“瞬间贴边对齐”）

### 25.3 生成节点隐藏内部预览【必遵】

生成节点（ImageNode / VideoNode / SeedanceNode / AudioNode / RunningHubNode）完成后节点底部原本会画出结果预览，与右侧外挂的 OutputNode 重复。必须隔离：

```tsx
// 在节点顶部调用
const hasAutoOutput = useHasAutoOutput(id);

// 底部预览加条件
{imageUrl && !hasAutoOutput && <img src={imageUrl} ... />}
{videoUrl && !hasAutoOutput && <video src={videoUrl} ... />}
{tracks.length > 0 && !hasAutoOutput && tracks.map(...)}
{urls.length > 0 && !hasAutoOutput && urls.map(...)}
```

[`useHasAutoOutput`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useHasAutoOutput.ts) 内部用 `useNodeConnections({handleType:'source'}) + useNodesData` 订阅下游，检测是否有 type==='output' 的下游节点，连/断连都能实时重渲染。

**后续补准入生成节点时必须同步调用 useHasAutoOutput**，否则会出现“节点内 + OutputNode 两处重复显示”的 bug。

### 25.4 OutputNode 作为中继节点

OutputNode 不是终结节点，同时具备：
- 左侧 target Handle：接收上游 (text/image/video/audio/any)
- 右侧 source Handle：透传给下游 (any)

在 [`portTypes.ts`](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/portTypes.ts) 中：
```ts
output: { inputs: ['text', 'image', 'video', 'audio', 'any'], outputs: ['any'] },
```

透传的 useEffect 会把过滤后的 collected 写到自身 data：`prompt/text/reply/imageUrl/imageUrls/urls/videoUrl/audioUrl`（不踩 outputText，保留“用户编辑覆盖”语义）。

### 25.5 关键 Commit 索引

- `3cc7cd0` OutputNode 升级为中继节点（右侧 source Handle + 透传 useEffect）
- `5656721` 生成节点输出后自动创建并连接 OutputNode（第一个 useEffect）
- `6aea8f6` 生成节点已外挂 OutputNode 时隐藏自身预览（useHasAutoOutput hook）
- `95982de` 多图 pickKind/pickIndex 拾取对应项（修复 5 个 OutputNode 重复显示全部图的 bug）
- `9abead7` 初版网格排列（固定 350x360，已被下一步优化）
- `ce098bc` 按 measured 真实尺寸网格重排（第三个 useEffect，避免节点遮挡）

### 25.6 调谐参数

都在 [`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 顶部常量：

| 变量 | 默认 | 含义 |
|---|---|---|
| `REORDER_COLS` | 3 | 每行几个 OutputNode |
| `REORDER_GAP` | 30 | 节点间隔（横/纵） |
| `srcW + 80` | 80 | 源节点右边缘距离到首个 OutputNode 的边距 |
| 初始占位 350x360 | - | measured 出来前的临时坐标，仅在创建一帧生效 |

### 25.7 限制 / 不在本机制范围内的节点

- **LLM 节点的 history 对话列表**：不在隐藏范围，对话本身是节点主 UI。LLM 的最终 reply / generatedImages 仍会被 Canvas useEffect 扫描到并外挂 OutputNode。
- **StoryboardGridNode / PresetImageNode**：4 宫格 / 多角度节点本身就是以“网格画面”为核心 UI，不隐藏。如未来需要补上，同样只需加 `useHasAutoOutput` 判断。
- **手动连接的 OutputNode**：id 不带 `output-auto-` 前缀，position 不会被重排；data 不带 pickKind，会显示上游全部输出。

### 25.8 验证清单

- [ ] MJ 生成 5 图：右侧出现 5 个 OutputNode，每个显示不同的一张图
- [ ] 5 个 OutputNode 的排列为 3+2（首行 3，次行 2）
- [ ] 吃图高度不一时不会上下遮挡（第二行从首行最高节点下方开始）
- [ ] 生成节点本体不会重复显示生成结果（useHasAutoOutput 生效）
- [ ] 删除某个自动 OutputNode，生成节点内预览重新出现（兑底）
- [ ] 手动拖一个 OutputNode 连到 ImageNode：OutputNode 显示上游全部输出（未被 pickKind 限制）
- [ ] 重跑生成不会重复创建 OutputNode（sig 记忆生效）

---

## 26. 防回退守则（强制 · 极重要）

> 起因：commit `5656721` 名义上只做了「生成节点自动外挂 OutputNode」（OutputNode.tsx +1），但实际 stat 显示 7 文件 / +107 / **−661**。
> 它把前两个 commit 的成果一次性静默回退：
> - `e065970` 的 GroupBoxNode 右侧聚合输出口（−125 行）
> - `e065970` 的 portTypes outputs（−5 行）
> - `46e3b4c` 的 NodeActionBar 浮动操作栏（−251 行）
> - skill.md 第 17-21 章累积沉淀（−214 行）
>
> 用户和 agent 都没有察觉，直到这次 UI 反馈「组级聚合输出口不见了」才被发现。
> 修复 commit：`9a486e3` 用 `git checkout e065970 -- src/components/nodes/GroupBoxNode.tsx` 把 e065970 的版本拉回。

### 26.1 根因（事故学复盘）

典型「工作树未刷新就批量提交」事故。最可能流程：

1. 会话/IDE 早期已把 GroupBoxNode、NodeActionBar、portTypes、skill.md 的 **旧快照** 读入内存或临时副本
2. 中间 commit（e065970、46e3b4c）只更新了 git 索引 + 工作树物理文件，**没有触发** agent 内存里的文件 buffer 同步
3. 准备做下一个 commit 时，agent 用 `edit_file` / `search_replace` / `write_file` 对若干「主战场文件」做改动
4. 用 `git add -A` / `git commit -a` / `git add .` **批量提交**，把 agent 写回的「旧快照」一起当作「用户主动修改」打进 commit
5. 由于 commit message 只描述了「主战场意图」，回退动作被淹没，static review 难以察觉

### 26.2 防回退强制守则

**1. 严禁 `git add -A` / `git add .` / `git commit -a`**

所有 commit 必须使用精确文件路径：

```bash
# ❌ 严禁
git add -A
git add .
git commit -a -m "..."

# ✅ 强制
git add path/to/file1.ts path/to/file2.tsx
git commit -m "..."
```

**2. commit 前必校验 `git diff --staged --stat`**

```bash
git diff --staged --stat
```

核对清单：
- [ ] 列出的文件数量与 commit 意图相符（例如「只改 ImageNode」时不应出现 GroupBoxNode）
- [ ] 每个文件的 +/− 行数大致符合预期（删除大量行的文件必须警惕）
- [ ] **任何 commit message 没提到的文件，全部 `git restore --staged <file>` 撤回**

**3. commit 后立刻校验 `git show --stat HEAD`**

```bash
git show --stat HEAD
```

如果发现混入回退，**立即 `git revert HEAD` 或 `git reset --soft HEAD~1`** 后精挑文件重提。

**4. 会话/任务开始前必查 `git status` + `git diff`**

确认工作树干净（或仅有预期改动）后再开始新动作。如果发现「无来由的修改」，必须先 `git restore <file>` 复位，绝不带着脏改动开始新工作。

**5. 任何「批量改动」任务必须分文件 commit**

例如本次「上游素材聚合预览区」涉及 5 个文件，正确姿势：

```bash
# 第一波：新建 hook
git add src/components/nodes/useUpstreamMaterials.ts src/components/nodes/useOrderedMaterials.ts
git commit -m "feat(materials): 新增 useUpstreamMaterials/useOrderedMaterials hook"

# 第二波：新建 UI 组件
git add src/components/nodes/MaterialThumbnail.tsx src/components/nodes/MaterialPreviewSection.tsx
git commit -m "feat(materials): 新增 MaterialThumbnail/MaterialPreviewSection 组件"

# 第三波：节点接入
git add src/components/nodes/ImageNode.tsx package.json package-lock.json
git commit -m "feat(image-node): 接入聚合预览区"
```

**6. 关键文件（功能契约文件）必须建立白名单监控**

下列文件改动必须在 commit message 中显式说明，否则视为事故：

- `src/components/Canvas.tsx`
- `src/components/nodes/GroupBoxNode.tsx`
- `src/components/nodes/OutputNode.tsx`
- `src/components/nodes/ImageNode.tsx`
- `src/components/nodes/VideoNode.tsx`
- `src/components/nodes/SeedanceNode.tsx`
- `src/components/nodes/AudioNode.tsx`
- `src/components/nodes/LLMNode.tsx`
- `src/components/nodes/RunningHubNode.tsx`
- `src/components/NodeActionBar.tsx`
- `src/config/portTypes.ts`
- `src/utils/topologicalSort.ts`
- `skill.md`

### 26.3 事故应急流程

如果发生「功能不见了」类反馈，按以下流程定位：

```bash
# 1. 找出该文件最后一次「正常」状态的 commit
git log --oneline -- path/to/file.ts

# 2. 拉对应文件 blob 哈希追溯（关键诊断动作）
git ls-tree <commit-A> -- path/to/file.ts
git ls-tree <commit-B> -- path/to/file.ts
# 如果两个相邻 commit 的 blob 哈希不同, 说明 commit-B 改了该文件

# 3. 用 git show --stat 看该 commit 是否「夹带私货」
git show --stat <commit-B>

# 4. 单文件回滚到某历史版本（不影响其他文件）
git checkout <good-commit> -- path/to/file.ts

# 5. 校验后单独 commit
git add path/to/file.ts
git commit -m "fix: 恢复 xxx 功能(被 <bad-commit> 误回退)"
```

### 26.4 关键 Commit 索引

- `e065970` - GroupBoxNode 右侧聚合输出口（被回退原始版本）
- `46e3b4c` - NodeActionBar 浮动操作栏（被回退原始版本）
- `5656721` - **事故 commit**：名义「自动外挂 OutputNode」实际夹带 4 项回退（−661 行）
- `9a486e3` - 修复事故，恢复 GroupBoxNode 聚合输出口 + 取消 MaterialPreviewSection 折叠

---

## 27. 组容器聚合输出口·连接侧二次修复（4a2cc3d）

> 起因：第 26 章 `9a486e3` 仅恢复了 GroupBoxNode 组件层与右侧 source Handle UI，但 portTypes / Canvas 创建路径 / 历史画布持久化 三处「连接侧逻辑」也是被 `5656721` 一并误回退的，导致即便 UI 出现也无法连出。`4a2cc3d` 把这条链路彻底补齐。

### 27.1 修复点（四处协同）

| 位置 | 修复内容 | 作用 |
|---|---|---|
| [`portTypes.ts`](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/portTypes.ts) | 补回 `groupBox: { inputs: [], outputs: ['any'] }` | `getNodeOutputs(group)` 才能返回 `any`，进而通过 `isConnectionValid` |
| [`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) Ctrl+G 创建组 | 新建 groupBox 节点显式 `connectable: true` | xyflow 不会因 fallback `false` 而禁掉右侧 handle |
| [`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) `onConnect` | source 是 groupBox 时，自动断开「成员→同 target」的重复边 | 防止「组级聚合输出 + 成员独立输出」同时存在导致下游重复或循环 |
| [`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 加载画布 | 加载时 `n.type === 'groupBox' && n.connectable === false ? { ...n, connectable: true } : n` | 兜底修复 5656721 事故期间生成的旧画布 JSON |

### 27.2 onConnect 去重核心代码

```ts
if (src && src.type === 'groupBox' && tgt && params.target) {
  const memberIds: string[] = Array.isArray((src.data as any)?.memberIds)
    ? ((src.data as any).memberIds as string[])
    : [];
  if (memberIds.length > 0) {
    const memberSet = new Set(memberIds);
    const dupEdges = curEdges.filter(
      (e) => memberSet.has(e.source) && e.target === params.target,
    );
    if (dupEdges.length > 0) {
      const dupIds = new Set(dupEdges.map((e) => e.id));
      setEdges((eds) => eds.filter((e) => !dupIds.has(e.id)));
    }
  }
}
```

### 27.3 验证清单

- [ ] Ctrl+G 打组后右侧 source handle 可拖出连线
- [ ] 组→下游连接成立后，组成员→同一下游的旧边自动消失
- [ ] 加载历史画布（含 5656721 期间的 connectable:false 老 group）后，右侧出口可用
- [ ] portTypes.groupBox.outputs 包含 `'any'`，匹配任意目标

### 27.4 关键 Commit 索引

- `e065970` - 首次实现组聚合输出口（含 portTypes + Canvas + GroupBoxNode）
- `5656721` - 事故 commit 把 portTypes / Canvas 部分回退
- `9a486e3` - 仅恢复 GroupBoxNode UI 部分
- `4a2cc3d` - 本章修复：补齐 portTypes + Canvas 创建/加载/onConnect 四处连接侧逻辑

---

## 28. 上游素材聚合预览区·全节点接入（3eeacda · 5867b3e · 8732968）

> 第 21d5d5b 提出了 ImageNode 的 [`MaterialPreviewSection`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/MaterialPreviewSection.tsx) MVP，本阶段把同一机制接入 VideoNode / SeedanceNode / AudioNode，实现 **「上游 + 本地」按用户拖拽顺序统一呈现** 的体验闭环。

### 28.1 共通改造模板

生成节点接入时的标准 5 步：

1. `import` [`useUpstreamMaterials`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useUpstreamMaterials.ts) + [`useOrderedMaterials`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useOrderedMaterials.ts) + [`MaterialPreviewSection`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/MaterialPreviewSection.tsx)
2. 用 `materialOrder: string[]` 字段保存用户拖拽顺序，`update({ materialOrder })` 持久化
3. **上游字段读取改用 `ordered`**：原来 `upstream.images.map(...)` 直接拼，现改为 `orderedImages.map(...)`，提交给 API 的顺序就是用户拖拽顺序
4. 渲染替换：删除原始「参考图计数 / 上游列表」UI，统一渲染 `<MaterialPreviewSection ... />`
5. 移除冗余的 `useReactFlow` 解构（聚合预览区 hook 已封装订阅）

### 28.2 各节点 groups 配置

| 节点 | groups | 说明 |
|---|---|---|
| ImageNode | `['text', 'image']` | 文本提示词 + 参考图（含 MJ sref/oref） |
| VideoNode（grok / veo 子模型） | `['image']` | 仅图生视频时显示参考图 |
| VideoNode（seedance 子模型） | `['text', 'image', 'video', 'audio']` | seedance 全模态参考 |
| SeedanceNode | `['text', 'image', 'video', 'audio']` | 独立 Seedance 节点全开 |
| AudioNode（generate） | `['text']` | 歌词提示纯文本 |
| AudioNode（cover / extend） | `['text', 'audio']` | 文本 + 参考音频 |

### 28.3 AudioNode 双输出口的 audio 副轨支持

[`useUpstreamMaterials`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useUpstreamMaterials.ts) 同时收集 `data.audioUrl`（主轨）和 `data.audioUrl_1`（副轨），来源为 AudioNode 的双 source handle。任一非空都会作为独立 Material 推入 `audios[]`，供下游聚合预览或参考音频使用。

```ts
// 音频 (audioUrl 主轨, audioUrl_1 副轨——AudioNode 双输出口)
pushUrl(sid, 'audio', ud.audioUrl, audios);
pushUrl(sid, 'audio', ud.audioUrl_1, audios);
```

### 28.4 关键 Commit 索引

- `21d5d5b` - 首版 ImageNode 接入 MaterialPreviewSection（MVP）
- `3eeacda` - VideoNode 接入聚合预览区，groups 跟随子模型
- `5867b3e` - SeedanceNode 接入聚合预览区，全模态全开
- `8732968` - AudioNode 接入聚合预览区 + audioUrl_1 副轨

---

## 29. 用户反馈三连修复（a72ef9a）

本章是 28 章接入完成后的微调，源自实际使用反馈。

### 29.1 ImageNode 聚合区补 text 组

问题：ImageNode 的 `groups` 仅 `['image']`，导致上游 LLM 节点输出的提示词无法在聚合区呈现，与 VideoNode 行为不一致。

修复：[`ImageNode.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx) 第 1052 行 `groups={['text', 'image']}`。提示词以「文本卡」形式与参考图同列呈现，可被一并拖拽排序。

### 29.2 OutputNode 双层 div 修复 handle 截断

问题：`OutputNode` 外层容器使用 `overflow: hidden + 圆角` 来获得卡片裁切效果，但是 xyflow `Handle` 是相对于最外层 `.react-flow__node` 定位的子元素，被 `overflow: hidden` 一起裁掉了左右各 6px，导致圆点 handle 看起来「被切了一半」，不利点击。

修复结构调整为 **外层 relative 不裁切 + 内层 rounded + overflow:hidden 容器**：

```tsx
<div className="relative" style={{ width: 320 }}>
  <Handle type="target" position={Position.Left}  ... />
  <Handle type="source" position={Position.Right} ... />
  {/* 内层裁切容器: 圆角 + 越界裁切, 不影响外层 handle */}
  <div className="rounded-xl border-2" style={{ overflow: 'hidden', ... }}>
    {/* 头部 / body */}
  </div>
</div>
```

Handle 留在外层 div 内，不会被内层 overflow 截断；视觉裁切移交给内层。

### 29.3 OutputNode 透传过滤：含图视音时清空文本字段

问题：OutputNode 作为中继时，会把上游 collected 全量透传到自身 `data.{prompt,text,reply}`。当上游同时含「图 + 提示词」时，下游生成节点（图生图 / 图生视频）会把上下文提示词当作新的 prompt 强行拼到生成调用，污染参数。

修复 [`OutputNode.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx)（约第 176-189 行）：

```ts
const hasNonText =
  collected.images.length > 0 ||
  collected.videos.length > 0 ||
  collected.audios.length > 0;
const passText = hasNonText ? '' : (displayText || '');
const next: any = {
  prompt: passText,
  text: passText,
  reply: passText,
  // imageUrl/imageUrls/urls/videoUrl/audioUrl 照常透传
};
```

规则归纳：
- **混合模态**：仅透传非文本资源，文本字段置空（避免污染）
- **纯文本输出**：仍透传到 prompt/text/reply
- 始终不踩 `outputText`，保留「用户编辑覆盖」语义

### 29.4 关键 Commit 索引

- `a72ef9a` - 三处用户反馈一并修复

---

## 30. Handle 光标语义化 + 命中区外扩 8px（be7c2a3）

### 30.1 设计目标

生产实测中用户常把 handle 误识别为「拖动节点本体」，且圆点视觉直径仅 12px，命中精度差。

### 30.2 双主题光标策略

| 主题 | handle 光标 | 含义 |
|---|---|---|
| 科技风 | `crosshair`（十字准星） | 强调精准拖拽起点 |
| 像素风 | `cell`（方格 + 十字） | 8-bit 风的「像素格选取」隐喻 |

实现位置：
- 科技风：[`index.css`](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/index.css) `.react-flow__handle { cursor: crosshair !important; }` + `:hover` 同样保持
- 像素风：[`theme-pixel.css`](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/theme-pixel.css) 用 `html[data-theme-style="pixel"]` 选择器覆盖为 `cell`

### 30.3 ::before 透明伪元素扩大命中区 8px

核心思路：handle 视觉本体不变，但用 `position:absolute` 的透明 `::before` 把可点击区域向四周扩 8px，鼠标在视觉边缘外也能触发拖拽。

```css
.react-flow__handle::before {
  content: '';
  position: absolute;
  inset: -8px;          /* 上下左右各 -8px */
  border-radius: 50%;   /* 科技风圆形 */
}
/* 像素风升级为方形命中区 */
html[data-theme-style="pixel"] .react-flow__handle::before {
  border-radius: 0 !important;
}
```

效果：
- 视觉直径仍 12px，保持节点紧凑
- 实际命中区直径 28px，类似主流画布软件「魔法点击」体验
- `pointer-events` 自然继承自父 handle，无需额外 JS

### 30.4 关键 Commit 索引

- `be7c2a3` - handle cursor 双主题 + ::before 外扩 8px 感应区

---

## 31. SHIFT+空白拖动·剪刀划线批量断连（aadb6cc · 50ecd23）

> 解决「多条连线想一次性删除」的痛点，沿用主流节点编辑器（Blender / TouchDesigner）的剪刀手势：按住 SHIFT 在画布空白拖动，鼠标轨迹划过的所有 edge 一次性删除。

### 31.1 交互三阶段

| 阶段 | body class | 鼠标光标 | 触发条件 | 视觉反馈 |
|---|---|---|---|---|
| 预览态 | `shift-mode` | 剪刀（彩色） | 仅按住 SHIFT，光标悬停画布空白 / GroupBoxNode 空白 | 提示「在这里拖动可断连」 |
| 划线态 | `cut-mode` | 剪刀（彩色） | 预览态基础上按下左键并拖动 | SVG 红色虚线轨迹 + 命中 edge 标记 `.cut-marked` 高亮 |
| 提交 | （清除） | 默认 | mouseup 或 SHIFT 释放 | 批量从 `edges` 状态删除 cutSet 中所有 id |

双主题剪刀：
- 科技风：红色（`#EF4444`）矢量剪刀，`stroke-linejoin: round`
- 像素风：黄色填充 + 黑边（`#FFE066` / `#1A1410`）8-bit 剪刀，`shape-rendering: crispEdges`

### 31.2 触发条件白名单

[`Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) `onCutMouseDownCapture` 严格筛选：

```ts
// 排除: handle / button / input / textarea / [contenteditable] / edge 本体
if (
  targetEl.closest('.react-flow__handle') ||
  targetEl.closest('button') ||
  targetEl.closest('input') ||
  targetEl.closest('textarea') ||
  targetEl.closest('[contenteditable="true"]') ||
  targetEl.closest('.react-flow__edge')
) return;

// 仅允许: 画布空白 (.react-flow__pane) 或 GroupBoxNode 内部空白
const onPane = !!targetEl.closest('.react-flow__pane');
const groupNode = targetEl.closest('.react-flow__node-groupBox');
const inOtherNode = !!targetEl.closest('.react-flow__node') && !groupNode;
if (!onPane && !groupNode) return;
if (inOtherNode) return;
```

关键点：
- 普通业务节点 **不触发剪刀**，避免与节点拖动冲突
- 组节点空白区 **触发剪刀**，因为组内成员节点的连线常需局部清理
- handle / 按钮 / 输入框 / 编辑态 全部豁免

### 31.3 命中检测：mousemove + elementsFromPoint

```ts
const onCutMove = (mv: MouseEvent) => {
  cutPoints.push([mv.clientX, mv.clientY]);
  if (cutPoints.length > 200) cutPoints = cutPoints.slice(-200); // 限长防 polyline 膨胀
  cutPath.setAttribute('points', cutPoints.map((p) => p.join(',')).join(' '));
  // 命中检测: 鼠标下所有元素
  const els = document.elementsFromPoint(mv.clientX, mv.clientY);
  for (const el of els) {
    const edgeEl = el.closest?.('.react-flow__edge');
    if (!edgeEl) continue;
    const id = edgeEl.getAttribute('data-id') || '';
    if (!id || cutSet.has(id)) continue;
    cutSet.add(id);
    edgeEl.classList.add('cut-marked'); // 红色 / 粉色 高亮
  }
};
```

说明：
- 用 `elementsFromPoint` 而非 `elementFromPoint`，可穿透到下层 edge（避免 SVG overlay 遮挡）
- `cutSet` 累积所有划过的 edge id，去重 + 添加 `cut-marked` class
- 提交时 `setEdges((prev) => prev.filter((ed) => !idsToCut.has(ed.id)))` 一次完成

### 31.4 拦截 ReactFlow 默认 panning

ReactFlow 默认 SHIFT + 空白拖动会触发 panning。剪刀模式必须 **完全接管**：

```ts
const onCutMouseDownCapture = (e: MouseEvent) => {
  // ...白名单筛选...
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();   // 三连阻断, capture 阶段抢在 ReactFlow 之前
  // ...开始划线...
};
```

注册时使用 capture 阶段：`window.addEventListener('mousedown', onCutMouseDownCapture, true)`。

### 31.5 中断收尾

两种中断路径都必须清理：

1. `mouseup` → `finishCut()` 提交删除 + 清 DOM
2. SHIFT 键松开（拖动中途）→ `onCutKeyUp` → `finishCut()`

收尾动作：
- 删除 SVG overlay（移除 `cutSvg` DOM 节点）
- 移除 `body.cut-mode`
- 清除所有 `.cut-marked` class
- 解绑 `mousemove` / `mouseup` 监听

### 31.6 双主题 CSS 资产清单

| Class | 主题 | 视觉 |
|---|---|---|
| `body.shift-mode .react-flow__pane / .react-flow__node-groupBox` | 通用 | 仅按住 SHIFT 时画布空白 + 组空白 显示剪刀光标 |
| `body.cut-mode, body.cut-mode *` | 科技风 | 全局红色矢量剪刀 |
| `html[data-theme-style="pixel"] body.cut-mode` | 像素风 | 全局黄色 8-bit 剪刀 |
| `.react-flow__edge.cut-marked .react-flow__edge-path` | 科技风 | 红色 + 加粗 + 虚线 |
| `html[data-theme-style="pixel"] .react-flow__edge.cut-marked` | 像素风 | px-pink-deep 粉色 + 均匀虚线 |
| `.cut-overlay-svg .cut-overlay-path` | 科技风 | 红色半透明轨迹（`rgba(239,68,68,.85)`） |
| `html[data-theme-style="pixel"] .cut-overlay-svg .cut-overlay-path` | 像素风 | px-ink 黑色方虚线 |

### 31.7 验证清单

- [ ] 仅按住 SHIFT 不拖动：画布空白 / 组空白 显示剪刀；普通节点 / handle / 按钮显示原光标
- [ ] SHIFT + 空白拖动：进入 cut-mode，全局剪刀，划过的 edge 实时高亮
- [ ] 鼠标松开：被高亮的 edge 一次性消失
- [ ] 拖动途中松开 SHIFT：同样收尾删除
- [ ] 在普通业务节点内 SHIFT+拖动：不触发剪刀（仍可正常拖动节点）
- [ ] 在组节点空白处 SHIFT+拖动：触发剪刀（可清理组内连线）
- [ ] 切换像素风：剪刀 / 高亮 / 轨迹颜色全部跟随主题
- [ ] 划过 200 点以上：polyline 自动截断保留近 200 点（不卡顿）

### 31.8 关键 Commit 索引

- `aadb6cc` - SHIFT+空白拖动剪刀划线断连（双主题剪刀 + 实时高亮 + 轨迹覆盖）
- `50ecd23` - SHIFT 按下即预览剪刀光标（画布空白 + 组节点空白）双主题

---

## 32. 输出图片双击编辑 (裁剪 / 宫格切分)

需求：在 OutputNode 展示的任意图片上双击弹出编辑窗口，提供：

1. **裁剪**：可拖动框选区、三个角缩放。
2. **宫格切分**：等分模式（可调 rows/cols）与自定义切线模式（点布横/纵线、拖动、撤销、清空）。
3. **gap 边缘去缝**：多宫格拼图间隔色偏走时，手动调 gap（0-240 px）微调 halfGap 收缩两侧。

**产物营业原则**：**不修改原素材**，裁剪/切分后的 N 张图以独立 OutputNode 落在当前节点右侧 (3 列网格)，手动连接下游仍可透传。

### 32.1 后端能力补齐 - `backend/src/routes/imageOps.js`

```js
// 1) 新增 精确裁剪
router.post('/crop', async (req, res) => {
  const { imageUrl, x, y, w, h } = req.body || {};
  // ... fetch + sharp.extract({ left:x, top:y, width:w, height:h })
});

// 2) 扩展宫格切分
router.post('/grid-crop', async (req, res) => {
  const { imageUrl, rows, cols, gap, rectsPx } = req.body || {};
  // 分支 A: rectsPx[] 优先 (外部计算好的自定义切线矩形)
  // 分支 B: 等分 + halfGap 收缩内部边缘
  // 均调 sharp(buf).extract(...) 并序输出 N 个 saveBuffer
});
```

返回：`{ urls: string[], rows, cols, gap, layout: { rows, cols, gap } }`。

### 32.2 前端 service - `src/services/imageOps.ts`

```ts
export const opCrop = (imageUrl, x, y, w, h) =>
  postOp<{ imageUrl: string }>('crop', { imageUrl, x, y, w, h });

export const opGridCrop = (imageUrl, rows, cols, gap?, rectsPx?) =>
  postOp<{ urls; rows; cols; gap; layout }>(
    'grid-crop',
    { imageUrl, rows, cols, gap, rectsPx },
  );
```

### 32.3 弹窗组件 - `src/components/nodes/ImageEditModal.tsx`

状态机：

| 状态 | 含义 |
|---|---|
| `mode: 'crop' \| 'grid'` | 顶部 tab 切换 |
| `gridMode: 'preset' \| 'custom'` | 宫格子模式 |
| `crop: {x,y,w,h}` (0..1) | 裁剪框 fraction |
| `rows/cols/gap` | 预设等分参数 |
| `customLines: Line[]` | `{type:'h'\|'v', pos:0..1}` |
| `history: Line[][]` | 撤销栈 |
| `naturalSize: {w,h}` | onLoad 后记录原图 natural 像素 |

关键函数：

- `computeRects(W,H,rows,cols,gap,customLines)` — 判断 customLines 是否使用、合并 0/H 边界、输出 N 个 `{x,y,w,h,row,col}` (natural 像素)
- `lineHit(fx,fy,W,H)` — 阈值 `max(8, min(W,H)/80)` 像素转 fraction 判拖拽
- crop 拖拽五种模式：`move / tl / tr / bl / br`，拖动中实时 setCrop
- 应用：`applyCrop` 调 opCrop, `applyGrid` 调 opGridCrop（useCustom 时传 rectsPx）后 `onProduce(urls, meta)`

双主题适配：

- 科技风：`accent='#22d3ee'`、圆角、深底+青色 accent
- 像素风：`accent='#C73B6B'`、零圆角 + 2px 黑描边 + 8-bit 阴影 (`6px 6px 0 #1A1410`)
- SVG 预览线：像素风 `shape-rendering=crispEdges` + 2px 尚线

### 32.4 OutputNode 接入 - `src/components/nodes/OutputNode.tsx`

```tsx
// 1) 双击触发
<img src={u} onDoubleClick={(e) => { e.stopPropagation(); setEditingUrl(u); }} />

// 2) 产物回调 — 在本节点右侧 3 列网格创建 N 个独立 OutputNode
const handleProduce = (urls, _meta) => {
  const me = rf.getNode(id);
  const baseX = me.position.x + (me.measured?.width || 320) + 80;
  const baseY = me.position.y;
  const newNodes = urls.map((u, i) => ({
    id: `output-auto-edit-${id}-${Date.now()}-${i}-${rand}`,
    type: 'output',
    position: { x: baseX + (i % 3) * 350, y: baseY + Math.floor(i / 3) * 360 },
    data: { directImageUrl: u, imageUrl: u },
  }));
  rf.addNodes(newNodes);
};
```

**独立模式**：产物 OutputNode 不连边、不依赖上游，通过新字段 `data.directImageUrl` 独立展示。
OutputNode 的 collected 计算中增加分支：

```ts
if (typeof d.directImageUrl === 'string' && d.directImageUrl) {
  pushUnique(out.images, d.directImageUrl);
}
if (Array.isArray(d.directImageUrls)) {
  d.directImageUrls.forEach((u) => pushUnique(out.images, u));
}
```

### 32.5 ID 前缀与网格重排不冲突

- 产物 id 前缀 `output-auto-edit-`，区别于原生 `output-auto-`。
- 必要原因：重排 useEffect 仅同时匹配 `id.startsWith('output-auto-')` **且**连边 `id.startsWith('e-auto-')`。产物节点不创建 edge，因此不会被重排接管，位置以创建时为准。
- 依然占用 `output-auto-` 前缀是为了：如果产物被手动拖动，会被 Canvas 的 `userMoved` 标记逻辑包括在内，表现一致。

### 32.6 双主题样式补丁

| 选择器 | 作用 |
|---|---|
| `.img-edit-overlay` (index.css) | fixed 全屏 + blur(4px) + fade-in 180ms |
| `.img-edit-modal` | min(1180px, 92vw) + max-height 90vh |
| `.img-edit-stage img` (像素风) | `image-rendering: pixelated` + 2px 黑描边 + 零圆角 |
| `.crop-box / .crop-handle` (像素风) | 零圆角 + 1px 黑色硬阴影 |

### 32.7 验证清单

- [ ] 任何含图 OutputNode 双击图片→弹窗出现、ESC 关闭
- [ ] 裁剪模式：拖动框体/4 角缩放都生效，出图为原图裁剪后尺寸
- [ ] 宫格等分：rows/cols 可调，gap 为 0 时无边缘收缩，增加 gap 可去缝
- [ ] 宫格自定义：可加横线+纵线混合，拖动跳动平滑，撤销/清空生效
- [ ] 产物 N 张节点出现在右侧 (3 列网格)，各节点独立可裁剪×N
- [ ] 产物节点上充当上游连接下游 generator，下游 imageUrl 能读到产物图
- [ ] 原节点 imageUrl 保持不变（不修改原素材）
- [ ] 像素风下弹窗为零圆角 + 8-bit 硬阴影 + crispEdges
- [ ] 科技风下弹窗为圆角 + 青色 accent + 背景模糊

### 32.8 关键文件清单

- 后端：[backend/src/routes/imageOps.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/imageOps.js)
- service：[src/services/imageOps.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/imageOps.ts)
- 弹窗组件：[src/components/nodes/ImageEditModal.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageEditModal.tsx)
- 节点接入：[src/components/nodes/OutputNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx)
- 样式：[src/styles/index.css](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/index.css) + [src/styles/theme-pixel.css](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/theme-pixel.css)

---

## 33. 跨节点素材拖拽（Ctrl+拖 图/视/音/文）

需求：在画布上任意节点的图片/视频/音频缩略图上按住 Ctrl + 鼠标左键拖拽，可跨节点将该素材“送”到另一个节点。同时 **不能破坏** 原有 Ctrl 在画布/组空白处的框选多选逻辑。

### 33.1 架构总览

```
±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±
 source: 节点里有 [data-drag-source]
        元素（图/视/音 thumbnail）
         |
         |  Ctrl + 鼠标左键按下
         v
 MaterialDragOverlay
   document.addEventListener('pointerdown', fn, capture=true)
   document.addEventListener('mousedown',   fn, capture=true)
   ├─ elementsFromPoint(x,y) 穿透 SelectionPane 查找 [data-drag-source]
   ├─ e.preventDefault() + stopPropagation() + stopImmediatePropagation()
   └─ useDragMaterialStore.start(payload, x, y)
         |
         | mousemove 全局监听
         v
   elementsFromPoint(x,y) 查 [data-drop-kinds]
   → store.move(x, y, hoverTargetId, accepts)
   → 幽灵缩略图 createPortal(body) 跟随鼠标
         |
         | mouseup
         v
   window.dispatchEvent(new CustomEvent(MATERIAL_DROP_EVENT, { targetNodeId, payload }))
         |
         v
 target: 节点 useMaterialDropTarget({ id, accepts, onDrop })
   ├─ 返回 dropProps {data-drop-kinds, data-node-id}
   ├─ isAccepting=true 时节点 border-emerald + 双层绿色光晕
   └─ 由 onDrop(payload) 实际收下素材到节点 data
```

### 33.2 关键踩坑：ReactFlow Pane onPointerDownCapture

ReactFlow v12 在 [Pane](file:///e:/PenguinPravite/T8-penguin-canvas/node_modules/%40xyflow/react/dist/esm/index.mjs) 上使用 React 合成事件 `onPointerDownCapture` 启动 userSelection：

```js
// node_modules/@xyflow/react/dist/esm/index.mjs L1559
onPointerDownCapture: isSelectionEnabled ? onPointerDownCapture : undefined
```

同时浏览器事件顺序：**`pointerdown` → `mousedown`**。

这导致两个现象：

1. 节点内部的 React `onMouseDown` 是 bubble 阶段事件，理论上能拿到，但“userSelection”在 pointerdown 阶段已启动。
2. 仅拦截 `mousedown` 是太晚的：pointerdown 已经让 SelectionPane 进入 selection，“只看到框选，看不到拖拽”。

唯一可靠的拦截点是 **document 原生 capture 阶段上同时拦 pointerdown 与 mousedown**（`document.addEventListener('pointerdown', fn, true)`），它会 **先于 React root 上的 capture 事件** 触发，然后 `e.stopImmediatePropagation()` 阻止 React 合成事件分发。

```ts
// src/components/MaterialDragOverlay.tsx
useEffect(() => {
  const handleDown = (e: PointerEvent | MouseEvent): boolean => {
    if (e.button !== 0) return false;
    if (!(e.ctrlKey || e.metaKey)) return false;
    if ('isPrimary' in e && (e as PointerEvent).isPrimary === false) return false;
    if (useDragMaterialStore.getState().dragging) return false;

    // 穿透 SelectionPane 覆盖层
    const stack = document.elementsFromPoint(e.clientX, e.clientY);
    let dragEl: HTMLElement | null = null;
    for (const el of stack) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.hasAttribute('data-drag-source')) { dragEl = el; break; }
      const closest = el.closest('[data-drag-source]') as HTMLElement | null;
      if (closest) { dragEl = closest; break; }
    }
    if (!dragEl) return false; // 未命中素材→放行，保留原有 Ctrl 框选

    const kind = dragEl.getAttribute('data-drag-kind') as MaterialKind | null;
    if (!kind) return false;
    const url = dragEl.getAttribute('data-drag-url') || undefined;
    const text = dragEl.getAttribute('data-drag-text') || undefined;
    const sourceNodeId = dragEl.getAttribute('data-drag-node-id') || undefined;
    const previewUrl = dragEl.getAttribute('data-drag-preview') || url;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!useDragMaterialStore.getState().dragging) {
      start({ kind, url, text, sourceNodeId, previewUrl }, e.clientX, e.clientY);
    }
    return true;
  };

  const onPointerDown = (e: PointerEvent) => { handleDown(e); };
  const onMouseDown   = (e: MouseEvent)   => { handleDown(e); };
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('mousedown',   onMouseDown,   true);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('mousedown',   onMouseDown,   true);
  };
}, [start]);
```

### 33.3 为什么 mousemove 命中检测也要用 elementsFromPoint

拖拽期间用户 Ctrl 仍然按着，所以 SelectionPane 仍会覆盖在节点之上。`elementFromPoint` 只返回顶层元素（= SelectionPane），拿不到下面的 target 节点。必须用 `elementsFromPoint` 拿到堆叠列表，逐个检查 `closest('[data-drop-kinds]')`。

```ts
const onMove = (e: MouseEvent) => {
  const stack = document.elementsFromPoint(e.clientX, e.clientY);
  let dropEl: HTMLElement | null = null;
  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.hasAttribute('data-drop-kinds')) { dropEl = el; break; }
    const closest = el.closest('[data-drop-kinds]') as HTMLElement | null;
    if (closest) { dropEl = closest; break; }
  }
  // ...
};
```

### 33.4 store / hooks / overlay

| 文件 | 职责 |
|---|---|
| [src/stores/dragMaterial.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/dragMaterial.ts) | zustand store：`{ dragging, payload, clientX, clientY, hoverTargetId, hoverAccepts }` + `start/move/end`；导出 `MATERIAL_DROP_EVENT` (CustomEvent name) + 类型 `MaterialKind = 'image'\|'video'\|'audio'\|'text'` |
| [src/hooks/useMaterialDragSource.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/hooks/useMaterialDragSource.ts) | 选用。主路径仅靠 `data-drag-*` 属性 + capture 拦截启动拖拽 |
| [src/hooks/useMaterialDropTarget.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/hooks/useMaterialDropTarget.ts) | 节点 target 注册：返回 `dropProps {data-drop-kinds, data-node-id}` + `isAccepting`；中部监听 MATERIAL_DROP_EVENT、仅在 `targetNodeId === id` 时调 `onDrop(payload)` |
| [src/components/MaterialDragOverlay.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/MaterialDragOverlay.tsx) | 全局拖拽幽灵浮层 + 拦截启动 + 命中检测 + ESC 取消；createPortal(document.body) 不受 ReactFlow transform 影响 |

### 33.5 完整节点 source/target 能力表

| 节点 | 作为 source （可拖出） | 作为 target （可拖入） | 拖入后写入字段 |
|---|---|---|---|
| OutputNode | 收集到的 image/video/audio | 全部：image/video/audio/text | `directImageUrl/directVideoUrl/directAudioUrl/directText` |
| UploadNode | 上传后的 image/video/audio | 不接收 | — |
| ImageNode | 输出 imageUrl | image → referenceImages；text → prompt | `data.referenceImages` / `data.prompt` |
| VideoNode | 输出 videoUrl | image → localRefImages；text → prompt | `data.localRefImages[]` / `data.prompt` |
| AudioNode | 领 audioUrl（各 track） | audio → localRefAudio；text → prompt | `data.localRefAudio` / `data.prompt` |
| LLMNode | 历史与当前 picked 图 | image → pickedFiles；text → prompt | `pickedFiles[]` / `data.prompt` |
| SeedanceNode | 输出 videoUrl | image/video/audio/text 全支持 | `localRefImages/Videos/Audios` / `data.prompt` |

### 33.6 source 素材元素标记 (必填)

所有缩略图 / 播放器都要加 `data-drag-*` 属性，供 document capture 拦截使用：

```tsx
<img
  src={imageUrl}
  data-drag-source
  data-drag-kind="image"          // 'image' | 'video' | 'audio' | 'text'
  data-drag-url={imageUrl}
  data-drag-preview={imageUrl}     // 可选，缝略默认 = data-drag-url
  data-drag-node-id={id}
  onMouseDown={(e) => beginMaterialDrag(e, { kind: 'image', url: imageUrl, sourceNodeId: id, previewUrl: imageUrl })}
  title="Ctrl+拖拽可送到其他节点"
/>
```

> **注意**：React 中 `<img data-drag-source />` 会被渲染为 `data-drag-source=""`，`hasAttribute('data-drag-source')` 返回 true。

### 33.7 target 节点接入样例

```ts
// VideoNode
const handleDrop = (payload: MaterialPayload) => {
  if (payload.kind === 'image' && payload.url) {
    update({ localRefImages: dedupePush(localRefImages, payload.url) });
  } else if (payload.kind === 'text' && typeof payload.text === 'string') {
    update({ prompt: payload.text });
  }
};
const { dropProps, isAccepting } = useMaterialDropTarget({
  id,
  accepts: ['image', 'text'],
  onDrop: handleDrop,
});

// 根 div 上面:
<div
  className={`... ${isAccepting ? 'border-emerald-400' : 'border-white/10'}`}
  style={{
    boxShadow: isAccepting
      ? '0 0 0 2px rgba(52,211,153,.45), 0 12px 30px rgba(52,211,153,.18)'
      : undefined,
  }}
  {...dropProps}
>
  ...
</div>
```

### 33.8 本地拖入字段与 collectUpstream 合并去重

为让拖入的素材**在生成时也起作用**，Video/Seedance/Audio 节点增加 d.localRefXxx 字段并合并进 collectUpstream：

```ts
// VideoNode
const localRefImages: string[] = Array.isArray(d?.localRefImages) ? d.localRefImages : [];
const collectUpstream = () => {
  const upImageUrls = orderedImages.map((m) => m.url).filter(Boolean);
  const merged: string[] = [];
  for (const u of [...upImageUrls, ...localRefImages]) {
    if (u && merged.indexOf(u) === -1) merged.push(u);
  }
  return { prompt, imageUrls: merged };
};
```

SeedanceNode 同时有 image / video / audio 三类本地拖入字段 + dedupe 合并。

### 33.9 零破坏保证

- 未点中 `data-drag-source` 时拦截函数 `return false` 放行，原有逻辑都保留：
  - 画布/组空白处 Ctrl+拖动 → ReactFlow 原框选多节点
  - Ctrl+Shift+点击 → 叠加多选
  - 右键菜单 / 组执行 / GroupBox 拖动联动 / runBus / Handle 连线 / 双击编辑 都不受影响
- isAccepting 动态边框仅在 `dragging && hoverTargetId === id` 时出现，不会干扰默认 selected/non-selected 状态。

### 33.10 验证清单

- [ ] 按住 Ctrl + 左键拖动任何节点上的图片/视频/音频缩略图 → 出现跟随光标的幽灵缩略图（不出选框）
- [ ] 拖入兼容节点时该节点 border 变绿 + 双层绿光晕
- [ ] mouseup 后拖入字段被写入节点 data（刷新页面后仍持久化）
- [ ] ESC 取消拖拽
- [ ] 拖到不兼容节点时不会写入
- [ ] 拖到画布空白处不会变为原框选
- [ ] **仍可以在画布/组空白处 Ctrl+拖动启动 ReactFlow 原框选多选**（零破坏）
- [ ] Ctrl+Shift+点击叠加多选仍然有效
- [ ] 拖入后在节点里可以重新 Ctrl+拖出去（本地素材本身也是 source）

### 33.11 提交记录

- `feat(canvas): add cross-node material drag-drop (Ctrl+drag image/video/audio/text)` · commit `4196415`·12 files·+842 -35
- `fix(canvas): intercept Ctrl+mousedown via document capture so SelectionPane no longer swallows material drag` · commit `4dc24aa`·8 files·+147 -2
- `fix(canvas): intercept pointerdown (not just mousedown) to win over ReactFlow Pane onPointerDownCapture` · commit `f962f59`·1 file·+33 -19

### 33.12 关键文件清单

- store：[src/stores/dragMaterial.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/dragMaterial.ts)
- hooks：[src/hooks/useMaterialDragSource.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/hooks/useMaterialDragSource.ts) + [src/hooks/useMaterialDropTarget.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/hooks/useMaterialDropTarget.ts)
- overlay：[src/components/MaterialDragOverlay.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/MaterialDragOverlay.tsx)
- 节点接入：[OutputNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx) / [UploadNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/UploadNode.tsx) / [ImageNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx) / [VideoNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/VideoNode.tsx) / [AudioNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/AudioNode.tsx) / [LLMNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LLMNode.tsx) / [SeedanceNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/SeedanceNode.tsx)
- 画布挂载：[src/components/Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)（`<MaterialDragOverlay />` 节点树外渲染）

---

## 34. 侧边栏节点暂时隐藏（13 个）

使用场景：部分节点需要从 UI 上隐藏（如未打磨、底层逻辑未重构完成），但必须保证已使用这些节点的画布仍能加载与运行。采用「仅隐藏 UI 入口、保留节点类型注册」的轻量开关。

### 34.1 设计要点

- **开关位置**：[NodeMeta](file:///e:/PenguinPravite/T8-penguin-canvas/src/types/canvas.ts) 新增可选字段 `hidden?: boolean`。
- **不动三处**：
  1. `NODE_REGISTRY` 仍保留全部 26 节点 → [Canvas.tsx 的 nodeTypes 注册表](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 靠它生成，保证已存在画布中的节点仍可加载、渲染、运行、连边、拖动。
  2. `getNodeMeta(type)` 反查仍能拿到隐藏节点的元数据 → [PlaceholderNode](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/PlaceholderNode.tsx) / 意外路径不会坍。
  3. `canvasTemplates.ts` 模板中直接 `makeNode('storyboard-grid')` 之类仍可生成。
- **只动两处过滤**：
  1. [NODE_GROUPS](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/nodeRegistry.ts) 各分类 filter 补充 `&& !n.hidden` → [Sidebar](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Sidebar.tsx) 不再渲染。
  2. [Canvas.tsx candidateMetas](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx#L1768) 首行 `if (meta.hidden) return [];` → 从 Handle 拖出后的能力匹配候选菜单不再出现。

### 34.2 三个 UI 入口均已覆盖

| 入口 | 是否受控 | 原因 |
| --- | --- | --- |
| 左侧 Sidebar 节点列表 | 是 | 走 NODE_GROUPS，已 filter |
| 右键画布空白快添加(QUICK_NODES) | 不受影响 | 本来就只取 input + core，不包含任何被隐藏节点 |
| Handle 拖出能力匹配候选菜单 | 是 | candidateMetas 首行跳过 hidden |
| 拖拽素材跨节点投递 | 不受影响 | 与节点是否隐藏无关，target 仍走 [data-drop-kinds](file:///e:/PenguinPravite/T8-penguin-canvas/src/hooks/useMaterialDropTarget.ts) |

### 34.3 隐藏节点清单（13 个）

| 分类 | type | label |
| --- | --- | --- |
| 特殊 | multi-angle-3d | 多角度 3D |
| 特殊 | panorama-720 | 720 全景 |
| 特殊 | penguin-portrait | 企鹅肖像 |
| 特殊 | portrait-metadata | 肖像元数据 |
| 特殊 | storyboard-grid | 分镜网格 |
| 工具 | drawing-board | 画板 |
| 工具 | browser | 浏览器 |
| 工具 | image-compare | 图片对比 |
| 工具 | frame-extractor | 抽帧 |
| 工具 | frame-pair | 首尾帧获取 |
| 工具 | remove-bg | 抠图 |
| 工具 | upscale | 放大 |
| 辅助 | edit | 编辑 |
| 辅助 | video-output | 视频输出 |

### 34.4 可见节点清单（18 个）

- input(2)：upload / output
- core(6)：text / image / video / seedance / audio / llm
- rh(2)：runninghub / rh-config
- utility(3)：resize / combine / grid-crop
- auxiliary(3)：idea / bp / relay
- toolbox(2)：cinematic / video-motion

### 34.5 重新启用某个节点

在 [src/config/nodeRegistry.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/nodeRegistry.ts) 对应行删除 `, hidden: true` 即可，零代码改动，无需重启服务。

### 34.6 零破坏保证

- 所有隐藏节点仍在 [NODE_REGISTRY](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/nodeRegistry.ts) 中→ nodeTypes 仍有完整组件映射。
- 已存在画布反序列化加载后仍能正常渲染与交互。
- 模板 [canvasTemplates.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/canvasTemplates.ts) 中 「三视图分镜」 仍可生成 multi-angle-3d + storyboard-grid 节点。
- 仅「用户从侧边栏主动添加」与「从 Handle 拖出后出现的候选菜单」 这两个发现路径被会过滤。

### 34.7 验证清单

- [x] `npx tsc --noEmit` 无报错
- [x] `npx vite build` 成功（4.05s）
- [x] features.json `node -e "require('./features.json')"` 可加载，phase16.items=7
- [x] 左侧侧边栏不再出现上述 13 个节点
- [x] 从任意 Handle 拖出后的候选菜单不再出现上述 13 个节点
- [x] 右键画布空白快添加菜单不受影响（仅 input+core）

### 34.8 关键文件清单

- [src/types/canvas.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/types/canvas.ts)——`NodeMeta.hidden?: boolean`
- [src/config/nodeRegistry.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/nodeRegistry.ts)——13 个节点打 `hidden: true` + `NODE_GROUPS` filter 补 `!n.hidden`
- [src/components/Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)——candidateMetas 首行 `if (meta.hidden) return [];`


---

## 35. RelayNode 全字段透传修复（v1.5.2）

### 35.1 用户报告

> 上传素材节点连接到中继节点，提示无数据透传，中继节点连接到输出素材节点也没有反应。

UploadNode → RelayNode → OutputNode 这条最常用的链路，上传**视频或音频**时彻底断流：RelayNode 显示「无数据透传」，OutputNode 也完全无反应。上传图像勉强能工作，但也不全。

### 35.2 根因

原版 [RelayNode](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RelayNode.tsx) 仅透传三个字段：`prompt / imageUrl / urls`。而：

- [UploadNode](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/UploadNode.tsx) 按 `uploadType` 写入：`image → imageUrl`、`video → videoUrl`、`audio → audioUrl`
- [OutputNode](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx) 通过 `useNodeConnections + useNodesData` 订阅上游：`prompt / outputText / reply / text + imageUrl / imageUrls / urls / generatedImages + videoUrl + audioUrl`

→ RelayNode 完全看不到 `videoUrl / audioUrl / imageUrls / generatedImages / outputText / reply / text`，自身 `data` 上自然不会出现这些字段，下游 `useNodesData` 读到的就是空。

### 35.3 修复要点

#### A. 透传范围扩展（4 类素材全覆盖）

```ts
const pushUnique = (arr: string[], v: any) => { /* 字符串去重收集 */ };

for (const uid of upstreamIds) {
  const ud = (n?.data as any) || {};
  // 文本：优先级 outputText > reply > prompt > text
  pushUnique(texts, ud.outputText);
  pushUnique(texts, ud.reply);
  pushUnique(texts, ud.prompt);
  pushUnique(texts, ud.text);
  // 图像：单 + 多都收集
  pushUnique(images, ud.imageUrl);
  for (const k of ['imageUrls','urls','generatedImages']) {
    if (Array.isArray(ud[k])) ud[k].forEach((u) => pushUnique(images, u));
  }
  // 视频 / 音频：首个命中为准
  if (!videoUrl && typeof ud.videoUrl === 'string' && ud.videoUrl) videoUrl = ud.videoUrl;
  if (!audioUrl && typeof ud.audioUrl === 'string' && ud.audioUrl) audioUrl = ud.audioUrl;
}

update({
  prompt: texts.length ? texts.join('\n') : undefined,
  imageUrl: images[0],
  imageUrls: images.length > 1 ? images : undefined,
  urls: images.length > 1 ? images : undefined,  // 老代码兼容
  videoUrl,
  audioUrl,
});
```

#### B. 死循环防护（严格对齐 §22.2）

```ts
const upstreamSignature = useMemo(() => {
  // 拼接所有透传字段：上游任意一项变化 signature 才会变
  return upstreamIds.map(uid => [uid, ud.prompt, ud.outputText, ud.reply, ud.text,
    ud.imageUrl, ud.videoUrl, ud.audioUrl,
    arrLen('imageUrls'), arrLen('urls'), arrLen('generatedImages')
  ].join('|')).join('::');
}, [p.id, p.data, getEdges, getNodes]);

useEffect(() => {
  // ...收集 + 合并...
  const cur = JSON.stringify({ prompt: d?.prompt, imageUrl: d?.imageUrl, /* ... */ });
  const next = JSON.stringify(merged);
  if (cur !== next) update(merged);    // 仅真变化才写回
}, [upstreamSignature]);                // ❶ 必须有 deps;❷ 必须 cur !== next
```

两条不可缺：

1. `useEffect` deps 必须为 `[upstreamSignature]`（无 deps → setState 风暴 → 浏览器卡死）
2. `update()` 前必须 `cur !== next` 深度比较（同 update 内容多次写入 → 节点 data 仍触发其它订阅者重渲）

#### C. 零上游主动清理

```ts
if (upstreamIds.length === 0) {
  // 断开所有上游后，主动把残留素材清空，避免误导下游
  if (cur !== empty) {
    update({ prompt: undefined, imageUrl: undefined, imageUrls: undefined,
             urls: undefined, videoUrl: undefined, audioUrl: undefined });
  }
  return;
}
```

不清理会导致：A → Relay → B 链路把 A 删掉后，Relay 仍向 B 透传旧素材，B 误以为还在工作。

### 35.4 UI 显示

节点内 4 个素材指示器：

```tsx
{hasText  && <div>📝 {prompt前30字}</div>}
{imageCnt && <div>🖼 {imageCnt} 张图</div>}
{hasVideo && <div>🎬 1 个视频</div>}
{hasAudio && <div>🎵 1 个音频</div>}
{!hasAny  && <div>无数据透传</div>}
```

### 35.5 字段对照速查表

| 素材类型 | UploadNode 写入 | RelayNode 透传读取 | RelayNode 透传写出 | OutputNode 订阅读取 |
|---|---|---|---|---|
| 文本 | —（无写入）| `outputText / reply / prompt / text`（优先级）| `prompt`（join '\n'）| `prompt / outputText / reply / text` |
| 图像 | `imageUrl` | `imageUrl + imageUrls / urls / generatedImages` | `imageUrl + imageUrls / urls` | `imageUrl + imageUrls / urls / generatedImages` |
| 视频 | `videoUrl` | `videoUrl` | `videoUrl` | `videoUrl` |
| 音频 | `audioUrl` | `audioUrl` | `audioUrl` | `audioUrl` |

### 35.6 验证清单

- [x] `npx tsc --noEmit` 无报错
- [x] `npx vite build` 成功（5.25s）
- [x] UploadNode(image) → RelayNode → OutputNode 图像可显示
- [x] UploadNode(video) → RelayNode → OutputNode 视频可播放（**主修复点**）
- [x] UploadNode(audio) → RelayNode → OutputNode 音频可播放（**主修复点**）
- [x] TextNode → RelayNode → OutputNode 文本可显示
- [x] ImageNode/VideoNode/AudioNode/LLMNode → RelayNode → OutputNode 全链路均工作
- [x] 多个上游同时连入 RelayNode：文本拼接、图像数组合并、视频/音频取首个命中
- [x] 断开 RelayNode 上游后，下游自动清空（不残留旧素材）

### 35.7 关键文件

- [src/components/nodes/RelayNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RelayNode.tsx)（唯一修改文件）
- 字段对齐参考：[UploadNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/UploadNode.tsx) / [OutputNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx)
- 死循环规范：本文档 §22.2

---

## 36. 节点拖出候选菜单·中继节点置顶（v1.5.3）

### 36.1 需求

从任意节点 Handle 拖出到画布空白区后，弹出的「连接到…」 / 「从…输入」候选菜单中，**中继（relay）节点永远置顶**。

原因：中继节点是跨距离连线 / 多上游合并 / 下游分发的高频中转点，原本按 NODE_REGISTRY 顺序在后面，需要滚动才能看到，不体贴。

### 36.2 实现

只需在 [Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 的 `pickerCandidates` useMemo 末尾追加一条稳定排序：

```ts
return NODE_REGISTRY.flatMap((meta) => {
  // …过滤 + 能力匹配逻辑保持不变…
  return [{ ...meta, matchedTypes: matched }];
}).sort((a, b) => {
  // 中继节点(relay)永远置顶
  if (a.type === 'relay' && b.type !== 'relay') return -1;
  if (b.type === 'relay' && a.type !== 'relay') return 1;
  return 0;            // 其余项保持原 NODE_REGISTRY 顺序(稳定排序)
});
```

要点：

- **只动 relay**：其余节点顺序完全不变，不引入额外优先级表
- **返回 0**：Array.prototype.sort 在现代引擎中为稳定排序，relay 之外的顺序 ≡ NODE_REGISTRY 顺序
- **仅影响这一个入口**：Sidebar / QUICK_NODES / NODE_GROUPS 都不受影响

### 36.3 入口对比

| 入口 | 顺序来源 | relay 位置 |
|---|---|---|
| 左侧 Sidebar | NODE_GROUPS（按分类）| auxiliary 分组内原位 |
| 右键快添加 | QUICK_NODES = input + core | 不包含（本例不受影响）|
| **Handle 拖出候选** | NODE_REGISTRY + sort(relay置顶) | **首位** |

### 36.4 关键文件

- [src/components/Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)——`pickerCandidates` useMemo 末尾 `.sort()`

---

## 37. LLM 多模态 image_url 预处理（v1.5.4）

### 37.1 用户报告

> LLM 节点传入图片后报错：
>
> ```
> 上游 HTTP 500: get file data from 'base64:/files/input/up_1779512616397_ty1b.png'
> failed: failed to decode base64 data: illegal base64 data at input byte 15
> code: convert_request_failed
> ```

### 37.2 根因

错误链路：

1. [UploadNode](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/UploadNode.tsx) 上传完后后端 `/api/files/upload` 返回本项目本地相对路径 `/files/input/up_xxx.png`。
2. [LLMNode.collectUpstream](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LLMNode.tsx) 取上游 `imageUrl` 后直接放到 `image_url.url`。
3. 后端 [proxy.js /llm](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) 原本 **原样透传** `messages` 给上游贞贞工坊 `/v1/chat/completions`。
4. 上游服务器无法访问本项目本地静态，拿到 `/files/input/...` 后错误地试图当 base64 解码 → 崩溃。

### 37.3 修复思路（对齐 gpt-image-2-web chat 多模态）

在后端 `/llm` 路由进入上游前，扫描 `messages` 中所有 `content` 数组里的 `image_url.url`，按前缀处理：

| 前缀 | 处理 |
|---|---|
| `data:` | 保留（已是 base64）|
| `http://` / `https://` | 保留（外网 URL 上游可访问）|
| `/files/*` | 本地拉 buffer → 转 `data:image/xxx;base64,xxx` dataURL |
| 其他 | 保留原值，让上游报真错误 |

### 37.4 实现

在 [proxy.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) `refToBananaImage` 之后新增：

```js
async function normalizeLlmMessageImages(messages) {
  if (!Array.isArray(messages)) return messages;
  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (!part || part.type !== 'image_url' || !part.image_url) continue;
      const url = part.image_url.url;
      if (typeof url !== 'string' || !url) continue;
      if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) continue;
      if (url.startsWith('/files/')) {
        const dataUrl = await refToBananaImage(url);  // 复用现有 helper
        if (dataUrl) part.image_url.url = dataUrl;
        else throw new Error(`本地图片读取失败: ${url}`);
      }
    }
  }
  return messages;
}
```

在 `/llm` 路由头部：

```js
let normalizedMessages;
try {
  normalizedMessages = await normalizeLlmMessageImages(messages);
} catch (e) {
  return res.status(400).json({ success: false, error: e.message || '参考图预处理失败' });
}
const payload = { model, messages: normalizedMessages, /* ... */ };
```

### 37.5 零破坏保证

- `content` 为字符串的普通文本消息（非多模态）不动
- 原本就是 `data:image/xxx;base64,...` 的 dataURL（本地选图）不动
- 外网 `http(s)://` 参考图（如 ImageNode 生成后转存的 OSS URL）不动
- LLMNode 前端代码零修改，`buildMessages` / `collectUpstream` / `pickedFiles` 逻辑全保留
- 其他路由（`/image/*` / `/video/*` / `/audio/*` / MJ / FAL / RH）不受影响

### 37.6 验证清单

- [x] `node -c backend/src/routes/proxy.js` 语法检查通过
- [x] `npx tsc --noEmit` 无报错
- [x] `npx vite build` 成功（5.46s）
- [x] UploadNode(image) → LLMNode 走上游变 base64 dataURL不再报 convert_request_failed
- [x] OutputNode/ImageNode/RelayNode 生成的纯 `/files/*` 路径进 LLM 同样会被转 base64
- [x] LLMNode 本地选图（本身就是 data: dataURL）走原路径未受影响
- [x] 外网 https:// 参考图走原 URL 未受影响

### 37.7 关键文件

- [backend/src/routes/proxy.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)——新增 `normalizeLlmMessageImages` + `/llm` 路由头部调用
- 参考 helper：同文件 `refToBananaImage`（line 140-155）
- 上游字段读取：[LLMNode.tsx collectUpstream](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LLMNode.tsx#L121-L139)

---

## 38. 图像轮询超时上限抬高：120s → 3600s（v1.5.5）

### 38.1 背景

用户反馈：**GPT2 模型超时等待现在可能是 120 秒，改成 3600 秒**。

原因：GPT2 / nano-banana / nano-banana-pro 标准异步路径上，**复杂 prompt** 或 **多参考图** 任务上游实际还在排队 / 生成，前端却被 `60×2s = 120s` 提前中断报超时。

### 38.2 原轮询参数（紧耦合在两处）

| 位置 | 字段 | 原值 | 合计上限 |
|---|---|---|---|
| [ImageNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx#L466-L495) “原有标准路径” | `maxPoll = 60` / `interval = 2000` | 60 × 2s | **120 s** |
| [proxy.js pollImageTask](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) | `maxRetries = 60` / `interval = 2000` | 60 × 2s | **120 s** |

两处都针对同一个上游路由 `/v1/images/tasks/{tid}`。

### 38.3 修复

只调次数上限，间隔 2s 不变：

```diff
- const maxPoll = 60;       // 最多 60 次
+ const maxPoll = 1800;     // 最多 1800 次  (1800 × 2s = 3600s = 60 分钟)
  const interval = 2000;    // 每 2 秒一次
```

```diff
- async function pollImageTask(taskId, apiKey, maxRetries = 60, interval = 2000) {
+ async function pollImageTask(taskId, apiKey, maxRetries = 1800, interval = 2000) {
```

### 38.4 适用范围

仅影响 **标准异步任务轮询**（贞贞工坊 `/v1/images/tasks/{tid}`）走的模型：

- GPT Image 2
- nano-banana-2
- nano-banana-pro

**不影响**以下独立超时逻辑的模型，他们各自保持原有参数：

| 模型 | 轮询位置 | 参数 |
|---|---|---|
| Midjourney | [ImageNode.tsx L301-L342](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx#L301-L342) | `maxPoll=300 × 3s` |
| GPT2-FAL / nano-banana-pro-FAL | [ImageNode.tsx L390-L429](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx#L390-L429) | `600 × 3s` |
| Seedance / Veo3 / Grok-FAL | SeedanceNode / VideoNode | 各自 `maxPoll/pollInt` |
| Suno | AudioNode | `60 × 3s` |

### 38.5 零破坏保证

- 任务 `status=success/failed` 一旦返回仍会立即出循环，**不会造成正常任务 60 分钟空转**
- 只是上限抬高，调用方脚本（不传 maxRetries）自动获得 3600s；传了自定义值的调用仍按传入走
- 进度日志“[i+1/maxPoll]”可能跳动变大，仅为提示作用，不影响逻辑
- 前后端同步修改防止 `/api/proxy/image` 同步代理路径（极少走）仍被 120s 提前截断

### 38.6 验证清单

- [x] `node -c backend/src/routes/proxy.js` 语法检查通过
- [x] `npx tsc --noEmit` 无报错
- [x] `npx vite build` 成功（5.33s）
- [ ] GPT2 复杂 prompt + 4 参考图任务可运行超过 2 分钟仍不被前端提前中断（待用户验证）

### 38.7 关键文件

- [src/components/nodes/ImageNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageNode.tsx#L466-L470)——`maxPoll` 60 → 1800
- [backend/src/routes/proxy.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)——`pollImageTask` 默认 `maxRetries` 60 → 1800

---

## 39. Shift+拖拽剪刀模式黑色 edge 命中丢失修复（v1.5.6）

### 39.1 用户报告

> 按住 shift 时候图标变成剪刀，但是无法剪短这种黑色的线，粉色的线可以，可能是默认没激活的线无法剪断？

### 39.2 根因

edge 在像素主题下默认 stroke-width 仅 **2.5 px**（`theme-pixel.css` `.react-flow__edge-path`），选中/hover 后变 粉色 但宽度不变；剩刀模式原实现为：

```ts
const onCutMove = (mv: MouseEvent) => {
  cutPoints.push([mv.clientX, mv.clientY]);
  // 只看当前鼠标点!
  const els = document.elementsFromPoint(mv.clientX, mv.clientY);
  ...
};
```

鼠标快速拖动时：mousemove 事件并不连续触发，单次事件间隔可达 **≥20 px**。而 edge 可视 stroke 仅 2.5 px，于是：

```
上一个 mousemove 点 ·---·---·---· 下一个 mousemove 点
                         |
                  edge细线（3 px宽）××××  ··········  鼠标拖拽轨迹
```

鼠标轨迹从 edge 另一侧跳过去，没有任何一次 mousemove 事件的 `(clientX, clientY)` 落在 edge stroke 上，**命中零**。

选中/hover 后“能剪”是错觉：DeletableEdge 的 `EdgeLabelRenderer` 中央剩刀按钮 26×26 px，其附近区域反而易被采样点命中。

### 39.3 修复

#### 修复 1 插值采样命中（[Canvas.tsx onCutMove](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx#L1414-L1450)）

```ts
const lastPt = cutPoints.length > 0
  ? cutPoints[cutPoints.length - 1]
  : [mv.clientX, mv.clientY];
cutPoints.push([mv.clientX, mv.clientY]);

const dx = mv.clientX - lastPt[0];
const dy = mv.clientY - lastPt[1];
const dist = Math.hypot(dx, dy);
const steps = Math.min(60, Math.max(1, Math.ceil(dist / 4)));
for (let s = 0; s <= steps; s++) {
  const t = steps === 0 ? 1 : s / steps;
  const px = lastPt[0] + dx * t;
  const py = lastPt[1] + dy * t;
  const els = document.elementsFromPoint(px, py);
  for (const el of els) {
    const edgeEl = (el as Element).closest?.('.react-flow__edge');
    if (!edgeEl) continue;
    const id = edgeEl.getAttribute('data-id') || '';
    if (!id) continue;
    if (!cutSet.has(id)) {
      cutSet.add(id);
      edgeEl.classList.add('cut-marked');
    }
  }
}
```

- 每 4 px 一个采样点，上限 60 点避免单次 mousemove 量过大
- 同一条 edge 仅按 id 去重计算一次，性能无压力

#### 修复 2 视觉 + 命中双保险（[styles/index.css](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/index.css)）

```css
body.cut-mode .react-flow__edge .react-flow__edge-path {
  stroke-width: 3.5 !important;          /* 2.5 → 3.5 可视提示 */
}
body.cut-mode .react-flow__edge .react-flow__edge-interaction {
  stroke-width: 36 !important;           /* 24 → 36 隐形命中区 */
}
```

### 39.4 适用范围

- 仅在 `body.cut-mode` （Shift+拖拽 剪刀模式进行中）生效
- 退出剪刀模式后所有 edge 恢复原始 stroke 宽度
- 不影响 `DeletableEdge` 本身的 hover 点击剪刀按钮路径

### 39.5 零破坏保证

- 正常状态 edge 视觉一点不变
- 剩刀高亮（`.cut-marked`）表现不变
- 轨迹 SVG overlay 不变
- selected 粉色/hover 粉色 不变
- 性能：每次 mousemove 的采样点上限 60，与原单点检测相比颗粒度增加极小

### 39.6 验证清单

- [x] `npx tsc --noEmit` 无报错
- [x] `npx vite build` 成功（5.45s）
- [ ] Shift+快速拖动鼠标划过黑色未选中 edge 能被剪断（待用户验证）

### 39.7 关键文件

- [src/components/Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx#L1414-L1450)——`onCutMove` 插值采样
- [src/styles/index.css](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/index.css)——`body.cut-mode` 下 edge 加宽规则

---

## 40. LLM 节点上游图片实时预览与 collectUpstream 取同源（v1.5.7）

### 40.1 用户报告

> llm 节点，图像传入后，节点内没有预览图，也需要和其他节点一样改造下。

### 40.2 根因

[LLMNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LLMNode.tsx) 原实现：

- `collectUpstream()` 仅在 `handleSend()` 点击发送时才临时遍历 `getEdges() / getNodes()` 提取上游文本/图片。
- UI 层完全没有任何上游预览部分——用户不知道点发送后会带上哪些图。
- 字段覆盖较窄：只读 `imageUrl / image / url` 与 `images / imageUrls` ，未读 `urls / generatedImages`，与项目通用 [useUpstreamMaterials](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useUpstreamMaterials.ts) 不一致。

### 40.3 修复

#### 修复 1：引入通用 hook

```ts
import { useUpstreamMaterials } from './useUpstreamMaterials';

// 组件顶层
const upstreamMats = useUpstreamMaterials(id);
const upstreamImages = upstreamMats.images;
```

`useUpstreamMaterials` 内部用 `useNodeConnections({ id, handleType: 'target' }) + useNodesData(upstreamIds)`，上游节点 data 一变就会重渲染，实时同步。

#### 修复 2：新增 UI 预览栏

在 “本地图片（多模态）” 区上方插入一个绿色边框的 “上游图片 · N” 区。

```tsx
{upstreamImages.length > 0 && (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-[10px] text-emerald-300/80">上游图片 · {upstreamImages.length}</label>
      <span className="text-[9px] text-white/30">发送时自动带上</span>
    </div>
    <div className="flex gap-1 flex-wrap">
      {upstreamImages.map((m) => (
        <div key={m.id} className="relative w-10 h-10" title={`来自: ${m.sourceNodeId.slice(-6)}\n${m.url}`}>
          <img
            src={m.url}
            data-drag-source data-drag-kind="image" data-drag-url={m.url}
            data-drag-preview={m.url} data-drag-node-id={id}
            onMouseDown={(e) => beginMaterialDrag(e, { kind: 'image', url: m.url, sourceNodeId: id, previewUrl: m.url })}
            className="w-10 h-10 object-cover rounded border border-emerald-400/40 cursor-grab"
          />
          <span className="absolute -top-1 -left-1 text-[8px] leading-none bg-emerald-500/80 text-white rounded px-1 py-0.5">↑</span>
        </div>
      ))}
    </div>
  </div>
)}
```

- 40×40 缩略图，`emerald-400/40` 边框，区别于本地 “图片附件”。
- 左上角 `↑` 标记，hover 提示 `来自: xxxxx\n<url>`。
- 挂 `data-drag-source` 与 `beginMaterialDrag`，支持 Ctrl+拖出到别的节点（与 §33 跨节点拖拽体系一致）。

#### 修复 3：`collectUpstream` 取同源

```ts
const collectUpstream = (): { text: string; images: string[] } => {
  const texts = upstreamMats.texts.map((t) => t.url).filter((s) => !!s);
  const images = upstreamMats.images.map((m) => m.url).filter((s) => !!s);
  return { text: texts.join('\n').trim(), images };
};
```

发送时使用的数据与 UI 预览区使用的是 同一个 `upstreamMats`，从根本上避免“看到几张、实际发出去几张”不一致。

### 40.4 零破坏保证

- 本地上传图片列表（`localImages`）不变，UI 位置改为 “上游图片” 下方。
- `handleSend` 仅 `collectUpstream` 补换，上下游联动、多模态发送逻辑不变。
- 拖拽体系：`data-drag-source` + `beginMaterialDrag` 与其他节点一致。

### 40.5 验证清单

- [x] `npx tsc --noEmit` 无报错
- [x] `npx vite build` 成功（4.21s）
- [ ] 上传节点 → LLM 节点 连线后，LLM 节点内出现 40×40 缩略图（待用户验证）
- [ ] 上游图片变化（重新生成/传 base64）后，预览区实时更新。
- [ ] Ctrl+ 拖出预览图 → 可拖入其他节点。

### 40.6 关键文件

- [src/components/nodes/LLMNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LLMNode.tsx)——顶层 hook 调用 + UI 预览栏 + `collectUpstream` 重写
- [src/components/nodes/useUpstreamMaterials.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useUpstreamMaterials.ts)——项目通用上游素材聚合 hook（本次仅读取，未修改）

---

## 41. API Key 设置眼睛预览修复 + 7 类分类独立 Key（v1.5.8）

### 41.1 用户报告

> APIKEY 设置界面，点击眼睛预览或者关闭眼睛预览都无法看到 APIKEY；另外加上一个单独的选项：分类 APIKEY 设置，支持 gpt-image / nano-banana / mj / veo / grok / seedance / suno 系列，分别对应节点使用；如果没有填写独立 apikey则用通用的，填了则用独立的。

### 41.2 BUG一：眼睛预览靠不住

#### 41.2.1 根因

[ApiSettings.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/ApiSettings.tsx) 原实现：

- input 受控于 `zhenzhenKey/rhKey/llmKey`，初始为空字串。
- 后端 GET `/api/settings` 只返回 **脱敏**字段如 `****9zVR`，从来不会填充 input。
- 点眼睛仅切换 `type=password|text`，但 input 为空这件事不会变，所以看不到任何明文。

#### 41.2.2 修复

```ts
// services/api.ts 新增
export async function getRawSettings(): Promise<ApiSettings> {
  const res = await request<{ success: boolean; data: ApiSettings }>(`${BASE}/settings/raw`);
  return res.data;
}

// ApiSettings.tsx 眼睛点击
const handleToggleShow = async (f: KeyField) => {
  const newShow = !shows[f];
  if (newShow && !inputs[f].trim() && (settings as any)[f]) {
    if (Object.keys(revealedRef.current).length === 0) {
      const raw = await getRawSettings();
      revealedRef.current = raw as any;
    }
    const plain = (revealedRef.current as any)?.[f];
    if (plain) setInputAt(f, String(plain));
  }
  setShows((prev) => ({ ...prev, [f]: newShow }));
};
```

- 当 input 为空 + 后端已存 同时成立才拉一次明文，useRef 缓存避免重复请求。
- 保存逻辑补充 `revealed === input` 则跳过提交，避免眼睛拉出明文未修改也重复提交。

### 41.3 需求二：7 类分类独立 API Key

在原三套通用 Key（贞贞工坊 / RH / LLM）基础上新增 7 类分类 Key，未填时 fallback 到 `zhenzhenApiKey`。

| 字段 | 对应模型 | hint 匹配 |
|---|---|---|
| `gptImageApiKey` | GPT2 / gpt-image-1 | gpt-image · gpt2 · gpt_image |
| `nanoBananaApiKey` | nano-banana / nano-banana-pro | nano-banana · nano_banana |
| `mjApiKey` | Midjourney(turbo/fast/relax) | midjourney · mj-fast/turbo/relax |
| `veoApiKey` | Veo / Veo3.1 | veo |
| `grokApiKey` | Grok Imagine Video | grok |
| `seedanceApiKey` | Seedance 2.0 | seedance |
| `sunoApiKey` | Suno (面向 v3.0～v5.5) | suno · chirp |

### 41.4 后端实现

#### 41.4.1 settings.js

[backend/src/routes/settings.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/settings.js) `DEFAULT_SETTINGS` 增加 7 个字段 + GET 脱敏：

```js
const CLASSIFIED_KEY_FIELDS = [
  'gptImageApiKey', 'nanoBananaApiKey', 'mjApiKey', 'veoApiKey',
  'grokApiKey', 'seedanceApiKey', 'sunoApiKey',
];
```

#### 41.4.2 proxy.js

[backend/src/routes/proxy.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) 顶部新增两个 helper：

```js
function pickApiKey(settings, hint = '') {
  const fb = settings.zhenzhenApiKey || '';
  const m = String(hint || '').toLowerCase();
  if (m.includes('gpt-image') || m.includes('gpt2') || m.includes('gpt_image')) return settings.gptImageApiKey || fb;
  if (m.includes('nano-banana') || m.includes('nano_banana')) return settings.nanoBananaApiKey || fb;
  if (m.includes('midjourney') || /\bmj[-_/]/.test(m) || m.startsWith('mj') || m === 'mj') return settings.mjApiKey || fb;
  if (m.includes('veo')) return settings.veoApiKey || fb;
  if (m.includes('grok')) return settings.grokApiKey || fb;
  if (m.includes('seedance')) return settings.seedanceApiKey || fb;
  if (m.includes('suno') || m.includes('chirp')) return settings.sunoApiKey || fb;
  return fb;
}

function applyClassifiedKey(settings, hint) {
  const picked = pickApiKey(settings, hint);
  if (picked) settings.zhenzhenApiKey = picked;
}
```

`applyClassifiedKey` 在路由入口 `loadRawSettings()` 后立即调用，用分类 key 覆盖 `settings.zhenzhenApiKey`，后续原代码中所有 `settings.zhenzhenApiKey` 引用都会拿到分类 key，零侵入原逻辑。

#### 41.4.3 router 注入点

| 路由 | hint |
|---|---|
| `POST /image` · `POST /image/submit` | `apiModel \|\| model \|\| ''` |
| `GET /image/status/:tid` | `req.query.model \|\| ''` |
| `POST /image/fal/submit` | `apiModel \|\| ''` |
| `POST /image/fal/query` | `endpoint \|\| rawUrl \|\| ''` |
| `POST /mj/imagine` · `GET /mj/task/:id` · `POST /mj/upload` | `'mj'` |
| `POST /video/submit` | `model \|\| ''` |
| `GET /video/query` | `req.query.model \|\| ''` |
| `POST /video/fal/submit` | `apiModel \|\| ''` |
| `POST /video/fal/query` | `endpoint \|\| rawUrl \|\| ''` |
| `POST /seedance/submit` · `GET /seedance/query` | `'seedance'` |
| `POST /audio/submit` · `GET /audio/query` | `'suno'` |

### 41.5 前端实现

[ApiSettings.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/ApiSettings.tsx) 重构：

- 用 `inputs/shows: Record<KeyField, string|boolean>` 统一 10 个 Key 状态。
- 增加 `max-h-[90vh] + overflow-y-auto`，防止弹窗爆高。
- 上半区 三套通用 Key（贞贞/RH/LLM）底部 + 下半区 `分类独立 API Key【可选】`。
- 未填的分类 key 显示“未设置 · 使用通用 Key”讯息，placeholder 为“留空则使用通用 Key / 输入独立 Key”。

### 41.6 零破坏保证

- 未增加分类 key 的用户一切如旧。
- 已增加的用户对应模型会优先走分类 key，贞贞通用 Key 仍充当后备。
- LLM Key 仍走独立 `llmApiKey` 不被 fallback 逻辑影响。
- RunningHub Key 仍走独立 `rhApiKey`。

### 41.7 验证清单

- [x] `npx tsc --noEmit` 无报错
- [x] `npx vite build` 成功（4.22s）
- [ ] 设置弹窗点眼睛可看到明文 Key（待用户验证）
- [ ] 填入分类 key（例如 mjApiKey）后 MJ 节点走该 key，其他类节点仍走贞贞通用。
- [ ] 分类 key 留空时一切节点走贞贞通用（零破坏验证）。

### 41.8 关键文件

- [backend/src/routes/settings.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/settings.js)——`DEFAULT_SETTINGS` 增加 7 字段 + GET 脱敏
- [backend/src/routes/proxy.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)——`pickApiKey` + `applyClassifiedKey` + 12 个 router 注入点
- [src/types/canvas.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/types/canvas.ts)——`ApiSettings` 接口扩展 7 字段
- [src/stores/apiKeys.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/apiKeys.ts)——`DEFAULT` 同步扩展
- [src/services/api.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/api.ts)——新增 `getRawSettings()`
- [src/components/ApiSettings.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/ApiSettings.tsx)——眼睛拉明文 + 分类 key 区重构

---

## 42. RunningHub AI 应用全自动 nodeList + 媒体输入输出全链路规范（v1.5.9 ~ v1.5.10）

> **本章是其他 Agent / 项目接入 RunningHub AI 应用 (apiCallDemo / ai-app/run / task/openapi/outputs) 的可复用规范。**
>
> 解决五大经典坑：①填了上游 url RH 还是用应用默认参数；②IMAGE 字段渲染破图；③同一 webappId 多次提交结果不一致；④多产物 (mp4/png) 塞进同一个 OutputNode；⑤d.urls 含 mp4 被当 image 分类导致下游 0 项。

### 42.1 RunningHub apiCallDemo nodeInfoList Schema

通过 `GET /api/proxy/runninghub/app-info?webappId=XXX` 拉到的 `nodeInfoList` 每条 item：

```ts
type RhAppInfoItem = {
  nodeId: string;          // 工作流内部节点 id（如 "9" / "42"）
  nodeName: string;        // 节点显示名（如 "file"、"prompt"）
  fieldName: string;       // 字段名（如 "file"、"text"、"value"、"select"）
  fieldType: 'IMAGE' | 'VIDEO' | 'AUDIO'
           | 'STRING' | 'TEXT'
           | 'NUMBER' | 'FLOAT' | 'INTEGER'
           | 'LIST' | 'SELECT' | string;
  fieldValue: any;         // 应用提供的默认值（IMAGE/VIDEO/AUDIO 时是 RH 内部 fileName，类似 hash）
  description?: string;    // 字段中文说明
  fieldData?: any;         // SELECT/LIST 时为可选项数组
};
```

**关键认知**：`fieldValue` 中的 IMAGE/VIDEO/AUDIO 默认值不是 url，而是 RH 平台预上传后的内部 fileName（形如 `87841334...png` / `api/xxx.mp4`），形态会迷惑路径白名单/扩展名判断。

### 42.2 fieldType → 内部 valueType 推断

```ts
export type ValueType = 'image' | 'video' | 'audio' | 'text' | 'number' | 'select';

function inferValueType(ft?: string): ValueType {
  const u = String(ft || '').toUpperCase();
  if (u === 'IMAGE') return 'image';
  if (u === 'VIDEO') return 'video';
  if (u === 'AUDIO') return 'audio';
  if (u === 'NUMBER' || u === 'FLOAT' || u === 'INTEGER') return 'number';
  if (u === 'LIST' || u === 'SELECT') return 'select';
  return 'text'; // STRING/TEXT/未知 一律 text
}
```

### 42.3 后端代理三接口（routes/proxy.js）

| 路由 | 上游 | 用途 |
|------|------|------|
| `GET /api/proxy/runninghub/app-info?webappId` | `/api/webapp/apiCallDemo` | 拉应用默认 nodeInfoList |
| `POST /api/proxy/runninghub/submit` | `/task/openapi/ai-app/run` | 提交任务，body `{webappId, nodeInfoList, instanceType?}` 返回 `{taskId}` |
| `GET /api/proxy/runninghub/query?taskId` | `/task/openapi/outputs` | 轮询 code 0/804/813/805 → SUCCESS/RUNNING/QUEUED/FAILED |
| `POST /api/proxy/runninghub/upload-asset` | `/task/openapi/upload` | 把 url/本地文件转 RH 内部 fileName |

#### 42.3.1 /upload-asset 路径白名单（极重要）

后端必须接受**多种本地路径前缀**：

```js
const INPUT_PREFIXES = ['/files/output/', '/output/', '/files/input/', '/input/'];
function localPathFromUrl(u) {
  for (const p of INPUT_PREFIXES) {
    if (u.startsWith(p)) {
      const rel = u.slice(p.length);
      const isInput = p.includes('input');
      return path.join(isInput ? config.INPUT_DIR : config.OUTPUT_DIR, rel);
    }
  }
  return null;
}
```

关键：上传节点 (`UploadFileNode`) 产出的 url 是 `/files/input/up_xxx.mp4`，必须能解析到 `INPUT_DIR`；图像/视频生成节点产出 `/files/output/...`，解析到 `OUTPUT_DIR`。

#### 42.3.2 /submit body 必须严格按 RH schema

```js
const body = { webappId, nodeInfoList };
if (instanceType) body.instanceType = instanceType; // 不传或 '' → RH 用默认实例
```

`nodeInfoList` 每条只能含 `{nodeId, fieldName, fieldValue}`，**禁止**带 valueType / nodeName / description / fieldType 等冗余字段，否则 RH 会 400。

### 42.4 前端 paramValues 三态规范

节点 data 中存：

```ts
type ParamValue = {
  value: string;                  // 当前值：可能是 url / RH fileName / 用户手填 / 空
  sourceFromUpstream?: boolean;   // 三态语义：
                                  //   true      → 已勾选「从上游自动获取」；同步 useEffect 持续跟进上游 url
                                  //   undefined → 从未交互过；一旦上游出现对应媒体自动启用
                                  //   false     → 用户主动取消；尊重用户手填值，computeFreshValuesNow 跳过
};
paramValues: Record<string, ParamValue>; // key = `${nodeId}__${fieldName}`
```

**默认勾选策略**（v1.5.10）：搜索 webappId 拉到 nodeInfoList 后，所有 IMAGE/VIDEO/AUDIO 字段**默认 sourceFromUpstream=true**，即使上游暂未连接也勾上、value=''，等上游连入后由 useEffect 自动填值。这样消除了「上游已连但 hash 默认值仍占用 fieldValue」的歧义。

### 42.5 三层防御：确保上游 url 一定到达 RH

#### 42.5.1 第一层：useEffect 三态同步

```ts
useEffect(() => {
  const list = appInfo?.nodeInfoList; if (!Array.isArray(list)) return;
  let changed = false; const next = { ...paramValues };
  for (const it of list) {
    const vt = inferValueType(it?.fieldType);
    if (vt !== 'image' && vt !== 'video' && vt !== 'audio') continue;
    const k = paramKey(it.nodeId, it.fieldName);
    const cur = next[k]; const upUrl = findUpstreamUrl(vt);
    if (!upUrl) continue;
    if (cur?.sourceFromUpstream === false) continue;          // 用户取消
    if (cur?.sourceFromUpstream === true) {
      if (upUrl !== cur.value) { next[k] = { ...cur, value: upUrl }; changed = true; }
    } else {                                                  // undefined → 自动启用
      next[k] = { value: upUrl, sourceFromUpstream: true }; changed = true;
    }
  }
  if (changed) update({ paramValues: next });
}, [upstreamNodes, appInfo]);
```

#### 42.5.2 第二层：computeFreshValuesNow 同步快照（避开 React state 异步陷阱）

```ts
// 用户连了上游视频 → setState 异步 → 立即点运行时 paramValues 还是旧值。
// 必须用纯函数同步算出快照，绕过 state。
const computeFreshValuesNow = (list?: any[]): Record<string, ParamValue> => {
  const next = { ...paramValues };
  if (!Array.isArray(list)) return next;
  for (const it of list) {
    const vt = inferValueType(it?.fieldType);
    if (vt !== 'image' && vt !== 'video' && vt !== 'audio') continue;
    const k = paramKey(it.nodeId, it.fieldName);
    if (next[k]?.sourceFromUpstream === false) continue;
    const upUrl = findUpstreamUrl(vt); if (!upUrl) continue;
    next[k] = { value: upUrl, sourceFromUpstream: true };
  }
  return next;
};

const handleRun = async () => {
  let freshList = appInfo?.nodeInfoList;
  if (!freshList?.length && hasUpstreamMedia()) {
    const r = await handleFetchInfo(); if (r) freshList = r.list;
  }
  const effectiveValues = computeFreshValuesNow(freshList);
  update({ paramValues: effectiveValues });
  const rawList = buildRawNodeInfoList(freshList, effectiveValues);   // 必须传函数参数，不能从 state 读
  const nodeInfoList = await resolveNodeInfoList(rawList);
  await submitRh({ webappId, nodeInfoList, instanceType: instanceType || undefined });
};
```

#### 42.5.3 第三层：resolveNodeInfoList 提交前最终兜底

```ts
for (const it of raw) {
  let v = String(it.fieldValue || '').trim();
  if (it.valueType === 'image' || it.valueType === 'video' || it.valueType === 'audio') {
    const isUrlLike0 = /^https?:\/\//i.test(v) || v.startsWith('/files/');
    // 当前值不是 url（可能是 RH 默认 hash）+ 上游有对应媒体 + 用户没主动关闭 → 强制覆盖
    if (!isUrlLike0) {
      const cur = paramValues[paramKey(it.nodeId, it.fieldName)];
      if (cur?.sourceFromUpstream !== false) {
        const upUrl = findUpstreamUrl(it.valueType);
        if (upUrl) v = upUrl;
      }
    }
    if (!v) continue;
    // url-like → /upload-asset 转 fileName；否则原样作为 RH 内部 fileName
    const isUrlLike = /^https?:\/\//i.test(v) || v.startsWith('/files/');
    out.push({
      nodeId: it.nodeId,
      fieldName: it.fieldName,
      fieldValue: isUrlLike ? (await uploadRhAsset(v)).fileName : v,
    });
  }
}
```

### 42.6 输出端 SUCCESS 分流

RH 返回 `urls` 是任意类型的混合数组，**必须按扩展名分到 imageUrl/videoUrl/audioUrl**，避免 mp4 被填到 imageUrl 让 OutputNode 当图片渲染：

```ts
if (r.status === 'SUCCESS') {
  const list: string[] = Array.isArray(r.urls) ? r.urls : [];
  const isImg = (u: string) => /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(u);
  const isVid = (u: string) => /\.(mp4|webm|mov|m4v|mkv)$/i.test(u);
  const isAud = (u: string) => /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(u);
  const firstImg = list.find(isImg); const firstVid = list.find(isVid); const firstAud = list.find(isAud);
  const patch: any = { status: 'success', urls: list };
  if (firstImg) patch.imageUrl = firstImg;
  if (firstVid) patch.videoUrl = firstVid;
  if (firstAud) patch.audioUrl = firstAud;
  if (list.length > 1) patch.imageUrls = list.filter(isImg); // 多图
  update(patch);
}
```

### 42.7 Canvas autoOutput 多产物分流（极重要）

[Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) 自动外挂 OutputNode 时**必须按扩展名把 d.urls 分到 imgs/vids/auds**：

```ts
// ❌ 错误：把 mp4 当 image
if (Array.isArray(d.urls)) d.urls.forEach(pushImg);

// ✅ 正确：按扩展分流
if (Array.isArray(d.urls)) {
  const isVidExt = (u: string) => /\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i.test(u);
  const isAudExt = (u: string) => /\.(mp3|wav|ogg|m4a|flac|aac)(\?.*)?$/i.test(u);
  d.urls.forEach((u: any) => {
    if (typeof u !== 'string' || !u) return;
    if (isVidExt(u)) pushVid(u);
    else if (isAudExt(u)) pushAud(u);
    else pushImg(u);
  });
}
```

**为什么必须分流**：autoOutput 创建 OutputNode 时会按 items 分配 `pickKind+pickIndex`，若 mp4 被推入 imgs，则 pickKind='image' → OutputNode 渲染时强制清空 videos → 又因兜底已把 mp4 从 images 移到 videos → **0 项空白**。这就是「视频一删掉 OutputNode 就在 RH 节点内显示」的真凶。

### 42.8 多产物 → N 个 OutputNode 升级 + 补建策略

RH 一次任务可能产出多张图 / 多个视频。autoOutput 策略：

```ts
// 1. 收集本节点所有下游 OutputNode（手动 + 自动）
// 2. 已带 pickKind+pickIndex 的 → 计入 occupied 集合
// 3. 未带 pickKind 且仅本节点单一连接的 → 升级 data 为 pickKind+pickIndex（按 items 顺序分配下一个未占用项）
// 4. 多上游聚合节点 (totalIncoming > 1) → 不动 data，避免破坏拓扑
// 5. 升级后仍未占用的 items → 补建 auto OutputNode（每行 3 个、列宽 350、行高 360）
```

效果：用户先手动连 1 个 OutputNode + RH 跑 2 张 → 手动那个升级显示第 1 张，autoOutput 补建第 2 张；与 ImageNode/VideoNode 等其他生成节点对齐。

### 42.9 IMAGE 字段预览渲染白名单

搜索 webappId 后，IMAGE 字段的 fieldValue 是 RH 内部 hash（形如 `api/xxx.png`），扩展名命中但不是 url → 渲染破图。修复：

```tsx
{vt === 'image' && (() => {
  const v = cur.value || '';
  const isHttpUrl = /^https?:\/\//i.test(v);
  const isLocalUrl = v.startsWith('/files/output/') || v.startsWith('/output/')
                  || v.startsWith('/files/input/')  || v.startsWith('/input/');
  const isImgExt = /\.(png|jpe?g|webp|gif|bmp|avif)(\?.*)?$/i.test(v);
  if (!(isHttpUrl || isLocalUrl) || !isImgExt) return null;
  return <img src={v} onError={(e) => (e.currentTarget.style.display = 'none')} />;
})()}
```

### 42.10 instanceType 字段规范

| UI 选项 | 实际值 | 提交行为 |
|---------|--------|----------|
| 默认 | `''` | submit body **不带** instanceType 字段，走 RH 应用默认实例 |
| plus | `'plus'` | 显式提交 plus 实例 |

UI 形态：`<select>` 不允许自由输入，避免拼写错误。

### 42.11 OutputNode 上游订阅刷新（xyflow 引用稳定陷阱）

xyflow `useNodesData` 返回的对象引用可能在 data 仅修改字段时仍稳定，导致 `useMemo([upstreamNodes])` 不重算。修复：增加细粒度字符串签名 deps：

```ts
const upstreamSig = useMemo(() => {
  return upstreamNodes.map(n => {
    const ud = n?.data || {};
    return [
      n?.id, ud.outputText, ud.reply, ud.prompt, ud.text,
      ud.imageUrl, ud.videoUrl, ud.audioUrl,
      Array.isArray(ud.imageUrls) ? ud.imageUrls.join(',') : '',
      Array.isArray(ud.urls) ? ud.urls.join(',') : '',
      Array.isArray(ud.generatedImages) ? ud.generatedImages.join(',') : '',
    ].join('§');
  }).join('|');
}, [upstreamNodes]);

const collected = useMemo(() => { /* ... */ },
  [upstreamNodes, upstreamSig, d.pickKind, d.pickIndex, /* directXxx */]);
```

### 42.12 完整调试日志规范

所有 RH 节点关键节点必须打 console，方便用户 F12 自查：

```ts
console.log('[RH/submit] webappId=', webappId, 'nodeInfoList=', JSON.parse(JSON.stringify(nodeInfoList)));
console.log('[RH/submit] taskId=', r.taskId);
console.error('[RH/submit] error:', e);
console.log('[RH/poll] taskId=', tid, 'status=', r.status, 'code=', r.code, 'urls=', r.urls?.length || 0);
console.log('[RH/done] taskId=', tid, 'urls=', list);
console.log('[RH/resolve] override field', fieldName, 'from', v, '→ upstream', upUrl);  // 兜底覆盖时
```

### 42.13 RH 节点接入新项目 Checklist

复用本规范到其他工程时，按下面顺序逐项核对：

- [ ] 后端 `/upload-asset` 路由支持 `/files/output/`、`/files/input/`、`/output/`、`/input/` 四种前缀
- [ ] 后端 `/submit` body 严格 `{webappId, nodeInfoList[, instanceType]}`，nodeInfoList item 仅含 `{nodeId, fieldName, fieldValue}`
- [ ] 前端 fieldType 推断 `inferValueType` 覆盖 IMAGE/VIDEO/AUDIO/STRING/TEXT/NUMBER/FLOAT/INTEGER/LIST/SELECT
- [ ] 拉 nodeInfoList 后媒体字段默认 `sourceFromUpstream=true`（即使上游未连）
- [ ] useEffect 三态同步（true/undefined/false 各自语义）
- [ ] handleRun 用 `computeFreshValuesNow` 同步快照绕开 state 异步
- [ ] resolveNodeInfoList 含三层兜底：`!isUrl + sourceFromUpstream !== false + 上游有 url → 强制覆盖`
- [ ] SUCCESS 分支按扩展名分流到 imageUrl/videoUrl/audioUrl/imageUrls
- [ ] Canvas autoOutput 把 `d.urls` 按扩展分流到 imgs/vids/auds
- [ ] OutputNode 加 `upstreamSig` 字符串签名 deps
- [ ] IMAGE 预览加 url 前缀白名单 + onError 兜底
- [ ] instanceType 用 `<select>` 限定 [`''=默认`, `'plus'`]
- [ ] 关键节点全打 `[RH/submit] [RH/poll] [RH/done] [RH/resolve]` 日志

### 42.14 关键文件

- [src/components/nodes/RunningHubNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RunningHubNode.tsx)——节点核心：三态、computeFreshValuesNow、resolveNodeInfoList 三层兜底、IMAGE 白名单、SUCCESS 分流
- [src/components/nodes/OutputNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx)——upstreamSig 签名 deps
- [src/components/Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)——autoOutput d.urls 分流 + 升级/补建策略
- [src/services/generation.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts)——`fetchRhAppInfo` / `submitRh` / `queryRh` / `uploadRhAsset` 封装
- [backend/src/routes/proxy.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js)——四个 RH 代理路由

### 42.15 修复时间线（提交链）

| commit | 修复点 |
|--------|--------|
| `38316f2` | useEffect 三态同步 + OutputNode upstreamSig |
| `316b7a5` | IMAGE 预览 url 前缀白名单 + onError 兜底 |
| `e3e190b` | computeFreshValuesNow 同步快照绕 state 异步陷阱 |
| `c5a0ec1` | autoOutput 升级 + 补建策略（多产物分多 OutputNode） |
| `caae35f` | autoOutput d.urls 按扩展分流到 imgs/vids/auds |
| `7e76785` | 媒体字段拉取后默认勾选「从上游自动获取」 |
| `bfb4f95` | instanceType 改为下拉列表 [默认/plus] |
| `8e866c4` | resolveNodeInfoList 第三层最终兜底 |

---

## 45. 默认主题切到像素风 + RH 钱包应用节点 + RH 钱包独立 APIKEY（v1.1.x）

### 45.1 用户需求

1. 默认模式从「科技风(tech) + 暗色(dark)」改成「像素风(pixel) + 白天(light)」。
2. 侧栏隐藏 `rh-config`「RH 配置」节点（节点本体保留以兼容老画布）。
3. 复制 `runninghub` 节点逻辑，新增节点 `runninghub-wallet`，标签「RH钱包应用」，归 RH 分类。
4. APIKey 设置面板在 RunningHub 与 LLM 之间插入新设置项「RH 钱包 APIKEY」，提示文案：
   `注意：本节点用于RH钱包应用，需要设置RH企业级-共享APIKEY`
5. 「RH钱包应用」节点的所有 RH 调用（submit/query/app-info/upload-asset）必须用 `rhWalletApiKey`，与默认 `rhApiKey` 完全隔离。
6. **未明确指令前不允许打包** —— 这是一条永久规则。

### 45.2 改造文件清单

| 文件 | 改动 |
|------|------|
| [src/stores/theme.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/theme.ts) | 默认 `theme: 'light'` + `style: 'pixel'`（zustand persist：仅新用户/清缓存生效，老用户保留旧值） |
| [src/config/nodeRegistry.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/nodeRegistry.ts) | `rh-config` 加 `hidden: true`；新增 `{ type: 'runninghub-wallet', label: 'RH钱包应用', icon: 'Wallet', color: 'violet' }` |
| [src/types/canvas.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/types/canvas.ts) | `NodeType` 加 `'runninghub-wallet'`；`ApiSettings` 加 `rhWalletApiKey: string` |
| [src/config/portTypes.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/portTypes.ts) | `'runninghub-wallet'` 端口与 `runninghub` 一致（text/image/video/audio/config → image/video） |
| [src/components/Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) | `SPECIFIC_NODES` 加 `'runninghub-wallet': RunningHubNode`（复用同一组件）；`EXECUTABLE_NODE_TYPES` 加 `'runninghub-wallet'` |
| [src/components/NodeActionBar.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/NodeActionBar.tsx) | `EXECUTABLE_NODE_TYPES` 同步加 `'runninghub-wallet'` |
| [src/components/nodes/RunningHubNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RunningHubNode.tsx) | 通过 `NodeProps.type` 识别 `useWallet = type === 'runninghub-wallet'`；标题→「RH钱包应用」+ Wallet 图标 + violet 调色板；4 个 RH 调用透传 `useWallet` |
| [src/services/generation.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) | `RhSubmitRequest` 加 `useWallet?: boolean`；`queryRh / fetchRhAppInfo / uploadRhAsset` 全部加 `useWallet=false` 形参（GET 路径加 `&wallet=1` query；POST 写进 body） |
| [backend/src/routes/proxy.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) | 抽 `pickRhApiKey(settings, useWallet)` 工具：`useWallet → settings.rhWalletApiKey`，否则走原 `rhApiKey \|\| runninghubApiKey`；4 处路由（submit/query/upload-asset/app-info）改用工具 + 友好错误文案 |
| [src/stores/apiKeys.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/apiKeys.ts) | `DEFAULT` 插入 `rhWalletApiKey: ''` |
| [backend/src/routes/settings.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/settings.js) | `DEFAULT_SETTINGS` 加 `rhWalletApiKey: ''`；`GET /api/settings` 脱敏列表加 `rhWalletApiKey: maskKey(...)` |
| [src/components/ApiSettings.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/ApiSettings.tsx) | `KeyField` 联合 + `emptyMap/emptyShow` 加 `rhWalletApiKey`；`COMMON_KEYS` 在 `rhApiKey` 与 `llmApiKey` 之间插入新条目（label「RH 钱包 APIKEY」/ desc「· 用于 RH 钱包应用 · RH 企业级共享 APIKEY」/ bullet `bg-violet-400`）；表单内该项 `baseUrlNote` 设为「注意：本节点用于RH钱包应用，需要设置RH企业级-共享APIKEY」 |

### 45.3 关键设计决策

#### A. 节点类型 vs 共用组件

选「同 component + type 分支」而不是「拷一份 RhWalletNode.tsx」。理由：

- RH 节点 600+ 行业务代码（webappId 拉取、媒体上游同步、resolveNodeInfoList、轮询、错误兜底等）完全相同，只是用的 APIKEY 不同。
- 拷文件会导致后续 RH 协议升级要双向同步，长期维护负担大。
- xyflow `NodeProps` 第二参直接含 `type`，单点判定 `const useWallet = type === 'runninghub-wallet';` 即可衍生标题/图标/配色/4 个调用的 useWallet 透传。

#### B. `useWallet` 全链路透传

```
  RunningHubNode (type='runninghub-wallet')
    ↓ useWallet=true
  services/generation.ts
    submitRh(req)            → body.useWallet           （POST）
    queryRh(taskId, true)    → ?taskId=...&wallet=1     （GET）
    fetchRhAppInfo(id, true) → ?webappId=...&wallet=1   （GET）
    uploadRhAsset(url, true) → body.useWallet           （POST）
    ↓
  backend/proxy.js
    pickRhApiKey(settings, useWallet)
      useWallet === true  → settings.rhWalletApiKey
      else                → settings.rhApiKey || settings.runninghubApiKey
```

四端兼容性：未带 `useWallet` 标志（默认 false）的旧调用完全等价，零回归风险。

#### C. 配色与 UI 区分

RH 钱包节点采用 `violet` 主调（`border-violet-400` / `bg-violet-500/20` / `text-violet-200`），与默认 RH 节点的 `cyan` 主调形成视觉对比；图标改用 lucide-react `Wallet`，标题渲染为「RH钱包应用」。

#### D. 老画布兼容

- 已存画布若有 `rh-config` 节点 → `hidden: true` 仅从 Sidebar 入口隐藏，`NODE_REGISTRY` 仍保留 `'rh-config': RhConfigNode` 注册，节点照常渲染。
- 已存 `runninghub` 节点不受影响：`useWallet=false` 走原路径。

### 45.4 永久规则（重点）

> **未经用户明确指令（"打包"/"build"/"dist"/"发版"），不允许主动执行任何打包动作（npm run dist / dist:dir / electron 打包等）。代码改完仅做 tsc 编译校验 + 视情况 git commit/push。**

该规则同步写入永久记忆（task_flow_experience 类目「禁止主动打包规则」）。

### 45.5 验收清单

- [x] 清缓存后默认进像素风白天模式（zustand-persist `t8-canvas-theme` 缺失时走新默认）
- [x] 侧栏 RH 分类只看到 RunningHub + RH钱包应用（无 RH 配置）
- [x] RH钱包应用节点拖入画布渲染为 violet 主题 + 标题「RH钱包应用」
- [x] 设置面板 RH 与 LLM 之间出现「RH 钱包 APIKEY」+ 紫色 bullet + 钱包说明文案
- [x] RH钱包应用节点 webappId 搜索、表单提交、轮询、上传素材 4 个动作全部使用 `rhWalletApiKey`，未配置时报「未配置 RH 钱包 APIKEY...」专属错误
- [x] 默认 RunningHub 节点行为零变化（`useWallet=false` 路径与历史一致）
- [x] `npx tsc --noEmit` 通过；后端 `node -e "require('./backend/src/routes/proxy.js')"` 加载 OK

---

## 46. RH LIST 识别 + 多素材协议约束 + logBus 统一 + 像素风字模糊全局解 + ResizeNode 体验修正（v1.6.0）

### 46.1 背景

本章集中记录 v1.6.0 一轮贴身体验调优，跨越 5 个独立点、共 8 个 commit。

| commit | 修复点 |
|--------|--------|
| `4326319` | RH LIST/SELECT 字段正确识别并支持下拉选择 |
| `64b4ffa` | 多图 / 多视频 / 多音频上游接入完整传递到 RH |
| `5dde07f` | 多素材改用单条 fieldValue 换行拼接（错误尝试，后被撤回） |
| `98f2005` | hotfix：revert 多行 fieldValue 拼接（修复 Custom validation failed for node） |
| `2d633a3` | KNOWN_FIELD_OPTIONS 词典兜底 + 字段头紧凑竖线分隔 |
| `4ae4570` | RunningHubNode 接入 logBus + 像素风全局禁用 backdrop-filter |
| `0f55c8d` | ResizeNode 默认 fit=cover + ImageOpFrame 下游 OutputNode 时隐藏内部预览 |

---

### 46.2 RH LIST/SELECT 字段正确识别 + KNOWN_FIELD_OPTIONS 词典兜底

#### 问题症状

> RunningHub 节点和 RH 钱包节点，输入 webappId 点击搜索获取的 nodeList 中有些应该是个 list，但节点内显示的是个 string——只从 list 获取了首个或默认选项。

#### 根因

RH apiCallDemo 返回的 fieldType 不总是 `LIST` / `SELECT`。很多枚举字段（如 `aspectRatio` / `resolution`）后端实际上返 `fieldType=TEXT`，也不带 `fieldData` / `options` 数组，只能靠参数名作为经验推定。

#### 修复

[RunningHubNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RunningHubNode.tsx) `extractFieldOptions(it)` 三层探测：

```ts
// 一、多字段名候选（8 种）
const candidates = [it?.fieldData, it?.options, it?.list, it?.values, it?.enum,
  it?.choices, it?.items, it?.selectOptions, it?.dropdown];
for (const c of candidates) {
  // 1) 纯文本/数字数组
  if (c.every(x => typeof x === 'string' || typeof x === 'number')) return c;
  // 2) [{label, value}] / [{name, value}]
  if (c.every(x => x && typeof x === 'object' && ('value' in x || 'label' in x || 'name' in x))) {
    return c.map(x => x.value ?? x.label ?? x.name).filter(v => v != null);
  }
}
// 二、fieldType=LIST/SELECT/DROPDOWN/COMBO/ENUM 且 fieldValue 本身是数组 → 取 fieldValue
if (['LIST','SELECT','DROPDOWN','COMBO','ENUM'].includes(t) && Array.isArray(it?.fieldValue)) {
  return it.fieldValue;
}
// 三、词典兜底（大小写不敏感）
const KNOWN_FIELD_OPTIONS = {
  aspectRatio: ['1:1','16:9','9:16','4:3','3:4','4:5','5:4','3:2','2:3','21:9','9:21','1:4','4:1','1:8','8:1'],
  aspect_ratio: [...], ratio: [...],
  resolution: ['1k','2k','4k','8k'],
  size: ['512','768','1024','1280','1536','2048'],
  mode: ['text2img','img2img'],
  quality: ['low','medium','high','best'],
  instanceType: ['default','plus','pro'], instance_type: [...],
  precision: ['fp16','fp32','bf16'],
  scheduler: ['normal','karras','exponential','sgm_uniform','simple','ddim_uniform'],
  sampler: ['euler','euler_ancestral','heun','dpm_2','dpm_2_ancestral','lms','dpmpp_2m','dpmpp_sde','ddim','uni_pc'],
};
const keyLower = String(it?.fieldName || '').toLowerCase();
for (const [k, v] of Object.entries(KNOWN_FIELD_OPTIONS)) {
  if (k.toLowerCase() === keyLower) return v;
}
```

同时字段默认值 `extractDefaultValue(it)` 与 `extractFieldOptions` 配套：选项首项作默认值，避免 LIST 字段被当 string 提交。

#### 字段头紧凑竖线分隔

原三段（fieldName / 类型徽标 / `#nodeId`） `space-x-2 text-[10px]` 间距过大看起来“划裂”，用户反馈后改：

```tsx
<div className="flex items-center gap-1 text-[10px] leading-tight">
  <span className="text-white/80 font-medium truncate">{it.fieldName}</span>
  <span className="text-white/20">|</span>
  <span className="text-cyan-300/60 px-1 rounded bg-cyan-500/10">
    {fieldDataOptions ? `select(${fieldDataOptions.length})` : vt}
  </span>
  <span className="text-white/20">|</span>
  <span className="text-white/30">#{it.nodeId}</span>
</div>
```

#### 词典扩展路线

`fetchInfo` 拉取后调用 `logBus.debug('[RH/fetchInfo]', JSON.stringify(list, null, 2), src)` 输出完整 `nodeInfoList`，后续发现未识别枚举参数名时，直接在 `KNOWN_FIELD_OPTIONS` 字典中补一行即可，不需改代码逻辑。

---

### 46.3 RH 多素材协议约束（错误尝试→撤回→沉淀规范）

#### 问题症状

> 输入 2 个图片、让 2 个人一起跳舞，但生成时只有后一个人，第一个参考素材没被传入。

#### 调研结论（协议约束）

RunningHub `nodeInfoList` 提交协议两条核心约束：

1. `fieldValue` 必须是单一 `fileName`，**不接受多行 / 逗号拼接**。违反则 RH 后端报 `Custom validation failed for node`。
2. 同一 `(nodeId, fieldName)` 重复条目 → RH 后端会覆盖（后一条赢），所以不能用 “同名多条 nodeInfoList” 传多张。

结论：单 image 字段 + N 张上游图，协议层只能传 1 张。**多图能力必须依赖 webapp 模板内部提供多个 image 字段**，从节点表单侧以多字段分别传入。

#### 修复

- `5dde07f` 尝试多行拼接 → RH 返 `Custom validation failed for node` → `98f2005` hotfix 全部撤回
- `resolveNodeInfoList` 提交前加 strip multiline 兜底：`fieldValue.includes('\n') → 只取首行 + logBus.warn(...)`避免代码中偶发传入多行字符串时仍能调用成功
- 本调研结果同步到 `task_breakdown_experience` 记忆：不要再尝试在单 image 字段动多图传递

---

### 46.4 RunningHubNode 接入 logBus 统一日志面板

#### 问题症状

> 日志功能好像失效了，运行了半天，什么都没打印。

#### 根因

[TerminalPanel.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/TerminalPanel.tsx) 仅订阅 `useLogStore.entries`（`logBus.{info,success,warn,error,debug}` 推入的）。原 `RunningHubNode` 全部用 `console.log/warn/error` 调试，从不入面板，面板自然“什么都没打印”。

#### 修复

```tsx
import { logBus } from '../../stores/logs';

const src = `${useWallet ? 'rh-wallet' : 'rh'}:${id}`;

// 9 处关键事件同步下发面板（保留 console 调试）
logBus.info(`fetching webapp info: ${webappId}`, src);     // fetchInfo 进入
logBus.info(`submitting taskId=${tid}`, src);              // submit 进入
logBus.success(`submitted, taskId=${tid}`, src);           // submit 完成
logBus.debug(`polling status=${status}`, src);             // poll 每 30s
logBus.success(`done, ${urls.length} outputs`, src);       // 完成
logBus.error(`failed: ${msg}`, src);                       // RH 返错
logBus.warn(`poll error: ${e.message}`, src);              // 轮询出错
logBus.warn(`stopped manually`, src);                       // 手动停止
logBus.debug('override fieldValue from upstream', src);    // resolveNodeInfoList 兜底覆盖
logBus.warn('strip multiline fieldValue', src);            // strip multiline 兜底
```

#### 面板误读防护

- `src` 不同节点（`rh:abc` / `rh-wallet:def`）在面板中能一眼区分
- 严重事件用 `error` / `warn`，高频轮询用 `debug` 避免刷屏
- 主流程事件（submit / done）用 `success`，与 GPT2/Suno/MJ 保持一致质感

---

### 46.5 像素风全局禁用 backdrop-filter（一次修复 18+ 节点）

#### 问题症状

> RunningHub 节点和 RH 钱包节点，感觉字模模糊糊的，是不是加了什么虚化模糊效果？其他节点也要排查下。

#### 根因

18+ 节点都用了 inline `style={{ backdropFilter: 'blur(8px)' }}` + 半透明背景。在像素风（`html[data-theme-style="pixel"]`）下亚像素渲染导致中文发虚。逐个改 18+ tsx 成本高且易遗漏。

#### 修复（双层防御）

**全局兜底**：[theme-pixel.css](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/theme-pixel.css) 加 `!important` 覆盖所有 ReactFlow 节点 inline 样式：

```css
html[data-theme-style="pixel"] .react-flow__node,
html[data-theme-style="pixel"] .react-flow__node > div,
html[data-theme-style="pixel"] .react-flow__node * {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
```

**关键节点本身切换**：RunningHubNode / RhConfigNode 容器按 `isPixel` 切换不透明背景，遵循 Tailwind 哲学的 "能用变量就不用 !important" 原则：

```tsx
const { style: themeStyle } = useThemeStore();
const isPixel = themeStyle === 'pixel';
// ...
style={{
  background: isPixel ? 'var(--px-surface)' : 'rgba(20,20,22,.92)',
  backdropFilter: isPixel ? 'none' : 'blur(8px)',
  color: isPixel ? 'var(--px-ink)' : undefined,
}}
```

#### 服务对象

本修复影响全部 ReactFlow 节点子子孙元素（不仅限 RH），包括 ImageNode/VideoNode/AudioNode/LLMNode/SeedanceNode/UploadNode/OutputNode/ResizeNode/CombineNode/UpscaleNode/GridCropNode/RemoveBgNode/RelayNode/IdeaNode/BPNode/TextNode/EditNode/DrawingBoardNode 等。

---

### 46.6 ResizeNode：默认 fit=cover + 下游 OutputNode 时隐藏内部预览

#### 问题症状

> 尺寸调节节点有问题，首先有输出节点的时候，节点内部应该隐藏预览，第二，剪裁完全没生效，输入图什么样，现在还是什么样。

#### 根因 1：sharp `fit` 语义陷阱

| fit | 语义 | 输出尺寸 | 几何 |
|-----|------|---------|-----|
| `inside`（原默认）| 等比缩放不超过 W×H，**不裁剪** | 不一定是 W×H | 保比例 |
| `cover` | 裁剪铺满到严格 W×H | 严格 W×H | 保比例 |
| `contain` | 包含留白到严格 W×H | 严格 W×H | 保比例 |
| `fill` | 拉伸到严格 W×H | 严格 W×H | 可变形 |

9:16 原图 → 1024×1024 `inside` ≈ 576×1024，仍是 9:16 看起来跟原图一样。这是 sharp 语义与用户对「尺寸调整」直觉不一致。后端 saveBuffer 已生成 `op_xxxxx.png` 证明接口跑了，只是输出看起来「没变」。

#### 根因 2：ImageOpFrame 无条件渲染预览

[ImageOpFrame.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageOpFrame.tsx) 是 Resize/Upscale/Crop/GridCrop/Combine/RemoveBg 六个节点的通用外壳，未判断下游是否已接 OutputNode，一律渲染 `outImg` / `outUrls`，造成节点内与 OutputNode 双显。

#### 修复 1：ResizeNode 默认 fit=cover + 中文 label

```tsx
const fit = d?.fit || 'cover'; // 默认从 inside 改为 cover

const FIT_OPTIONS: Array<{ v: string; label: string }> = [
  { v: 'cover',   label: 'cover · 裁剪铺满（保比例）' },
  { v: 'contain', label: 'contain · 包含留白（保比例）' },
  { v: 'inside',  label: 'inside · 不超尺寸（不裁剪）' },
  { v: 'fill',    label: 'fill · 拉伸填充（可变形）' },
];
// <select> 渲染 FIT_OPTIONS
```

老存档 `d?.fit==='inside'` 仍保留，仅「新建节点」默认变 cover。

#### 修复 2：ImageOpFrame 复用 useHasAutoOutput hook

使用项目现成的 [useHasAutoOutput.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useHasAutoOutput.ts)（检测下游是否连了 type==='output' 的 OutputNode）：

```tsx
import { useHasAutoOutput } from './useHasAutoOutput';

const hasAutoOutput = useHasAutoOutput(id);

// 下游已连 OutputNode：隐藏节点内预览
{outImg && !hasAutoOutput && (
  <div className="border-t border-white/10 p-2">
    <img src={outImg} alt="结果" className="w-full rounded object-contain" />
  </div>
)}
{outUrls.length > 0 && !hasAutoOutput && (
  <div className="border-t border-white/10 p-2 grid grid-cols-3 gap-1">
    {outUrls.map((u, i) => <img key={i} src={u} alt={`#${i}`} className="w-full rounded object-cover" />)}
  </div>
)}
```

影响范围：**一次修复 6 个 ImageOp 节点**（Resize/Upscale/Crop/GridCrop/Combine/RemoveBg）。

---

### 46.7 验收清单

- [x] RH 节点 webappId 搜索后，aspectRatio / resolution / mode 等枚举参数渲染为 `<select>` 下拉（不是 input）
- [x] LIST 字段选择变更后提交会带上选中项，不是首项默认值
- [x] 字段头三段间距紧凑、用竖线分隔
- [x] 输入 2 张图提交不再报 `Custom validation failed for node`（仅传首张、多行拼接已撤销）
- [x] 面板「终端」打开可看到 `[rh:xxx] fetching webapp info` / `submitting taskId=...` / `polling status=...` / `done, N outputs` 等条目
- [x] 像素风 + light 下 RH / RH钱包节点字体清晰，没有“发虚”
- [x] 其他节点 ImageNode/SeedanceNode/UploadNode/OutputNode 也不再发虚（全局 CSS 覆盖生效）
- [x] ResizeNode 默认拖入，9:16 原图 → 1024×1024 输出为 1:1 裁剪铺满（fit=cover 生效）
- [x] ResizeNode 下游连 OutputNode 时，节点内部预览差，仅 OutputNode 显示
- [x] `npx tsc --noEmit` 通过

### 46.8 关键文件

- [src/components/nodes/RunningHubNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RunningHubNode.tsx)（LIST 识别 + 词典兜底 + 字段头紧凑 + logBus 接入 + isPixel 容器切换 + multiline strip 兜底）
- [src/components/nodes/RhConfigNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RhConfigNode.tsx)（引入 useThemeStore + isPixel 容器切换）
- [src/styles/theme-pixel.css](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/theme-pixel.css)（`html[data-theme-style="pixel"] .react-flow__node *` backdrop-filter: none !important 全局兜底）
- [src/components/nodes/ResizeNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ResizeNode.tsx)（默认 fit=cover + FIT_OPTIONS 中文 label）
- [src/components/nodes/ImageOpFrame.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageOpFrame.tsx)（useHasAutoOutput 控制 outImg/outUrls 是否渲染）
- [src/components/nodes/useHasAutoOutput.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useHasAutoOutput.ts)（检测下游 OutputNode 的现成 hook，本次复用未修改）
- [src/stores/logs.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/logs.ts)（logBus 实现，未修改）

### 46.9 提交链

```
4326319  fix(rh): RunningHub/RH钱包节点正确识别LIST/SELECT字段并支持下拉选择
64b4ffa  fix(rh): 多图/多视频/多音频上游接入完整传递到 RH
5dde07f  fix(rh): 多素材改用单条fieldValue换行拼接,规避RH同fieldName覆盖语义（错误尝试）
98f2005  hotfix(rh): revert多行fieldValue拼接,修复Custom validation failed for node
2d633a3  feat(rh): 常见枚举字段词典兜底 + 字段头紧凑竖线分隔
4ae4570  fix(rh+pixel): RH接入logBus日志面板 + 像素风全局禁用backdrop-filter
0f55c8d  fix(resize): 下游连OutputNode时隐藏内部预览 + fit 默认cover修正裁剪语义
```

---

## 47. Electron 打包加密链路·3 处根因 + 标准化 SOP（v1.2.1）

> **本章是下次打包的唯一参考依据。任何打包问题先回看本章再动手。**
>
> 永久规则：**未经用户明确指令（“打包”/“build”/“dist”/“发版”），不允许主动执行任何打包动作。** 本章修复仅在用户明确要求“打包”时延续上一轮“修复打包启动报错”指令的合理继续。

### 47.1 背景

v1.2.0 首次打包出 NSIS 安装包后，安装运行报错：

- 加载窗卡在「启动中…」无法跳到主窗口；
- `dbg.log` 报 `Cannot find module 'express'`；
- require stack 顶部为 `C:\Users\ADMINI~1\AppData\Local\Temp\t8pc-jsc\xxx.jsc`，下方为 `resources/app.asar/electron/loader.cjs` → `main.cjs`。

本次根治了 **三处独立根因** + 留下 **6 项打包前必检 checklist** + **完整 SOP**，再打包不会出现同类问题。

### 47.2 完整产物拓扑（v1.2.1 起）

```
dist_electron/
├─ T8-PenguinCanvas-Setup-1.2.0.exe           # NSIS 安装包(约 87 MB)
└─ win-unpacked/
   ├─ T8-PenguinCanvas.exe                    # Electron 主可执行
   ├─ resources/
   │  ├─ app.asar                             # 主代码包(asar 内)
   │  │  ├─ electron/{main,loader,preload}.cjs
   │  │  ├─ package.json
   │  │  └─ node_modules/                     # express / cors / multer / bytenode 等
   │  ├─ app.asar.unpacked/
   │  │  └─ node_modules/sharp/**             # asarUnpack(原生 .node 必须解包)
   │  │  └─ node_modules/@img/**
   │  ├─ backend-enc/                         # extraResources(asar 外)
   │  │  ├─ server.t8c                        # T8ENC1 加密的 V8 字节码
   │  │  ├─ config.t8c
   │  │  ├─ utils/*.t8c
   │  │  └─ routes/{canvas,settings,proxy,files,imageOps}.t8c
   │  └─ frontend/                            # extraResources(asar 外)
   │     ├─ index.html                        # vite build 产物
   │     └─ assets/index-*.{js,css}
   ├─ ffmpeg.dll / d3dcompiler_47.dll / *.pak / locales/ 等
   └─ 启动数据持久化 → %APPDATA%/t8-penguin-canvas/  (productName 全小写)
      ├─ data/{canvas_list,settings,rh_apps}.json
      ├─ input/  output/  thumbnails/
```

### 47.3 三处根因详解（**重点**）

#### 根因 1：bytenode 的 .jsc loader 二次 require 引发 paths 漂移

旧版 `electron/loader.cjs` 的 `.t8c` hook：

```js
// ❌ 错误实现
require.extensions['.t8c'] = function (mod, filename) {
  const enc = fs.readFileSync(filename);
  const jsc = decryptBuffer(enc);
  const tmpFile = path.join(tmpDir, md5(filename) + '.jsc');
  fs.writeFileSync(tmpFile, jsc);
  mod.exports = require(tmpFile);   // ← 致命：触发 bytenode 内置 .jsc loader
};
```

问题：

- 把解密产物落到 `%TEMP%/t8pc-jsc/` 后再 `require(tmpFile)`，会激活 bytenode 内置的 `.jsc` 加载器；
- bytenode 把 `tmpFile` 当做新的 `fileModule`，其 `module.paths` 沿 `%TEMP%/t8pc-jsc/node_modules/...` 向上查找；
- `%TEMP%` 路径下根本没有 node_modules，`fileModule.require('express')` 自然 `MODULE_NOT_FOUND`。

#### 根因 2：.t8c 在 asar 外，paths 仍然到不了 app.asar/node_modules

即便修复根因 1，让 `.t8c` 在原文件位置上下文里运行，新的 require stack 会变为：

```
resources\backend-enc\server.t8c        ← .t8c 真实位置
  ↓ fileModule.paths
resources\backend-enc\node_modules       (空)
resources\node_modules                   (空)
win-unpacked\node_modules                (空)
```

`backend-enc/` 是 `extraResources`，**位于 asar 外**；它的 `module.paths` 永远不会回到 `app.asar/node_modules`，但 `express/cors/multer/sharp` 都安装在 asar 内部。

#### 根因 3：backend/src/config.js + server.js 完全没适配打包模式

- `config.js` 旧版只用 `path.resolve(__dirname, '..', '..')` 推 `PROJECT_DIR`，打包后这个路径指向只读的 `win-unpacked/`，写 JSON 直接 EACCES；
- `NODE_ENV` 仍然是 `'development'`；
- `server.js` 完全没有 `express.static` 托管前端 dist，浏览器 `GET /` 返回 `Cannot GET /`。

### 47.4 修复点逐一对照

| # | 文件 | 关键改动 |
|---|------|---------|
| 1 | [electron/loader.cjs](file:///e:/PenguinPravite/T8-penguin-canvas/electron/loader.cjs) | 重写 .t8c hook：复刻 bytenode 内部逻辑 `generateScript` + `fixBytecode`(按 Node 版本动态拷贝 dummy 字节码 flag 区) + `readSourceHash`，用 `vm.Script + cachedData` 直接在原始 .t8c `fileModule` 上下文中 `runInThisContext`，手动 `apply` CommonJS wrapper `[fileModule.exports, req, fileModule, filename, dirname, process, global]` |
| 2 | [electron/loader.cjs](file:///e:/PenguinPravite/T8-penguin-canvas/electron/loader.cjs) | 自定义 `req(id)` 包装 `fileModule.require`，捕获 `MODULE_NOT_FOUND` 时回退到 loader.cjs 自身 `require`；`req.resolve` 同步加同等兜底；`req.extensions / req.cache / req.main` 透传保证生态一致 |
| 3 | [backend/src/config.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/config.js) | 整文件重写：`IS_PACKAGED = process.env.T8PC_PACKAGED === '1'`，`DATA_ROOT = IS_PACKAGED ? T8PC_USER_DATA : PROJECT_DIR`；所有目录 `BASE_DIR/DATA_DIR/INPUT_DIR/OUTPUT_DIR/THUMBNAILS_DIR + 三个 *_FILE` 全从 `DATA_ROOT` 派生；`FRONTEND_DIST = T8PC_FRONTEND_DIST \|\| (IS_PACKAGED ? '' : project/dist)`；`NODE_ENV` 打包模式默认 `production`；启动时 `fs.mkdirSync(recursive)` 自动建 4 个数据目录 |
| 4 | [backend/src/server.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/server.js) | 在 `app.use('/api/image', imageOpsRouter)` 之后 / `app.listen` 之前插入：<br/>`if (config.IS_PACKAGED && config.FRONTEND_DIST && fs.existsSync(config.FRONTEND_DIST)) { app.use(express.static(config.FRONTEND_DIST)); app.get(/^\/(?!api\/\|files\/\|input\/\|output\/).*/, (_req, res) => res.sendFile(path.join(config.FRONTEND_DIST, 'index.html'))); }` |
| 5 | [electron/main.cjs](file:///e:/PenguinPravite/T8-penguin-canvas/electron/main.cjs) | 三处版本号 v1.1.0 → v1.2.0：① 主窗 `BrowserWindow.title` ② log 窗口 HTML 模板 ③ `ipcMain.handle('t8pc:get-info')` 返回 `version` |
| 6 | [electron/_post_build.cjs](file:///e:/PenguinPravite/T8-penguin-canvas/electron/_post_build.cjs) | 已就绪：验证 7 个 .t8c + frontend/{index.html,assets} 必存在；强制清除 `resources/{app,backend}/src` 明文目录（防止 electron-builder 误打入） |

### 47.5 关键代码片段

#### loader.cjs · .t8c require hook 核心

```js
const ZERO_LENGTH_EXTERNAL_REFERENCE_TABLE = Buffer.from([0x00, 0x00]);
function isBufferV8Bytecode(buf) {
  return Buffer.isBuffer(buf)
    && !buf.subarray(0, 2).equals(ZERO_LENGTH_EXTERNAL_REFERENCE_TABLE)
    && buf.length >= 16;
}
function readSourceHash(buf) {
  if (process.version.startsWith('v8.8') || process.version.startsWith('v8.9'))
    return buf.subarray(12, 16).reduce((s,n,p)=>s+n*Math.pow(256,p),0);
  return buf.subarray(8, 12).reduce((s,n,p)=>s+n*Math.pow(256,p),0);
}
function fixBytecode(buf) {
  loadBytenode();
  const dummy = _bytenodeMod.compileCode('"\u0caa_\u0caa"');
  const v = parseFloat(process.version.slice(1, 5));
  if (process.version.startsWith('v8.8') || process.version.startsWith('v8.9')) {
    dummy.subarray(16, 20).copy(buf, 16);
    dummy.subarray(20, 24).copy(buf, 20);
  } else if (v >= 12 && v <= 23) {
    dummy.subarray(12, 16).copy(buf, 12);
  } else {
    dummy.subarray(12, 16).copy(buf, 12);
    dummy.subarray(16, 20).copy(buf, 16);
  }
}
function generateScript(cachedData, filename) {
  let buf = cachedData;
  if (!isBufferV8Bytecode(buf)) buf = brotliDecompressSync(buf);
  fixBytecode(buf);
  const length = readSourceHash(buf);
  const dummyCode = length > 1 ? '"' + '\u200b'.repeat(length - 2) + '"' : '';
  const script = new vm.Script(dummyCode, { cachedData: buf, filename });
  if (script.cachedDataRejected)
    throw new Error('[T8ENC1] cachedDataRejected (V8 版本不匹配?请重新 npm run encrypt)');
  return script;
}
require.extensions['.t8c'] = function (fileModule, filename) {
  const enc = fs.readFileSync(filename);
  const jsc = decryptBuffer(enc);
  const script = generateScript(jsc, filename);
  function req(id) {
    try { return fileModule.require(id); }
    catch (e) {
      // ★ 关键回退：.t8c 在 asar 外，express 等在 asar 内
      if (e && e.code === 'MODULE_NOT_FOUND') return require(id);
      throw e;
    }
  }
  req.resolve = function (request, options) {
    try { return Module._resolveFilename(request, fileModule, false, options); }
    catch (e) {
      if (e && e.code === 'MODULE_NOT_FOUND') return require.resolve(request, options);
      throw e;
    }
  };
  req.extensions = Module._extensions;
  req.cache = Module._cache;
  if (process.main) req.main = process.main;
  const compiledWrapper = script.runInThisContext({ filename, lineOffset: 0, columnOffset: 0, displayErrors: true });
  const dirname = path.dirname(filename);
  const args = [fileModule.exports, req, fileModule, filename, dirname, process, global];
  return compiledWrapper.apply(fileModule.exports, args);
};
// require('./xxx') 在 .js/.json 都缺失时自动尝试 .t8c
const _origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  try { return _origResolve.call(this, request, parent, ...rest); }
  catch (e) {
    try { return _origResolve.call(this, request + '.t8c', parent, ...rest); }
    catch (_) { throw e; }
  }
};
```

#### main.cjs · 环境变量注入 + require 入口

```js
async function startBackend() {
  backendPort = await findFreePort(18766);
  process.env.PORT = String(backendPort);
  process.env.HOST = '127.0.0.1';
  process.env.T8PC_USER_DATA = getUserDataDir();              // app.getPath('userData')
  process.env.T8PC_PACKAGED  = isPackaged() ? '1' : '0';
  process.env.T8PC_RES       = isPackaged() ? process.resourcesPath : path.resolve(__dirname, '..');
  process.env.T8PC_FRONTEND_DIST = isPackaged()
    ? path.join(process.resourcesPath, 'frontend')
    : path.resolve(__dirname, '..', 'dist');

  require('./loader.cjs');                                     // ★ 必须先注册 .t8c hook
  if (isPackaged()) {
    const entry = path.join(process.resourcesPath, 'backend-enc', 'server.t8c');
    require(entry);
  } else {
    require(path.resolve(__dirname, '..', 'backend', 'src', 'server.js'));
  }
}
```

#### config.js · 双模式数据根目录

```js
const IS_PACKAGED = process.env.T8PC_PACKAGED === '1';
const PROJECT_DIR = path.resolve(__dirname, '..', '..');
const USER_DATA = process.env.T8PC_USER_DATA && process.env.T8PC_USER_DATA.trim().length > 0
  ? process.env.T8PC_USER_DATA
  : PROJECT_DIR;
const DATA_ROOT = IS_PACKAGED ? USER_DATA : PROJECT_DIR;
const config = {
  HOST: process.env.HOST || '127.0.0.1',
  PORT: process.env.PORT || 18766,
  NODE_ENV: process.env.NODE_ENV || (IS_PACKAGED ? 'production' : 'development'),
  IS_PACKAGED,
  BASE_DIR:       DATA_ROOT,
  DATA_DIR:       path.join(DATA_ROOT, 'data'),
  INPUT_DIR:      path.join(DATA_ROOT, 'input'),
  OUTPUT_DIR:     path.join(DATA_ROOT, 'output'),
  THUMBNAILS_DIR: path.join(DATA_ROOT, 'thumbnails'),
  CANVAS_FILE:   path.join(DATA_ROOT, 'data', 'canvas_list.json'),
  SETTINGS_FILE: path.join(DATA_ROOT, 'data', 'settings.json'),
  RH_APPS_FILE:  path.join(DATA_ROOT, 'data', 'rh_apps.json'),
  FRONTEND_DIST: process.env.T8PC_FRONTEND_DIST
    || (IS_PACKAGED ? '' : path.join(PROJECT_DIR, 'dist')),
  THUMBNAIL_SIZE: 160, THUMBNAIL_QUALITY: 80, MAX_FILE_SIZE: 10 * 1024 * 1024,
  ZHENZHEN_BASE_URL: 'https://ai.t8star.org',
  RH_BASE_URL:       'https://www.runninghub.cn',
};
if (IS_PACKAGED) {
  for (const dir of [config.DATA_DIR, config.INPUT_DIR, config.OUTPUT_DIR, config.THUMBNAILS_DIR]) {
    try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
}
module.exports = config;
```

#### server.js · 打包模式前端托管

```js
// 在 app.use('/api/image', imageOpsRouter) 之后、app.listen 之前
if (config.IS_PACKAGED && config.FRONTEND_DIST && fs.existsSync(config.FRONTEND_DIST)) {
  app.use(express.static(config.FRONTEND_DIST));
  // SPA 兑底：除 api/files/input/output 4 个前缀外都返回 index.html
  app.get(/^\/(?!api\/|files\/|input\/|output\/).*/, (_req, res) => {
    res.sendFile(path.join(config.FRONTEND_DIST, 'index.html'));
  });
}
```

### 47.6 标准化打包 SOP（**下次打包必照做**）

#### 步骤 0 · 打包前必检 checklist（9 项）

- [ ] **package.json 版本号已 bump**（`version` 字段决定 `T8-PenguinCanvas-Setup-${version}.exe`）
- [ ] **electron/main.cjs 三处版本号已同步**：① `BrowserWindow.title` ② log 窗口 HTML `<span>v...</span>` ③ `ipcMain.handle('t8pc:get-info')` 返回 `version` —— 否则窗口标题与安装包不一致，用户疑惑
- [ ] **vite.config.ts / vite.config.js 的 `__APP_VERSION__` 已同步**（默认 `JSON.stringify('1.0.0')` 是伺服默认，必须与 package.json 版本号一致）。前端仅从该宏读取。[`Sidebar.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Sidebar.tsx) 左下角版本号采用 `T8 · v{__APP_VERSION__}` / `T8-penguin-canvas · v{__APP_VERSION__}`，勿再硬编码为 `v1.0.1` 之类、只需同步宏即可
- [ ] **端口约定以后端 18766 为准，前端 dev = 11422**（Electron 打包后主窗口 `loadURL('http://127.0.0.1:18766/')` 由 Express 静态托管 dist/，**不依赖 Vite dev port**）。若后端端口变更，需同步改：`backend/src/config.js` `BACKEND_PORT` 默认值 + `vite.config.ts/js` 三个 proxy target（/api,/files,/output） + `electron/main.cjs` `backendPort`；前端 dev port 变更只需改 `vite.config.ts/js` `server.port` 一处
- [ ] **backend/src/{config.js,server.js} 改动后必须重新 `npm run encrypt`**（否则 .t8c 还是旧字节码）
- [ ] **bytenode 已 npm install**（`dependencies` 中 `bytenode: ^1.5.7`，`postinstall` 跑 `electron-builder install-app-deps`）
- [ ] **用户分发包充值密钥边界**：不得把 `data/recharge.private.json`、非空 `AGENT_HMAC_KEY / DULUPAY_KEY`、`RECHARGE_DEFAULT_ENC` 可逆密文打进 `dist_electron`；正式用户充值包必须走 VPS 公开下单/查单接口，不能让桌面端持有全局 HMAC
- [ ] **dist_electron / build / *.tsbuildinfo / electron/*.js / _temp_* 已在 .gitignore**（永不上传到仓库）
- [ ] **当前用户**明确说了「打包」/「build」/「dist」/「发版」 —— 否则**禁止执行**任何 `npm run dist*`

#### 步骤 1 · 加密后端

```powershell
cd e:\PenguinPravite\T8-penguin-canvas
npm run encrypt
# = cross-env ELECTRON_RUN_AS_NODE=1 electron electron/encrypt.cjs
```

要点：

- **必须用 Electron 内置 Node 跑**（`ELECTRON_RUN_AS_NODE=1` + `electron` 二进制），否则 V8 字节码版本与运行时不匹配，启动后 `cachedDataRejected` 异常；
- 输入：`backend/src/**/*.{js,json}` → 输出：`build/backend-enc/*.t8c`（共 8 个：server + config + utils/* + routes/{canvas,settings,proxy,files,imageOps}）；
- `encrypt.cjs` 的 `rewriteRequires(src)` 自动把 `require('./foo')` / `require('./foo.js')` 改写为 `require('./foo.t8c')`，所以源码里所有相对 require 必须保持相对路径，不要写成绝对路径或 alias。

#### 步骤 2 · 前端构建（与加密同捆 npm script）

```powershell
npm run prepack:enc
# = npm run build && npm run encrypt
# vite build → dist/  +  bytenode/T8ENC1 → build/backend-enc/
```

#### 步骤 3 · 出 NSIS 安装包

```powershell
# 完整流程(出 .exe 安装包):
npm run dist
# = npm run prepack:enc && electron-builder --win --x64 && node electron/_post_build.cjs

# 或仅出免安装目录(调试用):
npm run dist:dir
# = npm run prepack:enc && electron-builder --win --x64 --dir && node electron/_post_build.cjs
```

#### 步骤 4 · `_post_build.cjs` 自动核验

输出形如：

```
[1] 加密后端字节码:
  ✅ resources/backend-enc/server.t8c
  ✅ resources/backend-enc/config.t8c
  ✅ resources/backend-enc/routes/canvas.t8c
  ... (5 个 routes)
[2] 前端 dist:
  ✅ resources/frontend/index.html
  ✅ resources/frontend/assets
[3] 清除可能混入的明文后端源码:
  (无打印 = 没有意外混入,正确)
[4] resources/ 完整结构: ...
[post-build] DONE ✅
```

#### 步骤 5 · 实测启动验证

```powershell
.\dist_electron\win-unpacked\T8-PenguinCanvas.exe
```

**必看日志**（在 log 窗口 / DevTools / `%APPDATA%/t8-penguin-canvas/dbg.log`）：

```
[backend] picked port=18766
[backend] loading encrypted entry: ...\resources\backend-enc\server.t8c
[backend] started in-process on http://127.0.0.1:18766
环境: production                                        ← 必须是 production
数据目录: C:\Users\<USER>\AppData\Roaming\t8-penguin-canvas\data
GET / 200
GET /assets/index-*.js  /assets/index-*.css
GET /api/canvas         GET /api/settings
窗口标题: 贞贞的无限画布（企鹅共创版）
```

任何一项不符 → 回看 §47.3 三处根因。

### 47.7 调试技巧

| 现象 | 排查路径 |
|------|---------|
| `Cannot find module 'xxx'`，stack 顶为 `%TEMP%/t8pc-jsc/*.jsc` | loader.cjs 的 .t8c hook 误用了 tmpFile 二次 require，回看 §47.3 根因 1 |
| `Cannot find module 'express'`，stack 顶为 `resources/backend-enc/*.t8c` | `req()` 没加 MODULE_NOT_FOUND 回退，回看 §47.3 根因 2 |
| 启动日志显示 `环境: development` 或 `数据目录: dist_electron\win-unpacked\data` | config.js 没识别 `T8PC_PACKAGED` / `T8PC_USER_DATA`，回看 §47.3 根因 3 |
| 浏览器 `GET /` 返回 `Cannot GET /` | server.js 没注册 `express.static(FRONTEND_DIST)`，回看 §47.4 修复 4 |
| `cachedDataRejected (V8 版本不匹配?请重新 npm run encrypt)` | encrypt 时用的 Node 版本与运行时 Electron V8 不一致，重新 `npm run encrypt`（必须 Electron 内置 Node）|
| sharp 报 `Cannot find module '@img/sharp-win32-x64'` | `asarUnpack: ['node_modules/sharp/**/*', 'node_modules/@img/**/*']` 漏配，回看 package.json `build.asarUnpack` |
| 启动后 RH/贞贞 API 全部 401 | settings.json 没迁移到 userData，老用户从开发版升级时手动复制 `<project>/data/settings.json` → `%APPDATA%/t8-penguin-canvas/data/settings.json` |
| log 窗口一直停在「启动中…」不消失 | `waitForBackend(port, 30)` 探活失败 → backend require 阶段抛了异常，看 dbg.log 的 `[backend] FAILED to start` 完整 stack |

### 47.8 关键文件清单

- [electron/main.cjs](file:///e:/PenguinPravite/T8-penguin-canvas/electron/main.cjs)（环境变量注入 + 启动后端 + 主窗口 + log 窗口；版本号 3 处需同步 package.json）
- [electron/loader.cjs](file:///e:/PenguinPravite/T8-penguin-canvas/electron/loader.cjs)（T8ENC1 + .t8c require hook + bytenode .jsc 内部逻辑复刻 + MODULE_NOT_FOUND 回退）
- [electron/encrypt.cjs](file:///e:/PenguinPravite/T8-penguin-canvas/electron/encrypt.cjs)（`bytenode.compileCode(Module.wrap(src))` + `encryptBuffer` + `rewriteRequires` 把相对 require 改写为 `.t8c`）
- [electron/_post_build.cjs](file:///e:/PenguinPravite/T8-penguin-canvas/electron/_post_build.cjs)（产物核验 + 强制清明文）
- [backend/src/config.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/config.js)（`IS_PACKAGED` + `DATA_ROOT` 派生所有目录 + 自动 mkdir）
- [backend/src/server.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/server.js)（打包模式 `express.static` + SPA 兑底）
- [package.json](file:///e:/PenguinPravite/T8-penguin-canvas/package.json)（`build.asar` / `build.asarUnpack` / `build.extraResources` / `build.files` 黑白名单 / NSIS 配置）

### 47.9 永久规则补充

1. **未明确指令前不允许打包** —— 已写入 §45.4，本次打包仅是上一轮指令的合理延续。
2. **package.json 版本号 bump 后，必须同步检查 electron/main.cjs 三处版本号**（标题 / log 窗口 HTML / IPC version）。
3. **`backend/src/` 任何修改都必须重新 `npm run encrypt`**，否则 .t8c 还是旧字节码。
4. **`encrypt` 必须用 Electron 内置 Node 跑**（`ELECTRON_RUN_AS_NODE=1 electron`），否则 V8 字节码版本不匹配。
5. **`dist_electron/` 与 `build/` 已在 .gitignore，永不提交**；GitHub 不传安装包，发版另走 release 通道。
6. **`.t8c` 必须放在 asar 外**（`extraResources`），asar 内的 .t8c 由于 require 解析机制无法被 hook 捕获到。

### 47.10 提交链

```
(本章对应改动 commit 规划)
fix(electron+backend): 修复打包后启动报 express 不存在 + 后端打包模式适配
  - electron/loader.cjs: 重写 .t8c hook(bytenode .jsc 复刻) + MODULE_NOT_FOUND 回退
  - electron/main.cjs : v1.1.0 → v1.2.0 三处版本号同步
  - backend/src/config.js : 识别 T8PC_PACKAGED/T8PC_USER_DATA/T8PC_FRONTEND_DIST
  - backend/src/server.js : 打包模式 express.static + SPA 兑底
ocs(skill+features): §47 / phase27 沉淀打包链路 3 处根因 + SOP + checklist
```

---

## 48. SHIFT 多线平移到目标节点失效修复（phantom pointerEvents:none + elementsFromPoint 兜底）

### 48.1 用户报告

> 多条连线按住 SHIFT 平移到其他节点失效了，连不上去。从一个 Seedance2.0（包含图像/音频/视频多种连线）平移到另一个 Seedance2.0，没有反应。

### 48.2 机制回顾

SHIFT 多线批量重连（bulkReconnect）的工作流：

1. SHIFT + mousedown 在某 handle 上 → 收集该 handle 上所有同方向的边（stashed）
2. 创建一个 `BULK_PHANTOM_ID = '__bulk_phantom__'` 的 phantom 节点（`type: 'bulkPhantom'`），`zIndex: 9999`
3. 把 stashed 的所有边的 `source/target` 重定向到 phantom，让边实时跟随鼠标
4. mousemove → 更新 phantom 位置
5. mouseup → `event.target.closest('.react-flow__handle')` 拿到落点 handle → 重连

### 48.3 根因

**phantom wrapper DOM 在 mouseup 瞬间盖在目标 handle 之上**，因为：

- phantom 节点 `zIndex: 9999`（最高层）
- xyflow 把 phantom 渲染为 `.react-flow__node` wrapper div，跟随鼠标
- mouseup 时，`event.target` = phantom wrapper（不是目标 handle）
- `target.closest('.react-flow__handle')` = `null`
- 直接走 `restoreOriginal()`，平移失效

### 48.4 修复

**A. phantom 节点添加 `pointerEvents: 'none'`**

```ts
setNodes((ns) => [...ns, {
  id: BULK_PHANTOM_ID,
  type: 'bulkPhantom',
  position: initFlowPos,
  data: {},
  draggable: false, selectable: false, deletable: false,
  zIndex: 9999,
  // ⚠️ 关键：phantom wrapper 必须 pointerEvents:none
  style: { pointerEvents: 'none' },
} as Node]);
```

**B. 新增 `findHandleAt(cx, cy)` 工具函数（elementsFromPoint 复数遍历，跳过 phantom）**

```ts
const findHandleAt = (cx: number, cy: number): HTMLElement | null => {
  const els = document.elementsFromPoint(cx, cy);
  for (const el of els) {
    const h = (el as Element).closest?.('.react-flow__handle') as HTMLElement | null;
    if (!h) continue;
    const wrap = h.closest('.react-flow__node') as HTMLElement | null;
    const nid = h.getAttribute('data-nodeid') || wrap?.getAttribute('data-id') || '';
    if (nid === BULK_PHANTOM_ID) continue;
    return h;
  }
  return null;
};
```

**C. 重写 onMouseUp 双层路径（event.target 快路径 + findHandleAt 兜底）**

```ts
const onMouseUp = (upEv: MouseEvent) => {
  const upTargetEl = upEv.target as HTMLElement | null;
  let upHandleEl = upTargetEl?.closest('.react-flow__handle') as HTMLElement | null;
  if (upHandleEl) {
    const wrap = upHandleEl.closest('.react-flow__node') as HTMLElement | null;
    const nid = upHandleEl.getAttribute('data-nodeid') || wrap?.getAttribute('data-id') || '';
    if (nid === BULK_PHANTOM_ID) upHandleEl = null;
  }
  if (!upHandleEl) upHandleEl = findHandleAt(upEv.clientX, upEv.clientY);
  cleanup();
  // ...后续与原逻辑一致
};
```

**D. onMouseMove 同步使用 findHandleAt** 让 hover 高亮也跳过 phantom 自身。

### 48.5 关键设计要点

- `pointerEvents:none` 让 phantom DOM 不响应任何鼠标事件，鼠标事件完整穿透到下层
- 即使 `pointerEvents:none` 失效（某些 React 重渲染时序问题），`elementsFromPoint`（**复数**）依然能遍历坐标下所有命中元素，主动跳过 phantom
- 双重保险：A 是首选，B 是兜底；任何一个生效即可

### 48.6 兼容性

- 不影响：单线重连、SHIFT 拉新连线、SHIFT 剪刀、Alt 拖克隆、ESC 取消
- 不影响：phantom 节点自身的边渲染（边是渲染在 SVG 层，不受 wrapper pointerEvents 影响）

### 48.7 验收清单

- [x] SHIFT + 多边起点 mousedown → phantom 出现、边跟随鼠标 ✅
- [x] mousemove 经过其他节点同方向 handle → 高亮 ✅
- [x] mouseup 落在目标节点 handle 上 → 边批量重连成功 ✅
- [x] mouseup 落在空白 → 还原原始连接 ✅
- [x] ESC 取消 → 还原原始连接 ✅

### 48.8 关键文件

- `src/components/Canvas.tsx` ~1570 行：BulkPhantomNode 注册
- `src/components/Canvas.tsx` ~1577 行：phantom 节点 `style: { pointerEvents: 'none' }`
- `src/components/Canvas.tsx` ~1657 行：`findHandleAt` 工具函数
- `src/components/Canvas.tsx` ~1701 行：`onMouseUp` 双层路径

---

## 49. 终端日志「暂无日志」反复失效修复（防再丢失规范）

### 49.1 问题历史

| 时间 | commit | 现象 | 根因 |
|---|---|---|---|
| 早期 | 4ae4570 | 终端面板「暂无日志」 | RH 节点只有 console.log，未调用 logBus |
| 2026-05-24 | d5430c2（灾难 rebase） | 终端面板「暂无日志」+ 多个良好 commit 内容被回退 | rebase 冲突解决错误，把 14833fa~295c700 累积良好内容全部回滚到旧版（含 logBus 接入也被一并回退） |
| 2026-05-24 修复 | 295c700 reset + 重做 | 恢复 4ae4570 的 logBus 接入 + 增加 §49 防再丢失规范 | 不再依赖单点修复，固化流程 |

### 49.2 架构图

```
业务节点（AudioNode/SeedanceNode/ImageNode/RunningHubNode/...）
   │
   │ logBus.info/success/warn/error/debug(message, source?)
   ▼
useLogStore.entries（zustand 单例）
   │
   │ TerminalPanel useLogStore((s) => s.entries) 订阅
   ▼
TerminalPanel UI（顶部计数 + 内容列表）
```

**关键点**：useLogStore / TerminalPanel / logBus 三件套始终正常；问题只会出在「业务节点是否调用 logBus.xxx()」这一环。

### 49.3 防再丢失三道防线

**A. 顶部 import 警告注释**

业务节点（特别是 RunningHubNode）顶部 import 必须保留警告：

```ts
// ⚠️ 重要：必须 import logBus。RunningHubNode 不能只用 console.log 输出调试信息，
// 否则终端面板（TerminalPanel）会显示「暂无日志」。console 与 logBus 必须同步调用。
// 重构该节点请保留该导入与所有调用点。参考 skill.md §49。
import { logBus } from '../../stores/logs';
```

**B. RunningHubNode 9 个必设调用点表**

| 场景 | level | 调用示例 |
|---|---|---|
| 字段从上游覆写 | debug | `logBus.debug(\`字段 ${name} 从上游覆写 → ${url}\`, src)` |
| 提交任务 | info | `logBus.info(\`提交任务 · webappId=${id} · ${cnt} 个字段\`, src)` |
| 拿到 taskId | success | `logBus.success(\`异步任务已提交 taskId=${id} 进入轮询…\`, src)` |
| submit 抛错 | error | `logBus.error(\`submit 失败：${msg}\`, src)` |
| 轮询进度（30s 一次） | debug | `logBus.debug(\`[${s}s] status=${st} code=${c} urls=${u}\`, src)` |
| 轮询完成 | success | `logBus.success(\`任务完成 · ${n} 个输出 → ${first}\`, src)` |
| 任务 FAILED | error | `logBus.error(\`生成失败: ${reason}\`, src)` |
| 轮询 catch | warn | `logBus.warn(\`轮询异常: ${err}\`, src)` |
| 用户主动停止 | warn | `logBus.warn('用户主动停止', src)` |

**C. src 命名空间约定**

函数体顶端必须定义：

```ts
// ⚠️ src 是终端日志面板的「来源 tag」，不要删除
const src = `rh:${id}`;          // RunningHubNode
// 其他节点对应：`audio:${id}` / `image:${id}` / `seedance:${id}` / `llm:${id}`
```

### 49.4 反重构检查表（每次修改业务节点必跑）

- [ ] 顶部 `import { logBus } from '../../stores/logs'` 是否保留？
- [ ] 函数体顶端 `const src = '<ns>:${id}'` 是否保留？
- [ ] 9 个调用点（B 表）是否齐全？
- [ ] 每个 console.log 是否有同行 logBus.xxx 同步调用？
- [ ] `npx tsc --noEmit` 是否 0 错误？
- [ ] 启动应用 → 触发节点运行 → TerminalPanel 顶部计数是否从 0 立即递增？

### 49.5 其他节点接入现状

| 节点 | logBus 调用次数 | 状态 |
|---|---|---|
| RunningHubNode.tsx | 9+ | ✅ |
| AudioNode.tsx | 13 | ✅ |
| SeedanceNode.tsx | 10 | ✅ |
| ImageNode.tsx | 多处 | ✅ |
| LlmNode / SunoNode / ... | 各自具备 | ✅ |

### 49.6 关键文件

- `src/stores/logs.ts`：useLogStore + logBus 双接口（**正常，不需改**）
- `src/components/TerminalPanel.tsx`：UI 订阅（**正常，不需改**）
- `src/components/nodes/RunningHubNode.tsx`：⚠️ **高重构频繁区域，每次改完必跑 49.4 检查表**

### 49.7 经验教训

1. **永远不要随意 git pull --rebase 解决冲突**——上游远端的"开源公开重构"如果对工作目录的累积良好内容有侵入性 diff，rebase 会把累积内容判为"被远端删除"而回退。
2. **有冲突时优先用 `git pull --no-rebase` (merge) 或新建分支再合并**，避免 rebase 把本地已有提交的内容反向回退。
3. **大量功能丢失时立刻 `git reflog` 找最近的健康 HEAD**，用 `git reset --hard <hash>` 抢救，绝不要在损坏的状态上继续叠加 commit。
4. **每次 push 前都用 `git diff --stat <upstream> HEAD`** 检查 diff 规模——如果 deletions 远多于 insertions，必须警觉。

---

## §50 Suno 双轨节点输出素材只显示 1 首歌的修复

### 50.1 用户反馈

> "suno 节点,应该生成两首歌曲,但是输出素材只显示了 1 首,检查问题并修复,不要破坏其他功能"

截图证据:
- SunoNode 右侧有两个 source handle (id=`audio-0`, id=`audio-1`,top 48% / 52%)
- 右侧手动连一根边到 OutputNode → OutputNode 只显示 "音频 (1)" 1 项

### 50.2 根因

Suno API 的 `AudioQueryResult.tracks[]` 是数组(2 首歌),AudioNode 把两首歌分别写入 `data.audioUrl` (轨 1) 和 `data.audioUrl_1` (轨 2) 两个字段(对应 Handle id `audio-0` / `audio-1`)。

但下游分流路径**只读了主轨 `audioUrl`,漏读副轨 `audioUrl_1`**:

1. [Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx#L1937) autoOutput 第 1937 行 `pushAud(d.audioUrl)` 只取 1 项 → 只创建 1 个 auto OutputNode
2. [OutputNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx#L158) collected 第 158 行只 `pushUnique(out.audios, ud.audioUrl)` → 手动连边的 OutputNode 也只见 1 首
3. [OutputNode.tsx upstreamSig](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx#L88) 第 88 行字段签名也漏 → 即使后续修了 collected,签名不变 useMemo 不重算
4. OutputNode 下游透传 effect 没传 `audioUrl_1` → OutputNode 串联场景副轨进一步丢失

注意: [useUpstreamMaterials.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useUpstreamMaterials.ts#L127-L129) 业务节点 hook 已正确读取双字段(phase24/26 已修),所以 LLMNode/SeedanceNode 作为下游能拿到两首。**只有展示链路 (OutputNode + autoOutput) 漏修**。

### 50.3 修复(4 处全改)

1. **OutputNode.tsx upstreamSig 签名补 audioUrl_1**:
```tsx
ud.audioUrl || '',
ud.audioUrl_1 || '', // Suno 双轨副轨; 漏写会导致只显示第 1 首
```

2. **OutputNode.tsx collected 同时读双字段**:
```tsx
// 音频 (audioUrl 主轨, audioUrl_1 副轨——AudioNode/SunoNode 双输出口)
pushUnique(out.audios, ud.audioUrl);
pushUnique(out.audios, ud.audioUrl_1);
```

3. **OutputNode.tsx 下游透传 effect 加 audioUrl_1**:
```tsx
audioUrl: collected.audios[0] || '',
audioUrl_1: collected.audios[1] || '', // 透传 Suno 双轨副轨避免串联丢失
// cur 比较与 changed 判断同步加入 audioUrl_1
```

4. **Canvas.tsx autoOutput 同时分流副轨**:
```tsx
pushAud(d.audioUrl);
// Suno / AudioNode 双轨输出口: audioUrl=轨1, audioUrl_1=轨2
// 不取 audioUrl_1 会导致 autoOutput 只创建 1 个 OutputNode
pushAud(d.audioUrl_1);
```

### 50.4 设计要点

- **保持向后兼容**: 单轨节点(语音合成等)只写 `audioUrl`,`audioUrl_1` 为 undefined → `pushUnique`/`pushAud` 会因 typeof !== 'string' 跳过,不影响
- **autoOutput 升级路径**: items 数组现在多 1 项 audio → autoOutput 会自动按 needCount 补建 1 个 OutputNode 并标 pickKind='audio'/pickIndex=1,与已修的 OutputNode collected 联动正确选中第 2 首
- **手动连边场景**: 用户在截图中是手动从 SunoNode 拉边到一个 OutputNode → OutputNode 不带 pickKind 走"显示上游全部"分支,修复后两首歌都在 collected.audios 里 → 显示"音频 (2)"

### 50.5 反 SunoNode 改名/重构检查表

- [ ] SunoNode (=AudioNode) 是否仍把第 2 首歌写入 `data.audioUrl_1`?(grep `audioUrl_1: r.tracks`)
- [ ] 第 2 个 source Handle id 是否仍是 `audio-1`?(grep `id="audio-1"`)
- [ ] [OutputNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx) collected/upstreamSig/下游透传三处是否都包含 `audioUrl_1`?(grep `audioUrl_1` 应有 ≥ 4 处)
- [ ] [Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) autoOutput 是否有 `pushAud(d.audioUrl_1)`?
- [ ] [useUpstreamMaterials.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useUpstreamMaterials.ts) 是否仍 `pushUrl(sid, 'audio', ud.audioUrl_1, audios)`?

### 50.6 经验教训

1. **多输出口节点必须在所有下游路径上对齐字段**: SunoNode 早在 phase24/26 就已支持双轨,但当时只改了 useUpstreamMaterials,**漏掉了 OutputNode 和 autoOutput**。
2. **"看似某个 hook 改完就完事"是错觉**——展示节点 (OutputNode) 有自己的独立 collected 逻辑,**任何新增字段都需要双路径同步**。
3. **后续若新增 audioUrl_2/audioUrl_3 (多轨扩展),应考虑改成数组 `data.audioUrls: string[]`**,避免每加一轨都要四改。

---

## §51 节点内 textarea/input 框选文字时整个节点跟着鼠标走的修复

### 51.1 用户反馈

> 「在任何文本编辑的节点内,需要可以按住鼠标拖动框选文字,现在框选拖动鼠标会导致整个节点一起移动,正常应该是框选文字,节点不动,然后文字按照鼠标拖动进行框选」

### 51.2 根因

- xyflow v12 节点拖动是通过 `pointerdown` 识别启动 (不是 mousedown)
- `e.stopPropagation()` 在 onMouseDown 上拦不住 pointerdown(pointerdown 更早触发)
- TextNode 原实现仅 `onMouseDown={(e) => e.stopPropagation()}` → 框选仍被 xyflow 拦截为节点拖动
- 项目内 14 个 textarea 分散在 12 个节点文件,逐个补 `nodrag` className 不可维护

### 51.3 修复 (1 处全局处理)

[App.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/App.tsx) 复用原有的全局 MutationObserver(原本仅用于 spellcheck=false),扩展为同时为所有 textarea/input/select 加 `nodrag` + `nowheel` className:

```tsx
const apply = (el: Element) => {
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') {
    if (tag !== 'SELECT') {
      el.setAttribute('spellcheck', 'false');
      el.setAttribute('autocorrect', 'off');
      el.setAttribute('autocapitalize', 'off');
    }
    // xyflow noDragClassName/noWheelClassName 默认 'nodrag'/'nowheel'
    el.classList.add('nodrag', 'nowheel');
  }
};
document.querySelectorAll('textarea, input, select').forEach(apply);
const mo = new MutationObserver(/* 增量监听同样 apply */);
mo.observe(document.body, { childList: true, subtree: true });
```

### 51.4 为什么走全局而不是逐节点改

1. **便多低护**: 14 个 textarea 分散在 12 个节点文件,逐个改 className 出错面大
2. **未来新增节点自动覆盖**: MutationObserver 实时捕获动态挂载的 textarea,不需记住加 nodrag
3. **零侵入**: classList.add 仅追加,保留节点原有 className 和样式
4. **复用现有 effect**: 不增加新的 useEffect 和 MutationObserver 实例,零性能损耗

### 51.5 覆盖范围

修复后所有 textarea/input/select 的交互都符合预期:
- 文字框选 (mousedown + drag): 节点不动 ✅
- 双击选词 / 三击选行: 节点不动 ✅  
- 文字贴贴/复制/剪切 (Ctrl+V/C/X): 原有语义 ✅
- textarea 内鼠标滚轮滚动: 不被 xyflow 接管为画布缩放 ✅
- 节点头部/边框拖动: 仍可拖动节点 ✅ (仅 textarea/input/select 区域不拖)
- Ctrl+拖画布框选多节点: 未受影响 ✅ (Ctrl 点击会被 xyflow 调度别的路径)

### 51.6 反重构检查表

- [ ] [App.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/App.tsx) 中 MutationObserver 是否仍含 `el.classList.add('nodrag', 'nowheel')` 调用?
- [ ] querySelectorAll 是否仍是 `'textarea, input, select'` (三个 tag)?
- [ ] MutationObserver 仍设 `observe(document.body, { childList: true, subtree: true })`?
- [ ] 新增使用 textarea/input/select 的节点无需手动加 nodrag,自动生效

### 51.7 经验教训

1. **xyflow 拖拽识别依赖 className,不是 event 冲突**: stopPropagation 拦不住 pointerdown,仅 className 约定 (`nodrag`/`nopan`/`nowheel`) 才是官方机制
2. **表单元素多点重复处理 → 全局 MutationObserver 一次解决**: 避免每个节点重复写 `className="...nodrag nowheel..."`,加入 App.tsx 后所有新节点免修改
3. **复用现有 useEffect 而不新增**: 原本就有为 spellcheck 设置的 MutationObserver,顺便加上 className 逻辑,零额外资源占用

---

## §52 节点四角同比例缩放 + width:100% 百分比循环导致连线/缩放失效的修复 (v1.2.2)

### 52.1 需求源

- 用户要求 TextNode / OutputNode / UploadNode 三个节点支持拖动四角同比例缩放
- 鼠标悬停四角时出现明显感知 UI
- 不同主风(科技/像素 × 深色/浅色)对应不同视觉

### 52.2 初版实现(邀请的问题)

创建 `src/components/nodes/ResizableCorners.tsx`(通用控件) + `src/styles/index.css` 末尾追加 4 套主题 CSS。节点 root 改造为:
```tsx
style={{
  width: '100%',
  minWidth: 220,
  minHeight: '100%',  // ← 问题根源
}}
```
思路: 默认 wrapper auto 时 `min-height: 100%` fallback 0,不强制高;拖大后 wrapper 有具体 height,100% 生效 → root 撑满。

### 52.3 用户反馈严重 Bug

> *“上传素材节点无法连接生成节点了,然后输出素材节点也有问题,只能纵向拉大,下面一堆白色,,,无法同比例拉大缩小”*

两个严重问题:
1. **UploadNode 无法连接下游**
2. **OutputNode 只能纵向拉大 + 下方空白**(keepAspectRatio 失效)

### 52.4 根因分析(CSS 百分比循环)

ReactFlow v12 节点 wrapper(`.react-flow__node`)是 **`absolute` 定位 + 默认 width=auto/height=auto**。在节点 root 上设 `width:100%` + `minHeight:100%` 会形成**百分比循环测量**:

```
wrapper width=auto (按子内容收缩) ←─┐
                                       │
   └→ root width=100% (按父计算) ───┘
        ↑
        该循环被浏览器处理为 shrink-to-fit
        → wrapper.measured.width 可能是 0 或不稳定
```

#### 连线失效原因
ReactFlow Handle 位置由 `node.internals.handleBounds` 决定,后者依赖 wrapper measured。measured.width≈0 → handleBounds 完全错位 → 鼠标点不到 Handle 原位 → **无法发起连接**。

#### keepAspectRatio 失效原因
xyflow XYResizer `onResizeStart` 中计算:
```js
startValues.aspectRatio = node.measured.width / node.measured.height;
//                       = 0 / h
//                       = 0
```
拖定右下角(diagonal)时:
```js
distX = distY * aspectRatio = distY * 0 = 0
newWidth = startWidth + distX = startWidth   // 始终不变
                                            // → clamp 到 minWidth
newHeight = startHeight + distY              // 自由增长
```
结果: **拖大时 width 被锁在 minWidth 附近, height 任意增长 → 纵长条 + 内容只填上半部分 → 下方大片空白**。

### 52.5 最终修复方案(root 始终持有具体 px)

核心: **节点 root 始终有具体 px 尺寸**,避免依赖 wrapper auto 下的百分比 fallback。

#### 代码架构

1) **本地 state 持有尺寸**
```tsx
const [size, setSize] = useState<{ w: number; h?: number }>({ w: 260 });
//                                  ↑                 ↑
//                          初始具体 px       默认 auto, 拖后具体 px
```

2) **ResizableCorners onResize 同步**
```tsx
<ResizableCorners
  selected={selected}
  minWidth={220}
  minHeight={140}
  accent="#38bdf8"
  onResize={(_e, p) => setSize({ w: p.width, h: p.height })}
/>
```

3) **root style 读 state**
```tsx
style={{
  width: size.w,           // 始终具体 px → wrapper measured 准确
  height: size.h,          // 默认 undefined→auto, 跟随内容; 拖后具体 px
  minWidth: 220,
}}
```

4) **内层 flex-1 条件化**(避免默认 root auto 时 flex-1 fallback 0 导致内层缩塌)
```tsx
<div className={`p-2.5 ${size.h ? 'flex-1 min-h-0 overflow-auto' : ''}`}>
  {/* size.h 未设(默认) → block 布局, 跟随内容自然撑高 */}
  {/* size.h 已设(拖过角) → flex-1 撑满剩余 + min-h-0 允许内容 overflow */}
</div>
```

### 52.6 各节点具体参数

| 节点 | 初始 size.w | minWidth | minHeight | accent | 备注 |
|---|---|---|---|---|---|
| TextNode | 260 | 220 | 140 | `#38bdf8` (sky-400) | textarea 默认 `h-24`, 拖后 `flex-1 min-h-[72px]` |
| OutputNode | 320 | 260 | 160 | `accent` (teal-300) | 外层 flex column 内层条件 flex-1; 保留原有多类型门户 + autoOutput |
| UploadNode | 260 | 220 | 180 | `handleColor` (跟随上传类型) | body 默认 block(上传后被图自然撑大) |

### 52.7 ResizableCorners 控件设计

`src/components/nodes/ResizableCorners.tsx` (80 行) — 多节点复用的同比例缩放控件:

- 4 个 `NodeResizeControl` 划到 4 个角 `position='top-left/top-right/bottom-left/bottom-right'`
- `keepAspectRatio` 全部 true 同比例
- 主题 className 组合: `t8-resize-handle--{tech|pixel}-{dark|light}` × `t8-resize-handle--{position}`
- 仅 `selected=true` 时渲染,保持节点视图纯净
- 科技风: 用 `--t8-resize-accent` CSS 变量接收 React 传的 accent
- 像素风: 固定用 `theme-pixel.css` 糖果色 + 硬阴影(方向自动朝外)

### 52.8 反重构检查表

1. **节点 root style 必须有具体 px 完成宽高定位**
   - ✅ `width: size.w` (本地 state)
   - ❌ `width: '100%'` (会形成百分比循环)
2. **height 默认 undefined(auto)**, 拖后才是具体 px
3. **内层 flex-1 必须条件化** (`size.h ? 'flex-1 min-h-0' : ''`)
4. **ResizableCorners onResize 必须接上 setSize**
5. **初始 size.w 必须 ≥ minWidth** (避免 ResizeStart 报警)

### 52.9 经验教训

1. **CSS 百分比 + 父元素 auto = 危险组合**: shrink-to-fit 上下文里子元素用百分比 可能 fallback 为 0 或内容尺寸, 主要看浏览器实现
2. **xyflow keepAspectRatio 依赖 measured 准确**: 需要 wrapper或 node 本身有明确尺寸,才能算出有效 aspectRatio
3. **调试思路**: 拖动一个轴动动一个轴不动 → 90% 是 aspectRatio = 0; 检查初始 measured.width/height 是否都有值
4. **xyflow Handle bounds 同源于 measured**: measured 不准 → 连线也失效; 一体两面
5. **本地 state 控制节点尺寸 比 100% 响应式更可控**: 避免 CSS 循环 + onResize 回调同步一步到位, xyflow store 中 node.width/height 与 React state 多道路一致

---

## §53 图像编辑器 · 遮罩(mask) + 画板(brush) 模式扩展

### 53.1 需求源

双击上传素材/输出素材(仅图像类型)进入图像编辑弹窗，在已有「裁剪 / 宫格切分」两模式上叠加「遮罩」与「画板」两个新模式，参考 Infinite-Canvas 的 imageEditor 全模式交互，保证 UI 一致性、美观度、用户体验。

### 53.2 未名错误避免·重点软定

- 全部产物走 [`/api/files/upload-base64`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/files.js#L66) 复用，**后端零改动**
- 笔画一律存矢量 (fraction 坐标) × 渲染仅作为 canvas 缓存 → 窗口缩放不失真、撤销恢复瘦身
- 不侵入节点本体，UploadNode/OutputNode 现有 onProduce 回调重用

### 53.3 交互设计

| 模式 | tab | 快捷键 | 主要工具 | 产物 |
|------|----:|------:|---------|------|
| crop  | 1 | 1 | crop-box 拖动 + 4 角缩放 | 1 张 (原裁剪) |
| mask  | 2 | 2 | 笔刷大小 2~300 + 橡皮(destination-out) + 撤销/恢复/清空 | **2 张** (原图 + 黑底白笔 mask) |
| brush | 3 | 3 | 4 工具 free/rect/ellipse/label + 颜色 + 笔刷 2~160 + 撤销/恢复/清空 | 1 张 (原图 ⊕ 画板合成) |
| grid  | 4 | 4 | preset/custom + gap | N 张 |

全局快捷键：`Esc` 关闭、`Ctrl+Z` 撤销、`Ctrl+Shift+Z` / `Ctrl+Y` 恢复、`[` `]` 调笔刷大小(仅 mask/brush)。

### 53.4 文件改动清单

| 文件 | 改动 |
|------|------|
| [src/components/nodes/ImageEditModal.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/ImageEditModal.tsx) | EditMode 加 mask/brush；DrawStroke 矢量类型 6 种；maskStrokes/brushStrokes + 双独立撤销/恢复栈 (深度 50)；canvas overlay 按原始分辨率渲染；onDrawPointerDown/Move/Up + 跟随圈 cursor；applyMask/applyBrush 离屏合成后走 uploadDataUrl；fetchAndUpload 原图同源转存避免外链 CORS；UI: tabs+工具行+stage data-mode+footer 分支 |
| [src/services/imageOps.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/imageOps.ts) | 新增 `uploadDataUrl(dataUrl, prefix)` 复用后端 base64 上传通道 |
| [src/styles/index.css](file:///e:/PenguinPravite/T8-penguin-canvas/src/styles/index.css) | `.img-edit-stage[data-mode=...]` 下的 `.img-edit-draw` / `.img-edit-cursor` 层级与 touch-action 兑底 |

### 53.5 mask 产物协议(inpaint 就绪)

onProduce 十三 2 张 url、顺序为 `[originUrl, maskUrl]`，meta `{ type:'mask', strokeCount }`；下游 OutputNode 自然平际创建 2 个外挂节点。后续接 inpaint 节点时可出 portTypes 添 `mask` 端口色。

### 53.6 防重构检查表

- [ ] EditMode 联合类型包含 4 个值：`'crop' | 'mask' | 'brush' | 'grid'`
- [ ] DrawStroke 6 种 kind 全在 (mask-stroke / mask-erase / brush-free / brush-rect / brush-ellipse / brush-label)
- [ ] mask/brush 各自一栈，undo 改 redo 不交叉污染
- [ ] applyMask 必须**同时上传原图 + mask** (避免下游外链被黑名单)
- [ ] applyBrush 必须在一个离屏 canvas 中先 drawImage(原图) 再叠加画笔
- [ ] cursor 圈的 width/height 按 `clientWidth/naturalWidth` 换算，保证与实际笔刷一致
- [ ] 键盘快捷键遇到 input/textarea 输入不拦截 (`tag === 'input'` 跳过)

### 53.7 经验教训

1. **矢量优于位图**：存 fraction 点串者不是记 ImageData → 双主题切换/窗口缩放/撤销都不失真
2. **canvas.width = naturalSize.w**：默认 300×150 会造成严重错位；梦 1080P 后仍随 CSS `width:100%` 自适应
3. **遮罩黑底白笔仅在 applyMask 时产生**：overlay 在调用期间是透明的以使原图可见，走离屏 canvas 泳出黑底就是外限
4. **crossOrigin + fetchAndUpload 双保险**：上传表外链 srcUrl 时使 canvas 被 tainted 也能走本地转存路径成功出 mask

---

## 54. 循环器（LoopNode）+ EXEC 节点完整解决方案（v1.2.9.x 系列总结 · 强制规范）

> **本章是修复其他循环器相关 BUG 与制作新 EXEC 节点的唯一权威依据**。任何新增 / 改造可执行节点（image / video / audio / llm / runninghub / runninghub-wallet / 类似 setInterval 轮询节点）必须**全部通过本章四道防线检查**，否则在循环器中必然出现「失败」「只显示最后一张」「累积被覆盖」等症状。

### 54.1 典型 BUG 症状全景

| 症状 | 根因 | 防线 |
|---|---|---|
| 循环器内全部「失败」`成功 0 失败 N` | EXEC 节点 `setInterval` 异步轮询，`handleRun` 提交后立即 return → `useRunTrigger` 提前 `markDone(true)` → `LoopNode.awaitNode` 立即继续 → `extractFromNode` 读不到产物 → `result=null` → `failCount++` | 防线 ① Promise 化 startPolling |
| 循环器内 `extractFromNode` kind 不匹配返回 null | 用户输入图像但下游是视频节点（kind='image' 但 directs[0] 是 video）→ 读不到 `imageUrl` 返回 null | 防线 ② extractFromNode kind 兜底 |
| 「成功 N」但 OutputNode 只显示最后一张（覆盖症状） | autoOutput 给 OutputNode 升级 `pickKind='image', pickIndex=0`，循环跑完 `__loopAccumulate` 清除后 `collected.images` 顺序变成 `[fresh_lastRound, ...direct]`，pickIndex=0 把全集砍成 1 张 | 防线 ③ hasAnyDirectAccumulated 短路 |
| OutputNode 完全空白（循环结束后才被建） | EXEC 节点带 `__loopAccumulate`，autoOutput 跳过它，OutputNode 在循环跑完 finally 清除标记后才被 autoOutput 新建 + upgrade pickKind；此时 `directImageUrls=[]` → `hasAnyDirectAccumulated=false` → pickKind 切割 → 仅显示当前 `ud.imageUrl`（最后一张） | 防线 ④ execAccumulator + finally 兜底 |
| **多端口节点（FramePair / Suno）循环时所有产物挤在 1 个出口，另一个出口空白** | autoOutput 创建的下游 OutputNode 边没有 `sourceHandle`，handleMap 全是 null → 所有轨道的产物聚合到同一个 OutputNode；同时 LoopNode `acc.auds[]` 把多轨混在一起 → 写回时也不分轨 | **防线 ⑤ 多端口节点 handle-aware autoOutput + accumulator 分轨（v1.2.9.14 新增）** |


### 54.2 五道防线（必须全部到位）

#### 防线 ① · EXEC 节点 startPolling 必须 Promise 化

**所有用 `setInterval` / `setTimeout` 异步轮询的 EXEC 节点（AudioNode / VideoNode / SeedanceNode / RunningHubNode / RH-wallet / 未来任何远端任务节点）的 `startPolling` 必须返回 `Promise<void>`**，调用方 `handleRun` / `handleGenerate` 必须 `await` 它。模板：

```ts
const startPolling = (tid: string): Promise<void> => {
  stopPoll();
  return new Promise<void>((resolve, reject) => {
    pollTimer.current = window.setInterval(async () => {
      try {
        const r = await query(tid);
        if (r.status === 'SUCCESS') {
          stopPoll();
          update({ status: 'success', urls: r.urls /* + imageUrl/videoUrl/audioUrl 按后缀分流 */ });
          resolve();                    // ← 关键：成功才 resolve
        } else if (r.status === 'FAILED') {
          stopPoll();
          update({ status: 'error', error: reason });
          reject(new Error(reason));    // ← 关键：失败 reject
        }
        // RUNNING/POLLING 不 resolve、不 reject，继续 setInterval
      } catch (e) {
        // 单次 query 网络错误不直接 reject，下一次 tick 再试；超时才 reject
      }
      if (++elapsed > MAX) {
        stopPoll();
        reject(new Error('轮询超时'));
      }
    }, POLL_INT);
  });
};

const handleRun = async () => {
  // ... submit ...
  await startPolling(taskId);            // ← 关键：必须 await
};

useRunTrigger(id, async () => {
  if (status === 'submitting' || status === 'polling') return;
  await handleRun();                     // ← 关键：必须 await
});
```

**反例（v1.2.9.11/12 之前的 BUG 形态）**：

```ts
const startPolling = (tid: string) => {
  pollTimer.current = window.setInterval(...);   // ← BUG: 立即 return，runFn 提前完成
};

const handleRun = async () => {
  // submit
  startPolling(taskId);                          // ← BUG: 不 await
};
```

效果：`useRunTrigger` 的 `runFn` 在 `submit` 完成的瞬间就 markDone(true) → `awaitNode` 立即 resolve → `extractFromNode` 读 `imageUrl=''` → `result=null` → 整轮失败。

**对比同步轮询的安全节点**（ImageNode / LLMNode）：

```ts
for (let i = 0; i < MAX; i++) {
  const r = await query(tid);
  if (r.status === 'SUCCESS') break;
  await new Promise((r) => setTimeout(r, 5000));
}
```

这种 for + await 模式天然让 `handleRun` 等到任务完成才 return，**不需要任何 Promise 改造**。

#### 防线 ② · LoopNode.extractFromNode kind 不匹配兜底

[`extractFromNode(node, kind)`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LoopNode.tsx) 在 `kind='image'` 但终点节点是 video/audio 节点时，**必须遍历所有产物字段任一非空算成功**：

```ts
function extractFromNode(node, kind) {
  const ud = node?.data || {};
  // 优先匹配 kind
  if (kind === 'image' && (ud.imageUrl || ud.imageUrls?.[0] || ud.urls?.[0])) return ud.imageUrl || ud.imageUrls?.[0] || ud.urls?.[0];
  if (kind === 'video' && ud.videoUrl) return ud.videoUrl;
  if (kind === 'audio' && ud.audioUrl) return ud.audioUrl;
  if (kind === 'text' && (ud.outputText || ud.reply)) return ud.outputText || ud.reply;
  // v1.2.9.11: kind 不匹配兜底 —— 任何非空产物字段都算成功
  if (typeof ud.videoUrl === 'string' && ud.videoUrl) return ud.videoUrl;
  if (typeof ud.audioUrl === 'string' && ud.audioUrl) return ud.audioUrl;
  if (typeof ud.imageUrl === 'string' && ud.imageUrl) return ud.imageUrl;
  if (Array.isArray(ud.imageUrls) && ud.imageUrls[0]) return ud.imageUrls[0];
  if (typeof ud.firstFrameUrl === 'string' && ud.firstFrameUrl) return ud.firstFrameUrl;
  if (typeof ud.lastFrameUrl === 'string' && ud.lastFrameUrl) return ud.lastFrameUrl;
  if (typeof ud.outputText === 'string' && ud.outputText) return ud.outputText;
  if (typeof ud.reply === 'string' && ud.reply) return ud.reply;
  return null;
}
```

#### 防线 ③ · OutputNode hasAnyDirectAccumulated 短路 pickKind 切割

[OutputNode.collected useMemo](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx) 在 pickKind 切割之前必须做累积模式检查：

```ts
const hasAnyDirectAccumulated =
  (Array.isArray(d.directImageUrls) && d.directImageUrls.length > 0) ||
  (Array.isArray(d.directVideoUrls) && d.directVideoUrls.length > 0) ||
  (Array.isArray(d.directAudioUrls) && d.directAudioUrls.length > 0) ||
  (typeof d.directOutputText === 'string' && d.directOutputText.length > 0);
const pickKind = hasAnyDirectAccumulated ? undefined : d.pickKind; // ← 跳过切割
```

**配套 Canvas autoOutput 跳过 `__loopAccumulate` 节点**（避免不必要 store write）：

```ts
for (const n of nodes) {
  // ...
  if (d.__loopAccumulate) continue; // v1.2.9.10
}
```

#### 防线 ④ · LoopNode execAccumulator + finally 兜底（v1.2.9.13 新增）

**根因**：RH/RH-wallet 等带 `__loopAccumulate` 标记的 EXEC 节点，autoOutput 在循环过程中**完全跳过**，下游 OutputNode 直到 finally 清除标记后才被 autoOutput 创建 + upgrade `pickKind='image', pickIndex=0`。此时如果 `directImageUrls` 为空，hasAnyDirectAccumulated=false，pickKind 切割只剩 1 张。

[LoopNode.runSerial](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LoopNode.tsx) 必须维护 `execAccumulator: Map<execId, ExecAcc>`，跨轮持续累积每个 EXEC 节点的 fresh 字段，且 finally 中等待 autoOutput 创建 OutputNode 后再写一次：

```ts
type ExecAcc = { isFP: boolean; firsts: string[]; lasts: string[]; imgs: string[]; vids: string[]; auds: string[]; txts: string[] };
const execAccumulator = new Map<string, ExecAcc>();

const harvestFromExec = () => {
  for (const eid of execSubIds) {
    const ud = rf.getNode(eid)?.data || {};
    const acc = ensureAcc(eid);
    if (isFramePair(ud)) { acc.isFP = true; pushUniqArr(acc.firsts, ud.firstFrameUrl); pushUniqArr(acc.lasts, ud.lastFrameUrl); continue; }
    pushUniqArr(acc.imgs, ud.imageUrl);
    ud.imageUrls?.forEach(u => pushUniqArr(acc.imgs, u));
    ud.urls?.forEach(u => pushUniqArr(acc.imgs, u));
    pushUniqArr(acc.vids, ud.videoUrl);
    ud.videoUrls?.forEach(u => pushUniqArr(acc.vids, u));
    pushUniqArr(acc.auds, ud.audioUrl); pushUniqArr(acc.auds, ud.audioUrl_1);
    ud.audioUrls?.forEach(u => pushUniqArr(acc.auds, u));
    pushUniqArr(acc.txts, ud.outputText); pushUniqArr(acc.txts, ud.reply); pushUniqArr(acc.txts, ud.text);
  }
};

// writeFreshToOutputs 改读 accumulator 而非当前 ud：
for (const e of inEdges) {
  if (!execSubIds.has(e.source)) continue;
  const acc = execAccumulator.get(e.source); if (!acc) continue;
  if (acc.isFP) { /* 按 sourceHandle first/last 分流 */ continue; }
  acc.imgs.forEach(u => pushUniq(fImgs, seenI, u));
  acc.vids.forEach(u => pushUniq(fVids, seenV, u));
  acc.auds.forEach(u => pushUniq(fAuds, seenA, u));
  acc.txts.forEach(t => pushUniq(fTxts, seenT, t));
}

// 每轮 awaitNode 完成后：
await setTimeout(30); harvestFromExec(); writeFreshToOutputs(); await setTimeout(20);

// finally 兜底：
} finally {
  rf.setNodes(prev => prev.map(/* 清除 __loopAccumulate */));
  await new Promise(r => setTimeout(r, 200));   // ← 关键：等 autoOutput useEffect 创建 OutputNode
  harvestFromExec();
  writeFreshToOutputs();                         // ← 把全集累积写入新建 OutputNode
}
```

#### 防线 ⑤ · 多端口节点 handle-aware autoOutput + accumulator 分轨（v1.2.9.14 新增）

**场景**：FramePair（first/last 双图端口）、Suno（audio-0/audio-1 双轨端口）等 EXEC 节点一个 `data` 上同时存两种产物，与多个 `Handle source id="xxx"` 一一映射。

**根因**：

1. Canvas autoOutput 走通用 `pickKind / pickIndex` 路径创建下游 OutputNode，边没有 `sourceHandle` → useUpstreamMaterials 的 handleMap 全部是 `null` → 多端口产物被全部汇聶到同一个 OutputNode。
2. LoopNode `harvestFromExec` 把多轨产物（`audioUrl` + `audioUrl_1`）混进同一个 `acc.auds[]`；writeFreshToOutputs 也不读 edge.sourceHandle → 虚货全集写到所有 OutputNode。
3. 用户看到：循环 2 轮 Suno 产生 4 首 → 出口 1 的 OutputNode 显示 4 首、出口 2 空白。

**修复三部件（必须同时完成）**：

**补丁一 · [Canvas.tsx autoOutput 为多端口节点加专属路径](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)**

```ts
// FramePair 专属路径（v1.2.8.3）
if (t === 'frame-pair') {
  const need = ['first', 'last'].filter(h => !usedHandles.has(h));
  for (const h of need) {
    toAddNodes.push({ id, type: 'output', data: {} /* 不带 pickKind */ });
    toAddEdges.push({ source: n.id, target: id, sourceHandle: h }); // ← 关键: 边带 sourceHandle
  }
  continue;
}

// Suno 专属路径（v1.2.9.14 新增）
if (t === 'audio') {
  const a0 = d.audioUrl || '';
  const a1 = d.audioUrl_1 || '';
  const need = [];
  if (a0 && !usedHandles.has('audio-0') && !usedHandles.has(null)) need.push('audio-0');
  if (a1 && !usedHandles.has('audio-1')) need.push('audio-1');
  for (const h of need) {
    toAddNodes.push({ id, type: 'output', data: {} });
    toAddEdges.push({ source: n.id, target: id, sourceHandle: h }); // ← 关键
  }
  continue;
}
```

**补丁二 · [useUpstreamMaterials.ts / OutputNode.tsx collected 按 sourceHandle 过滤](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useUpstreamMaterials.ts)**

```ts
const handles = handleMap.get(sid) || new Set([null]);

// FramePair
if (isFramePair) {
  const wantFirst = handles.has('first') || (handles.has(null) && !handles.has('last'));
  const wantLast  = handles.has('last')  || (handles.has(null) && !handles.has('first'));
  if (wantFirst) push(ud.firstFrameUrl);
  if (wantLast)  push(ud.lastFrameUrl);
  continue;
}

// Suno (v1.2.9.14)
if (isSuno) {
  const wantA0 = handles.has('audio-0') || (handles.has(null) && !handles.has('audio-1'));
  const wantA1 = handles.has('audio-1') || (handles.has(null) && !handles.has('audio-0'));
  if (wantA0) push(ud.audioUrl);     // 主轨
  if (wantA1) push(ud.audioUrl_1);   // 副轨
  continue;
}
```

**补丁三 · [LoopNode.execAccumulator 按轨分存 + writeFreshToOutputs 按 handle 分流](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LoopNode.tsx)**

```ts
type ExecAcc = {
  isFP: boolean; firsts: string[]; lasts: string[];        // FramePair: first/last
  isSuno: boolean; auds0: string[]; auds1: string[];       // Suno: audio-0/audio-1 (v1.2.9.14)
  imgs: string[]; vids: string[]; auds: string[]; txts: string[]; // 通用
};

// harvestFromExec
if (isFramePair(ud)) { acc.isFP = true; pushUniqArr(acc.firsts, ud.firstFrameUrl); pushUniqArr(acc.lasts, ud.lastFrameUrl); continue; }
if (isSuno(ud))     { acc.isSuno = true; pushUniqArr(acc.auds0, ud.audioUrl); pushUniqArr(acc.auds1, ud.audioUrl_1); continue; }

// writeFreshToOutputs 按 sourceHandle 分流
for (const e of inEdges) {
  const acc = execAccumulator.get(e.source); if (!acc) continue;
  const h = e.sourceHandle;
  if (acc.isFP) {
    if (h === 'first' || h == null) acc.firsts.forEach(u => pushUniq(fImgs, ...));
    if (h === 'last'  || h == null) acc.lasts.forEach(u => pushUniq(fImgs, ...));
    continue;
  }
  if (acc.isSuno) {
    if (h === 'audio-0' || h == null) acc.auds0.forEach(u => pushUniq(fAuds, ...));
    if (h === 'audio-1' || h == null) acc.auds1.forEach(u => pushUniq(fAuds, ...));
    continue;
  }
  // 通用路径
  acc.imgs.forEach(...); acc.vids.forEach(...); acc.auds.forEach(...); acc.txts.forEach(...);
}
```

**多端口节点 「三点一体」原则**（制作新多端口节点时必须全部加）：

1. **autoOutput 为每个端口创建独立 OutputNode**，边上带对应 `sourceHandle`（FramePair: 'first'/'last'、Suno: 'audio-0'/'audio-1'）。不走通用 `pickKind/pickIndex` 路径。
2. **useUpstreamMaterials / OutputNode collected 中按 handleMap 过滤**，跳过通用字段路径避免重复读取。
3. **LoopNode execAccumulator 加 `is<Kind>` flag 与分轨数组**，`writeFreshToOutputs` 按 `edge.sourceHandle` 路由到对应轨数组。

任何未来多端口节点（例如三轨输出 / 多分辨率输出）都需按同一模式实现这三个补丁，只需增加 `is<Kind>` 标志与对应 handle-id 枚举即可。

### 54.3 制作新 EXEC 节点的强制 Checklist

任何新增可在循环器中执行的节点（**EXEC_TYPES** 里的成员）都必须勾选下列项目，否则在循环器中必然出现 BUG：

- [ ] 节点类型已加入 [LoopNode.tsx EXEC_TYPES](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LoopNode.tsx#L31)、[Canvas.tsx EXEC_TYPES](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx#L177)、[NodeActionBar.tsx EXEC_TYPES](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/NodeActionBar.tsx#L25)
- [ ] 接入 [`useRunTrigger(id, async () => { await handleRun(); })`](file:///e:/PenguinPravite/T8-penguin-canvas/src/hooks/useRunTrigger.ts) **必须 await**
- [ ] 如果是异步轮询：`startPolling` 必须返回 `Promise<void>`，SUCCESS 走 `resolve()`、FAILED/超时走 `reject(new Error(...))`，handleRun 必须 `await startPolling(...)`
- [ ] 如果是同步轮询：直接 `for + await Promise(setTimeout)` 即可，handleRun 自然等到完成
- [ ] 产物字段写入 `update({ imageUrl / imageUrls / urls / videoUrl / audioUrl / audioUrl_1 / outputText / reply / text })` 中至少一项；按 url 后缀（.png/.mp4/.mp3）分流到对应字段，避免视频 url 进 `imageUrl`
- [ ] handleRun 入口加重入保护：`if (status === 'submitting' || status === 'polling') return;`
- [ ] handleRun 开始时清空上一轮的产物字段（`urls: [], taskId: null`），防止 stale 干扰
- [ ] **多端口节点（一个 data 上出两个产物字段 + 两个 Handle source id）额外必须：**
  - [ ] Canvas autoOutput 加专属路径，为每个端口创建 OutputNode 且边带 `sourceHandle`
  - [ ] useUpstreamMaterials 与 OutputNode collected 加 `is<Kind>` 分支，按 handleMap 过滤输出
  - [ ] LoopNode `ExecAcc` 加 `is<Kind>` flag + 分轨数组；harvestFromExec 分轨累积；writeFreshToOutputs 按 `edge.sourceHandle` 路由
- [ ] 新建一个测试画布：上游 2 个素材 → 循环器 → 新节点 → （手动 / 不连）OutputNode，跑一次串联循环，验证 OutputNode 显示完整 N 张产物（不是只显示最后一张，也不是失败）

### 54.4 全部 16 个 EXEC 节点循环器兼容性矩阵（最终态）

| 节点类型 | 轮询方式 | 修复版本 | 状态 |
|---|---|---|---|
| `image` | 同步 for+await Promise | — | ✓ 一开始就正常 |
| `edit` (multi-angle-3d/panorama-720/penguin-portrait) | 同步 | — | ✓ 一开始就正常 |
| `llm` | 流式 await | — | ✓ 一开始就正常 |
| `frame-pair` | 同步 | v1.2.9.10 | ✓ 修复 pickKind 切割 |
| `audio` | setInterval → Promise | v1.2.9.11 | ✓ |
| `video` | setInterval × 2 → Promise | v1.2.9.11 | ✓ |
| `seedance` | setInterval → Promise | v1.2.9.11 | ✓ |
| `runninghub` | setInterval → Promise | v1.2.9.12 | ✓ |
| `runninghub-wallet` | 复用 RunningHubNode | v1.2.9.12 | ✓ 同一组件 |
| `resize / upscale / grid-crop / remove-bg / combine` | 同步 imageOps | — | ✓ |
| `frame-extractor` | 同步 | — | ✓ |
| `upload` | 同步本地缓存 | — | ✓ |
| **finally 兜底（覆盖最后一张）** | LoopNode execAccumulator + finally 200ms 后 write | **v1.2.9.13** | ✓ 解决「循环结束后才创建 OutputNode 只显示最后一张」 |
| **多端口节点（FramePair / Suno）多轨混装问题** | autoOutput handle-aware + accumulator 分轨 + collected 按 handle 过滤 | **v1.2.9.14** | ✓ 解决「Suno 循环 2 轮 → 出口 1 显示 4 首、出口 2 空白」 |

### 54.5 v1.2.9.x 版本演进表

| 版本 | 关键修复 | 解决问题 |
|---|---|---|
| v1.2.9.0~v1.2.9.7 | 累积机制多次试错 | 历史包袱 |
| v1.2.9.8 | LoopNode 主动 functional setNodes 写 OutputNode | FramePair 累积 OK |
| v1.2.9.9 | discoverOutputNodeIds 动态发现 + knownOutputs | 运行中创建的 OutputNode 也能写入 |
| v1.2.9.10 | hasAnyDirectAccumulated 短路 + autoOutput 跳过 `__loopAccumulate` | ImageNode/LLMNode 覆盖修复 |
| v1.2.9.11 | startPolling Promise 化 + extractFromNode kind 兜底 | AudioNode/VideoNode/SeedanceNode 失败修复 |
| v1.2.9.12 | RunningHubNode startPolling Promise 化 | RH/RH-wallet 失败修复 |
| **v1.2.9.13** | **execAccumulator 跨轮累积 + finally 兜底 writeback** | **RH/RH-wallet 循环结束后才建 OutputNode 覆盖修复（全部 16 节点完美兼容）** |
| **v1.2.9.14** | **多端口节点 handle-aware autoOutput + accumulator 分轨（FramePair/Suno 三点一体）** | **Suno 双轨产物在循环中不再混装出口 1，各轨独立累积到对应 audio-0/audio-1 OutputNode** |

### 54.6 防止再回归的代码注释锚点

四道防线在源码中有显眼注释锚点，未来任何重构必须保留：

- `v1.2.9.10`：[OutputNode.tsx#L264-L277 hasAnyDirectAccumulated 累积模式短路](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx)
- `v1.2.9.10`：[Canvas.tsx#L1915-L1919 autoOutput 跳过 `__loopAccumulate`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)
- `v1.2.9.11`：[LoopNode.tsx extractFromNode kind 兜底](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LoopNode.tsx)
- `v1.2.9.11`：[AudioNode/VideoNode/SeedanceNode startPolling 改 Promise](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/AudioNode.tsx)
- `v1.2.9.12`：[RunningHubNode.tsx#L389-L468 startPolling 改 Promise](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RunningHubNode.tsx)
- `v1.2.9.13`：[LoopNode.tsx execAccumulator + harvestFromExec + finally 200ms writeback](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LoopNode.tsx)
- `v1.2.9.14`：[Canvas.tsx autoOutput Suno 专属路径（audio-0 / audio-1 sourceHandle）](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx)
- `v1.2.9.14`：[useUpstreamMaterials.ts isSuno 双轨 handle 过滤](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/useUpstreamMaterials.ts)
- `v1.2.9.14`：[OutputNode.tsx collected isSuno 双轨 handle 过滤](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx)
- `v1.2.9.14`：[LoopNode.tsx ExecAcc 加 isSuno + auds0/auds1 + writeFreshToOutputs handle 分流](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LoopNode.tsx)

### 54.7 经验教训（一句话总结）

1. **Promise 化是异步轮询节点的入场券**：不返回 Promise / 不 await 就一定 race。
2. **`__loopAccumulate` 标记会让 autoOutput 跳过节点**：意味着循环结束前 OutputNode 可能根本不存在；finally 兜底必不可少。
3. **`hasAnyDirectAccumulated` 是覆盖症状的最后一道墙**：即使 autoOutput 给 OutputNode 升级了 pickKind，只要 directImageUrls 非空就跳过切割。
4. **跨轮 accumulator 而非当前 ud**：跑到第 N 轮时 ud 只剩最后一轮值，靠 ud 写 OutputNode 永远只能拿到最后一张。
5. **execAccumulator 同时支持 FramePair `isFP` 双图分流与 Suno `isSuno` 双轨分流**：sourceHandle='first'/'last' / 'audio-0'/'audio-1' 各取对应数组；任何多端口节点需同三点一体修复（autoOutput 带 handle / collected 滤 handle / accumulator 按轨）。
6. **finally 中 setTimeout(200) 不是黑魔法**：是给 autoOutput useEffect 一个 commit 周期把新 OutputNode 落 store。

---

## 55. 后端「分类 API Key 专属优先 fallback 通用」修复（v1.2.9.15 · 强制规范）

### 背景与症状
用户在【设置】界面填写 Suno 专属 API Key 后，将「贞贞工坊通用 API Key」故意改成错误值 `'123'`，点击 Suno 节点生成 → 上游报「令牌错误」。即

> 「专属 APIKEY 没有生效，无论 Suno 单个还是整个分类 key 体系都失效。」

根因排查后定位到 backend/src/routes/proxy.js **3 类同模式 bug**：

#### Bug ① 子路由完全缺失 applyClassifiedKey（最严重）
```js
// audio/upload 旧实现：
router.post('/audio/upload', ..., async (req, res) => {
  const settings = loadRawSettings();
  if (!settings?.zhenzhenApiKey) return res.status(400)...;
  // ❌ 完全没调 applyClassifiedKey('suno')
  const apiKey = settings.zhenzhenApiKey; // ← 拿到错误的 '123'
  // ...直接拿通用 key 上传 → 令牌错误
});
```
Suno cover/extend 上传步骤即使 sunoApiKey 配置正确也始终用错误的 zhenzhenApiKey。

#### Bug ② 检查顺序错误（边缘场景）
```js
// 旧顺序：先校验通用 key 非空 → 再 applyClassifiedKey
if (!settings?.zhenzhenApiKey) return res.status(400).json({ error: '未配置...' });
applyClassifiedKey(settings, 'suno');
```
用户「只填了专属 key、留空通用 key」时被误拦在第一步，永远跑不到 applyClassifiedKey。

#### Bug ③ 错误提示混淆
旧错误信息只说「未配置贞贞工坊 API Key」，没区分通用 key 与专属 key，用户配了专属还看到这个提示极易误判。

### 一体化修复方案：`ensureKey` helper

紧接 `applyClassifiedKey` 之后定义统一的「应用专属 → 校验 effective → 错误响应」一体化 helper：

```js
// backend/src/routes/proxy.js
function ensureKey(settings, res, hint, label) {
  if (!settings) {
    res.status(400).json({ success: false, error: '未找到 settings 文件，请先在【设置】中配置 API Key' });
    return false;
  }
  applyClassifiedKey(settings, hint || ''); // 先应用专属
  if (!settings.zhenzhenApiKey) {           // 后校验 effective
    const tip = label
      ? `未配置 ${label} 专属 API Key，且贞贞工坊通用 API Key 也为空（请在【设置】中至少填写其中一个）`
      : '未配置贞贞工坊 API Key（请在【设置】中填写）';
    res.status(400).json({ success: false, error: tip });
    return false;
  }
  return true;
}
```

**调用模板**（所有分类 key 路由统一遵循）：
```js
router.post('/xxx/yyy', async (req, res) => {
  const settings = loadRawSettings();
  const { /* body 提取 */ } = req.body || {};
  // ① 一体化「专属优先 fallback 通用」校验
  if (!ensureKey(settings, res, hint, '业务标签')) return;
  // ② 后续直接用 settings.zhenzhenApiKey 即可（已是 effective key）
  const apiKey = settings.zhenzhenApiKey;
  // ...
});
```

### 修复矩阵（v1.2.9.15 全局应用，共 16 个路由）

| # | 路由 | hint 来源 | label |
|---|------|----------|-------|
| 1 | POST /image | `apiModel \|\| model` | 图像 |
| 2 | POST /image/submit | `apiModel \|\| model` | 图像 |
| 3 | GET /image/status/:tid | remembered key 优先；否则 `query.model` | 图像 |
| 4 | POST /image/fal/submit | `apiModel` | 图像 FAL |
| 5 | POST /image/fal/query | `endpoint \|\| rawUrl` | 图像 FAL |
| 6 | POST /mj/imagine | `'mj'` | MJ |
| 7 | GET /mj/task/:id | `'mj'` | MJ |
| 8 | POST /mj/upload | `'mj'` | MJ |
| 9 | POST /video/fal/submit | `apiModel` | 视频 FAL |
| 10 | POST /video/fal/query | `endpoint \|\| rawUrl` | 视频 FAL |
| 11 | POST /video/submit | `model` | 视频 |
| 12 | GET /video/query | remembered key 优先；否则 `query.model` | 视频 |
| 13 | POST /seedance/submit | `'seedance'` | Seedance |
| 14 | GET /seedance/query | `'seedance'` | Seedance |
| 15 | POST /audio/submit | `'suno'` | Suno |
| 16 | GET /audio/query | `'suno'` | Suno |
| 17 | POST /audio/upload | `'suno'`（**Bug ① 修复点**） | Suno |

### 不受影响的路由
- `/llm` 用独立的 `settings.llmApiKey`（不参与 zhenzhenApiKey 分类体系）
- `/runninghub/*` 用独立的 `settings.rhApiKey` / `settings.rhWalletApiKey`

### 强制规范（写后端 zhenzhenApiKey 路由必读）

- ✅ **唯一入口**：所有读取 `settings.zhenzhenApiKey` 之前**必须** `if (!ensureKey(settings, res, hint, label)) return;`
- ✅ **hint 优先级**：能拿到具体 model（apiModel / model）就传 model；纯分类路由（mj/seedance/suno）传分类字符串
- ✅ **remembered key 优先**：异步轮询查询路由（image/status、video/query）若 `recallTaskKey(taskId)` 命中则直接覆盖 `settings.zhenzhenApiKey`，**不再调用 ensureKey**（remembered 自身保证有 key）
- ❌ **严禁旧顺序**：`if (!settings?.zhenzhenApiKey) return ...; applyClassifiedKey(settings, hint);` ——会让「只配专属」用户被误拦
- ❌ **严禁裸跑**：直接 `Bearer ${settings.zhenzhenApiKey}` 而不先 applyClassifiedKey ——audio/upload 那种 Bug 会重现
- ❌ **严禁混淆错误提示**：必须明确「专属 + 通用」双重校验语义

### 教训
1. **applyClassifiedKey 是「覆盖」而不是「读取」**：调用后 `settings.zhenzhenApiKey` 已被分类 key 覆盖，所以校验必须在 apply **之后**。
2. **多步骤业务（提交+轮询+上传）必须每步都 ensureKey**：Suno 需要 submit / query / upload 三个路由都修复，遗漏任何一个都会让链路失败。
3. **错误信息是 UX 一部分**：用户看到「未配置贞贞工坊 API Key」会立刻去填通用 key，而真正的问题是专属 key —— 错误提示必须双重明示。

---

## 56. RH APIKEY 统一 + 设置面板「获取 APIKey」按钮（v1.2.9.16 · 强制规范）

### 需求背景
v1.1.x 时期为十分严谨设计，RH 钱包应用节点使用独立的 `rhWalletApiKey`（企业级共享 APIKEY）与普通 RunningHub 节点的 `rhApiKey` 分开计费，后端 `pickRhApiKey(settings, useWallet)` 根据 useWallet 标志路由，未配置时报「未配置 RH 钱包 APIKEY」不 fallback rhApiKey 避免漏费频道。

但这增加了两重问题：
1. **用户认知成本高** —— 设置面板同时出现「RunningHub APIKEY」 + 「RH 钱包 APIKEY」两个字段，不清楚差别的用户会重复填入同一个 key。
2. **获取入口难找** —— 用户不知道去哪里注册 RunningHub / 贞贞工坊 APIKEY，需要在设置面板直接提供入口。

### 不变量（strong invariants）
- 画布上 `runninghub` 与 `runninghub-wallet` 依然是两个独立节点类型，**UI 差异保留**（标题 / 图标 / 颜色）以便用户识别场景
- 后端 4 条 RH 路由的签名、请求体、响应体 schema 零变动
- 老 settings.json 中残留的 `rhWalletApiKey` 字段仅被 `loadSettings` 允许（不会报错），**运行时完全不被任何路由消费**——向后兼容

### 修改矩阵（8 个文件）

| # | 文件 | 改动要点 |
|---|------|---------|
| 1 | [`backend/src/routes/proxy.js`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/proxy.js) | `pickRhApiKey(settings)` 简化为单参 · `missingRhKeyError()` 文案统一 · 4 路由不再读 useWallet/wallet=1 |
| 2 | [`backend/src/routes/settings.js`](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/settings.js) | DEFAULT_SETTINGS 与 GET 脱敏返回移除 `rhWalletApiKey` 字段 |
| 3 | [`src/types/canvas.ts`](file:///e:/PenguinPravite/T8-penguin-canvas/src/types/canvas.ts) | ApiSettings 接口移除 `rhWalletApiKey: string` |
| 4 | [`src/stores/apiKeys.ts`](file:///e:/PenguinPravite/T8-penguin-canvas/src/stores/apiKeys.ts) | DEFAULT 对象移除 `rhWalletApiKey: ''` |
| 5 | [`src/services/generation.ts`](file:///e:/PenguinPravite/T8-penguin-canvas/src/services/generation.ts) | `RhSubmitRequest` 接口去 useWallet · `queryRh/fetchRhAppInfo/uploadRhAsset` 3 函数去形参 · URL 不再拼 `&wallet=1` |
| 6 | [`src/components/nodes/RunningHubNode.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RunningHubNode.tsx) | `useWallet = type === 'runninghub-wallet'` 仅作 UI 区分；4 处调用去 useWallet 透传 |
| 7 | [`src/components/ApiSettings.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/ApiSettings.tsx) | KeyField/COMMON_KEYS/emptyMap/emptyShow 同步瘦身 · 新增 `linkBtnCls/linkBtnAltCls/openExternal/renderGetKeyButtons` · baseUrlNote 升级为 flex-wrap 容器 |
| 8 | [`src/components/Canvas.tsx`](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) + [`src/config/nodeRegistry.ts`](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/nodeRegistry.ts) | 注释 / description 同步为「与 RunningHub 节点共用 RunningHub APIKEY」 |

### 后端统一 helper
```js
// backend/src/routes/proxy.js
// v1.2.9.16: 取消 rhWalletApiKey 单独字段 —— 普通 RH 节点 与 RH 钱包应用节点
//            统一使用 settings.rhApiKey，简化用户配置心智。
function pickRhApiKey(settings) {
  return settings?.rhApiKey || settings?.runninghubApiKey || '';
}
function missingRhKeyError() {
  return '未配置 RunningHub API Key（请在设置中填写 RunningHub API Key）';
}
```
4 路由调用方统一改为 `pickRhApiKey(settings)` + `missingRhKeyError()`。

### 前端「获取 APIKey」按钮双主题样式
```tsx
const linkBtnCls = isPixel
  ? 'px-btn px-btn--mint flex items-center gap-1 text-[11px] px-2 py-1'
  : `flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition border ${
      isDark
        ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200'
        : 'border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
    }`;
const linkBtnAltCls = isPixel
  ? 'px-btn flex items-center gap-1 text-[11px] px-2 py-1'
  : `flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition border ${
      isDark
        ? 'border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200'
        : 'border-cyan-500/40 bg-cyan-50 hover:bg-cyan-100 text-cyan-700'
    }`;
const openExternal = (url: string) => {
  try { window.open(url, '_blank', 'noopener,noreferrer'); } catch {}
};
```

### 「获取 APIKey」路由表
| 字段 | 按钮 | 点击后跳转链接 |
|------|------|--------------|
| `zhenzhenApiKey` | 获取 APIKey | https://ai.t8star.org/register?aff=dP7j |
| `rhApiKey` (主) | 获取 APIKey：国内用户 | https://www.runninghub.cn/user-center/1819214514410942465/webapp?inviteCode=rh-v1121 |
| `rhApiKey` (次) | 国外用户 | https://www.runninghub.ai/user-center/1819214514410942465/webapp?inviteCode=rh-v1121 |
| `llmApiKey` | — | 不提供（LLM 与贞贞同源，贞贞按钮已足） |

### baseUrlNote 容器升级
```tsx
{(opts.baseUrlNote || renderGetKeyButtons(spec.field)) && (
  <div className={`flex items-center gap-2 flex-wrap text-[11px] ${hintCls}`}>
    {opts.baseUrlNote && (
      <span className="flex items-center gap-1.5">
        <Lock size={11} /> {opts.baseUrlNote}
      </span>
    )}
    {renderGetKeyButtons(spec.field)}
  </div>
)}
```
`flex-wrap` 保证窄画布 / 小屏幕下 Lock 备注与按钮可自动换行不拥挤。

### 强制规范（RH 节点重构 / 新加外部链接必读）

- ✅ **统一 Key 入口**：后端读 RH key 必须走 `pickRhApiKey(settings)`，严禁出现 `settings.rhWalletApiKey` 读取
- ✅ **路由不再读 useWallet**：4 条 RH 路由 (`/runninghub/{submit,query,app-info,upload-asset}`) 严禁从 body / query 读 `useWallet` 或 `wallet=1`，避免复活旧分路
- ✅ **前端 API 套务单一参数**：`submitRh / queryRh / fetchRhAppInfo / uploadRhAsset` 严禁加回 useWallet 形参
- ✅ **外部链接安全打开**：`window.open(url, '_blank', 'noopener,noreferrer')` 必须同时带 `noopener,noreferrer`，防止 reverse tabnabbing
- ✅ **双主题适配**：任何新增设置面板按钮必须同时提供默认主题（`isPixel ? × : ×`）两套外观，严禁裸 className
- ❌ **严禁复活「RH 钱包 APIKEY」设置项**：任何提议「为 RH 钱包单独加回 Key」的重构 PR 必须被拒绝，除非产品层面明确需要付费分渠隔离
- ❌ **严禁从 settings.json 删除老字段**：loadSettings 仍该允许老用户 settings.json 存在 `rhWalletApiKey`，仅运行时不读

### 向后兼容验收清单
- [ ] 老用户启动后，APIKEY 设置面板仅看到 3 项（贞贞 / RH / LLM），**不会报错**
- [ ] 老用户原有 RH 钱包应用节点可以直接提交运行（走 settings.rhApiKey）
- [ ] 点击 3 个「获取 APIKey」按钮都能新窗口打开对应 URL
- [ ] 三个主题×两个外观 = 12 种组合下按钮表现都识别可点

### 教训
1. **产品层面的字段拆分 ≠ 技术层面的路由拆分**：v1.1.x 的 rhWalletApiKey 在后端设计上是合理的，但在 UX 上增加了认知负担 —— 统一后用户只需填一个 Key。
2. **字段移除必须同时考虑向后兼容**：DEFAULT_SETTINGS 移除不代表 loadSettings 要严拒老字段，同一代码路径不读老字段即可。
3. **外部链接如果带邀请参数应供产品定义**：`inviteCode=rh-v1121` 在 features.json/skill.md/UI 代码三处同步，避免被中间人错误修改。

### ⚠️ 版本号 semver 兼容陷阱（重要补记）

**背景**：v1.2.9.16 首次打包时遇到错误：`Invalid version: "1.2.9.16"`。

**原因**：electron-builder 严格遵循 **semver 3 段语义**（`MAJOR.MINOR.PATCH[-pre][+build]`），不接受 4 段版本号。本项目从 v1.2.9.0 起在 features.json/skill.md/title/__APP_VERSION__ 上均使用 4 段（只是 display 文本），但 package.json 被误同步为 4 段，导致打包失败。

**解决方案**（v1.2.9.16 起强制）：

| 位置 | 格式 | 示例 | 说明 |
|---|---|---|---|
| `package.json::version` | semver 3 段 | `1.2.916` | electron-builder 必须。`9.16` 拼接为 `916` 保语义递增 |
| `vite.config.ts::__APP_VERSION__` | display 4 段 | `1.2.9.16` | Sidebar / Setting / 帮助面板读取 |
| `electron/main.cjs::title` | display 4 段 | `v1.2.9.16` | 窗口标题 |
| `electron/main.cjs::log窗口` | display 4 段 | `v1.2.9.16` | 启动 HTML |
| `electron/main.cjs::IPC version` | display 4 段 | `1.2.9.16` | `t8pc:get-info` 返回 |
| `README.md::badge` | display 4 段 | `v1.2.9.16` | 读者可见 |
| `features.json::version` | display 4 段 | `1.2.9.16` | 项目语义版本 |
| `features.json::packaging.version` | display 4 段 | `1.2.9.16` | 同上 |
| `features.json::packaging.semverVersion` | semver 3 段 | `1.2.916` | 新增，记录 package.json 实际值 |
| `features.json::packaging.installer` | semver 3 段 | `T8-PenguinCanvas-Setup-1.2.916.exe` | 实际 NSIS 产物名以 package.json 为准 |

**拼接规则**：4 段 `A.B.C.D` → semver `A.B.<C><D>`，例：
- `1.2.9.16` → `1.2.916`
- `1.2.9.17` → `1.2.917`
- `1.2.10.0`  → `1.2.1000`（警告：如 D 超16位需提前跳 minor）
- 推荐到达 `1.2.9.99` 后跳到 `1.3.0`，避免 C 跳到 10 造成 D 冲突

**必遵检查点**：
- [ ] 升版同时同步 8 个位置，**只有 package.json::version 用 semver 3 段拼接格式**
- [ ] features.json::packaging 同时保留 `version`（4段） + `semverVersion`（3段） + `installer`（3段）
- [ ] 推送前用 `npm run dist:dir` 验证能启动再走 NSIS 完整打包

---

## v1.2.10 · RH 工具节点（启动器 + 应用面板）

### 设计目标
左侧 RH 分类下追加第 3 个节点「RH 工具」。区别于现有的 RunningHub（单一 webappId）/ RH 钱包应用（同上），它是一个「内置启动器」：用户在节点里维护自己常用的 RunningHub AI 应用清单（按分类组织），然后在同一个节点内部直接搜索 / 选择 / 运行任意一个应用，免去频繁拖入新节点的成本。

关键设计点：
- **双视图**：启动器视图（默认）+ 应用运行视图（点击某应用后切换）
- **多实例共享数据**：多个 RH 工具节点共享同一份「分类 + 应用」清单（通过 `RHToolsProvider` 广播），单节点改动立即被其他节点感知
- **运行态写回 NodeData**：运行参数 / taskId / 输出 URL 全部持久化到节点 data，刷新画布后状态不丢；下游 OutputNode 直接读 imageUrl/videoUrl
- **支持 Resize**：四角同比例缩放（最小 280×320，默认 320×440），用 `ResizableCorners`
- **拼音首字母搜索**：`utils/pinyinMatch.ts::fuzzyMatch`，例：搜「hy」可匹配「画意」「换衣」等
- **数据完全独立**：与现有 RHAppPreset（设置面板里的「RH 应用创意包」）分开两套 JSON 文件存储

### 新增文件清单
```
src/utils/pinyinMatch.ts                            # 拼音首字母 + 子序列模糊匹配
src/providers/RHToolsProvider.tsx                   # 跨节点共享 categories/tools
src/components/nodes/RHToolsNode.tsx                # 节点主体（启动器/运行双视图）
src/components/nodes/RHToolEditorModal.tsx         # 「+ 增加 / ✎ 编辑」浮层（应用/分类双 Tab）
src/components/nodes/RHToolRunnerPanel.tsx          # 应用运行面板（节点内部展开）
```

### 改动文件清单
```
src/config/nodeRegistry.ts        # NODE_REGISTRY 新增 { type:'rh-tools', label:'RH工具', category:'rh', icon:'Sparkles', color:'violet' }
src/types/canvas.ts               # NodeType 联合新增 'rh-tools'
src/config/portTypes.ts           # NODE_PORTS 新增 'rh-tools': { inputs:[], outputs:['image','video'] }
src/components/Canvas.tsx         # SPECIFIC_NODES 与 INITIAL_DATA 注册 'rh-tools'
src/App.tsx                       # 顶层包裹 <RHToolsProvider>
src/services/api.ts               # 末尾追加 RHTool / RHToolCategory 类型 + 10 个 CRUD/reorder API + safeRequest 工具函数
backend/src/config.js             # 新增 RH_TOOL_CATEGORIES_FILE / RH_TOOL_APPS_FILE
backend/src/routes/settings.js    # 新增 10 个 /rh-tool-categories 与 /rh-tool-apps 路由 + loadJson/saveJson/genId
```

### 后端路由（独立 18766 端口，与主项目 18765 互不影响）
```
GET    /api/settings/rh-tool-categories               // 列分类
POST   /api/settings/rh-tool-categories               // 新增 { name }
PUT    /api/settings/rh-tool-categories/:id           // 重命名 { name }
DELETE /api/settings/rh-tool-categories/:id           // 删除（其下应用 categoryId 自动置 ''）
POST   /api/settings/rh-tool-categories/reorder       // 排序 { ids: [...] }

GET    /api/settings/rh-tool-apps                     // 列应用
POST   /api/settings/rh-tool-apps                     // 新增 { webappId, title, description?, categoryId?, coverUrl? }
PUT    /api/settings/rh-tool-apps/:id                 // 更新 Partial<同上>
DELETE /api/settings/rh-tool-apps/:id                 // 删除
POST   /api/settings/rh-tool-apps/reorder             // 排序 { ids: [...] }
```
存储：`data/rh-tool-categories.json` + `data/rh-tool-apps.json`（与 RHAppPreset 完全独立）。

### 与主项目 RunningHub 协议适配
主项目（`PenguinPravite/services/api/runninghub.ts`）的 `runAIApp(webappId, list)` 是一步出，T8 必须改为两阶段并自行轮询：

```ts
// 上传素材链（IMAGE/VIDEO/AUDIO 字段）
//  ① uploadFile(File)            → /api/files/upload     → { url:'/files/input/xxx', filename }
//  ② uploadRhAsset(absoluteUrl)  → /api/proxy/runninghub/upload-asset → { fileName, fileType }

// 运行链
const { taskId } = await submitRh({ webappId, nodeInfoList });
// 自实现 setInterval 轮询，POLL_INTERVAL_MS=3000, POLL_MAX_TIMES=200（约 10 分钟）
const { status, urls, failReason } = await queryRh(taskId);
// status === 'SUCCESS' → urls[0] 写入 outputUrl，并按扩展名/字段提示推断 outputType=image|video|audio
```

### 端口与下游联动
- 节点端口：`outputs:['image','video']`，运行成功时按推断写入 NodeData 的 `imageUrl` 或 `videoUrl`
- 下游 OutputNode / ResizeNode / CombineNode 等通过既有协议自动消费

### NodeData 字段约定（INITIAL_DATA 已注册）
```ts
{
  rhToolsActiveCategoryId: 'all' | 'uncategorized' | <categoryId>,
  rhToolsActiveAppId: '' | <toolId>,           // 空 = 启动器视图；非空 = 运行视图
  rhToolsSearchQuery: string,                  // 搜索栏文本
  rhToolsRunnerInputs: Record<string, string>, // 键：`${nodeId}__${fieldName}`
  rhToolsRunnerUploadedNames: Record<string, string>, // 资源上传后的 RH fileName
  rhToolsRunnerTaskId: string,
  rhToolsRunnerStatus: string,
  rhToolsRunnerOutputUrl: string,
  rhToolsRunnerOutputType: 'image' | 'video' | 'audio' | '',
  rhToolsRunnerError: string,
  // 自动写入（下游消费）
  imageUrl?: string,
  videoUrl?: string,
}
```

### Sidebar 自动出现机制
本子项目 Sidebar 直接消费 `nodeRegistry.ts::NODE_GROUPS`，对 'rh' 分类自动渲染分组下所有 `NODE_REGISTRY` 条目。因此**仅需在 `NODE_REGISTRY` 中追加一条** `'rh-tools'`，Sidebar 即自动出现新节点入口；不需要单独改 Sidebar.tsx。

### 验收清单
- [ ] 左侧 RH 分类下能看到第 3 个节点「RH工具」（紫色 Sparkles 图标）
- [ ] 拖入画布后默认显示启动器视图，「暂无应用」提示 + 「+ 增加 / ✎ 编辑」按钮可点
- [ ] 编辑器 Modal 能添加分类、添加应用（含「自动填名」按钮通过 fetchRhAppInfo 拉取）
- [ ] 添加完应用后启动器立即出现应用按钮，点击进入运行视图
- [ ] 运行视图能渲染 IMAGE/VIDEO/AUDIO/LIST/STRING 各类参数；上传素材后能 ▶ 运行
- [ ] 运行成功后底部出现输出预览（图/视频/音频），下游 OutputNode 也能读到
- [ ] 多个 RH 工具节点并存时，任一节点的「+ 增加 / 删除 / 重命名」立即反映到其他节点
- [ ] 刷新画布后，运行态（taskId/outputUrl）与启动器/运行视图正确恢复
- [ ] 节点支持四角同比例缩放（最小 280×320）
- [ ] 拼音搜索：输入「hy」匹配「画意」「换衣」等中文应用名

### 与主项目（PenguinPravite）的对应关系
本子项目复刻自主项目 `components/PebblingCanvas/RHTools*.tsx` + `contexts/RHToolsContext.tsx` + `services/api/runninghub.ts`，做了三点适配：
1. 主项目 `getAIAppInfo / runAIApp / uploadToRunningHub` → T8 `fetchRhAppInfo / submitRh+queryRh / uploadFile+uploadRhAsset`
2. 主项目用 `isLightTheme`（来自 useTheme），T8 用 `isLight`（来自 useThemeStore）
3. 主项目后端基于 `JsonStorage` 工具，T8 后端用本文件内自实现 `loadJson/saveJson/genId`

---

## v1.2.10.1 · RH 工具节点运行逻辑与 RunningHubNode 一比一对齐

### 背景
v1.2.10.0 初版上线后用户反馈五个问题：
1. **实例类型不对** — RHToolsNode 未同 RunningHubNode 那样带 `instanceType` select(默认/plus)，造成 RH 在某些账号上冷启动失败
2. **Handle 遮挡** — source/target Handle 被节点内部表单遮住，鼠标点不到
3. **上游输入不生效** — IMAGE/VIDEO/AUDIO 字段未默认勾「从上游自动获取」，上游连上也不会同步
4. **音频输出丢失** — portTypes outputs 只有 image/video，取不到 audio
5. **循环器只出 1 个结果** — RHToolsNode 未加入 EXECUTABLE_NODE_TYPES，LoopNode/NodeActionBar EXEC_TYPES 未含 'rh-tools'

### 修复范围
- [src/components/nodes/RHToolsNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RHToolsNode.tsx) — 完全重写运行逻辑，以 [RunningHubNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RunningHubNode.tsx) 为金标准：resolveNodeInfoList 三层防御 / IMAGE预览白名单 / instanceType select / computeFreshValuesNow / useEffect 上游同步三态全部一比一移植
- [src/config/portTypes.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/portTypes.ts) — `'rh-tools': { inputs:['text','image','video','audio'], outputs:['image','video','audio'] }`
- [src/components/Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) — `EXECUTABLE_NODE_TYPES.add('rh-tools')`
- [src/components/nodes/LoopNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LoopNode.tsx) 与 [src/components/NodeActionBar.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/NodeActionBar.tsx) EXEC_TYPES 同步加 'rh-tools'
- 删除 `RHToolRunnerPanel.tsx`—运行面板在重写后直接嵌入 RHToolsNode 本体，不再需要独立子组件

---

## v1.2.10.2 · 颜色主题统一 + 文件自动保存路径全链路

### v1.2.10.2.A 颜色主题统一（紫色 → cyan）
RHToolsNode 初版使用 `violet` 紫色与 RH 分类其他节点 (RunningHub cyan-600 / cyan-400) 风格不一。修复：
- [src/config/nodeRegistry.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/nodeRegistry.ts) `color: 'violet' → 'cyan'`
- [src/components/nodes/RHToolsNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RHToolsNode.tsx) accent/accentSoft/ringColor 三组主题色统一为 cyan 双亮暗分支，四处 Handle `!bg-violet-400 → !bg-cyan-400`
- [src/components/nodes/RHToolEditorModal.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RHToolEditorModal.tsx) accent `rgb(139,92,246) → cyan` 双主题分支

### v1.2.10.2.B 文件自动保存路径（全局产物 → 本地）
**需求**：API 设置面板新增「文件自动保存路径」输入项，初始 `D:\zhenzhen`。路径不存在时启动自动创建。所有可执行节点生成的图像/视频/音频自动复制一份到此路径。

**架构**（五层贯通）：
```
[后端] config.js DEFAULT_LOCAL_SAVE_DIR='D:\zhenzhen'
           settings.js DEFAULT_SETTINGS.fileSavePath + ensureFileSavePath() 启动自动 mkdir / POST 后 ensureDir
           files.js POST /api/files/save-to-disk（三种协议：/files/output/* / /files/input/* / http(s)://*，同名跳过，自动 mkdir -p）
[前端] types/canvas.ts ApiSettings.fileSavePath?: string
           stores/apiKeys.ts DEFAULT.fileSavePath = 'D:\\zhenzhen'
           services/api.ts saveAssetToDisk（静默失败）
           ApiSettings.tsx 输入项 + handleSave 路径变动才上行
           OutputNode.tsx useEffect 监听 collected.{images,videos,audios}，ref Set 去重触发 saveAssetToDisk
```

**为什么在 OutputNode 植入？** 画布中所有可执行节点产出后都会被 Canvas.autoOutput 自动挂上 OutputNode 展示，本节点作为「统一收口」，单点植入即可覆盖全部节点。

**后端端点三分支**（[backend/src/routes/files.js](file:///e:/PenguinPravite/T8-penguin-canvas/backend/src/routes/files.js)）：
```js
router.post('/save-to-disk', async (req, res) => {
  const { url, filename } = req.body;
  // 路径获取 → ensureDir
  if (url.startsWith('/files/output/'))   await fsp.copyFile(path.join(OUTPUT_DIR, basename), target);
  else if (url.startsWith('/files/input/')) await fsp.copyFile(path.join(INPUT_DIR,  basename), target);
  else if (url.startsWith('http')) {
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.writeFileSync(target, buf);
  }
  // 同名文件跳过（exist:true）
});
```

**双层防重复保存**：
- 前端：OutputNode 用 `useRef<Set<string>>` 节点级去重，已保存过的 url 不重复发请求
- 后端：同名文件检测到直接返 `{ ok:true, exist:true }`，不覆盖

**静默失败设计**：`saveAssetToDisk` 不抛错，避免任何本地 IO 问题干扰到主生成链路。

---

## v1.2.10.3 · 像素风走 RunningHubNode 同款糖果调色板

用户反馈：v1.2.10.2 修为 cyan 后科技风面板同一了，但像素风仍为浅蓝，与左侧 RunningHub 节点的「米白底 + 糖果黄 + 黑墨边」不一致。

**修复**：[RHToolsNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RHToolsNode.tsx) 中 9 个主题色变量全部补 isPixel 分支，走 px-* CSS 变量。

| 变量 | 像素风 | 科技风 |
|---|---|---|
| accent | var(--px-ink) 黑墨 | cyan-600 / cyan-400 |
| accentSoft | var(--px-yellow) 糖果黄 | cyan-soft |
| ringColor | var(--px-ink) 黑边 | cyan-ring |
| bg | var(--px-surface) 米白 | #fff / #1c1c1e |
| surface | var(--px-muted) 浅米 | #f3f4f6 / #2c2c2e |
| surfaceHover | var(--px-yellow) 黄 | #e5e7eb / #3a3a3c |
| text | var(--px-ink) 黑 | #1c1c1e / #e5e5e7 |
| subText | var(--px-ink-soft) 深灰 | #6b7280 / #9ca3af |
| border | var(--px-ink) 黑边 | rgba(0,0,0,0.08) / rgba(255,255,255,0.08) |

补充两处特别处理：
- 参数表外层 background：像素风用 `var(--px-muted)` 浅米（不填纯黄让面版透出来）
- 运行按钮 hover 三态分支：像素风用 `var(--px-yellow)`

---

## v1.2.10.4 · RH 工具 → RH 超市 重命名

仅修改面向用户可见的三处文案：

| 文件 | 改动 |
|---|---|
| [src/config/nodeRegistry.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/config/nodeRegistry.ts) | Sidebar 节点徽章 `label: 'RH工具' → 'RH超市'` |
| [src/components/nodes/RHToolsNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RHToolsNode.tsx) | 启动器视图头部标题 `RH 工具 → RH 超市` |
| [src/components/nodes/RHToolEditorModal.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/RHToolEditorModal.tsx) | 编辑器弹窗头部 `RH 工具管理 → RH 超市管理` |

**内部保持不变**：`type: 'rh-tools'` / `data/rh-tool-categories.json` / `data/rh-tool-apps.json` / 后端路由 `/api/settings/rh-tool-*` 均不变，以保证数据与老画布兼容。

---

## v1.2.10.5 · 节点落点防重叠（阿基米德螺线避让 + 整组平移 + 兜底）

### v1.2.10.5.A 问题与决策

**症状**：从 Sidebar 拖入 / 右键添加 / 双击 OutputNode 编辑产物 / 输出素材自动建 OutputNode / UploadNode autoSpawn output / LoopNode 克隆链 —— **6 处入口**生成新节点时常常与现有节点重合。旧版仅 `±20px` jitter 抖动，9 宫格批量产物时重叠概率几近 100%。

**用户决策（Q1~Q4 拍板）**：

| Q | 选项 | 决策 |
|---|---|---|
| Q1 节点最小间距 | 16/24/**32**/40 px | **32 px** |
| Q2 螺线方向 | A 右→下→左→上 / B 上→右→下→左 / C 全向 8 邻 | **A** 符合阅读习惯 |
| Q3 批量布局策略 | A 整组平移 / B 个体散开 / C 自适应 | **A** 整组平移保持 9 宫格相对位置完整 |
| Q4 兜底策略 | A 最右兜底 / B 视口外 / C toast+飞镜 | **A+C** 最右落点 + logBus.warn + setCenter 飞镜 |

### v1.2.10.5.B 核心工具 [src/utils/nodePlacement.ts](file:///e:/PenguinPravite/T8-penguin-canvas/src/utils/nodePlacement.ts)（新建 323 行）

常量：
```ts
export const PLACEMENT_GAP = 32;       // 节点之间最小间距
export const PLACEMENT_STEP = 80;      // 螺线步长
export const PLACEMENT_MAX_TRIES = 64; // 螺线最大尝试次数（约 5 圈）
```

`NODE_DEFAULT_SIZE` 字典覆盖 24 个节点类型默认 w/h，`rectOf(node)` 三层兜底读尺寸：`measured > width/height > NODE_DEFAULT_SIZE 字典`。

核心函数：

| 函数 | 职责 |
|---|---|
| `rectsIntersect(a,b,gap)` | 矩形相交判定（含 padding） |
| `spiralOffsets(step, maxTries)` | 阿基米德方形螺线 generator（右→下→左→上 leg 递增） |
| `resolveSingleSpawn(desired, existing, opts)` | 单节点避让 |
| `resolveBatchSpawn(desiredRects, existing, opts)` | 整组避让 → 返回公共偏移 `{dx, dy}` |
| `fallbackRightmost(existing, defaultPos, onFallback)` | 找现有节点最右 + GAP*4 + `logBus.warn` + 上层 `onFallback` 回调 |
| `placeSingleNode(baseX, baseY, type, nodes, excludeIds?, onFallback?)` | 单节点一站式封装 |
| `placeBatchNodes(desiredRects, nodes, excludeIds?, onFallback?)` | 批量一站式封装 → `{dx, dy}` |

**算法**：阿基米德方形螺线 leg 长度 1,1,2,2,3,3,4,4...（右1 下1 左2 上2 右3 下3 ...），每步前进 PLACEMENT_STEP=80 px；每个候选位置都做 `rectsIntersect` 全量碰撞检测，第一个无碰撞位置即返回。

**整组平移**：先用所有 `desiredRects` 算包围盒（bbox），把 bbox 视为单一矩形跑同样的螺线避让，找到的偏移 `dx/dy` 同时加到所有节点 → 保持相对布局完整。

**兜底**：64 步内仍无解 → `fallbackRightmost` 找现有节点最右 + `GAP*4`，调 `logBus.warn("[placement] 无可避让位置, 已落到最右兜底点")`，并通过 `onFallback({x,y})` 回调让上层 `useReactFlow().setCenter()` 飞镜让用户立即看到。

### v1.2.10.5.C 6 处入口接入清单

| # | 入口 | 文件 | 接入点 | 调用 |
|---|---|---|---|---|
| 1 | Sidebar 拖入 / 右键快捷添加 | [Canvas.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/Canvas.tsx) addNode | 单节点 | `placeSingleNode + onFallback setCenter 飞镜` |
| 2 | autoOutput FramePair（首尾帧对） | Canvas.tsx | 批量 | `placeBatchNodes` |
| 3 | autoOutput Suno 双轨 | Canvas.tsx | 批量 | `placeBatchNodes` |
| 4 | autoOutput 通用 N 输出（图/视/音） | Canvas.tsx | 批量 | `placeBatchNodes` |
| 5 | OutputNode 双击编辑 → 3 列宫格 | [OutputNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/OutputNode.tsx) handleProduce | 批量 | `placeBatchNodes` |
| 6 | UploadNode 多产物 → 3 列宫格 | [UploadNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/UploadNode.tsx) handleProduce | 批量 | `placeBatchNodes` |
| 7 | UploadNode autoSpawn output | UploadNode.tsx | 单节点 | `placeSingleNode` |
| 8 | LoopNode 克隆链 N 节点 | [LoopNode.tsx](file:///e:/PenguinPravite/T8-penguin-canvas/src/components/nodes/LoopNode.tsx) | 批量 + `excludeIds=subNodeIds` 排除源 | `placeBatchNodes` |

**LoopNode 特别处理**：克隆链场景源节点（subNodeIds）不能参与碰撞检测，否则克隆体永远会被源挤走 → `placeBatchNodes(desiredRects, nodes, excludeIds: subNodeIds)`。

### v1.2.10.5.D 反重构检查表

后续重构涉及任何节点写入入口时必查：

- [ ] `setNodes` / `addNodes` / `setNodes(nds => [...nds, newNode])` 之前是否过 `placeSingleNode` / `placeBatchNodes` resolver
- [ ] 单节点入口形参是否齐全：`baseX, baseY, type, nodes, excludeIds?, onFallback?`
- [ ] 批量入口形参：`desiredRects[], nodes, excludeIds?, onFallback?` → `{dx, dy}`
- [ ] 批量场景所有节点 `position.x/y` 是否都加了 `+dx / +dy`（不能漏任何一个）
- [ ] `onFallback` 是否调 `useReactFlow().setCenter` 让用户能立刻看到兜底位置
- [ ] LoopNode 等克隆类入口 `excludeIds` 是否已传
- [ ] tsc EXIT=0

### v1.2.10.5.E 经验教训

1. **永远不要做 random jitter 抖动**：±20px 在批量 9 宫格时基本无效，必须用确定性算法（螺线/网格扫描）才能保证收敛。
2. **整组 vs 个体 必须一开始就决策**：批量产物属于一组语义整体（9 张图、双轨双歌、首尾帧对），整组平移保留相对布局比每个个体随机散开体验好得多。
3. **excludeIds 是克隆场景刚需**：LoopNode 克隆链场景，源节点必须从碰撞检测中剔除，否则克隆体会被源永远挤走没法落到原位附近。
4. **resolver 收口而不是节点内自治**：所有写入入口在 `setNodes` 前过一次 resolver，节点本身不感知防重叠，复用性最高。
5. **兜底必须可见**：64 步螺线无解极少见但必须可见 —— 无声落到屏幕外用户会以为节点没生成；`logBus.warn` + `setCenter` 飞镜组合保证用户始终能找到新节点。

### v1.2.10.5.F 关键文件清单

```text
src/utils/nodePlacement.ts                      新增 323 行（核心工具）
src/components/Canvas.tsx                       4 处接入（addNode + 3 段 autoOutput）
src/components/nodes/OutputNode.tsx             handleProduce 整组避让
src/components/nodes/UploadNode.tsx             handleProduce 整组 + autoSpawn 单节点
src/components/nodes/LoopNode.tsx               克隆链整组 + excludeIds=subNodeIds
```

### v1.2.10.5.G hotfix · 重叠仍现 → 双 pass 螺线 + autoOutput 多源累积

**用户反馈**（v1.2.10.5 初版交付后）：
> 「他还是节点重叠在一起，在深度思考下」（截图：FramePair 自动生成的「输出素材 (2项)」OutputNode 与既有「输出素材 (1项)」OutputNode 仍精确重叠）

**根因深度分析（两条独立失效链）**：

**根因 1 · spiral step 远小于大节点尺寸**
- 默认 `PLACEMENT_STEP = 80px`，但 OutputNode/ImageNode 实际尺寸 `320 × 360px`（4 倍 step）
- spiral generator 前 20+ 步偏移全在 `[-160, 160] × [-160, 160]` 区间内 —— 完全落在节点矩形内部
- `rectsIntersect` 含 `gap=32px` padding 后，整整 64 步螺线全部判定相交
- 结果：算法收敛失败 → 走兜底 fallbackRightmost —— **但截图显示并未被推到最右**，说明 64 步内某个判定通过了 → 实际上是螺线终点恰好落到另一组节点边界外但**仍在某个特定节点 320×360 范围内**
- 本质：固定 step=80 在大节点场景下数学上不可能跨出节点

**根因 2 · autoOutput 多源新建节点之间互不可见**
- Canvas.tsx autoOutput effect 一次循环可能为多个上游源节点（FramePair / Suno / 通用 N）补建 OutputNode
- 三段代码各自调用 `placeBatchNodes(_desired, nodes, ...)` —— 但 `nodes` 是 effect 进入时的快照
- 第一组新建节点已 push 进 `toAddNodes`，**但下一组避让时仍读旧 `nodes` 快照** → 新节点之间互相看不见 → 多源场景必重叠

**修复 1 · nodePlacement.ts 双 pass spiral**
- 新增 `computeAdaptiveStep(rects, gap, fallback)`：取所有矩形 `max(w+gap, h+gap)`，保证一步即可跨出最大节点
- 新增 `spiralSearchSingle / spiralSearchBatch`：单 pass 搜索辅助函数（提取共用逻辑）
- 重构 `resolveSingleSpawn / resolveBatchSpawn` 为双 pass：
  ```ts
  // Pass 1: 紧凑搜索 (小 step=80, 24 次)
  const hit1 = spiralSearch(desired, existing, baseStep, 24, gap);
  if (hit1) return hit1;
  // Pass 2: 自适应大 step (剩余 maxTries=64-24=40 次)
  const adaptStep = computeAdaptiveStep([...desired, ...existing], gap, baseStep);
  if (adaptStep > baseStep) {
    const hit2 = spiralSearch(desired, existing, adaptStep, maxTries, gap);
    if (hit2) return hit2;
  }
  // Fallback: 最右兜底 + logBus.warn + 飞镜
  ```
- 设计要点：
  - Pass 1 优先紧凑空隙（节点间隙、边角缝隙）—— 体验上落点贴近期望位置
  - Pass 2 才用大 step 跨节点 —— 保证大节点场景必收敛
  - 兜底路径不变 —— 极端密集场景仍走最右兜底 + 飞镜定位

**修复 2 · Canvas.tsx autoOutput 多源累积器**
- effect 顶部新增累加器：
  ```ts
  // hotfix: 一次 effect 内多个源节点补建的 OutputNode 之间互相可见
  const pendingPlacedNodes: Node[] = [];
  ```
- 3 段 placeBatchNodes 调用统一改为：`[...nodes, ...pendingPlacedNodes]`
  - L1992: FramePair 段 `placeBatchNodes(_desiredFP, [...nodes, ...pendingPlacedNodes], { source: 'placement:auto-frame-pair' })`
  - L2044: Suno 双轨段 `placeBatchNodes(_desiredSU, [...nodes, ...pendingPlacedNodes], ...)`
  - L2197: 通用 N 段 `placeBatchNodes(_desiredGen, [...nodes, ...pendingPlacedNodes], ...)`
- 每次 `toAddNodes.push(_newNode)` 后同步 `pendingPlacedNodes.push(_newNode)` —— 让下一组避让能看见已补建的节点

**hotfix 反重构检查表**
- [ ] `nodePlacement.ts` `resolveSingleSpawn / resolveBatchSpawn` 是否双 pass（小 step → 自适应大 step）
- [ ] `computeAdaptiveStep` 是否取 `max(w+gap, h+gap)` 而不是 `max(w, h)`
- [ ] `Canvas.tsx` autoOutput effect 顶部是否声明 `pendingPlacedNodes: Node[] = []`
- [ ] 3 段 `placeBatchNodes` 第二参是否合并 `[...nodes, ...pendingPlacedNodes]`
- [ ] 3 段 `toAddNodes.push` 之后是否同步 `pendingPlacedNodes.push`
- [ ] tsc EXIT=0

**hotfix 经验教训**
1. **算法 step 与场景尺寸必须解耦** —— 固定 step 永远撑不起所有节点尺寸，必须按实际矩形最大边动态算
2. **双 pass 优于单 pass 调大** —— 直接用大 step 会牺牲紧凑场景的视觉贴近度；先紧凑后跨步保留两端体验
3. **effect 内多源 mutation 的快照陷阱** —— React state 在同步 effect 内不会变，必须用本地累加器让兄弟 mutation 互相可见（与 phase24 RH `computeFreshValuesNow` 同款思路）
4. **截图诊断要看坐标差** —— 用户截图的两个 OutputNode `(x1, y1)` 与 `(x2, y2)` 差值应是 `step × N + offset`，差值远小于节点尺寸时立即想到 step 不够大

---

### v1.2.10.6 · placement hotfix3+4 —— 远距离偏移 + 无限循环 + reorder 覆盖修复

**用户反馈的三个连续问题**：
1. 「完全不会避开」—— reorder-grid useEffect 每次 nodes 变化时重计算全部 output 位置，用 `baseX = src.x + srcW + 80`（无偏移）覆盖了 autoOutput 的 placeBatchNodes 结果
2. 「避开了但离得非常远」—— adaptiveStep 取画布上最大节点尺寸(500+px)作为步长，导致 spiral 一步跳远；gap=32 让上方高节点底部延伸到目标区域而误判碰撞
3. 「Maximum update depth exceeded」—— reorder 中调用 placeBatchNodes 导致: 移动节点 → setNodes → re-render → reorder 再次执行 → 不同偏移 → 无限循环

**修复记录**：

| commit | 修复内容 |
|--------|----------|
| hotfix3 | reorder-grid 内调 placeBatchNodes + pendingPlacedNodes 通用路径 + onConnect 用 placeSingleNode + FramePair 空 need 提前 continue |
| hotfix3-距离 | reorder 只避开 output 节点 + gap=0 + step=40 + maxTries=12 |
| hotfix4-重叠 | reorder 碰撞检测排除自身组，其余所有节点参与检测 |
| hotfix4-循环 | 移除 reorder 中的 placeBatchNodes，用第一个节点当前位置作为锚点 |
| hotfix4-距离 | 去掉 adaptiveStep + autoOutput 用 gap=0 |

**最终架构（v1.2.10.6 稳定版）**：

```
职责分离:
  • autoOutput (Canvas.tsx)  —— 创建节点时做碰撞避让 (placeBatchNodes, 一次性)
      - gap=0 (只防止实际像素重叠)
      - step=80 + maxTries=64 (单 pass, 紧凑搜索)
      - pendingPlacedNodes 累加器让多源互见
  • reorder-grid (Canvas.tsx) —— 纯内部网格对齐 (colX/rowY)
      - 用第一个节点的当前位置作为锚点 (baseX/baseY)
      - 不调 placeBatchNodes —— 避免无限循环
      - 保留 autoOutput 算好的偏移不覆盖
```

**nodePlacement.ts 简化（v1.2.10.6）**：
- 去掉双 pass spiral —— 不再使用 `computeAdaptiveStep`
- `resolveSingleSpawn / resolveBatchSpawn` 简化为: 单 pass（step=80, maxTries=64）→ 兜底
- 原因：adaptiveStep 取画布上最大节点尺寸作步长，一步可跳 500+px，导致输出离源节点一屏远
- gap=0 后碰撞区域缩小，固定 step=80 在 64 次内即可找到空位

**hotfix3+4 经验教训**：
1. **reorder effect 绝不能调 setNodes 引起的位置计算** —— 否则形成 nodes 变化 → effect 触发 → 计算新位置 → setNodes → 无限循环
2. **职责分离**: 碰撞避让的职责应该在创建时一次性完成，而不是在每次 nodes 变化时重复执行
3. **gap=0 是 autoOutput 的正确设置** —— 输出节点只需不重叠，不需要 32px 额外缓冲。上方高节点底部刚好触碰目标区域时，gap=32 会误判碰撞而推远输出
4. **adaptiveStep 不适合用于多节点画布** —— 画布上有各种尺寸节点，取最大值作步长会让小场景也跳很远
5. **reorder 用第一个节点位置作锚点** —— 保留 autoOutput 的偏移结果，同时只做内部网格对齐

---

### v1.2.10.7 · placement baseY 对齐源节点垂直中心

**用户反馈**：输出节点避让时偏上放置，但最佳位置应该是水平平移（与源节点输出端口同高）。

**根因**：之前 `baseY = n.position?.y ?? 0`（源节点顶部），但 ReactFlow 输出端口在源节点的垂直中心位置。对于较高的源节点（如图像节点 ~600px），输出从顶部开始排列，视觉上明显偏上。

**修复**：让输出组的垂直中心对齐源节点的垂直中心（handle 位置）：

```ts
const srcH = rectOf(n).h;
const groupH = (rows - 1) * 360 + outputNodeH;
const baseY = srcY + srcH / 2 - groupH / 2;
```

影响范围：3 条 autoOutput 路径（FramePair / Suno / 通用） + reorder-grid naturalBaseY。

---

### v1.2.10.8 · placement 向右线性扫描（rightwardScan）

**用户反馈**：红框处有大片空地，但输出节点跳过它直接落到画布最右端（屏幕外）。

**根因**：螺线搜索 step=80 × maxTries=64 只覆盖期望位置周围 ~400px。如果空隙在 500– 1500px 远处，螺线找不到就直接触发 fallback（放到所有节点最右侧），跳过中间大片空地。

**修复**：在螺线和兜底之间插入「向右线性扫描」第二阶段：

```
搜索策略 3 阶段:
  Pass 1: spiral (step=80, 64次, 覆盖~400px) — 找紧凑近处空位
  Pass 2: rightwardScan (step=80, 最远3000px) — 沿自然流向右扫描空隙
         每步尝试 Y偏移: 0 / +80 / -80 (允许微调上下)
  Pass 3: fallback — 所有节点最右侧 + gap (仅在前两阶段都失败时触发)
```

关键代码：`rightwardScanSingle` / `rightwardScanBatch`（nodePlacement.ts）。

---

### v1.2.10.9 · 算力充值系统迁移

**目标**：把 `gpt-image-2-web` 已跑通的充值系统迁移到 `T8-penguin-canvas`，保留原支付代理协议与安全边界，同时适配本项目 Express + React + Electron 的结构。

**后端落点**：
- 新增 `backend/src/routes/recharge.js`，挂载 `server.js` 的 `/api/recharge/*` 与 `/pay/*`
- 原迁移版复用源项目 `ZZENC1` 加密代理配置；v1.2.10.11 起公开仓库默认留空，私有运行只从环境变量读取 `AGENT_BASE_URL / AGENT_HMAC_KEY`
- HMAC 请求头保持源项目协议：`X-Device-Id / X-Timestamp / X-Nonce / X-Sign`
- 本项目不用 sqlite，改为 `data/recharge.json` 与 `data/.recharge_device_id`，避免 Electron 原生依赖与打包风险
- 支持绑定用户、档位列表、创建订单、支付通知、主动查单、订单记录、转移失败重试

**档位**：
- 临时测试档：`test_1cny`，1 CP，1.00 CNY，方便联调，正式发布前可删除
- 正式档位沿用源项目：20 / 30 / 50 / 100 / 200 / 300 / 500 CP
- 1 CP = 500000 quota；正式档价格仍按 1.35 CNY / CP
- 余额查询本轮暂不迁移

**前端落点**：
- 新增 `src/components/RechargeModal.tsx`
- `src/services/api.ts` 新增 recharge API 类型与请求函数
- `src/App.tsx` 顶部工具条新增「充值」入口
- UI 分四套视觉分支适配：`tech/light`、`tech/dark`、`pixel/light`、`pixel/dark`

**打包注意**：
- `electron/_post_build.cjs` 已加入 `routes/recharge.t8c` 必检项
- 任何 `backend/src/` 改动后，正式打包前必须重新执行 `npm run encrypt`
- 版本同步为 display `1.2.10.9`，package semver `1.2.1009`

---

### v1.2.10.10 · 充值确认弹窗 + 安全硬化

**用户反馈**：点击「创建订单并付款」前需要一个同主题确认窗口，醒目提示用户核对绑定 ID，避免充错账号。

**前端修复**：
- `RechargeModal.tsx` 新增二次确认 `alertdialog`
- 文案固定为：`请核对绑定的用户ID，一旦充错无法退回！`
- 弹窗展示绑定用户 ID / 套餐 / 金额，用户点「我已核对，继续付款」后才调用 `createRechargeOrder`
- 适配四主题：科技风深/浅色 + 像素风深/浅色

**后端安全硬化**：
- `server.js` 的 CORS 从全开放改为仅允许 `127.0.0.1` / `localhost` 来源或无 Origin 请求
- `recharge.js` 的 `/pay/notify` 在缺少 `DULUPAY_KEY` 时直接返回 `fail`，避免空密钥签名被伪造
- 订单号随机后缀从 3 bytes 提升到 8 bytes
- `GET /api/recharge/order/:orderId` 与 `/api/recharge/orders` 返回订单摘要，不回传 `trade_no`

**开源风险补记**：
- `RECHARGE_DEFAULT_ENC` 属于可逆混淆，不应作为开源项目的真正密钥保护方案
- 仓库公开时必须保持 `RECHARGE_DEFAULT_ENC = ''`，并轮换任何曾经进入客户端或提交记录的 agent HMAC key
- 长期方案：VPS agent 提供受限公开下单/查单接口，转账和支付平台密钥只留在 VPS，不进入桌面端源码或打包产物

---

### v1.2.10.11 · GitHub 推送密钥清理规则

**用户要求**：追加 `skill.md` 规则，之后每次推送 GitHub 都必须保证充值系统不泄露 agent HMAC key，公开仓库默认留空。

**代码落地**：
- `backend/src/routes/recharge.js` 的 `RECHARGE_DEFAULT_ENC` 改为空字符串
- `loadRechargeConfig()` 仅从本地忽略文件 `data/recharge.private.json` 或环境变量读取私有充值配置：`RECHARGE_AGENT_BASE_URL`、`RECHARGE_AGENT_HMAC_KEY`、`RECHARGE_WEBSITE_URL`、`RECHARGE_DULUPAY_KEY`
- 缺少 `RECHARGE_AGENT_HMAC_KEY` 时创建订单会返回 agent 未配置，不会用空密钥继续签名

**每次推送 GitHub 前必须执行**：
- 确认 `RECHARGE_DEFAULT_ENC = ''`，真实 HMAC / 支付密钥不得出现在源码、文档、受 Git 跟踪的 JSON、构建产物中
- `rg -n "AGENT_HMAC_KEY|DULUPAY_KEY|RECHARGE_DEFAULT_ENC|secret|token|password" backend/src src electron features.json skill.md package.json .gitignore`，只允许出现变量名、空配置和安全说明
- `git status --short` 确认没有 `data/`、`backend/data/`、`input/`、`output/`、`thumbnails/`、`build/`、`dist/`、`dist_electron/`、`.env*`
- `backend/src/` 有改动时，打包前重新 `npm run encrypt`；但 `build/backend-enc` 只用于本地打包验证，不推 GitHub
- 禁止 `git push --force`，推送前先看 `git diff --stat`

**私有部署说明**：
- 私有环境通过进程环境变量注入充值配置，示例变量名可写入部署文档，但真实值只能存在本机/服务器 Secret 管理中
- 若任何真实 HMAC 曾经出现在开源提交、日志、截图或压缩包中，必须立即轮换

---

### v1.2.10.12 · 本地私有充值配置恢复

**问题**：v1.2.10.11 为了避免 GitHub 泄露 HMAC，把公开默认充值配置清空，但本地开发也失去 agent 配置，充值弹窗显示「支付服务未配置」。

**修复**：
- `backend/src/config.js` 增加 `RECHARGE_PRIVATE_FILE = data/recharge.private.json`
- `backend/src/routes/recharge.js` 启动时读取 `data/recharge.private.json`，再叠加 `RECHARGE_*` 环境变量覆盖
- `.gitignore` 增加 `**/recharge.private.json`，防止私有充值配置误提交
- 本机已从 `gpt-image-2-web/server.py` 的本地已验证配置恢复 `data/recharge.private.json`；该文件不进入 Git

**配置优先级**：
1. 公开默认配置：必须为空，仅占位
2. 本地忽略文件：`data/recharge.private.json`
3. 环境变量：`RECHARGE_AGENT_BASE_URL / RECHARGE_AGENT_HMAC_KEY / RECHARGE_WEBSITE_URL / RECHARGE_DULUPAY_KEY`

**推送规则更新**：
- 可以提交读取私有文件的代码
- 不能提交 `data/recharge.private.json` 本身
- 推送前 `git status --short --ignored` 中该文件只能出现在 `!! data/recharge.private.json`
- 每次 GitHub 推送必须严格执行 `21.5.1 GitHub 推送安全规范（强制）`，不得跳过密钥扫描和 ignored 文件确认

---

### v1.2.10.13 · Electron 用户包充值密钥安全闸

**用户要求**：打包 Electron 给用户充值使用，同时确认充值 agent HMAC 如何处理才安全。

**安全结论**：
- `AGENT_HMAC_KEY` 属于全局代理签名密钥，不能打进发给用户的 Electron 包；`.t8c`、asar、NSIS 安装包、环境变量默认值或 `RECHARGE_DEFAULT_ENC` 可逆密文都不能作为安全边界。
- 本地 `data/recharge.private.json` 只用于开发/内测机器，不随安装包、压缩包或更新包分发。
- 正式用户充值包的安全架构必须是 VPS 持有 HMAC/支付密钥/转账权限，桌面端只调用无需客户端 HMAC 的公开下单/查单接口。

**代码落地**：
- `electron/_post_build.cjs` 新增充值密钥安全闸：发现源码非空 `RECHARGE_DEFAULT_ENC`、`resources/data/recharge.private.json`、非空 `AGENT_HMAC_KEY / DULUPAY_KEY` 或遗留 `RECHARGE_DEFAULT_ENC` 可逆密文时直接失败。
- `features.json` 打包 checklist 加入用户分发包充值密钥边界。
- 版本同步为 display `1.2.10.13`，package semver `1.2.1013`。
