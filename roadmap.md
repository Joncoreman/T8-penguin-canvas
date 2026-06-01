# T8-penguin-canvas Roadmap

## 宫格编辑节点路线（开发中）

> 目标：新增独立「宫格编辑」节点，用于多图分镜拼版。它和现有「宫格剪裁」职责相反：宫格剪裁是一张图拆成多图，宫格编辑是多张图按格子排序后生成一张拼接图。

### 1. 第一阶段：分镜拼版基础版

- 工具节点分类新增可见节点「宫格编辑」，左侧接 `image`，右侧输出 `image`。
- 支持横向格数 `cols` 与纵向格数 `rows`，例如 `3×4` 表示横向 3 格、纵向 4 格；默认先用 `3×3`，提供 `2×2 / 3×3 / 3×4 / 4×3 / 1×4 / 4×1` 预设。
- 支持输出尺寸：常用比例 `1:1 / 4:3 / 16:9 / 9:16` 与自定义宽高；第一版直接输出 PNG，节点预览保持真实输出比例并在竖版/超长比例下滚动查看，不压缩成方块。
- 左侧图像输入会自动填入宫格；节点内也提供每格 `+` 和本地上传入口，用户可手动补图。
- 格子支持拖拽排序，顺序写入节点 `data.gridEditorOrder`，避免上游变化时丢失用户编排。
- 每格可删除当前图片；图片不足时保留空占位，运行时输出背景色空格，不报错。
- 图片超过格子数量时显示溢出提示，并提供「自动扩容」把行数补足。
- 每格显示序号开关，方便分镜 1、2、3 对应提示词或脚本。
- `拆分` 第一版先把当前已填格子的图片按顺序写回节点 `imageUrls / urls`，由现有自动输出链路生成多图合集；后续再扩展“打散到画布”。
- `运行` 调用后端 `/api/image/grid-compose`，按当前格子、间距、背景、适配模式生成一张拼接大图并写入 `imageUrl`。

### 2. 后端与数据规范

- 后端新增 `POST /api/image/grid-compose`，使用 `sharp` 统一拼图，复用现有 `/files/input`、`/files/output`、资源库文件和 dataURL 图像解析。
- 请求结构以 `rows / cols / width / height / gap / background / fit / showIndexes / cells[]` 为核心，`cells` 长度按 `rows*cols` 保留空格位置。
- `fit` 首版支持 `adaptive / cover / contain / fill`：默认 `adaptive` 保留整图并补背景，避免分镜窄格裁切人物；`cover` 适合统一画面比例，`contain` 明确完整留白，`fill` 仅在用户明确选择时拉伸。
- 后端必须限制 `rows/cols`、输出尺寸和格子总数，避免误设超大拼图拖垮内存。
- 输出仍落到 `/files/output/*`，继续兼容 OutputNode、资源库、节点发送、Loop 和自动保存。

### 3. 后续扩展

- 第二阶段支持双击单格进入裁切编辑，调整单张图片在格子里的缩放、平移、旋转和裁切框。
- 第二阶段支持边框样式、格子标题、场记文字、页码、水印、统一字幕条。
- 第三阶段支持保存为资源库「分镜宫格模板」，包括行列、尺寸、背景、间距、序号和每格说明。
- 第三阶段支持从文本分割 / LLM 分镜文本自动给每格生成标题，并与图片顺序绑定。

## 画板节点抠图路线（开发中）

> 目标：在现有「画板」节点内增加轻量 Photoshop 式套索与钢笔抠图，让用户可以直接在图层画板中对图片素材做非破坏式透明 PNG 抠出，不打断画板、图层、导入导出和 RUN 输出流程。

### 1. 第一阶段：非破坏式基础版

- 工具栏新增「套索」与「钢笔」两个抠图工具，仍在画板节点内部操作，不新增独立弹窗。
- 抠图只对当前选中的图片元素生效；未选图片、图层隐藏或锁定时禁用并显示明确提示。
- 套索支持按住拖动绘制自由闭合路径，松手后显示选区轮廓与操作浮条。
- 钢笔支持点击添加锚点，点击起点附近或按 Enter 闭合，Backspace 删除最后一个点，Esc 取消草稿。
- 默认动作是「抠出为新图层」：原图片图层保持不变，抠出的透明 PNG 作为新图片图层插入到当前图层上方，方便用户撤销或删除。
- 抠图草稿在确认前只存在组件状态中，不实时写入 `boardLayers`，避免拖动时触发大量自动保存和历史污染。

