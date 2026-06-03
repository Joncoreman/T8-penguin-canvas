/**
 * 节点端口语义注册表(连接类型校验核心)
 *
 * 设计目标:
 *   每个节点声明它的"输入需要什么"与"输出提供什么"。
 *   连接时只允许 source.outputs 与 target.inputs 有交集才能连。
 *   特殊类型 'any' 表示透传,与任何类型互通(用于 relay 中继)。
 *   upload 节点是动态的:输出根据 data.uploadType 决定,未上传时视为通用占位。
 *
 * 端口类型(PortType):
 *   - text:     文本/提示词 (data.prompt)
 *   - image:    图像 URL (data.imageUrl)
 *   - video:    视频 URL (data.videoUrl)
 *   - audio:    音频 URL (data.audioUrl)
 *   - metadata: 结构化元数据(肖像/参数包)
 *   - config:   配置参数(rh-config 注入)
 *   - any:      透传(中继)
 */
import type { Node } from '@xyflow/react';

export type PortType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'metadata'
  | 'config'
  | 'any';

export interface NodePorts {
  /** 该节点能接受的输入类型集合 */
  inputs: PortType[];
  /** 该节点能产出的输出类型集合 */
  outputs: PortType[];
}

const DEV_NODE_PORTS: Record<string, NodePorts> = import.meta.env?.DEV ? {
  // RH 工具箱制作器: 维护者开发态节点，只输出生成好的 manifest JSON 文本。
  'rh-toolbox-maker': { inputs: [], outputs: ['text'] },
} : {};

/**
 * 节点端口注册表
 * 与 features.json 节点清单严格对齐
 */
