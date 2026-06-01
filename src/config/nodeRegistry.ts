import type { NodeMeta } from '../types/canvas';

/**
 * 节点元数据注册表
 * 严格对齐 features.json 中的 24 个保留节点
 * 图标使用 lucide-react 名称(运行时由 Sidebar 动态查找)
 */
export const NODE_REGISTRY: NodeMeta[] = [
  // ========== Input 素材资源(3) ==========
  { type: 'upload', label: '上传素材', category: 'input', description: '图像 / 视频 / 音频 三合一上传(自适应输出端口)', icon: 'Upload', color: 'emerald' },
  { type: 'material-set', label: '素材集', category: 'input', description: '把多个同类型文本 / 图像 / 视频 / 音频打包成可排序素材集，可直接传给生成与 RH 节点', icon: 'Images', color: 'teal' },
  { type: 'output', label: '输出素材', category: 'input', description: '起于上游任意节点的 文本/图像/视频/音频 结果预览(原始宽高比 + 文本双击编辑)', icon: 'MonitorPlay', color: 'teal' },

  // ========== Core 核心节点(6) ==========
  { type: 'text', label: '文本', category: 'core', description: '提示词文本节点', icon: 'Type', color: 'sky' },
  { type: 'image', label: '图像', category: 'core', description: 'GPT Image 2 / Nano Banana Pro / Nano Banana 2 (多 TAB 模型切换)', icon: 'Image', color: 'amber' },
  { type: 'video', label: '视频', category: 'core', description: 'Veo 3.1 / Grok Video', icon: 'Video', color: 'rose' },
  { type: 'seedance', label: 'SD2.0', category: 'core', description: 'Seedance 2.0 视频分镜', icon: 'Film', color: 'fuchsia' },
  { type: 'audio', label: '音频', category: 'core', description: 'Suno V5.5 全模式(生成/翻唱/续写)', icon: 'Music', color: 'violet' },
  { type: 'llm', label: 'LLM', category: 'core', description: 'GPT-5 / Claude 4.5 / Gemini 2.5(独立 Key)', icon: 'Brain', color: 'emerald' },

  // ========== RH RunningHub 节点(3) ==========
  { type: 'runninghub', label: 'RunningHub', category: 'rh', description: 'RH 工作流主节点', icon: 'Workflow', color: 'cyan' },
  // RH 钱包应用：复用 RunningHubNode 实现。v1.2.9.16 起与普通 RunningHub 节点统一使用 settings.rhApiKey
  { type: 'runninghub-wallet', label: 'RH钱包应用', category: 'rh', description: 'RH 钱包应用工作流（与 RunningHub 节点共用 RunningHub APIKEY）', icon: 'Wallet', color: 'violet' },
  // RH 配置节点从 v1.1.x 起隐藏（参数注入已可由 RunningHub 节点内表单代替，hidden:true 仅从 Sidebar 隐藏，保留老画布节点越。需重启删除 hidden 即可）
  { type: 'rh-config', label: 'RH 配置', category: 'rh', description: 'RH 工作流参数注入', icon: 'Settings2', color: 'cyan', hidden: true },
  // RH 工具节点 (v1.2.10+, 显示名从 v1.2.10.4 起改为「RH 超市」): 启动器式包装多个 RunningHub AI 应用，在节点内直接运行
  { type: 'rh-tools', label: 'RH超市', category: 'rh', description: '启动器式包装多个 RunningHub AI 应用，在节点内分类浏览 / 拼音搜索 / 一键运行', icon: 'Sparkles', color: 'cyan' },

  // ========== Special 特殊节点(5) ==========
  // 以下五个节点暂时隐藏不展示 (hidden: true) —— 需要重新启用时删除 hidden 即可。
  { type: 'multi-angle-3d', label: '多角度 3D', category: 'special', description: '3D 多视角生成', icon: 'Box', color: 'indigo', hidden: true },
  { type: 'panorama-720', label: '720 全景', category: 'special', description: '720° 全景图', icon: 'Globe', color: 'indigo', hidden: true },
  { type: 'penguin-portrait', label: '企鹅肖像', category: 'special', description: '肖像专用流程', icon: 'UserSquare2', color: 'indigo', hidden: true },
  { type: 'portrait-metadata', label: '肖像元数据', category: 'special', description: '肖像参数管理', icon: 'FileText', color: 'indigo', hidden: true },
  { type: 'storyboard-grid', label: '分镜网格', category: 'special', description: '分镜九宫格布局', icon: 'LayoutGrid', color: 'indigo', hidden: true },

  // ========== Utility 工具节点(13) ==========
  // 其中 4 个暂时隐藏: browser / frame-extractor / remove-bg / upscale
  { type: 'drawing-board', label: '画板', category: 'utility', description: '图层画板：接上游图片后手绘、标注、组合并输出图像', icon: 'Pencil', color: 'orange' },
  { type: 'browser', label: '浏览器', category: 'utility', description: '网页内嵌', icon: 'Globe2', color: 'orange', hidden: true },
  { type: 'image-compare', label: '图像对比', category: 'utility', description: '双图滑杆 / 并排 / 叠加 / 热力 / 聚焦对比', icon: 'GitCompare', color: 'orange' },
  { type: 'frame-extractor', label: '抽帧', category: 'utility', description: '视频抽帧', icon: 'Scissors', color: 'orange', hidden: true },
  // 首尾帧获取 (v1.2.7): 输入视频节点 → 运行后抽取首帧/尾帧 → 双 image 输出
  { type: 'frame-pair', label: '首尾帧获取', category: 'utility', description: '从视频抽取首帧与尾帧，双输出可分别接下游', icon: 'Film', color: 'orange' },
  // 循环器 (v1.2.8): 上游多素材 → 串联/并联驱动下游执行链
  { type: 'loop', label: '循环器', category: 'utility', description: '接多个同类型素材，串联逐个驱动或并联克隆子图同时跱发下游生成节点', icon: 'Repeat', color: 'orange' },
  // 从合集获取 (v1.2.8): 多素材 → 按序号取单个传给下游
  { type: 'pick-from-set', label: '从合集获取', category: 'utility', description: '从上游多素材中按序号取出单一素材，kind 可在节点内切换', icon: 'Filter', color: 'orange' },
  { type: 'text-split', label: '文本分割', category: 'utility', description: '将长提示词/分镜按段落、行、智能分镜、正则、自定义分隔符或字数切成多段文本，支持收藏与循环器链路', icon: 'SplitSquareVertical', color: 'orange' },
  { type: 'resize', label: '尺寸调整', category: 'utility', description: '图像尺寸调整', icon: 'Maximize2', color: 'orange' },
  { type: 'combine', label: '合并', category: 'utility', description: '图像合并', icon: 'Combine', color: 'orange' },
  { type: 'remove-bg', label: '抠图', category: 'utility', description: '去除背景', icon: 'Eraser', color: 'orange', hidden: true },
  { type: 'upscale', label: '放大', category: 'utility', description: '图像放大', icon: 'ZoomIn', color: 'orange', hidden: true },
  { type: 'grid-crop', label: '宫格剪裁', category: 'utility', description: '网格切图', icon: 'Grid3x3', color: 'orange' },
  { type: 'grid-editor', label: '宫格编辑', category: 'utility', description: '多图分镜宫格拼接与顺序拆分', icon: 'LayoutGrid', color: 'orange' },

  // ========== Auxiliary 辅助节点(6) ==========
  // 其中 2 个暂时隐藏: edit / video-output
  { type: 'edit', label: '编辑', category: 'auxiliary', description: '图像编辑/局部', icon: 'Edit3', color: 'slate', hidden: true },
  { type: 'idea', label: '灵感', category: 'auxiliary', description: '灵感记录', icon: 'Lightbulb', color: 'slate' },
  { type: 'bp', label: 'BP 蓝图', category: 'auxiliary', description: 'Blueprint 蓝图', icon: 'Map', color: 'slate' },
  { type: 'relay', label: '中继', category: 'auxiliary', description: '数据中转', icon: 'ArrowRightLeft', color: 'slate' },
  { type: 'remove-ai-watermark', label: '去AI水印', category: 'auxiliary', description: '基于 remove-ai-watermarks 的可见/隐形水印、局部擦除、元数据清理与鉴别', icon: 'ShieldOff', color: 'slate' },
  { type: 'video-output', label: '视频输出', category: 'auxiliary', description: '视频结果展示', icon: 'MonitorPlay', color: 'slate', hidden: true },

  // ========== Toolbox 工具箱(5) ==========
  { type: 'cinematic', label: '电影感', category: 'toolbox', description: '电影感组合器：风格 / 镜头 / 光影 / 调色 / 质感各 50 项，支持收藏与 JSON 导入/导出', icon: 'Clapperboard', color: 'pink' },
  { type: 'video-motion', label: '视频运镜', category: 'toolbox', description: '视频运镜组合器：场景 / 动作 / 路径 / 节奏 / 稳定 / 主体约束各 50 项，支持收藏与 JSON 导入/导出', icon: 'Camera', color: 'pink' },
  { type: 'multi-angle-visual', label: '可视化多角度', category: 'toolbox', description: '可视化调节方位 / 俯仰 / 远近，支持批量角度、Prompt 模式、前后缀、镜头收藏、JSON 导入/导出与紧凑双栏 UI', icon: 'Compass', color: 'pink' },
  { type: 'portrait-master', label: '肖像大师', category: 'toolbox', description: '捏人 Prompt 设计器：五官、发型、服饰、配饰、气质神情等 9 大类词库，支持随机、锁定、权重和运行输出文本', icon: 'UserRoundCog', color: 'pink' },
  { type: 'pose-master', label: '姿势大师', category: 'toolbox', description: '人体线稿姿态编辑器：支持多人姿势、抓取移动、OpenPose/COCO 预览输出、keypoints JSON 与中英文 prompt', icon: 'PersonStanding', color: 'pink' },
];