### 2. 数据与渲染规范

- 新增 `src/utils/drawingBoardCutout.ts` 存放路径闭合、RDP 简化、有效面积判断、旋转图片坐标映射等纯函数，必须配套 `tests/drawingBoardCutout.test.ts`。
- 路径坐标以画板坐标展示，合成时映射到图片元素本地坐标；旋转图片要通过图片中心反向旋转处理，避免选区与图像错位。
- 离屏 canvas 负责最终透明 PNG 合成：先裁出源图片，再用闭合路径生成 alpha mask，再通过 `/api/files/upload-base64` 落到 `/files/output/*`。
- 羽化和平滑作为轻量选项保留；第一阶段以路径简化和平滑边缘为主，后续再扩展更强的边缘优化。
- 导出画板 JSON 仍保存最终图层状态；后续如需要可把可编辑抠图路径作为图片元素 metadata 扩展，但第一阶段不强制用户维护复杂历史。

### 3. 后续扩展

- 第二阶段增加钢笔贝塞尔手柄、选区增减、重新编辑旧选区、删除选区 / 仅保留选区等更多 Photoshop 式操作。
- 第三阶段可复用已有 `remove-bg` / AI 去背能力，增加「自动主体抠图后手动修边」模式。
- 所有新增 UI 必须使用 `t8-*` 主题变量和 `t8-mini-icon-button`，不得写死某个主题颜色；新增官方主题时要检查画板抠图浮条、锚点、选区线在浅色/深色下都可见。

## 肖像大师开发路线

> 目标：新增「肖像大师」节点，定位为创作者可用的捏人 Prompt 设计器。节点只输出 prompt / metadata，不直接生成图片；负面约束暂不开发。

### 1. 第一阶段：基础可用版（已完成）

- 新增可见节点「肖像大师」，放入工具箱分类。
- 节点本体保持轻量：显示 Avatar 占位预览、角色摘要、Prompt 预览、编辑、随机、复制、运行输出文本。
- 点击编辑打开同主题捏人面板。
- 捏人面板支持分类选择、搜索、不选、锁定、随机、权重、自定义补充。
- 词库按稳定 id 保存，避免后续排序变化破坏旧画布。
- 核心分类包括：基础人物、五官、头发、妆容、身体标记、服装、配饰、气质神情、画面控制。
- 每个小参数至少准备 100 个可选项；每项都允许“不选”，不选时不输出词条。
- 输出英文 prompt 为默认，同时保留中文标签和摘要。
- 点击 RUN 只更新/输出文本，不调用图像生成。
- 支持连接到图像、视频、SD2.0、LLM、RunningHub、RH 超市等下游节点。
- UI 必须使用 T8 主题变量和 `t8-*` 通用样式，适配全部官方主题与明暗模式。

### 2. 第二阶段：Avatar 可视预览（已完成）

- 新增轻量 SVG/Canvas 分层 Avatar 预览。
- 预览跟随脸型、肤色、发型、发色、眼睛、眉毛、嘴型、服装色块、发饰、眼镜、帽子等关键选项变化。
- Avatar 只作为方向感预览，不生成真实图片，不消耗 API。
- 预览层使用选项的 `previewTag` / `preview` 元数据驱动，避免为每个词条单独绘图。

### 3. 第三阶段：角色库与复用（已完成）

- 支持导入 / 导出肖像大师 JSON。
- 支持收藏常用角色配置，本机最多保留 40 个常用角色。
- 支持保存到资源库的「角色」分类，采用现有素材集文本协议保存肖像大师 JSON，避免扩展后端资源类型。
- 支持从资源库插入角色配置回画布：资源库识别 `t8-portrait-master` JSON 后直接恢复为肖像大师节点。
- 支持跨画布发送肖像大师配置和输出 prompt。
- 支持把当前配置一键生成文本节点，方便接入循环器、文本分割和其他工作流。

### 4. 第四阶段：高级随机与批量角色（已完成）

- 支持随机全部、只随机空项、只随机当前分类、重随未锁定项。
- 支持随机种子，保证角色配置可复现。
- 支持风格随机包，例如清纯、御姐、赛博、古风、学院、暗黑、偶像、战斗、洛丽塔、职场等。
- 支持批量生成多个角色 prompt。
- 支持冲突规则和权重规则，例如发型/帽子/头饰互斥、套装优先覆盖上衣下装等。
- 支持把批量 prompt 输出为多个文本节点或一个文本素材集。