export const NODE_PORTS: Record<string, NodePorts> = {
  // ========== Core ==========
  text: { inputs: [], outputs: ['text'] },
  image: { inputs: ['text', 'image'], outputs: ['image'] },
  video: { inputs: ['text', 'image'], outputs: ['video'] },
  // SD2.0 (Seedance 2.0) 同时支持:
  //   text  → prompt
  //   image → reference_image / first_frame / last_frame
  //   video → reference_video (上游视频节点 / SD2.0 节点 都可作为输入)
  //   audio → reference_audio
  seedance: { inputs: ['text', 'image', 'video', 'audio'], outputs: ['video'] },
  audio: { inputs: ['text', 'audio'], outputs: ['audio'] },
  llm: { inputs: ['text', 'image', 'video'], outputs: ['text'] },

  // ========== RH ==========
  runninghub: { inputs: ['text', 'image', 'video', 'audio', 'config'], outputs: ['image', 'video'] },
  // RH 钱包应用：端口语义与 runninghub 一致，仅是提交时使用独立 APIKEY
  'runninghub-wallet': { inputs: ['text', 'image', 'video', 'audio', 'config'], outputs: ['image', 'video'] },
  // RhConfigNode 阶段 B 通用化：可接受任意上游节点产出的
  // text / image / video / audio（提交时由 RunningHubNode 负责调 /upload-asset 转 fileName）
  'rh-config': { inputs: ['text', 'image', 'video', 'audio'], outputs: ['config'] },
  // RH 工具节点 (启动器): 节点内部独立运行 RH 应用。
  // v1.2.10.1: 与 RunningHubNode 一致，左侧可接 text/image/video/audio 上游，
  // 右侧输出 image/video/audio（按扩展名分流到 imageUrl/videoUrl/audioUrl）。
  'rh-tools': { inputs: ['text', 'image', 'video', 'audio'], outputs: ['image', 'video', 'audio'] },
  // RH 工具箱: 维护者精选工具，可处理/输出四类素材，后续供其他节点按 capability 快捷调用。
  'rh-toolbox': { inputs: ['text', 'image', 'video', 'audio'], outputs: ['text', 'image', 'video', 'audio'] },
  ...DEV_NODE_PORTS,

  // ========== ComfyUI ==========
  // ComfyUI超市：本地 workflow 应用运行器，可按 manifest 消费/输出四类素材。
  'comfyui-store': { inputs: ['text', 'image', 'video', 'audio'], outputs: ['text', 'image', 'video', 'audio'] },
  // ComfyUI应用制作工具：把 API Workflow JSON 转成应用 manifest，输出 JSON 文本。
  'comfyui-app-maker': { inputs: [], outputs: ['text'] },

  // ========== Special ==========
  'multi-angle-3d': { inputs: ['text', 'image'], outputs: ['image'] },
  'panorama-720': { inputs: ['text'], outputs: ['image'] },
  'penguin-portrait': { inputs: ['text', 'image', 'metadata'], outputs: ['image'] },
  'portrait-metadata': { inputs: ['image'], outputs: ['metadata'] },
  'storyboard-grid': { inputs: ['image'], outputs: ['image'] },

  // ========== Utility ==========
  'drawing-board': { inputs: ['image'], outputs: ['image'] },
  browser: { inputs: [], outputs: ['text', 'image'] },
  'image-compare': { inputs: ['image'], outputs: ['image'] },
  'frame-extractor': { inputs: ['video'], outputs: ['image'] },
  // 首尾帧获取: 视频抽首/尾两帧 → 双 source handle (id=first/last) 输出 image
  'frame-pair': { inputs: ['video'], outputs: ['image'] },
  // 循环器 (v1.2.8): 接受 4 类素材集合 → 按 kind 输出下游驱动 (串联/并联)
  // 输出默认按 kind 递多类型 (any 允许接任意下游执行节点)
  loop: { inputs: ['text', 'image', 'video', 'audio'], outputs: ['text', 'image', 'video', 'audio'] },
  // 从合集获取 (v1.2.8): 从上游集合中选中单一素材 → 输出按 kind 变化
  'pick-from-set': { inputs: ['text', 'image', 'video', 'audio'], outputs: ['text', 'image', 'video', 'audio'] },
  // 文本分割: 长文本/上游文本 → 多段 textSegments, 下游按多文本集合消费
  'text-split': { inputs: ['text'], outputs: ['text'] },
  resize: { inputs: ['image'], outputs: ['image'] },
  combine: { inputs: ['image'], outputs: ['image'] },
  'remove-bg': { inputs: ['image'], outputs: ['image'] },
  upscale: { inputs: ['image'], outputs: ['image'] },
  'grid-crop': { inputs: ['image'], outputs: ['image'] },
  'grid-editor': { inputs: ['image'], outputs: ['image'] },

  // ========== Auxiliary ==========
  edit: { inputs: ['text', 'image'], outputs: ['image'] },
  idea: { inputs: [], outputs: ['text'] },
  bp: { inputs: ['text'], outputs: ['text'] },
  // relay 中继:任意进任意出(透传)
  relay: { inputs: ['any'], outputs: ['any'] },
  // 去AI水印: 图像支持完整清理/擦除/鉴别；视频/音频支持元数据检查与清理，文本输出用于报告。
  'remove-ai-watermark': { inputs: ['image', 'video', 'audio'], outputs: ['image', 'video', 'audio', 'text', 'metadata'] },
  'video-output': { inputs: ['video'], outputs: [] },

  // ========== Toolbox ==========
  cinematic: { inputs: [], outputs: ['text'] },
  'video-motion': { inputs: [], outputs: ['text'] },
  'multi-angle-visual': { inputs: ['image'], outputs: ['text'] },
  'portrait-master': { inputs: ['text', 'metadata'], outputs: ['text', 'metadata'] },
  // 姿势大师二阶段: 兼容上游肖像/运镜文本与参考图。未连接时保持旧版独立输出行为。
  'pose-master': { inputs: ['text', 'image', 'metadata'], outputs: ['image', 'text', 'metadata'] },

  // ========== 上传素材节点 (NEW) ==========
  // 动态:由 data.uploadType 决定具体输出。未上传时 outputs=[],不允许连出。
  upload: { inputs: [], outputs: [] },
  // 素材集: 同类型素材集合，输入可收集四类素材，输出按 materialSetKind 动态决定。
  'material-set': { inputs: ['text', 'image', 'video', 'audio'], outputs: ['text', 'image', 'video', 'audio'] },

  // ========== 输出素材节点 (NEW) ==========
  // 任意上游节点的 文本/图像/视频/音频 都可连入；同时作为中继节点可继续向下游透传 (any)。
  output: { inputs: ['text', 'image', 'video', 'audio', 'any'], outputs: ['any'] },

  // ========== 组容器 (NEW) ==========
  // groupBox 自身不接收外部输入 (无 target handle),
  // 但右侧 source handle 可以把「组内所有节点的聚合输出 (any)」一次性传给组外节点。
  groupBox: { inputs: [], outputs: ['any'] },
};

