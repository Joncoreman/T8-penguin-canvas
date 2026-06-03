/**
 * T8-penguin-canvas 节点类型定义
 * 与 features.json 节点清单严格对齐(24 节点 + 4 已弃)
 */

// 节点类型(25 种保留 = 24 + upload)
export type NodeType =
  // Core (8)
  | 'text'
  | 'image'
  | 'video'
  | 'seedance'
  | 'audio'
  | 'llm'
  | 'runninghub'
  | 'runninghub-wallet'
  | 'rh-config'
  | 'rh-tools'
  | 'rh-toolbox'
  | 'rh-toolbox-maker'
  | 'comfyui-store'
  | 'comfyui-app-maker'
  // Special (5)
  | 'multi-angle-3d'
  | 'panorama-720'
  | 'penguin-portrait'
  | 'portrait-metadata'
  | 'storyboard-grid'
  // Utility (9)
  | 'drawing-board'
  | 'browser'
  | 'image-compare'
  | 'frame-extractor'
  | 'frame-pair'
  | 'loop'
  | 'pick-from-set'
  | 'text-split'
  | 'resize'
  | 'combine'
  | 'remove-bg'
  | 'upscale'
  | 'grid-crop'
  | 'grid-editor'
  // Auxiliary (5)
  | 'edit'
  | 'idea'
  | 'bp'
  | 'relay'
  | 'remove-ai-watermark'
  | 'video-output'
  // Toolbox (5)
  | 'cinematic'
  | 'video-motion'
  | 'multi-angle-visual'
  | 'portrait-master'
  | 'pose-master'
  // Input/Output 素材 (2) - 上传素材(图像/视频/音频三合一) + 输出素材(文本/图像/视频/音频预览)
  | 'upload'
  | 'material-set'
  | 'output';

// 节点分类
export type NodeCategory =
  | 'core'
  | 'rh'
  | 'comfyui'
  | 'special'
  | 'utility'
  | 'auxiliary'
  | 'toolbox'
  | 'input';

// 节点元数据(用于 Sidebar 展示)
export interface NodeMeta {
  type: NodeType;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string; // lucide-react 图标名
  color: string; // tailwind 色阶
  /**
   * 是否在 UI 入口暂时隐藏(Sidebar 节点列表 + 端口拖出候选选择器)。
   * 节点本身仍然在 NODE_REGISTRY 中注册到 nodeTypes,以保证已存在画布数据加载与渲染兼容,
   * 仅从用户主动添加入口中移除。设为 true 即等价于「暂时不展示」。
   */
  hidden?: boolean;
}

// 画布节点数据(xyflow Node.data)
export type AdvancedProviderProtocol =
  | 'openai-compatible'
  | 'modelscope'
  | 'volcengine'
  | 'comfyui'
  | 'jimeng-cli';

export interface AdvancedProviderConfig {
  id: string;
  label: string;
  protocol: AdvancedProviderProtocol;
  baseUrl?: string;
  enabled?: boolean;
  apiKey?: string;
  hasApiKey?: boolean;
  imageModels?: string[];
  videoModels?: string[];
  chatModels?: string[];
  defaults?: Record<string, any>;
  modelscopeConfig?: {
    defaultsVersion?: number;
    loras?: Array<{
      id: string;
      name?: string;
      targetModel: string;
      strength?: number;
      enabled?: boolean;
      note?: string;
    }>;
  };
  volcengineConfig?: {
    project?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    hasAccessKeyId?: boolean;
    hasSecretAccessKey?: boolean;
  };
  comfyuiConfig?: {
    instances?: string[];
    workflows?: Array<{
      id: string;
      name: string;
      workflowJson?: Record<string, any>;
      fields?: Array<{ nodeId: string; fieldName: string; source?: string; value?: any }>;
      excludeRules?: string[];
    }>;
  };
  jimengConfig?: {
    executablePath?: string;
    useWsl?: boolean;
    wslDistro?: string;
    pollSeconds?: number;
  };
}

export interface AdvancedProviderSummary {
  enabledCount: number;
  configuredKeyCount: number;
  comfyuiConfigured: boolean;
  jimengConfigured: boolean;
}