## 姿势大师开发路线

> 目标：新增「姿势大师」节点，定位为创作者快速表达动作姿态的参考图 + prompt 工具。第一阶段先做单人线稿和手动调整；后续逐步加入姿势库、批量分镜、与肖像/运镜联动以及可选的姿态识别能力。

### 1. 第一阶段：单人线稿基础版（已完成）

- 工具箱分类新增可见节点「姿势大师」。
- 支持单人人体体块线稿，用户可拖动关节点微调姿态。
- 内置 100 个不同常用姿势预设，不用镜像凑数。
- 支持视角、景别、中英文 prompt 切换，默认英文。
- 支持导入 / 导出 `t8-pose-master` JSON。
- 运行后输出 768×1056 PNG 姿势参考图、prompt/text 和 metadata。

### 2. 第二阶段：姿势库、批量分镜与节点联动（已完成）

- 支持姿势收藏，收藏逻辑参考电影感 / 视频运镜节点，可快速套用常用动作。
- 支持导入 / 导出 `t8-pose-master-library` 姿势库 JSON，包含当前姿势和收藏列表。
- 支持多姿势批量输出：从当前预设连续生成、随机常用姿势、复制当前姿势，适合一套分镜动作草案。
- 支持姿势强度：自然、夸张、漫画感、战斗感、舞台感。
- 支持与「肖像大师」联动：上游人物设定文本会与姿势动作提示词合并，形成完整角色动作 prompt。
- 支持与「视频运镜」联动：上游运镜文本会与姿势动作提示词合并，便于后续视频生成。
- 支持输入参考图作为姿态画布淡底参考，不写入导出 PNG，避免污染控制图。

### 3. 第三阶段：识别与高阶控制（已完成）

- 导入人物图后，使用 MediaPipe Pose 在前端识别 33 个姿态点，再转成可编辑骨架。
- 导出 OpenPose / COCO keypoints JSON，供 ComfyUI / ControlNet 用户复用。
- 支持多人物姿态，可新增、复制、删除并切换当前编辑人物。
- 支持手部简化控制，左右手可分别控制手掌方向、放松、握拳、张开、指向等。
- 支持视频关键帧：A 姿势到 B 姿势插值，输出一组姿态图，用于视频生成参考。
- 多姿势批量输出和 A/B 关键帧序列只生成一个姿势分镜合集 OutputNode，不再重复创建多个单体输出素材。
- `导出` 只导出当前姿势 JSON；`导出库` 导出当前姿势 + 姿势收藏库 JSON；`导入` 会自动识别两种 JSON。

## 工作流资源库路线（已完成）

> 目标：让用户把一组已经搭好的节点和内部连线保存成可复用工作流模板，放在资源库里按分类管理，避免为了复用小流程而长期保留大量临时画布。

### 1. 资源协议

- 资源库新增第六类 `workflow`，默认分类为：未分类、常用工作流、图像流程、视频流程、工具链。
- 工作流资源使用独立 JSON 文件保存，schema 固定为 `t8-workflow-fragment`，字段包含 `nodes`、`edges`、`sourceCanvasId`、`nodeCount`、`edgeCount`、`nodeTypes`、`savedAt`。
- 保存时只保留选中节点之间的内部连线，过滤选区外连线；节点清除 `selected / dragging / resizing / measured / positionAbsolute` 等运行态字段。
- `ResourceKind` 包含 `workflow`，但 `ResourceMediaKind` 仍只允许 `image / video / audio`，避免工作流被当作普通可拖拽媒体素材处理。

### 2. 用户入口

- 选中一个或多个节点后，右键菜单新增「保存工作流到资源库」。
- 跨画布发送弹窗的「节点片段」模式下，「保存到资源库」会保存为工作流模板；素材模式仍按图像 / 视频 / 音频 / 文本入库。
- 资源库抽屉新增「工作流」TAB，支持独立分类、新建分类、搜索、收藏、重命名、改分类和删除。
- 工作流卡片显示节点数、连线数、主要节点类型和轻量拓扑预览；拓扑预览使用节点类型缩写、方向箭头和原始相对布局归一化坐标，让用户不用打开模板也能辨别流程结构。
- 带内部连线的多节点选择默认发送为节点片段；自动模式和发送历史都不能悄悄改成输出素材 / 素材集模式，除非用户在弹窗里明确手动切换。
- 点击插入会把整套节点和内部连线插入当前画布。