// 按分类分组,便于 Sidebar 渲染 (在这里过滤 hidden 节点 —— 它们仍在 NODE_REGISTRY 中保证节点类型注册)
export const NODE_GROUPS: Record<string, { label: string; nodes: NodeMeta[] }> = {
  input: { label: '素材资源', nodes: NODE_REGISTRY.filter((n) => n.category === 'input' && !n.hidden) },
  core: { label: '核心节点', nodes: NODE_REGISTRY.filter((n) => n.category === 'core' && !n.hidden) },
  rh: { label: 'RH', nodes: NODE_REGISTRY.filter((n) => n.category === 'rh' && !n.hidden) },
  special: { label: '特殊节点', nodes: NODE_REGISTRY.filter((n) => n.category === 'special' && !n.hidden) },
  utility: { label: '工具节点', nodes: NODE_REGISTRY.filter((n) => n.category === 'utility' && !n.hidden) },
  auxiliary: { label: '辅助节点', nodes: NODE_REGISTRY.filter((n) => n.category === 'auxiliary' && !n.hidden) },
  toolbox: { label: '工具箱', nodes: NODE_REGISTRY.filter((n) => n.category === 'toolbox' && !n.hidden) },
};

// 通过 type 反查 meta
export function getNodeMeta(type: string): NodeMeta | undefined {
  return NODE_REGISTRY.find((n) => n.type === type);
}