export type CloudUploadProvider =
  | 'tencent-cos'
  | 'aliyun-oss'
  | 'baidu-netdisk'
  | 'quark-netdisk';

export interface CloudUploadTargetConfig {
  id: string;
  provider: CloudUploadProvider;
  label: string;
  enabled?: boolean;
  isDefault?: boolean;
  prefix?: string;
  publicBaseUrl?: string;
  tencentCos?: {
    bucket?: string;
    region?: string;
    secretId?: string;
    secretKey?: string;
    hasSecretId?: boolean;
    hasSecretKey?: boolean;
  };
  aliyunOss?: {
    bucket?: string;
    endpoint?: string;
    accessKeyId?: string;
    accessKeySecret?: string;
    hasAccessKeyId?: boolean;
    hasAccessKeySecret?: boolean;
  };
  baiduNetdisk?: {
    folder?: string;
    accessToken?: string;
    refreshToken?: string;
    appKey?: string;
    appSecret?: string;
    hasAccessToken?: boolean;
    hasRefreshToken?: boolean;
    hasAppKey?: boolean;
    hasAppSecret?: boolean;
  };
  quarkNetdisk?: {
    folder?: string;
    mode?: 'external-command' | 'cookie';
    commandPath?: string;
    cookie?: string;
    hasCookie?: boolean;
  };
}

export interface CloudUploadSummary {
  totalCount: number;
  enabledCount: number;
  configuredCount: number;
  supportedUploadCount: number;
  defaultTargetId?: string;
  defaultLabel?: string;
}

export type CanvasProviderSource = 'zhenzhen' | AdvancedProviderProtocol;

export interface CanvasNodeData {
  label?: string;
  prompt?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  model?: string;
  providerSource?: CanvasProviderSource;
  providerId?: string;
  providerModel?: string;
  providerParams?: Record<string, any>;
  status?: 'idle' | 'generating' | 'success' | 'error';
  error?: string;
  // 通用扩展字段
  [key: string]: any;
}

// 画布列表项(后端返回)
export interface CanvasListItem {
  id: string;
  name: string;
  nodeCount: number;
  createdAt: number;
  updatedAt: number;
}

// 画布完整数据
export interface CanvasData {
  nodes: any[];
  edges: any[];
  viewport: { x: number; y: number; zoom: number };
  nextNodeSerialId?: number;
}

// API Key 设置(对应后端 settings)
export interface ApiSettings {
  // 三套通用 Key
  zhenzhenApiKey: string;
  zhenzhenBaseUrl: string; // 锁定 https://ai.t8star.org
  rhApiKey: string;
  rhBaseUrl: string; // https://www.runninghub.cn
  llmApiKey: string;
  llmBaseUrl: string; // 锁定 https://ai.t8star.org
  // 分类 API Key（留空时 fallback 到 zhenzhenApiKey）
  gptImageApiKey?: string;
  nanoBananaApiKey?: string;
  mjApiKey?: string;
  veoApiKey?: string;
  grokApiKey?: string;
  seedanceApiKey?: string;
  sunoApiKey?: string;
  // v1.2.10.2: 全局生成素材自动保存到本地的路径(可用户自定义)
  fileSavePath?: string;
  // v1.3.1: 画布自动保存导出路径(实际写入 <path>/T8-penguin-canvas/canvases)
  canvasAutoSavePath?: string;
  // v1.3.4: 资源库路径(资源文件 + resource_library.json 元数据)
  resourceLibraryPath?: string;
  // v1.3.6: 自定义主题模板路径(主题 JSON 文件)
  themeTemplatePath?: string;
  // 本地 Eagle API 地址(默认 http://127.0.0.1:41595)
  eagleApiBase?: string;
  advancedProviders?: AdvancedProviderConfig[];
  advancedProviderSummary?: AdvancedProviderSummary;
  cloudUploadTargets?: CloudUploadTargetConfig[];
  cloudUploadSummary?: CloudUploadSummary;
  preferences?: {
    theme?: 'dark' | 'light';
    language?: string;
  };
}