### 3. 画布兼容规则

- 插入工作流复用现有节点片段实例化逻辑：重映射节点 id / 边 id，保持相对布局，并避开当前画布已有节点。
- 插入到当前画布时必须通过 `assignActiveNodeSerials()` 分配新的 NodeID；跨画布或后续扩展目标画布保存时必须通过 `assignFreshNodeSerials()`，禁止复用来源画布的 NodeID。
- 插入后自动选中新节点并定位到新内容中心；失败时给出明确提示，例如空工作流、JSON schema 无效、资源文件读取失败。
- 工作流资源默认不参与 `data-drag-source` 媒体拖拽协议；用户需要复用时用“插入画布”，再从画布继续编辑或发送。

## 扩展 API 平台融合路线（参考 Infinite-Canvas）

> 目标：把 Infinite-Canvas 中 ModelScope、火山引擎、本地 ComfyUI、即梦 Seedance 2.0 CLI、OpenAI 兼容图像/视频接口的调用方式，移植成 T8-penguin-canvas 的“高级可选扩展平台”。这些平台不是主功能入口，默认不影响贞贞工坊 / RunningHub / LLM 独立 Key 的现有体验；只有用户主动展开、配置、并在节点里选择扩展平台时才启用。

### 1. 融合原则

- 默认路径零变化：图像、视频、SD2.0、音频、LLM、RunningHub 节点继续默认走现有上游与分类 Key fallback 逻辑。
- 扩展平台只作为高级入口：在 API 设置页「分类独立 API Key【可选】」下方新增「扩展 API 平台【高级/可选】」，默认折叠，不在节点侧栏新增大分类。
- 设置与调用解耦：设置页只负责保存平台、模型、Key、Base URL、CLI/ComfyUI 状态；节点只通过 `providerSource/providerId/providerModel/providerParams` 选择调用目标。
- 缺省兼容旧画布：旧画布缺少 provider 字段时一律视为 `zhenzhen`，导入其他画布也不得因扩展字段缺失报错。
- 输出协议统一：所有扩展平台最终都要归一化成当前 OutputNode / 资源库 / 自动保存可识别的 `imageUrls`、`videoUrl/videoUrls`、`audioUrls`、`text`、`raw`、`taskId`。
- 媒体输入统一：复用现有上游素材聚合与排序，不在每个平台重复写收集逻辑；后端新增 media resolver，把 `/files/*`、`/api/resources/*`、远程 URL、dataURL、本地临时文件按平台需要转换为 base64、URL、asset、或本地路径。
- 安全边界清晰：Key 默认后端保存并脱敏展示；CLI 路径、ComfyUI 地址、火山 AK/SK 不写入日志；本地服务地址默认只允许 localhost/127.0.0.1，远端地址需要明确提示风险。

### 2. 设置页入口设计

- 新增默认折叠区块「扩展 API 平台【高级/可选】」，位置在「分类独立 API Key【可选】」之后、文件保存路径之前。
- 折叠态只显示：已启用平台数量、已配置 Key 数量、ComfyUI/即梦 CLI 是否可用；并提示“未配置不会影响主流程”。
- 展开态使用平台卡片或分段标签，一次只展开一个平台，避免表单过长：
  - OpenAI 兼容：自定义名称、Base URL、API Key、图像/视频/聊天模型列表、提交/轮询端点覆盖、测试连接。
  - ModelScope：Token、默认 `https://api-inference.modelscope.cn/v1`、图像模型、聊天模型、可选 LoRA 列表。
  - 火山引擎：方舟 API Key、默认 `https://ark.cn-beijing.volces.com/api/v3`、Seedream/Seedance 模型列表；可选火山素材 AK/SK、Project、Region。
  - 本地 ComfyUI：实例地址列表、队列状态、工作流 JSON 导入、暴露参数映射、输入图片同步策略、运行测试。
  - 即梦 CLI：dreamina 可执行路径、WSL 开关/发行版、登录状态检测、poll 秒数、图像/视频模型列表。
- 每个平台卡片必须有启用开关、保存状态、测试按钮、失败原因；未启用的平台不出现在节点模型选择中。