/**
 * 取节点的输入端口类型(返回该节点能接收的 PortType 列表)。
 */
export function getNodeInputs(node: Node | null | undefined): PortType[] {
  if (!node || !node.type) return [];
  const ports = NODE_PORTS[node.type];
  return ports?.inputs ?? [];
}

/**
 * 取节点的输出端口类型(对 upload 做动态解析)。
 */
export function getNodeOutputs(node: Node | null | undefined): PortType[] {
  if (!node || !node.type) return [];

  // upload 节点根据 data.uploadType 动态决定输出类型
  if (node.type === 'upload') {
    const uploadType = (node.data as any)?.uploadType as
      | 'image'
      | 'video'
      | 'audio'
      | undefined;
    if (uploadType === 'image') return ['image'];
    if (uploadType === 'video') return ['video'];
    if (uploadType === 'audio') return ['audio'];
    // 未上传时不暴露任何输出类型
    return [];
  }

  if (node.type === 'material-set') {
    const kind = (node.data as any)?.materialSetKind as
      | 'text'
      | 'image'
      | 'video'
      | 'audio'
      | undefined;
    const items = (node.data as any)?.materialSetItems;
    const hasItems = Array.isArray(items) && items.length > 0;
    if (!hasItems) return [];
    if (kind === 'text') return ['text'];
    if (kind === 'image') return ['image'];
    if (kind === 'video') return ['video'];
    if (kind === 'audio') return ['audio'];
    return [];
  }

  const ports = NODE_PORTS[node.type];
  return ports?.outputs ?? [];
}

/**
 * 端口类型集合是否兼容(any 透传 + 交集判定)
 */
export function arePortsCompatible(
  sourceOutputs: PortType[],
  targetInputs: PortType[]
): boolean {
  if (sourceOutputs.length === 0 || targetInputs.length === 0) return false;
  // any 透传:任一侧带 any 即兼容
  if (sourceOutputs.includes('any') || targetInputs.includes('any')) return true;
  // 取交集
  return sourceOutputs.some((t) => targetInputs.includes(t));
}

/**
 * 主校验函数:给 ReactFlow 的 isValidConnection 直接复用。
 *
 * @param source 源节点
 * @param target 目标节点
 * @returns true=允许连接 / false=拒绝
 */
export function isConnectionValid(
  source: Node | null | undefined,
  target: Node | null | undefined
): boolean {
  if (!source || !target) return false;
  if (source.id === target.id) return false; // 不允许自连
  // v1.2.9.6: 禁止「循环器 → 输出素材」连接 —— 循环器自身不产出最终结果,
  //          这种连接会变成无内容的空白 OutputNode, 影响体验; 真正的展示应走
  //          「循环器 → EXEC 节点 → OutputNode」累积链路。
  if ((source as any).type === 'loop' && (target as any).type === 'output') return false;
  const sOut = getNodeOutputs(source);
  const tIn = getNodeInputs(target);
  return arePortsCompatible(sOut, tIn);
}

/**
 * 端口类型 → 颜色映射(用于 Handle 颜色与 UI 提示)
 */
export const PORT_COLOR: Record<PortType, string> = {
  text: '#7dd3fc',     // sky-300
  image: '#fcd34d',    // amber-300
  video: '#fda4af',    // rose-300
  audio: '#c4b5fd',    // violet-300
  metadata: '#67e8f9', // cyan-300
  config: '#a5b4fc',   // indigo-300
  any: '#cbd5e1',      // slate-300
};

/**
 * 端口类型中文标签
 */
export const PORT_LABEL: Record<PortType, string> = {
  text: '文本',
  image: '图像',
  video: '视频',
  audio: '音频',
  metadata: '元数据',
  config: '配置',
  any: '任意',
};