### 3. 节点融合方式

- 第一阶段不新增主侧栏节点，优先在现有图像、视频、SD2.0、LLM 节点里增加“更多平台/高级来源”小折叠区。
- 未配置扩展平台时，节点 UI 不显示扩展选择，保持现有简洁度。
- 用户配置并启用扩展平台后：
  - 图像节点可选择 `贞贞工坊 / OpenAI兼容 / ModelScope / 火山引擎 / 即梦CLI / ComfyUI工作流`。
  - 视频节点可选择 `贞贞工坊 / OpenAI兼容 / 火山引擎 / 即梦CLI`，Seedance 2.0 CLI 作为高级来源，不替代当前 SD2.0 主节点。
  - LLM 节点可选择 `LLM独立Key / OpenAI兼容 / ModelScope / 火山方舟聊天接入点`。
  - ComfyUI 若需要复杂工作流，可在后续阶段新增可选「本地 ComfyUI」节点；但只有用户保存至少一个工作流后才在添加菜单里显示。
- 节点运行按钮、进度、错误展示、自动输出、完成提示音、Loop 等等待机制都复用现有状态字段，不为扩展平台另建一套交互。

### 4. 后端适配层设计

- 新增 `backend/src/providers/` 作为扩展平台适配层，避免把所有新逻辑塞进 `routes/proxy.js`：
  - `registry.js`：平台默认值、协议枚举、模型列表、脱敏、配置归一化。
  - `mediaResolver.js`：把 T8 本地素材、资源库素材、远程 URL、base64、视频帧等转换为各平台需要的输入格式。
  - `openaiCompatible.js`：OpenAI 兼容图像/视频/聊天请求、端点覆盖、异步轮询、结果归一化。
  - `modelscope.js`：参考 Infinite-Canvas 的 async image task、`X-ModelScope-Async-Mode`、`/tasks/{task_id}` 轮询和图片转存。
  - `volcengine.js`：参考火山 Ark/Seedream/Seedance payload，处理方舟 Key、视频 `content` 数组、图片/视频引用和可选素材资产。
  - `comfyui.js`：本地 `/prompt`、`/queue`、`/history/{prompt_id}`、`/upload/image`、`/view` 下载，支持工作流参数映射。
  - `jimengCli.js`：参考 Infinite-Canvas 的 dreamina CLI、Windows/WSL 路径转换、安装/登录状态检测、poll、输出转存。
- 现有 `/api/proxy/*` 路由保持主流程；新增 `/api/proxy/external/*` 或内部 adapter 分发。只有请求显式带 `providerSource !== 'zhenzhen'` 时才进入扩展平台。
- 设置路由扩展 `advancedProviders` 字段，GET 返回脱敏状态，`/raw` 仅内部使用；保存时过滤非法协议、非法 URL、过长模型名和未知字段。

### 5. 数据结构草案

- `ApiSettings.advancedProviders`：
  - `enabled`
  - `id`
  - `label`
  - `protocol`: `openai-compatible | modelscope | volcengine | comfyui | jimeng-cli`
  - `baseUrl`
  - `apiKey`
  - `imageModels`
  - `videoModels`
  - `chatModels`
  - `defaults`
  - `volcengineConfig`
  - `comfyuiConfig`
  - `jimengConfig`
- `CanvasNodeData` 扩展字段：
  - `providerSource?: 'zhenzhen' | 'openai-compatible' | 'modelscope' | 'volcengine' | 'comfyui' | 'jimeng-cli'`
  - `providerId?: string`
  - `providerModel?: string`
  - `providerParams?: Record<string, any>`
- Canvas 保存、节点发送、跨画布导入必须保留这些字段；目标画布若没有同名 provider，节点显示“扩展平台未配置”，但不丢失原配置。

### 6. 分阶段开发计划

#### Phase A：设置与数据模型

- 状态：已在 v1.8.1/v1.8.2 落地。
- 扩展 `ApiSettings` 类型、zustand 默认值、后端 settings 默认值、脱敏与导入/导出。
- API 设置页新增默认折叠的扩展平台入口，折叠态摘要和展开态平台表单已接入。
- 增加配置校验测试：非法 URL、非法 provider id、Key 脱敏、旧设置迁移。

#### Phase B：Adapter 骨架与媒体解析

- 状态：已在 v1.8.1/v1.8.2 落地基础版，后续真实调用会继续扩展同一 adapter。
- 新增 providers 目录和统一返回类型。
- 实现 media resolver，覆盖 `/files/*`、`/api/resources/*`、dataURL、远程 URL、本地临时文件、视频抽帧。
- 新增 `POST /api/proxy/external/test-provider`，可测试 Key/Base URL/ComfyUI/即梦 CLI 状态，响应不泄漏明文密钥。

#### Phase C：OpenAI 兼容与 ModelScope

- 状态：已在 v1.8.4 落地。
- 已接入 OpenAI 兼容图像 / 视频 / LLM 调用，统一走 `/api/proxy/external/{image,video,llm}`，输出自动转存到 `/files/output/*`。
- 图像节点与 LLM 节点已增加高级 provider 选择；默认不显示，只有已启用 provider 时出现。
- ModelScope 已实现异步图像提交、轮询、错误归一化和自动保存。

#### Phase D：火山引擎与即梦 Seedance CLI

- 状态：已在 v1.8.4 落地。
- 火山已接入 Seedream 图像与 Seedance 视频，支持 dataURL / 本地 T8 素材解析、提交任务、轮询和视频转存。
- 即梦 CLI 已支持状态检测、text2image、image2image、text2video、单图 multimodal2video、多图 multiframe2video、poll 与输出转存。
- 视频节点 / SD2.0 节点已提供高级来源选择，但默认仍走当前贞贞工坊路径。

#### Phase E：本地 ComfyUI 工作流

- 状态：已在 v1.8.4 落地图像节点高级来源版。
- API 设置页支持 ComfyUI 实例列表、队列状态测试、工作流 JSON 粘贴保存和参数映射 JSON。
- 后端已实现 `/prompt` 提交、`/history/{prompt_id}` 轮询，并归一化 image/video/audio/text 输出；图像节点可在高级来源中选择已保存工作流。
- 独立「本地 ComfyUI」节点仍作为后续可选扩展，不影响当前节点融合方案。

#### Phase F：体验收口与回归

- 状态：已在 v1.8.4 落地基础收口。
- 扩展平台错误已统一成用户可读文案：未配置 Key、模型不存在、格式不支持、CLI 未安装、ComfyUI 不在线、任务超时。
- 输出素材统一进入 `/files/output/*`，因此可继续被 OutputNode、资源库、节点发送、Loop 与自动保存链路识别。
- 命令回归已覆盖 `node --test tests/*.test.ts`、`npm run build`；浏览器插件验证因当前本地 URL 安全策略阻止，未绕过策略。

## 去 AI 水印辅助节点路线（参考 wiltodelta/remove-ai-watermarks）

> 目标：新增辅助节点「去AI水印」，完整接入 `wiltodelta/remove-ai-watermarks` 的可见水印、局部擦除、隐形水印、元数据清理和鉴别能力。T8 只负责画布节点、用户交互、媒体解析、CLI 桥接和输出协议；算法能力由上游 Python 包提供，后续上游新增水印类型、修复 bug 或扩展参数时，T8 通过动态能力探测和少量 adapter 维护即可跟进。

### 1. 上游集成原则

- 不把上游算法重写成 JS，不复制上游核心源码到 T8 仓库；T8 只维护 adapter、媒体协议、UI 与输出协议。
- 后端通过 `remove-ai-watermarks` CLI / `python -m remove_ai_watermarks.cli` 调用上游能力；用户可用系统 PATH、Python 环境、`T8_REMOVE_AI_WATERMARKS_RUNTIME`、`T8_REMOVE_AI_WATERMARKS_BIN` 或 `T8_REMOVE_AI_WATERMARKS_SRC` 指定安装位置。
- 开发环境允许指向本地克隆 `E:\PenguinPravite\_external\remove-ai-watermarks`；普通用户环境可用 `pipx/uv/pip install remove-ai-watermarks`，完整 Electron 离线分发包则使用 `tools/remove-ai-watermarks-runtime` sidecar runtime。
- 去AI水印 full runtime 可能包含 Python、Torch、CUDA、LaMA/invisible 模型，禁止提交 Git；仓库只保留 runtime slot README 和打包规范。
- 后端状态接口必须返回上游版本、CLI 可用性、已知 visible mark 列表和可选能力状态；若上游以后新增 mark，T8 不需要改前端枚举即可显示。
- UI 必须有明确提示：该节点用于合法授权素材处理、去除本人作品中的平台标记或清理元数据，不鼓励规避版权、署名或平台合规标记。
- 输出仍统一转存到 `/files/output/*`，继续兼容 OutputNode、资源库、节点发送、Loop、自动保存和 Eagle。

### 2. 用户入口与节点体验

- 节点分类放入「辅助节点」，名称为「去AI水印」，默认可见。
- 节点左侧可接图像 / 视频 / 音频；图像支持完整处理，视频 / 音频首阶段只支持元数据检查和移除，避免误导用户以为能直接擦视频画面水印。
- 默认模式为「智能清理」：先尝试 known visible mark 自动识别移除，再清理 AI 元数据；用户可选是否追加隐形水印处理。
- 模式列表：
  - 智能清理：visible auto + metadata remove，可选 invisible。
  - 可见水印：`visible`，mark 支持 auto 和动态 mark 列表，参数含 detect、inpaint、method、strength、strip metadata。
  - 框选擦除：`erase`，支持多矩形区域、cv2/lama backend、telea/ns、dilate、strip metadata。
  - 隐形水印：`invisible`，支持 device、pipeline、strength、steps、seed、humanize、max resolution、protect text / face。
  - 隐形水印参数必须在 T8 层做安全钳制：steps 至少 4，非 0 max resolution 至少 256，strength 至少保证一个 diffusion timestep，避免上游 diffusers 空 latent 崩溃。
  - 元数据：`metadata --check` / `metadata --remove`，支持图片、视频、音频容器。
  - 鉴别：`identify --json`，输出 platform、confidence、watermarks、signals、caveats。
- 节点运行后按结果类型写入 `imageUrl / imageUrls / videoUrl / audioUrl / outputText / metadata`；鉴别和检查模式可直接接文本 / LLM / 输出素材。
- 错误要用户可读：未安装上游 CLI、Python 版本不足、可选依赖缺失、没有上游素材、不支持当前媒体类型、框选区域为空、任务超时。

### 3. 后端设计

- 新增 `backend/src/tools/aiWatermark/runner.js`：
  - 解析 CLI：`T8_REMOVE_AI_WATERMARKS_RUNTIME` sidecar root > Electron `resources/tools/remove-ai-watermarks` > `T8_REMOVE_AI_WATERMARKS_BIN` > `T8_REMOVE_AI_WATERMARKS_SRC` > 开发期 `_external/remove-ai-watermarks` > PATH `remove-ai-watermarks(.cmd)` > `python -m remove_ai_watermarks.cli`。
  - 提供 `detectCapabilities()`、`buildAiWatermarkPlan()`、`runAiWatermarkProcess()` 等纯函数，便于测试。
  - 对 smart 模式进行 T8 自己的串联编排，优先调用 `visible --mark auto`，如果未生成文件则复制原图继续 metadata remove；不直接依赖上游 `all`，避免固定 Gemini 引擎漏掉 Doubao/Jimeng 等 registry mark。
  - 子进程日志只返回 stdout/stderr 摘要，不打印本地绝对路径以外的敏感配置。
- 新增 `backend/src/tools/aiWatermark/media.js`：
  - 复用 T8 媒体协议，解析 `/files/input/*`、`/files/output/*`、`/input/*`、`/output/*`、`/api/resources/file/*`、`/api/resources/set-file/*`、dataURL、远程 URL、本地绝对路径。
  - dataURL 和远程 URL 会先落到 input 临时文件，再交给 CLI 处理；输出文件写入 `config.OUTPUT_DIR`。
  - 远程 URL 需超时、限制大小，并保留文件扩展名或 MIME 推断。
- 新增 `backend/src/routes/aiWatermark.js`：
  - `GET /api/ai-watermark/status`：返回 installed、version、resolver、markKeys、optionalFeatures、setupHints。
  - `POST /api/ai-watermark/process`：执行单个素材的指定模式，返回 outputUrl、outputKind、report、commands、logs。
  - 后续可扩展 `POST /api/ai-watermark/batch`，当前节点先在前端逐个素材串行调用。
- `backend/src/server.js` 挂载 `/api/ai-watermark`。
- `electron/_post_build.cjs` 增加 `routes/aiWatermark.t8c` 和 `tools/aiWatermark/*.t8c` 校验，确保打包时后端 adapter 不丢；同时检查 `resources/tools/remove-ai-watermarks` runtime slot，源码构建缺少 runtime 只警告，正式用户包设置 `T8_REQUIRE_AI_WATERMARK_RUNTIME=1` 后必须强制失败。

### 4. 前端设计

- 新增 `src/services/aiWatermark.ts`，封装 status/process API 和响应类型。
- 新增 `src/components/nodes/RemoveAiWatermarkNode.tsx`：
  - 使用 `useRunTrigger()` 接入单点运行、批量运行、Loop；不接入任务完成提示音，避免扩展工具节点制造额外提示声。
  - 从上游收集图像 / 视频 / 音频，默认处理第一个，可勾选“处理全部上游素材”。
  - 显示上游素材摘要、上游 CLI 状态、模式切换、参数分区、运行按钮、结果预览和报告文本。
  - 框选擦除提供预览图与区域列表；首版至少支持手动矩形输入、默认右下角快速区域和多区域删除，后续再增强拖拽框选。
  - 视觉必须使用 `t8-*` / CSS 变量，不写死大面积暗色卡片，适配科技、像素、OP、RH、火影、EVA、幽游、灌篮等主题。
- 更新注册文件：
  - `src/types/canvas.ts` 增加 `remove-ai-watermark`。
  - `src/config/nodeRegistry.ts` 放入辅助节点。
  - `src/config/portTypes.ts` 声明 image/video/audio 输入，image/video/audio/text/metadata 输出。
  - `src/components/Canvas.tsx` 注册组件、初始数据和可执行节点。
  - `src/components/NodeActionBar.tsx` 同步可执行节点集合。
  - `src/utils/nodePlacement.ts` 增加默认尺寸。

### 5. 可维护与上游同步

- 后端能力探测优先动态读取上游 `watermark_registry.mark_keys()`、`remove_ai_watermarks.__version__`、`invisible_engine.is_available()`、`region_eraser.lama_available()`。
- 前端 mark 下拉从 status 返回值生成；如果 status 不可用，则回退 `auto / gemini / doubao / jimeng`。
- 保留 `advancedArgs` 或后端透传白名单扩展位，便于上游先新增参数时临时试用；稳定后再做成明确 UI 控件。
- 上游同步流程：
  - 更新本地外部克隆：`git -C E:\PenguinPravite\_external\remove-ai-watermarks pull`。
  - 升级用户环境：`pipx upgrade remove-ai-watermarks` 或 `uv tool upgrade remove-ai-watermarks`；Electron 离线包要同步重建 `tools/remove-ai-watermarks-runtime` sidecar。
  - 若 CLI 参数变化，只需更新 `runner.js` 的命令计划、节点 UI、features/skill 规范和相关测试。
  - 若新增 visible mark，只要仍在 `watermark_registry.mark_keys()` 中，T8 UI 自动显示。
- README/features 后续发布时需要保留 MIT attribution：`remove-ai-watermarks` by `wiltodelta`, MIT License。

### 6. 验证清单

- 单元测试：
  - `node --test tests/aiWatermarkRunner.test.ts`
  - `node --test tests/*.test.ts`
- 语法检查：
  - `node -c backend/src/routes/aiWatermark.js`
  - `node -c backend/src/tools/aiWatermark/runner.js`
  - `node -c backend/src/tools/aiWatermark/media.js`
- 构建：
  - `npm run build`
  - `npm run dist`
- 运行时依赖：
  - `python -m pip check`
  - Torch/CUDA import smoke（需要 GPU 能力时）
  - `GET /api/ai-watermark/status` 返回 installed=true、markKeys 与 optionalFeatures
- Electron:
  - `tools/remove-ai-watermarks-runtime` 为空时 `_post_build.cjs` 只警告；用户离线包设置 `T8_REQUIRE_AI_WATERMARK_RUNTIME=1` 必须能拦截缺失 runtime。
  - 准备 sidecar runtime 后重新 `npm run dist` 并检查 win-unpacked 启动冒烟。
- 手动冒烟：
  - 未安装上游 CLI 时，节点显示安装提示且不崩溃。
  - 安装上游 CLI 后，`GET /api/ai-watermark/status` 返回版本和 mark 列表。
  - 图像输入运行智能清理后输出 `/files/output/*` 图片。
  - 元数据检查模式能输出文本报告，且可接 OutputNode/LLM。
