import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, CloudUpload, Download, ExternalLink, Eye, EyeOff, FileUp, Info, KeyRound, Loader2, Lock, Plus, Save, Settings2, TestTube2, Trash2, X, FolderOpen, ServerCog } from 'lucide-react';
import { useApiKeysStore, FIXED_ZHENZHEN_BASE, RH_BASE } from '../stores/apiKeys';
import { useThemeStore } from '../stores/theme';
import type { AdvancedProviderConfig, AdvancedProviderProtocol, ApiSettings, CloudUploadProvider, CloudUploadTargetConfig } from '../types/canvas';
import { getRawSettings, testAdvancedProvider, testCloudUploadTarget } from '../services/api';
import {
  advancedProviderSummary as summarizeAdvancedProviderForm,
  normalizeModelscopeLoraStrength,
  normalizeModelscopeLoras,
  parseAdvancedProviderModelText,
  stringifyAdvancedProviderModels,
} from '../utils/advancedProviders';
import {
  COMFY_FIELD_SOURCE_OPTIONS,
  analyzeComfyWorkflow,
  canonicalizeComfyFieldsByWorkflow,
  filterComfyFieldsByExcludeRules,
  parseComfyFieldExcludeRules,
  type ComfyFieldMapping,
} from '../utils/comfyuiWorkflow';

interface ApiSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

// 主 Key 字段名类型
type KeyField =
  | 'zhenzhenApiKey'
  | 'rhApiKey'
  | 'llmApiKey'
  | 'gptImageApiKey'
  | 'nanoBananaApiKey'
  | 'mjApiKey'
  | 'veoApiKey'
  | 'grokApiKey'
  | 'seedanceApiKey'
  | 'sunoApiKey';

interface KeySpec {
  field: KeyField;
  label: string;
  desc: string;
  bullet: string; // tailwind bg color class
}

const COMMON_KEYS: KeySpec[] = [
  { field: 'zhenzhenApiKey', label: '贞贞工坊 API Key', desc: '· 通用后备 · 用于图像/视频/音频生成', bullet: 'bg-amber-400' },
  { field: 'rhApiKey', label: 'RunningHub API Key', desc: '· RunningHub 节点与 RH 钱包应用节点共用', bullet: 'bg-cyan-400' },
  { field: 'llmApiKey', label: 'LLM 独立 API Key', desc: '· 额度隔离 · 用于 LLM/Vision', bullet: 'bg-emerald-400' },
];

const CLASSIFIED_KEYS: KeySpec[] = [
  { field: 'gptImageApiKey', label: 'gpt-image 系列', desc: 'GPT2 / gpt-image-1 等图像任务专用', bullet: 'bg-pink-400' },
  { field: 'nanoBananaApiKey', label: 'nano-banana 系列', desc: 'nano-banana / nano-banana-pro 专用', bullet: 'bg-yellow-400' },
  { field: 'mjApiKey', label: 'mj 系列', desc: 'Midjourney (turbo/fast/relax) 专用', bullet: 'bg-purple-400' },
  { field: 'veoApiKey', label: 'veo / sora 系列', desc: 'Veo / Veo3.1 / Sora2 视频专用', bullet: 'bg-blue-400' },
  { field: 'grokApiKey', label: 'grok 系列', desc: 'Grok Image / Grok Imagine Video 专用', bullet: 'bg-orange-400' },
  { field: 'seedanceApiKey', label: 'seedance 系列', desc: 'Seedance 视频专用', bullet: 'bg-teal-400' },
  { field: 'sunoApiKey', label: 'suno 系列', desc: 'Suno 音乐专用', bullet: 'bg-rose-400' },
];

const ALL_FIELDS: KeyField[] = [
  ...COMMON_KEYS.map((k) => k.field),
  ...CLASSIFIED_KEYS.map((k) => k.field),
];

const PATH_FIELDS = [
  'fileSavePath',
  'canvasAutoSavePath',
  'resourceLibraryPath',
  'themeTemplatePath',
  'eagleApiBase',
] as const;

const SETTINGS_BACKUP_SCHEMA = 't8-penguin-canvas-settings';
const SETTINGS_BACKUP_VERSION = 1;

const ADVANCED_PROVIDER_LABELS: Record<AdvancedProviderProtocol, string> = {
  'openai-compatible': 'OpenAI 兼容',
  modelscope: 'ModelScope',
  volcengine: '火山引擎',
  comfyui: '本地 ComfyUI',
  'jimeng-cli': '即梦 CLI',
};

const ADVANCED_PROVIDER_GUIDES: Record<AdvancedProviderProtocol, {
  subtitle: string;
  description: string;
  nodeScopes: string[];
  connectionHint: string;
  modelHint: string;
  baseUrlPlaceholder?: string;
  keyLabel?: string;
}> = {
  'openai-compatible': {
    subtitle: '接入兼容 OpenAI 格式的图像 / 视频 / LLM 服务',
    description: '适合接入你自己的中转站、One API、New API 或其他兼容 /v1/chat/completions、/v1/images/generations、/v1/videos/generations 的服务。',
    nodeScopes: ['图像节点', '视频节点', 'LLM 节点'],
    connectionHint: 'Base URL 填到 /v1 这一层，例如 https://api.example.com/v1；Key 留空会保留后端已保存的密钥。',
    modelHint: '每行一个模型名。只填你确实要在节点里选择的模型，空白时会使用内置兜底示例。',
    baseUrlPlaceholder: 'https://api.example.com/v1',
    keyLabel: 'API Key / Token',
  },
  modelscope: {
    subtitle: '接入 ModelScope 的异步图像任务与兼容聊天接口',
    description: '适合把 ModelScope 上的图像模型加入图像节点，也可以给 LLM 节点填入可用的聊天模型。',
    nodeScopes: ['图像节点', 'LLM 节点'],
    connectionHint: 'Base URL 通常使用 ModelScope API 地址；Token 填 ModelScope 访问令牌。',
    modelHint: '图像模型建议填写 ModelScope 模型 ID，例如 owner/model-name；聊天模型按平台实际模型名填写。',
    baseUrlPlaceholder: 'https://api-inference.modelscope.cn/v1',
    keyLabel: 'ModelScope Token',
  },
  volcengine: {
    subtitle: '接入火山方舟 / Seedream / Seedance',
    description: '适合用火山引擎做 Seedream 图像、Seedance 视频或方舟聊天模型。只在节点里选择高级来源时才会走这里。',
    nodeScopes: ['图像节点', '视频节点', 'LLM 节点'],
    connectionHint: 'Base URL 填火山方舟 API 地址；常规生成使用 API Key，素材上传能力可补充 AK/SK。',
    modelHint: '图像、视频、聊天模型分别按火山控制台里的模型接入点填写，每行一个。',
    baseUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
    keyLabel: '火山 API Key',
  },
  comfyui: {
    subtitle: '接入本机 ComfyUI 工作流',
    description: '适合把本机 ComfyUI 的 API Workflow 接到图像节点。为安全起见这里只允许本机地址。',
    nodeScopes: ['图像节点'],
    connectionHint: '实例地址填本机 ComfyUI，例如 http://127.0.0.1:8188。多个实例可一行一个。',
    modelHint: '图像节点里选择的是工作流 ID/名称，不需要填写模型列表。',
    baseUrlPlaceholder: 'http://127.0.0.1:8188',
  },
  'jimeng-cli': {
    subtitle: '通过本地 dreamina / 即梦 CLI 调用图像和视频',
    description: '适合已经在本机配置好即梦 CLI 的用户。它不走 API Key，而是调用本地命令并轮询任务结果。',
    nodeScopes: ['图像节点', '视频节点', 'SD2.0 节点'],
    connectionHint: '填写 dreamina 可执行文件路径；如果 CLI 装在 WSL 里，再打开 WSL 并填写发行版名称。',
    modelHint: '模型名按 CLI 支持的命令参数填写，例如 seedance2.0fast_vip。每行一个。',
  },
};

const MODELSCOPE_TOKEN_URLS = {
  cn: 'https://www.modelscope.cn/my/access/token',
  intl: 'https://www.modelscope.ai/my/access/token',
} as const;

const JIMENG_CLI_INSTALL_COMMAND = 'curl -s https://jimeng.jianying.com/cli | bash';

const CLOUD_UPLOAD_LABELS: Record<CloudUploadProvider, string> = {
  'tencent-cos': '腾讯云 COS',
  'aliyun-oss': '阿里云 OSS',
  'baidu-netdisk': '百度网盘',
  'quark-netdisk': '夸克网盘',
};

const CLOUD_UPLOAD_GUIDES: Record<CloudUploadProvider, {
  subtitle: string;
  description: string;
  status: string;
}> = {
  'tencent-cos': {
    subtitle: '适合把生成素材归档到腾讯云对象存储，支持真实上传。',
    description: '填写 Bucket、Region、SecretId 和 SecretKey；公共域名可选，留空时返回 COS 默认对象 URL。',
    status: '已支持上传',
  },
  'aliyun-oss': {
    subtitle: '适合把生成素材归档到阿里云对象存储，支持真实上传。',
    description: '填写 Bucket、Endpoint、AccessKeyId 和 AccessKeySecret；公共域名可选，留空时返回 OSS 默认对象 URL。',
    status: '已支持上传',
  },
  'baidu-netdisk': {
    subtitle: '保留百度网盘配置位，等待稳定 OAuth / PCS 上传方案接入。',
    description: '后续会优先接入正式授权流程，避免让用户手填不稳定 Cookie 或抓包字段。',
    status: '规划中',
  },
  'quark-netdisk': {
    subtitle: '保留夸克网盘配置位，等待稳定 CLI / 授权方案接入。',
    description: '后续若接入外部 CLI，会在这里填写命令路径并统一走同一个右键上传入口。',
    status: '实验位',
  },
};

function summarizeCloudUploadForm(targets: CloudUploadTargetConfig[]) {
  const normalized = Array.isArray(targets) ? targets : [];
  const configuredCount = normalized.filter((target) => {
    if (target.provider === 'tencent-cos') {
      return !!(target.tencentCos?.bucket && target.tencentCos?.region && (target.tencentCos?.secretId || target.tencentCos?.hasSecretId) && (target.tencentCos?.secretKey || target.tencentCos?.hasSecretKey));
    }
    if (target.provider === 'aliyun-oss') {
      return !!(target.aliyunOss?.bucket && target.aliyunOss?.endpoint && (target.aliyunOss?.accessKeyId || target.aliyunOss?.hasAccessKeyId) && (target.aliyunOss?.accessKeySecret || target.aliyunOss?.hasAccessKeySecret));
    }
    if (target.provider === 'baidu-netdisk') {
      return !!(target.baiduNetdisk?.accessToken || target.baiduNetdisk?.hasAccessToken || target.baiduNetdisk?.refreshToken || target.baiduNetdisk?.hasRefreshToken);
    }
    if (target.provider === 'quark-netdisk') {
      return !!(target.quarkNetdisk?.commandPath || target.quarkNetdisk?.cookie || target.quarkNetdisk?.hasCookie);
    }
    return false;
  }).length;
  const defaultTarget = normalized.find((target) => target.isDefault) || normalized.find((target) => target.enabled) || null;
  return {
    totalCount: normalized.length,
    enabledCount: normalized.filter((target) => target.enabled).length,
    configuredCount,
    defaultLabel: defaultTarget?.label || '',
  };
}

function tryParseJsonObject(raw: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

interface AdvancedProviderFormBlockProps {
  title: string;
  note?: string;
  className: string;
  labelClassName: string;
  hintClassName: string;
  children: ReactNode;
}

function AdvancedProviderFormBlock({
  title,
  note,
  className,
  labelClassName,
  hintClassName,
  children,
}: AdvancedProviderFormBlockProps) {
  return (
    <section className={className}>
      <div className="space-y-1">
        <div className={`text-xs font-black ${labelClassName}`}>{title}</div>
        {note && <p className={`text-[11px] leading-relaxed ${hintClassName}`}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

const emptyMap = (): Record<KeyField, string> => ({
  zhenzhenApiKey: '', rhApiKey: '', llmApiKey: '',
  gptImageApiKey: '', nanoBananaApiKey: '', mjApiKey: '', veoApiKey: '',
  grokApiKey: '', seedanceApiKey: '', sunoApiKey: '',
});
const emptyShow = (): Record<KeyField, boolean> => ({
  zhenzhenApiKey: false, rhApiKey: false, llmApiKey: false,
  gptImageApiKey: false, nanoBananaApiKey: false, mjApiKey: false, veoApiKey: false,
  grokApiKey: false, seedanceApiKey: false, sunoApiKey: false,
});

export default function ApiSettingsModal({ open, onClose }: ApiSettingsModalProps) {
  const { theme, style } = useThemeStore();
  const { settings, loading, error, load, save, loaded } = useApiKeysStore();
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';

  const [inputs, setInputs] = useState<Record<KeyField, string>>(emptyMap());
  const [shows, setShows] = useState<Record<KeyField, boolean>>(emptyShow());
  const [saved, setSaved] = useState(false);
  // v1.2.10.2: 文件自动保存路径输入
  const [fileSavePathInput, setFileSavePathInput] = useState<string>('');
  // v1.3.1: 画布自动保存路径输入
  const [canvasAutoSavePathInput, setCanvasAutoSavePathInput] = useState<string>('');
  // v1.3.4: 资源库路径输入
  const [resourceLibraryPathInput, setResourceLibraryPathInput] = useState<string>('');
  // v1.3.6: 主题模板路径输入
  const [themeTemplatePathInput, setThemeTemplatePathInput] = useState<string>('');
  // 本地 Eagle API 地址
  const [eagleApiBaseInput, setEagleApiBaseInput] = useState<string>('');
  // 分类独立 Key 区块折叠状态（新手友好：默认折叠，点击展开）
  const [classifiedOpen, setClassifiedOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedProvidersInput, setAdvancedProvidersInput] = useState<AdvancedProviderConfig[]>([]);
  const [activeAdvancedProviderId, setActiveAdvancedProviderId] = useState<string>('');
  const [advancedDirty, setAdvancedDirty] = useState(false);
  const [advancedTestStatus, setAdvancedTestStatus] = useState<Record<string, { loading?: boolean; ok?: boolean; message?: string }>>({});
  const [advancedComfyDrafts, setAdvancedComfyDrafts] = useState<Record<string, { workflowJson?: string; fields?: string; excludeRules?: string }>>({});
  const [cloudUploadOpen, setCloudUploadOpen] = useState(false);
  const [cloudUploadTargetsInput, setCloudUploadTargetsInput] = useState<CloudUploadTargetConfig[]>([]);
  const [activeCloudTargetId, setActiveCloudTargetId] = useState<string>('');
  const [cloudUploadDirty, setCloudUploadDirty] = useState(false);
  const [cloudTestStatus, setCloudTestStatus] = useState<Record<string, { loading?: boolean; ok?: boolean; message?: string }>>({});
  const [backupMessage, setBackupMessage] = useState<string>('');
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  // 眼睛预览拉取的明文（仅缓存，不提交）
  const revealedRef = useRef<Partial<Record<KeyField, string>>>({});

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  // 重置表单(脱敏 Key 不直接填充,留空则保持后端原值)
  useEffect(() => {
    if (open) {
      setInputs(emptyMap());
      setShows(emptyShow());
      revealedRef.current = {};
      setSaved(false);
      setBackupMessage('');
      setClassifiedOpen(false);
      setAdvancedOpen(false);
      const providers = Array.isArray((settings as any)?.advancedProviders)
        ? ((settings as any).advancedProviders as AdvancedProviderConfig[])
        : [];
      setAdvancedProvidersInput(providers);
      setActiveAdvancedProviderId(providers[0]?.id || '');
      setAdvancedDirty(false);
      setAdvancedTestStatus({});
      setAdvancedComfyDrafts({});
      setCloudUploadOpen(false);
      const cloudTargets = Array.isArray((settings as any)?.cloudUploadTargets)
        ? ((settings as any).cloudUploadTargets as CloudUploadTargetConfig[])
        : [];
      setCloudUploadTargetsInput(cloudTargets);
      setActiveCloudTargetId(cloudTargets[0]?.id || '');
      setCloudUploadDirty(false);
      setCloudTestStatus({});
      // 回填文件自动保存路径(明文字段，不脱敏)
      setFileSavePathInput((settings as any)?.fileSavePath || '');
      setCanvasAutoSavePathInput((settings as any)?.canvasAutoSavePath || '');
      setResourceLibraryPathInput((settings as any)?.resourceLibraryPath || '');
      setThemeTemplatePathInput((settings as any)?.themeTemplatePath || '');
      setEagleApiBaseInput((settings as any)?.eagleApiBase || '');
    }
  }, [open, settings]);

  if (!open) return null;

  const setInputAt = (f: KeyField, v: string) => {
    setInputs((prev) => ({ ...prev, [f]: v }));
  };

  const getCurrentEditableSettings = (): Partial<ApiSettings> => ({
    zhenzhenApiKey: inputs.zhenzhenApiKey.trim(),
    rhApiKey: inputs.rhApiKey.trim(),
    llmApiKey: inputs.llmApiKey.trim(),
    gptImageApiKey: inputs.gptImageApiKey.trim(),
    nanoBananaApiKey: inputs.nanoBananaApiKey.trim(),
    mjApiKey: inputs.mjApiKey.trim(),
    veoApiKey: inputs.veoApiKey.trim(),
    grokApiKey: inputs.grokApiKey.trim(),
    seedanceApiKey: inputs.seedanceApiKey.trim(),
    sunoApiKey: inputs.sunoApiKey.trim(),
    fileSavePath: fileSavePathInput.trim(),
    canvasAutoSavePath: canvasAutoSavePathInput.trim(),
    resourceLibraryPath: resourceLibraryPathInput.trim(),
    themeTemplatePath: themeTemplatePathInput.trim(),
    eagleApiBase: eagleApiBaseInput.trim(),
    ...(advancedDirty ? { advancedProviders: advancedProvidersInput } : {}),
    ...(cloudUploadDirty ? { cloudUploadTargets: cloudUploadTargetsInput } : {}),
  });

  const isMaskedKeyValue = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    return /^\*{2,}/.test(value.trim());
  };

  const normalizeImportedSettings = (raw: unknown): Partial<ApiSettings> => {
    const source = raw && typeof raw === 'object' && 'settings' in raw
      ? (raw as any).settings
      : raw;
    if (!source || typeof source !== 'object') {
      throw new Error('设置备份格式不正确');
    }
    const next: Partial<ApiSettings> = {};
    for (const field of ALL_FIELDS) {
      const value = (source as any)[field];
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed || isMaskedKeyValue(trimmed)) continue;
      (next as any)[field] = trimmed;
    }
    for (const field of PATH_FIELDS) {
      const value = (source as any)[field];
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      (next as any)[field] = trimmed;
    }
    if ((source as any).preferences && typeof (source as any).preferences === 'object') {
      next.preferences = { ...(source as any).preferences };
    }
    if (Array.isArray((source as any).advancedProviders)) {
      next.advancedProviders = (source as any).advancedProviders;
    }
    if (Array.isArray((source as any).cloudUploadTargets)) {
      next.cloudUploadTargets = (source as any).cloudUploadTargets;
    }
    return next;
  };

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportSettings = async () => {
    try {
      let raw: ApiSettings | null = null;
      try {
        raw = await getRawSettings();
      } catch {
        raw = null;
      }
      const editable = getCurrentEditableSettings();
      const exportSettings = {
        ...(raw || {}),
        ...Object.fromEntries(
          Object.entries(editable).filter(([, value]) => typeof value === 'string' && value.trim())
        ),
        zhenzhenBaseUrl: FIXED_ZHENZHEN_BASE,
        llmBaseUrl: FIXED_ZHENZHEN_BASE,
        rhBaseUrl: RH_BASE,
      };
      const payload = {
        schema: SETTINGS_BACKUP_SCHEMA,
        version: SETTINGS_BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        containsSecrets: true,
        note: '此文件包含明文 API Key，请勿上传到 GitHub 或公开分享。',
        settings: exportSettings,
      };
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadJson(`t8-settings-backup-${date}.json`, payload);
      setBackupMessage('已导出设置备份。注意：文件包含明文 API Key，请妥善保管。');
    } catch (e: any) {
      setBackupMessage(e?.message || '导出设置失败');
    }
  };

  const applyImportedSettings = (patch: Partial<ApiSettings>) => {
    setInputs((prev) => {
      const nextInputs = { ...prev };
      for (const field of ALL_FIELDS) {
        const value = (patch as any)[field];
        if (typeof value === 'string' && value.trim()) nextInputs[field] = value.trim();
      }
      return nextInputs;
    });
    setShows(emptyShow());
    revealedRef.current = {};
    if (typeof patch.fileSavePath === 'string') setFileSavePathInput(patch.fileSavePath);
    if (typeof patch.canvasAutoSavePath === 'string') setCanvasAutoSavePathInput(patch.canvasAutoSavePath);
    if (typeof patch.resourceLibraryPath === 'string') setResourceLibraryPathInput(patch.resourceLibraryPath);
    if (typeof patch.themeTemplatePath === 'string') setThemeTemplatePathInput(patch.themeTemplatePath);
    if (typeof patch.eagleApiBase === 'string') setEagleApiBaseInput(patch.eagleApiBase);
    if (Array.isArray(patch.advancedProviders)) {
      setAdvancedProvidersInput(patch.advancedProviders);
      setActiveAdvancedProviderId(patch.advancedProviders[0]?.id || '');
      setAdvancedDirty(true);
      setAdvancedOpen(true);
    }
    if (Array.isArray((patch as any).cloudUploadTargets)) {
      const targets = (patch as any).cloudUploadTargets as CloudUploadTargetConfig[];
      setCloudUploadTargetsInput(targets);
      setActiveCloudTargetId(targets[0]?.id || '');
      setCloudUploadDirty(true);
      setCloudUploadOpen(true);
    }
    setClassifiedOpen(true);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const patch = normalizeImportedSettings(parsed);
      if (Object.keys(patch).length === 0) {
        setBackupMessage('未读取到可导入的设置，已跳过空值和脱敏 Key。');
        return;
      }
      applyImportedSettings(patch);
      setBackupMessage('已导入到表单，请检查后点击“保存”生效。');
    } catch (e: any) {
      setBackupMessage(e?.message || '导入设置失败，请确认 JSON 文件格式。');
    } finally {
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
    }
  };

  // 眼睛点击: 如果要切为“显示”且当前 input 为空但后端已存在 key,
  // 调 /api/settings/raw 拿明文填充。
  const handleToggleShow = async (f: KeyField) => {
    const newShow = !shows[f];
    if (newShow && !inputs[f].trim() && (settings as any)[f]) {
      try {
        if (!revealedRef.current || Object.keys(revealedRef.current).length === 0) {
          const raw = await getRawSettings();
          revealedRef.current = raw as any;
        }
      } catch {
        // 忽略拉取失败
      }
      const plain = (revealedRef.current as any)?.[f];
      if (plain) setInputAt(f, String(plain));
    }
    setShows((prev) => ({ ...prev, [f]: newShow }));
  };

  const handleSave = async () => {
    const patch: Partial<ApiSettings> = {};
    for (const f of ALL_FIELDS) {
      const v = inputs[f].trim();
      if (!v) continue;
      // 眼睛拉出明文未修改 → 跳过，不走一道上行请求
      const revealed = (revealedRef.current as any)?.[f];
      if (revealed && v === String(revealed)) continue;
      (patch as any)[f] = v;
    }
    // v1.2.10.2: 文件自动保存路径变动才上行
    const newPath = (fileSavePathInput || '').trim();
    const oldPath = (settings as any)?.fileSavePath || '';
    if (newPath && newPath !== oldPath) {
      (patch as any).fileSavePath = newPath;
    }
    const newCanvasPath = (canvasAutoSavePathInput || '').trim();
    const oldCanvasPath = (settings as any)?.canvasAutoSavePath || '';
    if (newCanvasPath && newCanvasPath !== oldCanvasPath) {
      (patch as any).canvasAutoSavePath = newCanvasPath;
    }
    const newResourcePath = (resourceLibraryPathInput || '').trim();
    const oldResourcePath = (settings as any)?.resourceLibraryPath || '';
    if (newResourcePath && newResourcePath !== oldResourcePath) {
      (patch as any).resourceLibraryPath = newResourcePath;
    }
    const newThemeTemplatePath = (themeTemplatePathInput || '').trim();
    const oldThemeTemplatePath = (settings as any)?.themeTemplatePath || '';
    if (newThemeTemplatePath && newThemeTemplatePath !== oldThemeTemplatePath) {
      (patch as any).themeTemplatePath = newThemeTemplatePath;
    }
    const newEagleApiBase = (eagleApiBaseInput || '').trim();
    const oldEagleApiBase = (settings as any)?.eagleApiBase || '';
    if (newEagleApiBase && newEagleApiBase !== oldEagleApiBase) {
      (patch as any).eagleApiBase = newEagleApiBase;
    }
    if (advancedDirty) {
      (patch as any).advancedProviders = advancedProvidersInput;
    }
    if (cloudUploadDirty) {
      (patch as any).cloudUploadTargets = cloudUploadTargetsInput;
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    await save(patch);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const inputCls = isPixel
    ? 't8-api-settings-input flex-1 px-3 py-2 rounded-[10px] text-sm outline-none px-input'
    : 't8-api-settings-input flex-1 px-3 py-2 rounded-md text-sm outline-none border';

  const labelCls = 't8-api-settings-label';
  const hintCls = 't8-api-settings-hint';
  const eyeBtnCls = isPixel
    ? 't8-api-settings-icon-btn px-btn px-btn--icon px-btn--ghost'
    : 't8-api-settings-icon-btn p-2 rounded-md';

  // 防御性脱敏：始终只显示尾4位（与之前 `****9zVR` 一致），
  // 即使后端意外返回明文也不会暴露完整 Key
  const toMaskedDisplay = (v?: string): string => {
    if (!v) return '';
    const s = String(v);
    // 后端已脱敏（****xxxx 形式）直接原样
    if (/^\*{2,}/.test(s)) return s;
    if (s.length <= 4) return '****';
    return '****' + s.slice(-4);
  };

  // 获取 APIKey 外部链接按钮样式（双主题）
  const linkBtnCls = isPixel
    ? 't8-api-settings-action-btn px-btn px-btn--mint flex items-center gap-1 text-[11px] px-2 py-1'
    : 't8-api-settings-action-btn flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition border';
  const linkBtnAltCls = isPixel
    ? 't8-api-settings-action-btn px-btn flex items-center gap-1 text-[11px] px-2 py-1'
    : 't8-api-settings-action-btn flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition border';

  const openExternal = (url: string) => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // 志忘
    }
  };

  // 每个字段费应的「获取 APIKey」按钮配置
  const renderGetKeyButtons = (field: KeyField) => {
    if (field === 'zhenzhenApiKey') {
      return (
        <button
          type="button"
          onClick={() => openExternal('https://ai.t8star.org/register?aff=dP7j')}
          className={linkBtnCls}
          title="前往贞贞工坊注册获取 APIKEY"
        >
          <ExternalLink size={11} /> 获取 APIKey
        </button>
      );
    }
    if (field === 'rhApiKey') {
      return (
        <>
          <button
            type="button"
            onClick={() => openExternal('https://www.runninghub.cn/user-center/1819214514410942465/webapp?inviteCode=rh-v1121')}
            className={linkBtnCls}
            title="国内用户·前往 runninghub.cn 获取 APIKEY"
          >
            <ExternalLink size={11} /> 获取 APIKey：国内用户
          </button>
          <button
            type="button"
            onClick={() => openExternal('https://www.runninghub.ai/user-center/1819214514410942465/webapp?inviteCode=rh-v1121')}
            className={linkBtnAltCls}
            title="国外用户·前往 runninghub.ai 获取 APIKEY"
          >
            <ExternalLink size={11} /> 国外用户
          </button>
        </>
      );
    }
    return null;
  };

  const advancedSummary = summarizeAdvancedProviderForm(advancedProvidersInput);
  const activeAdvancedProvider = advancedProvidersInput.find((provider) => provider.id === activeAdvancedProviderId)
    || advancedProvidersInput[0]
    || null;
  const cloudSummary = summarizeCloudUploadForm(cloudUploadTargetsInput);
  const activeCloudTarget = cloudUploadTargetsInput.find((target) => target.id === activeCloudTargetId)
    || cloudUploadTargetsInput[0]
    || null;

  const updateAdvancedProvider = (id: string, patch: Partial<AdvancedProviderConfig>) => {
    setAdvancedProvidersInput((prev) => prev.map((provider) => (
      provider.id === id ? { ...provider, ...patch } : provider
    )));
    setAdvancedDirty(true);
  };

  const updateAdvancedProviderNested = (
    id: string,
    key: 'modelscopeConfig' | 'volcengineConfig' | 'comfyuiConfig' | 'jimengConfig',
    patch: Record<string, any>,
  ) => {
    setAdvancedProvidersInput((prev) => prev.map((provider) => (
      provider.id === id
        ? { ...provider, [key]: { ...(provider as any)[key], ...patch } }
        : provider
    )));
    setAdvancedDirty(true);
  };

  const handleTestAdvancedProvider = async (provider: AdvancedProviderConfig) => {
    setAdvancedTestStatus((prev) => ({ ...prev, [provider.id]: { loading: true } }));
    try {
      const result = await testAdvancedProvider({ provider, dryRun: false });
      setAdvancedTestStatus((prev) => ({
        ...prev,
        [provider.id]: {
          ok: result.ok,
          message: result.ok ? (result.message || '连接可用') : (result.error || '测试失败'),
        },
      }));
    } catch (e: any) {
      setAdvancedTestStatus((prev) => ({
        ...prev,
        [provider.id]: { ok: false, message: e?.message || '测试失败' },
      }));
    }
  };

  const updateCloudTarget = (id: string, patch: Partial<CloudUploadTargetConfig>) => {
    setCloudUploadTargetsInput((prev) => prev.map((target) => (
      target.id === id ? { ...target, ...patch } : target
    )));
    setCloudUploadDirty(true);
  };

  const updateCloudTargetNested = (
    id: string,
    key: 'tencentCos' | 'aliyunOss' | 'baiduNetdisk' | 'quarkNetdisk',
    patch: Record<string, any>,
  ) => {
    setCloudUploadTargetsInput((prev) => prev.map((target) => (
      target.id === id
        ? { ...target, [key]: { ...(target as any)[key], ...patch } }
        : target
    )));
    setCloudUploadDirty(true);
  };

  const markCloudDefault = (id: string) => {
    setCloudUploadTargetsInput((prev) => prev.map((target) => ({ ...target, isDefault: target.id === id })));
    setCloudUploadDirty(true);
  };

  const handleTestCloudTarget = async (target: CloudUploadTargetConfig) => {
    setCloudTestStatus((prev) => ({ ...prev, [target.id]: { loading: true } }));
    try {
      const result = await testCloudUploadTarget({ target });
      setCloudTestStatus((prev) => ({
        ...prev,
        [target.id]: {
          ok: result.success ? result.data.ok : false,
          message: result.success
            ? (result.data.message || '配置可用')
            : (result.error || '配置检查失败'),
        },
      }));
    } catch (e: any) {
      setCloudTestStatus((prev) => ({
        ...prev,
        [target.id]: { ok: false, message: e?.message || '配置检查失败' },
      }));
    }
  };

  const renderCloudTargetForm = (target: CloudUploadTargetConfig) => {
    const providerLabel = CLOUD_UPLOAD_LABELS[target.provider] || target.provider;
    const guide = CLOUD_UPLOAD_GUIDES[target.provider];
    const sectionCls = isPixel
      ? 't8-api-settings-provider-panel border p-3 space-y-4 min-w-0'
      : 't8-api-settings-provider-panel border rounded-xl p-3 sm:p-4 space-y-4 min-w-0';
    const formBlockCls = isPixel
      ? 't8-api-settings-section border p-3 space-y-3'
      : 't8-api-settings-section rounded-lg border p-3 space-y-3';
    const fieldInputCls = `${inputCls.replace('flex-1 ', '')} w-full min-w-0`;
    const guideBoxCls = isPixel
      ? 't8-api-settings-guide border p-3 text-[11px] leading-relaxed'
      : 't8-api-settings-guide rounded-lg border p-3 text-[11px] leading-relaxed';
    const smallPillCls = isPixel
      ? 't8-api-settings-pill inline-flex items-center px-1.5 py-0.5 border text-[10px] font-bold'
      : 't8-api-settings-pill inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] font-semibold';
    const supported = target.provider === 'tencent-cos' || target.provider === 'aliyun-oss';
    const test = cloudTestStatus[target.id];
    return (
      <div className={sectionCls}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-black ${labelCls}`}>{target.label || providerLabel}</span>
              <span className={smallPillCls}>{providerLabel}</span>
              <span className={target.enabled ? 'text-[11px] font-bold text-emerald-500' : `text-[11px] font-bold ${hintCls}`}>
                {target.enabled ? '已启用' : '未启用'}
              </span>
              <span className={supported ? 'text-[11px] font-bold text-emerald-500' : `text-[11px] font-bold ${hintCls}`}>
                {guide?.status}
              </span>
            </div>
            <p className={`mt-1 text-[11px] leading-relaxed ${hintCls}`}>{guide?.subtitle}</p>
          </div>
          <label className={`flex items-center gap-2 text-xs font-bold shrink-0 ${labelCls}`}>
            <input
              type="checkbox"
              checked={!!target.enabled}
              onChange={(e) => updateCloudTarget(target.id, { enabled: e.target.checked })}
            />
            右键菜单显示
          </label>
          <label className={`flex items-center gap-2 text-xs font-bold shrink-0 ${labelCls}`}>
            <input
              type="radio"
              checked={!!target.isDefault}
              onChange={() => markCloudDefault(target.id)}
            />
            默认目标
          </label>
          <button
            type="button"
            onClick={() => handleTestCloudTarget(target)}
            disabled={!!test?.loading}
            className={
              isPixel
                ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 shrink-0'
                : 't8-api-settings-secondary-btn px-2 py-1 text-[11px] rounded border shrink-0 inline-flex items-center gap-1'
            }
          >
            <TestTube2 size={12} />
            {test?.loading ? '检查中...' : '配置检查'}
          </button>
        </div>

        {test?.message && (
          <div className={test.ok ? 'text-[11px] text-emerald-500' : 'text-[11px] text-red-400'}>
            {test.message}
          </div>
        )}

        <div className={guideBoxCls}>
          <div className="flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold">这是什么？</div>
              <p>{guide?.description}</p>
              <p className={`mt-2 ${hintCls}`}>
                右键上传只复制一份外部副本，不会改动画布节点、资源库文件或本地自动保存结果。
              </p>
            </div>
          </div>
        </div>

        <AdvancedProviderFormBlock
          className={formBlockCls}
          labelClassName={labelCls}
          hintClassName={hintCls}
          title="1. 基础信息"
          note="显示名称会出现在素材右键菜单中；路径前缀支持 {kind}、{yyyy-mm}、{date}，例如 t8-canvas/{kind}/{yyyy-mm}。"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={`text-[11px] ${labelCls}`}>显示名称</span>
              <input
                value={target.label || ''}
                onChange={(e) => updateCloudTarget(target.id, { label: e.target.value })}
                className={fieldInputCls}
                placeholder={providerLabel}
              />
            </label>
            <label className="space-y-1">
              <span className={`text-[11px] ${labelCls}`}>路径前缀</span>
              <input
                value={target.prefix || ''}
                onChange={(e) => updateCloudTarget(target.id, { prefix: e.target.value })}
                className={fieldInputCls}
                placeholder="t8-canvas/{kind}/{yyyy-mm}"
              />
            </label>
            {supported && (
              <label className="space-y-1 lg:col-span-2">
                <span className={`text-[11px] ${labelCls}`}>公共域名（可选）</span>
                <input
                  value={target.publicBaseUrl || ''}
                  onChange={(e) => updateCloudTarget(target.id, { publicBaseUrl: e.target.value })}
                  className={fieldInputCls}
                  placeholder="https://cdn.example.com/path · 留空返回默认对象 URL"
                />
              </label>
            )}
          </div>
        </AdvancedProviderFormBlock>

        {target.provider === 'tencent-cos' && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="2. 腾讯云 COS"
            note="SecretId / SecretKey 留空或保留 **** 表示不覆盖后端已保存密钥。"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>Bucket</span>
                <input
                  value={target.tencentCos?.bucket || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'tencentCos', { bucket: e.target.value })}
                  className={fieldInputCls}
                  placeholder="example-1250000000"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>Region</span>
                <input
                  value={target.tencentCos?.region || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'tencentCos', { region: e.target.value })}
                  className={fieldInputCls}
                  placeholder="ap-guangzhou"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>SecretId</span>
                <input
                  type="password"
                  value={target.tencentCos?.secretId || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'tencentCos', { secretId: e.target.value })}
                  className={fieldInputCls}
                  placeholder={target.tencentCos?.hasSecretId ? '留空保持不变' : '请输入 SecretId'}
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>SecretKey</span>
                <input
                  type="password"
                  value={target.tencentCos?.secretKey || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'tencentCos', { secretKey: e.target.value })}
                  className={fieldInputCls}
                  placeholder={target.tencentCos?.hasSecretKey ? '留空保持不变' : '请输入 SecretKey'}
                />
              </label>
            </div>
          </AdvancedProviderFormBlock>
        )}

        {target.provider === 'aliyun-oss' && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="2. 阿里云 OSS"
            note="Endpoint 可以填 oss-cn-hangzhou.aliyuncs.com 或完整 https 地址；保存时会统一清洗。"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>Bucket</span>
                <input
                  value={target.aliyunOss?.bucket || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'aliyunOss', { bucket: e.target.value })}
                  className={fieldInputCls}
                  placeholder="example-bucket"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>Endpoint</span>
                <input
                  value={target.aliyunOss?.endpoint || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'aliyunOss', { endpoint: e.target.value })}
                  className={fieldInputCls}
                  placeholder="oss-cn-hangzhou.aliyuncs.com"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>AccessKeyId</span>
                <input
                  type="password"
                  value={target.aliyunOss?.accessKeyId || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'aliyunOss', { accessKeyId: e.target.value })}
                  className={fieldInputCls}
                  placeholder={target.aliyunOss?.hasAccessKeyId ? '留空保持不变' : '请输入 AccessKeyId'}
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>AccessKeySecret</span>
                <input
                  type="password"
                  value={target.aliyunOss?.accessKeySecret || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'aliyunOss', { accessKeySecret: e.target.value })}
                  className={fieldInputCls}
                  placeholder={target.aliyunOss?.hasAccessKeySecret ? '留空保持不变' : '请输入 AccessKeySecret'}
                />
              </label>
            </div>
          </AdvancedProviderFormBlock>
        )}

        {target.provider === 'baidu-netdisk' && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="2. 百度网盘（预留）"
            note="第一版不执行真实上传，字段用于后续 OAuth / PCS 接入时平滑迁移。"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="space-y-1 lg:col-span-2">
                <span className={`text-[11px] ${labelCls}`}>网盘目录</span>
                <input
                  value={target.baiduNetdisk?.folder || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'baiduNetdisk', { folder: e.target.value })}
                  className={fieldInputCls}
                  placeholder="/apps/T8PenguinCanvas"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>Access Token</span>
                <input
                  type="password"
                  value={target.baiduNetdisk?.accessToken || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'baiduNetdisk', { accessToken: e.target.value })}
                  className={fieldInputCls}
                  placeholder={target.baiduNetdisk?.hasAccessToken ? '留空保持不变' : '后续接入时使用'}
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>Refresh Token</span>
                <input
                  type="password"
                  value={target.baiduNetdisk?.refreshToken || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'baiduNetdisk', { refreshToken: e.target.value })}
                  className={fieldInputCls}
                  placeholder={target.baiduNetdisk?.hasRefreshToken ? '留空保持不变' : '后续接入时使用'}
                />
              </label>
            </div>
          </AdvancedProviderFormBlock>
        )}

        {target.provider === 'quark-netdisk' && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="2. 夸克网盘（预留）"
            note="第一版不执行真实上传，字段用于后续稳定 CLI / 授权方案接入。"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>网盘目录</span>
                <input
                  value={target.quarkNetdisk?.folder || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'quarkNetdisk', { folder: e.target.value })}
                  className={fieldInputCls}
                  placeholder="/T8PenguinCanvas"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>外部命令路径</span>
                <input
                  value={target.quarkNetdisk?.commandPath || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'quarkNetdisk', { commandPath: e.target.value })}
                  className={fieldInputCls}
                  placeholder="后续 CLI 接入时使用"
                />
              </label>
              <label className="space-y-1 lg:col-span-2">
                <span className={`text-[11px] ${labelCls}`}>Cookie / 授权信息（不推荐长期依赖）</span>
                <input
                  type="password"
                  value={target.quarkNetdisk?.cookie || ''}
                  onChange={(e) => updateCloudTargetNested(target.id, 'quarkNetdisk', { cookie: e.target.value })}
                  className={fieldInputCls}
                  placeholder={target.quarkNetdisk?.hasCookie ? '留空保持不变' : '等待稳定方案后再填写'}
                />
              </label>
            </div>
          </AdvancedProviderFormBlock>
        )}
      </div>
    );
  };

  const renderAdvancedProviderForm = (provider: AdvancedProviderConfig) => {
    const protocolLabel = ADVANCED_PROVIDER_LABELS[provider.protocol] || provider.protocol;
    const guide = ADVANCED_PROVIDER_GUIDES[provider.protocol];
    const isComfy = provider.protocol === 'comfyui';
    const isJimeng = provider.protocol === 'jimeng-cli';
    const isVolc = provider.protocol === 'volcengine';
    const isModelScope = provider.protocol === 'modelscope';
    const sectionCls = isPixel
      ? 't8-api-settings-provider-panel border p-3 space-y-4 min-w-0'
      : 't8-api-settings-provider-panel border rounded-xl p-3 sm:p-4 space-y-4 min-w-0';
    const formBlockCls = isPixel
      ? 't8-api-settings-section border p-3 space-y-3'
      : 't8-api-settings-section rounded-lg border p-3 space-y-3';
    const fieldInputCls = `${inputCls.replace('flex-1 ', '')} w-full min-w-0`;
    const textareaCls = `${fieldInputCls} min-h-[76px] resize-y font-mono text-xs leading-relaxed`;
    const guideBoxCls = isPixel
      ? 't8-api-settings-guide border p-3 text-[11px] leading-relaxed'
      : 't8-api-settings-guide rounded-lg border p-3 text-[11px] leading-relaxed';
    const smallPillCls = isPixel
      ? 't8-api-settings-pill inline-flex items-center px-1.5 py-0.5 border text-[10px] font-bold'
      : 't8-api-settings-pill inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] font-semibold';
    const comfyWorkflow = (provider.comfyuiConfig?.workflows?.[0] || { id: 'workflow-1', name: '默认工作流' }) as NonNullable<NonNullable<AdvancedProviderConfig['comfyuiConfig']>['workflows']>[number];
    const comfyDraft = advancedComfyDrafts[provider.id] || {};
    const comfyWorkflowRaw = comfyDraft.workflowJson ?? (comfyWorkflow.workflowJson ? JSON.stringify(comfyWorkflow.workflowJson, null, 2) : '');
    const comfyWorkflowObject = tryParseJsonObject(comfyWorkflowRaw);
    const comfyWorkflowSource = comfyWorkflowObject || comfyWorkflow.workflowJson || null;
    const comfyAnalysis = analyzeComfyWorkflow(comfyWorkflowSource);
    const comfyExcludeRulesRaw = comfyDraft.excludeRules ?? parseComfyFieldExcludeRules((comfyWorkflow as any).excludeRules).join('\n');
    const comfyExcludeRules = parseComfyFieldExcludeRules(comfyExcludeRulesRaw);
    const comfyFilteredAnalysisFields = filterComfyFieldsByExcludeRules(comfyWorkflowSource, comfyAnalysis.fields, comfyExcludeRules);
    const comfyExcludedFieldCount = Math.max(0, comfyAnalysis.fields.length - comfyFilteredAnalysisFields.length);
    const comfyBaseMappedFields = (Array.isArray(comfyWorkflow.fields) && comfyWorkflow.fields.length
      ? comfyWorkflow.fields
      : comfyFilteredAnalysisFields) as ComfyFieldMapping[];
    const comfyMappedFields = canonicalizeComfyFieldsByWorkflow(
      comfyWorkflowSource,
      filterComfyFieldsByExcludeRules(comfyWorkflowSource, comfyBaseMappedFields, comfyExcludeRules),
    );
    const setComfyDraft = (patch: { workflowJson?: string; fields?: string; excludeRules?: string }) => {
      setAdvancedComfyDrafts((prev) => ({ ...prev, [provider.id]: { ...(prev[provider.id] || {}), ...patch } }));
    };
    const updateComfyWorkflow = (patch: Record<string, any>) => {
      updateAdvancedProviderNested(provider.id, 'comfyuiConfig', {
        workflows: [{ ...comfyWorkflow, ...patch }],
      });
    };
    const updateComfyWorkflowJson = (raw: string) => {
      setComfyDraft({ workflowJson: raw });
      try {
        const workflowJson = JSON.parse(raw);
        const analysis = analyzeComfyWorkflow(workflowJson);
        const nextFields = canonicalizeComfyFieldsByWorkflow(
          workflowJson,
          filterComfyFieldsByExcludeRules(workflowJson, analysis.fields, comfyExcludeRules),
        );
        updateComfyWorkflow({
          workflowJson,
          ...(nextFields.length ? { fields: nextFields } : {}),
        });
        if (nextFields.length) setComfyDraft({ fields: JSON.stringify(nextFields, null, 2) });
        setAdvancedTestStatus((prev) => ({
          ...prev,
          [provider.id]: {
            ok: true,
            message: nextFields.length
              ? `工作流已解析，自动识别 ${nextFields.length} 个输入字段`
              : '工作流 JSON 已解析，但未自动识别到常用输入字段',
          },
        }));
      } catch {
        setAdvancedTestStatus((prev) => ({ ...prev, [provider.id]: { ok: false, message: '工作流 JSON 格式不正确，修正后会自动保存' } }));
      }
    };
    const updateComfyExcludeRules = (raw: string) => {
      setComfyDraft({ excludeRules: raw });
      const excludeRules = parseComfyFieldExcludeRules(raw);
      const workflowJson = comfyWorkflowSource;
      const currentFields = comfyAnalysis.fields.length
        ? comfyAnalysis.fields
        : (Array.isArray(comfyWorkflow.fields) ? comfyWorkflow.fields : []);
      const fields = canonicalizeComfyFieldsByWorkflow(
        workflowJson,
        filterComfyFieldsByExcludeRules(workflowJson, currentFields as ComfyFieldMapping[], excludeRules),
      );
      updateComfyWorkflow({ excludeRules, fields });
      setComfyDraft({ fields: JSON.stringify(fields, null, 2) });
      setAdvancedTestStatus((prev) => ({
        ...prev,
        [provider.id]: {
          ok: true,
          message: excludeRules.length
            ? `已设置 ${excludeRules.length} 条排除规则，当前映射保留 ${fields.length} 个字段`
            : `已清空排除规则，当前映射保留 ${fields.length} 个字段`,
        },
      }));
    };
    const appendComfyExcludeRules = (items: string[]) => {
      updateComfyExcludeRules([...parseComfyFieldExcludeRules(comfyExcludeRulesRaw), ...items].join('\n'));
    };
    const handleComfyWorkflowFile = (file: File) => {
      const reader = new FileReader();
      reader.onload = () => updateComfyWorkflowJson(String(reader.result || ''));
      reader.onerror = () => setAdvancedTestStatus((prev) => ({
        ...prev,
        [provider.id]: { ok: false, message: '读取 workflow JSON 文件失败' },
      }));
      reader.readAsText(file, 'utf-8');
    };
    const updateComfyFields = (raw: string) => {
      setComfyDraft({ fields: raw });
      try {
        const parsed = JSON.parse(raw || '[]');
        if (!Array.isArray(parsed)) throw new Error('fields must be array');
        const workflowJson = comfyWorkflowSource;
        const fields = canonicalizeComfyFieldsByWorkflow(
          workflowJson,
          filterComfyFieldsByExcludeRules(workflowJson, parsed as ComfyFieldMapping[], comfyExcludeRules),
        );
        updateComfyWorkflow({ fields });
        setAdvancedTestStatus((prev) => ({ ...prev, [provider.id]: { ok: true, message: '参数映射已解析' } }));
      } catch {
        setAdvancedTestStatus((prev) => ({ ...prev, [provider.id]: { ok: false, message: '参数映射 JSON 需要是数组' } }));
      }
    };
    const applyComfyAutoMapping = () => {
      const workflowJson = comfyWorkflowSource;
      const analysis = analyzeComfyWorkflow(workflowJson || null);
      const fields = canonicalizeComfyFieldsByWorkflow(
        workflowJson || null,
        filterComfyFieldsByExcludeRules(workflowJson || null, analysis.fields, comfyExcludeRules),
      );
      updateComfyWorkflow({ fields });
      setComfyDraft({ fields: JSON.stringify(fields, null, 2) });
      setAdvancedTestStatus((prev) => ({
        ...prev,
        [provider.id]: {
          ok: fields.length > 0,
          message: fields.length
            ? `已应用自动映射：${fields.length} 个字段${comfyExcludeRules.length ? `，已按规则排除 ${analysis.fields.length - fields.length} 个` : ''}`
            : '没有识别到可自动映射的字段',
        },
      }));
    };
    const updateComfyField = (index: number, patch: Partial<ComfyFieldMapping>) => {
      const nextFields = canonicalizeComfyFieldsByWorkflow(
        comfyWorkflowSource,
        filterComfyFieldsByExcludeRules(
          comfyWorkflowSource,
          comfyMappedFields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
          comfyExcludeRules,
        ),
      );
      updateComfyWorkflow({ fields: nextFields });
      setComfyDraft({ fields: JSON.stringify(nextFields, null, 2) });
    };
    const removeComfyField = (index: number) => {
      const nextFields = comfyMappedFields.filter((_, i) => i !== index);
      updateComfyWorkflow({ fields: nextFields });
      setComfyDraft({ fields: JSON.stringify(nextFields, null, 2) });
    };
    const modelscopeLoras = Array.isArray(provider.modelscopeConfig?.loras) ? provider.modelscopeConfig.loras : [];
    const setModelscopeLoras = (loras: any[]) => {
      updateAdvancedProviderNested(provider.id, 'modelscopeConfig', {
        defaultsVersion: provider.modelscopeConfig?.defaultsVersion,
        loras,
      });
    };
    const modelscopeTargetOptions = (selected?: string) => {
      const out: string[] = [];
      for (const value of [
        selected,
        ...(Array.isArray(provider.imageModels) ? provider.imageModels : []),
        'Tongyi-MAI/Z-Image-Turbo',
        'Qwen/Qwen-Image-2512',
        'Qwen/Qwen-Image-Edit-2511',
        'black-forest-labs/FLUX.2-klein-9B',
      ]) {
        const item = String(value || '').trim();
        if (item && !out.includes(item)) out.push(item);
      }
      return out;
    };
    const addModelscopeLora = () => {
      setModelscopeLoras([
        ...modelscopeLoras,
        {
          id: '',
          name: '',
          targetModel: modelscopeTargetOptions()[0] || 'Tongyi-MAI/Z-Image-Turbo',
          strength: 0.8,
          enabled: true,
          note: '',
        },
      ]);
    };
    const updateModelscopeLora = (index: number, patch: Record<string, any>) => {
      setModelscopeLoras(modelscopeLoras.map((lora, i) => (
        i === index
          ? {
            ...lora,
            ...patch,
            ...(Object.prototype.hasOwnProperty.call(patch, 'strength')
              ? { strength: normalizeModelscopeLoraStrength(patch.strength, 0.8) }
              : {}),
          }
          : lora
      )));
    };
    const removeModelscopeLora = (index: number) => {
      setModelscopeLoras(modelscopeLoras.filter((_, i) => i !== index));
    };
    const enabledModelscopeLoraCount = normalizeModelscopeLoras(modelscopeLoras).filter((lora) => lora.enabled !== false).length;
    return (
      <div className={sectionCls}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-black ${labelCls}`}>{provider.label || protocolLabel}</span>
              <span className={smallPillCls}>{protocolLabel}</span>
              <span className={provider.enabled ? 'text-[11px] font-bold text-emerald-500' : `text-[11px] font-bold ${hintCls}`}>
                {provider.enabled ? '已启用' : '未启用'}
              </span>
            </div>
            <p className={`mt-1 text-[11px] leading-relaxed ${hintCls}`}>{guide?.subtitle}</p>
          </div>
          <label className={`flex items-center gap-2 text-xs font-bold shrink-0 ${labelCls}`}>
            <input
              type="checkbox"
              checked={!!provider.enabled}
              onChange={(e) => updateAdvancedProvider(provider.id, { enabled: e.target.checked })}
            />
            在节点中显示
          </label>
          <button
            type="button"
            onClick={() => handleTestAdvancedProvider(provider)}
            disabled={!!advancedTestStatus[provider.id]?.loading}
            className={
              isPixel
                ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 shrink-0'
                : 't8-api-settings-secondary-btn px-2 py-1 text-[11px] rounded border shrink-0 inline-flex items-center gap-1'
            }
          >
            <TestTube2 size={12} />
            {advancedTestStatus[provider.id]?.loading ? '测试中...' : '测试连接'}
          </button>
        </div>

        {advancedTestStatus[provider.id]?.message && (
          <div
            className={
              advancedTestStatus[provider.id]?.ok
                ? 'text-[11px] text-emerald-500'
                : 'text-[11px] text-red-400'
            }
          >
            {advancedTestStatus[provider.id]?.message}
          </div>
        )}

        <div className={guideBoxCls}>
          <div className="flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold">这是什么？</div>
              <p>{guide?.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(guide?.nodeScopes || []).map((scope) => (
                  <span key={scope} className={smallPillCls}>{scope}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <AdvancedProviderFormBlock
          className={formBlockCls}
          labelClassName={labelCls}
          hintClassName={hintCls}
          title="1. 基础信息"
          note="显示名称只影响下拉菜单里的名字；关闭“在节点中显示”后，这个平台不会出现在图像 / 视频 / LLM 节点的高级来源里。"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={`text-[11px] ${labelCls}`}>显示名称</span>
              <input
                value={provider.label || ''}
                onChange={(e) => updateAdvancedProvider(provider.id, { label: e.target.value })}
                className={fieldInputCls}
                placeholder={protocolLabel}
              />
            </label>
            {!isJimeng && (
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>{isComfy ? '默认实例地址' : 'Base URL'}</span>
                <input
                  value={provider.baseUrl || ''}
                  onChange={(e) => updateAdvancedProvider(provider.id, { baseUrl: e.target.value })}
                  className={fieldInputCls}
                  placeholder={guide?.baseUrlPlaceholder || 'https://api.example.com/v1'}
                />
              </label>
            )}
          </div>
        </AdvancedProviderFormBlock>

        {!isComfy && !isJimeng && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="2. 连接密钥"
            note={guide?.connectionHint}
          >
            <label className="space-y-1 block">
              <span className={`text-[11px] ${labelCls}`}>{guide?.keyLabel || 'API Key / Token'}</span>
              <input
                type="password"
                value={provider.apiKey || ''}
                onChange={(e) => updateAdvancedProvider(provider.id, { apiKey: e.target.value })}
                className={fieldInputCls}
                placeholder={provider.hasApiKey || provider.apiKey ? '留空或保留 **** 表示不覆盖后端密钥' : '请输入 API Key'}
              />
            </label>
            {provider.protocol === 'modelscope' && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openExternal(MODELSCOPE_TOKEN_URLS.cn)}
                  className={linkBtnCls}
                  title="打开 ModelScope 国内站 Token 页面"
                >
                  <ExternalLink size={11} /> 获取 Token · 国内
                </button>
                <button
                  type="button"
                  onClick={() => openExternal(MODELSCOPE_TOKEN_URLS.intl)}
                  className={linkBtnAltCls}
                  title="打开 ModelScope 国际站 Token 页面"
                >
                  <ExternalLink size={11} /> 获取 Token · 国外
                </button>
              </div>
            )}
          </AdvancedProviderFormBlock>
        )}

        {isVolc && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="3. 火山高级项（可选）"
            note="普通 Ark / Seedream / Seedance 调用通常只需要上面的 API Key。只有需要素材上传或特定项目隔离时，再补充这些字段。"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>Project</span>
                <input
                  value={provider.volcengineConfig?.project || ''}
                  onChange={(e) => updateAdvancedProviderNested(provider.id, 'volcengineConfig', { project: e.target.value })}
                  className={fieldInputCls}
                  placeholder="可选，例如 default"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>Region</span>
                <input
                  value={provider.volcengineConfig?.region || ''}
                  onChange={(e) => updateAdvancedProviderNested(provider.id, 'volcengineConfig', { region: e.target.value })}
                  className={fieldInputCls}
                  placeholder="cn-beijing"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>素材 Access Key ID</span>
                <input
                  type="password"
                  value={provider.volcengineConfig?.accessKeyId || ''}
                  onChange={(e) => updateAdvancedProviderNested(provider.id, 'volcengineConfig', { accessKeyId: e.target.value })}
                  className={fieldInputCls}
                  placeholder={provider.volcengineConfig?.hasAccessKeyId ? '留空保持不变' : '可选'}
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>素材 Secret Access Key</span>
                <input
                  type="password"
                  value={provider.volcengineConfig?.secretAccessKey || ''}
                  onChange={(e) => updateAdvancedProviderNested(provider.id, 'volcengineConfig', { secretAccessKey: e.target.value })}
                  className={fieldInputCls}
                  placeholder={provider.volcengineConfig?.hasSecretAccessKey ? '留空保持不变' : '可选'}
                />
              </label>
            </div>
          </AdvancedProviderFormBlock>
        )}

        {isComfy && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="2. ComfyUI 工作流"
            note={guide?.connectionHint}
          >
            <label className="space-y-1 block">
              <span className={`text-[11px] ${labelCls}`}>实例地址列表（一行一个）</span>
              <textarea
                value={(provider.comfyuiConfig?.instances || [provider.baseUrl || '']).filter(Boolean).join('\n')}
                onChange={(e) => updateAdvancedProviderNested(provider.id, 'comfyuiConfig', {
                  instances: parseAdvancedProviderModelText(e.target.value),
                })}
                className={textareaCls}
                placeholder={guide?.baseUrlPlaceholder || 'http://127.0.0.1:8188'}
              />
            </label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>工作流 ID</span>
                <input
                  value={comfyWorkflow.id || ''}
                  onChange={(e) => updateComfyWorkflow({ id: e.target.value || 'workflow-1' })}
                  className={fieldInputCls}
                  placeholder="workflow-1"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>工作流名称</span>
                <input
                  value={comfyWorkflow.name || ''}
                  onChange={(e) => updateComfyWorkflow({ name: e.target.value || '默认工作流' })}
                  className={fieldInputCls}
                  placeholder="默认工作流"
                />
              </label>
            </div>
            <label className="space-y-1 block">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] ${labelCls}`}>工作流 JSON（从 ComfyUI 导出的 API 格式）</span>
                <label
                  className={
                    isPixel
                      ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 shrink-0 cursor-pointer inline-flex items-center gap-1'
                      : 't8-api-settings-secondary-btn px-2 py-1 text-[11px] rounded border shrink-0 cursor-pointer inline-flex items-center gap-1'
                  }
                  title="上传 ComfyUI API Workflow JSON 并自动映射"
                >
                  <FileUp size={12} /> 上传 JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleComfyWorkflowFile(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              <textarea
                value={comfyWorkflowRaw}
                onChange={(e) => updateComfyWorkflowJson(e.target.value)}
                className={`${textareaCls} min-h-[140px]`}
                placeholder='粘贴 ComfyUI API workflow JSON，例如 {"1":{"class_type":"CLIPTextEncode","inputs":{"text":""}}}'
              />
              <p className={`text-[11px] ${hintCls}`}>不是普通前端 workflow 文件，需要在 ComfyUI 开启 dev mode 后导出的 API workflow。</p>
            </label>
            <label className="space-y-1 block">
              <span className={`text-[11px] ${labelCls}`}>自动映射排除规则（可选）</span>
              <textarea
                value={comfyExcludeRulesRaw}
                onChange={(e) => updateComfyExcludeRules(e.target.value)}
                className={`${textareaCls} min-h-[72px]`}
                placeholder={'每行一个：seed、steps、class:KSampler、CLIPTextEncode.text、#86.batch_size'}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => appendComfyExcludeRules(['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'])}
                  className={isPixel ? 'px-btn text-[11px] px-2 py-1' : 'rounded border px-2 py-1 text-[11px]'}
                >
                  排除采样器参数
                </button>
                <button
                  type="button"
                  onClick={() => appendComfyExcludeRules(['model_name', 'ckpt_name', 'clip_name', 'vae_name', 'lora_name'])}
                  className={isPixel ? 'px-btn text-[11px] px-2 py-1' : 'rounded border px-2 py-1 text-[11px]'}
                >
                  排除模型加载
                </button>
                <button
                  type="button"
                  onClick={() => appendComfyExcludeRules(['width', 'height', 'batch_size'])}
                  className={isPixel ? 'px-btn text-[11px] px-2 py-1' : 'rounded border px-2 py-1 text-[11px]'}
                >
                  排除尺寸批量
                </button>
                <span className={`text-[10px] ${hintCls}`}>
                  当前 {comfyExcludeRules.length} 条规则，已排除 {comfyExcludedFieldCount} 个自动识别字段。
                </span>
              </div>
              <p className={`text-[11px] ${hintCls}`}>
                支持 source/字段名/节点类名/节点编号，例如 source:cfg、field:width、class:KSampler、node:86、#86.width。
              </p>
            </label>
            <div className={guideBoxCls}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`text-xs font-black ${labelCls}`}>自动识别结果</div>
                  <p className={`mt-1 ${hintCls}`}>
                    已识别 {comfyAnalysis.fields.length} 个可映射字段，排除后保留 {comfyFilteredAnalysisFields.length} 个，图片输入 {comfyAnalysis.imageInputCount} 个，输出节点 {comfyAnalysis.outputCount} 个。
                  </p>
                  {comfyAnalysis.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {comfyAnalysis.warnings.slice(0, 3).map((warning, index) => (
                        <p key={`${provider.id}-comfy-warning-${index}`} className="text-[10px] text-amber-400">{warning}</p>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={applyComfyAutoMapping}
                  className={
                    isPixel
                      ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 shrink-0'
                      : 't8-api-settings-secondary-btn px-2 py-1 text-[11px] rounded border shrink-0'
                  }
                >
                  自动映射
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <div className={`text-xs font-black ${labelCls}`}>参数映射</div>
              {comfyMappedFields.length > 0 ? (
                <div className="space-y-1.5">
                  {comfyMappedFields.map((field, index) => {
                    const detected = comfyAnalysis.fields.find((item) => item.nodeId === field.nodeId && item.fieldName === field.fieldName);
                    const isFixed = String(field.source || '') === 'fixed';
                    return (
                      <div
                        key={`${field.nodeId}-${field.fieldName}-${index}`}
                        className={isPixel ? 't8-api-settings-section border p-2 space-y-2' : 't8-api-settings-section rounded border p-2 space-y-2'}
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px_32px] gap-2 items-end">
                          <div className="min-w-0">
                            <div className={`text-[11px] font-bold truncate ${labelCls}`} title={detected?.label || `${field.nodeId}.${field.fieldName}`}>
                              {detected?.label || `节点 #${field.nodeId} · ${field.fieldName}`}
                            </div>
                            <div className={`text-[10px] truncate ${hintCls}`}>
                              {detected?.classType || 'Custom'} / {field.nodeId}.{field.fieldName}
                            </div>
                          </div>
                          <label className="space-y-1">
                            <span className={`text-[10px] ${hintCls}`}>来源</span>
                            <select
                              value={(field.source || field.fieldName || 'fixed') as string}
                              onChange={(e) => updateComfyField(index, { source: e.target.value })}
                              className={fieldInputCls}
                            >
                              {COMFY_FIELD_SOURCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeComfyField(index)}
                            className={isPixel ? 'px-btn text-[11px] px-2 py-1' : 'rounded border px-2 py-1 text-[11px]'}
                            title="移除此映射"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        {isFixed && (
                          <input
                            value={String(field.value ?? '')}
                            onChange={(e) => updateComfyField(index, { value: e.target.value })}
                            className={fieldInputCls}
                            placeholder="固定写入这个 ComfyUI 字段的值"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={`text-[11px] ${hintCls}`}>粘贴 API Workflow 后会自动生成映射；也可以在下面高级 JSON 中手动填写。</p>
              )}
            </div>
            <details className="space-y-2">
              <summary className={`cursor-pointer text-[11px] font-bold ${labelCls}`}>高级：直接编辑 fields JSON</summary>
              <textarea
                value={comfyDraft.fields ?? JSON.stringify(comfyMappedFields, null, 2)}
                onChange={(e) => updateComfyFields(e.target.value)}
                className={textareaCls}
                placeholder='[{"nodeId":"1","fieldName":"text","source":"prompt"}]'
              />
              <p className={`text-[11px] ${hintCls}`}>用于兼容复杂工作流。普通用户建议使用上方映射表。</p>
            </details>
          </AdvancedProviderFormBlock>
        )}

        {isJimeng && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="2. 本地 CLI"
            note={guide?.connectionHint}
          >
            <div className={guideBoxCls}>
              <div className="flex items-start gap-2">
                <Info size={14} className="mt-0.5 shrink-0" />
                <div className="min-w-0 space-y-2">
                  <div className={`font-bold ${labelCls}`}>如何安装即梦 CLI？</div>
                  <p className={hintCls}>
                    在 PowerShell 7、Git Bash 或 WSL 终端执行安装命令；安装完成后运行 <code className="font-mono">dreamina login</code> 登录，再回到这里点击“测试连接”。
                  </p>
                  <code className="block w-full overflow-x-auto rounded border px-2 py-1.5 font-mono text-[11px] leading-relaxed">
                    {JIMENG_CLI_INSTALL_COMMAND}
                  </code>
                  <p className={hintCls}>
                    Windows 常见路径是 <code className="font-mono">C:\Users\&lt;用户名&gt;\bin\dreamina.exe</code>；如果命令已加入 PATH，可直接填写 <code className="font-mono">dreamina</code>。装在 WSL 里时，勾选下面的 WSL 选项并填写发行版名称。
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="space-y-1 lg:col-span-2">
                <span className={`text-[11px] ${labelCls}`}>dreamina 可执行路径</span>
                <input
                  value={provider.jimengConfig?.executablePath || ''}
                  onChange={(e) => updateAdvancedProviderNested(provider.id, 'jimengConfig', { executablePath: e.target.value })}
                  className={fieldInputCls}
                  placeholder="dreamina 或 C:\\path\\dreamina.exe"
                />
              </label>
              <label className={`flex items-center gap-2 text-[11px] ${labelCls}`}>
                <input
                  type="checkbox"
                  checked={!!provider.jimengConfig?.useWsl}
                  onChange={(e) => updateAdvancedProviderNested(provider.id, 'jimengConfig', { useWsl: e.target.checked })}
                />
                CLI 装在 WSL 中
              </label>
              <label className="space-y-1">
                <span className={`text-[11px] ${labelCls}`}>WSL 发行版</span>
                <input
                  value={provider.jimengConfig?.wslDistro || ''}
                  onChange={(e) => updateAdvancedProviderNested(provider.id, 'jimengConfig', { wslDistro: e.target.value })}
                  className={fieldInputCls}
                  placeholder="例如 Ubuntu"
                />
              </label>
            </div>
          </AdvancedProviderFormBlock>
        )}

        {!isComfy && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="3. 节点里可选的模型"
            note={guide?.modelHint}
          >
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <label className="space-y-1 min-w-0">
                <span className={`text-[11px] ${labelCls}`}>图像模型（一行一个）</span>
                <textarea
                  value={stringifyAdvancedProviderModels(provider.imageModels)}
                  onChange={(e) => updateAdvancedProvider(provider.id, { imageModels: parseAdvancedProviderModelText(e.target.value) })}
                  className={textareaCls}
                  placeholder="例如 gpt-image-1"
                />
              </label>
              <label className="space-y-1 min-w-0">
                <span className={`text-[11px] ${labelCls}`}>视频模型（一行一个）</span>
                <textarea
                  value={stringifyAdvancedProviderModels(provider.videoModels)}
                  onChange={(e) => updateAdvancedProvider(provider.id, { videoModels: parseAdvancedProviderModelText(e.target.value) })}
                  className={textareaCls}
                  placeholder={isJimeng ? '例如 seedance2.0fast_vip' : '例如 video-model-name'}
                />
              </label>
              <label className="space-y-1 min-w-0">
                <span className={`text-[11px] ${labelCls}`}>聊天模型（一行一个）</span>
                <textarea
                  value={stringifyAdvancedProviderModels(provider.chatModels)}
                  onChange={(e) => updateAdvancedProvider(provider.id, { chatModels: parseAdvancedProviderModelText(e.target.value) })}
                  className={textareaCls}
                  placeholder={isJimeng ? '即梦 CLI 通常不用填写' : '例如 gpt-4o-mini'}
                />
              </label>
            </div>
          </AdvancedProviderFormBlock>
        )}

        {isModelScope && (
          <AdvancedProviderFormBlock
            className={formBlockCls}
            labelClassName={labelCls}
            hintClassName={hintCls}
            title="4. ModelScope LoRA（可选）"
            note={`为 ModelScope 图像模型绑定 LoRA。图像节点会按当前外部模型自动筛选；当前启用 ${enabledModelscopeLoraCount}/${modelscopeLoras.length}。`}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openExternal('https://www.modelscope.cn/aigc/models')}
                className={linkBtnCls}
                title="打开 ModelScope 国内模型库"
              >
                <ExternalLink size={11} /> 中文模型库
              </button>
              <button
                type="button"
                onClick={() => openExternal('https://www.modelscope.ai/civision/models')}
                className={linkBtnAltCls}
                title="打开 ModelScope 国际模型库"
              >
                <ExternalLink size={11} /> 英文模型库
              </button>
              <button
                type="button"
                onClick={addModelscopeLora}
                className={
                  isPixel
                    ? 't8-api-settings-secondary-btn px-btn text-[11px] px-2 py-1 inline-flex items-center gap-1'
                    : 't8-api-settings-secondary-btn rounded border px-2 py-1 text-[11px] inline-flex items-center gap-1'
                }
              >
                <Plus size={12} /> 添加 LoRA
              </button>
            </div>

            {!modelscopeLoras.length ? (
              <div className={`border border-dashed p-3 text-center text-[11px] ${hintCls} ${isPixel ? '' : 'rounded-lg'}`}>
                暂无 LoRA。点击“添加 LoRA”后填写 LoRA 模型 ID，并绑定到一个 ModelScope 图像模型。
              </div>
            ) : (
              <div className="space-y-2">
                {modelscopeLoras.map((lora, index) => {
                  const target = String((lora as any).targetModel || (lora as any).target_model || (lora as any).model || '').trim();
                  const strength = normalizeModelscopeLoraStrength((lora as any).strength ?? (lora as any).default_strength, 0.8);
                  return (
                    <div
                      key={index}
                      className={isPixel ? 't8-api-settings-section border p-2 space-y-2' : 't8-api-settings-section rounded-lg border p-2 space-y-2'}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_92px_36px] gap-2 items-end">
                        <label className="space-y-1 min-w-0">
                          <span className={`text-[11px] ${labelCls}`}>LoRA ID</span>
                          <input
                            value={(lora as any).id || ''}
                            onChange={(e) => updateModelscopeLora(index, { id: e.target.value })}
                            className={fieldInputCls}
                            placeholder="例如 Daniel8152/film"
                          />
                        </label>
                        <label className="space-y-1 min-w-0">
                          <span className={`text-[11px] ${labelCls}`}>绑定图像模型</span>
                          <select
                            value={target || modelscopeTargetOptions()[0] || ''}
                            onChange={(e) => updateModelscopeLora(index, { targetModel: e.target.value })}
                            className={fieldInputCls}
                          >
                            {modelscopeTargetOptions(target).map((modelName) => (
                              <option key={modelName} value={modelName}>{modelName}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1 min-w-0">
                          <span className={`text-[11px] ${labelCls}`}>强度</span>
                          <input
                            type="number"
                            min={0}
                            max={2}
                            step={0.05}
                            value={strength}
                            onChange={(e) => updateModelscopeLora(index, { strength: e.target.value })}
                            className={fieldInputCls}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeModelscopeLora(index)}
                          className={
                            isPixel
                              ? 't8-mini-icon-button h-9 w-9 inline-flex items-center justify-center'
                              : 't8-mini-icon-button h-9 w-9 rounded border inline-flex items-center justify-center'
                          }
                          title="删除 LoRA"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
                        <label className="space-y-1 min-w-0">
                          <span className={`text-[11px] ${labelCls}`}>显示名</span>
                          <input
                            value={(lora as any).name || ''}
                            onChange={(e) => updateModelscopeLora(index, { name: e.target.value })}
                            className={fieldInputCls}
                            placeholder="可选，用于节点下拉显示"
                          />
                        </label>
                        <label className="space-y-1 min-w-0">
                          <span className={`text-[11px] ${labelCls}`}>备注</span>
                          <input
                            value={(lora as any).note || ''}
                            onChange={(e) => updateModelscopeLora(index, { note: e.target.value })}
                            className={fieldInputCls}
                            placeholder="可选，例如触发词或用途"
                          />
                        </label>
                      </div>
                      <label className={`inline-flex items-center gap-2 text-[11px] font-bold ${labelCls}`}>
                        <input
                          type="checkbox"
                          checked={(lora as any).enabled !== false}
                          onChange={(e) => updateModelscopeLora(index, { enabled: e.target.checked })}
                        />
                        在图像节点中可用
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </AdvancedProviderFormBlock>
        )}
      </div>
    );
  };

  // 渲染单个 Key 表项
  const renderKey = (spec: KeySpec, opts: { fallbackHint?: boolean; baseUrlNote?: string }) => {
    const f = spec.field;
    const rawVal = (settings as any)[f] as string | undefined;
    const hasSaved = !!rawVal;
    const maskedDisplay = toMaskedDisplay(rawVal);
    return (
      <div key={f} className="space-y-2">
        <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
          <span className={`w-2 h-2 rounded-full ${spec.bullet}`} />
          {spec.label}
          <span className={`text-[11px] font-normal ${hintCls}`}>{spec.desc}</span>
          {hasSaved && (
            <span className="t8-api-settings-badge text-[10px] font-bold px-1.5 py-0.5 rounded border" data-tone="success">
              ✓ 已保存 {maskedDisplay}
            </span>
          )}
          {opts.fallbackHint && !hasSaved && (
            <span className="t8-api-settings-badge text-[10px] font-normal px-1.5 py-0.5 rounded border" data-tone="muted">
              未设置 · 使用通用 Key
            </span>
          )}
        </label>
        <div className="flex items-center gap-2">
          <input
            type={shows[f] ? 'text' : 'password'}
            value={inputs[f]}
            onChange={(e) => setInputAt(f, e.target.value)}
            placeholder={hasSaved ? '留空保持不变 / 输入新值覆盖' : (opts.fallbackHint ? '留空则使用通用 Key / 输入独立 Key' : '请输入 sk-...')}
            className={inputCls}
            autoComplete="off"
          />
          <button
            onClick={() => handleToggleShow(f)}
            className={eyeBtnCls}
            title={shows[f] ? '隐藏' : '显示明文'}
          >
            {shows[f] ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
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
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm ${
        isPixel ? 'px-modal-mask' : 'bg-black/60'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={
          isPixel
            ? `t8-api-settings-modal w-full ${advancedOpen || cloudUploadOpen ? 'max-w-4xl' : 'max-w-2xl'} mx-4 px-card overflow-hidden flex flex-col max-h-[90vh]`
            : `t8-api-settings-modal w-full ${advancedOpen || cloudUploadOpen ? 'max-w-4xl' : 'max-w-2xl'} mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border`
        }
      >
        {/* 头部 */}
        <div
          className={`t8-api-settings-header flex items-center gap-3 px-5 py-4 border-b shrink-0 ${
            isPixel
              ? 'border-[var(--px-ink)]'
              : ''
          }`}
        >
          <KeyRound size={18} className="t8-api-settings-icon" />
          <div className="flex-1">
            <h2
              className={`t8-api-settings-title text-base font-semibold ${isPixel ? 'px-title' : ''}`}
            >
              API Key 设置 (通用 + 分类独立)
            </h2>
            <p className={`text-xs mt-0.5 ${hintCls}`}>
              留空表示保持后端已存的 Key 不变 · 输入新值即覆盖 · 点眼睛可预览明文。
            </p>
          </div>
          <button
            onClick={onClose}
            className={
              isPixel
                ? 't8-api-settings-icon-btn px-btn px-btn--icon px-btn--ghost'
                : 't8-api-settings-icon-btn p-1.5 rounded-md'
            }
          >
            <X size={18} />
          </button>
        </div>

        {/* 表单 */}
        <div className="t8-api-settings-body p-5 space-y-5 overflow-y-auto">
          {/* 三套通用 Key */}
          {renderKey(COMMON_KEYS[0], { baseUrlNote: `Base URL 锁定: ${FIXED_ZHENZHEN_BASE}` })}
          {renderKey(COMMON_KEYS[1], { baseUrlNote: `Base URL: ${RH_BASE}` })}
          {renderKey(COMMON_KEYS[2], { baseUrlNote: `Base URL 锁定: ${FIXED_ZHENZHEN_BASE} (与贞贞同地址, Key 独立)` })}

          {/* 分类独立 Key（默认折叠，点击展开 —— 新手友好） */}
          <div className="t8-api-settings-divider pt-3 border-t">
            {(() => {
              const configuredCount = CLASSIFIED_KEYS.filter((spec) => {
                const v = (settings as any)?.[spec.field];
                return typeof v === 'string' && v.trim().length > 0;
              }).length;
              const totalCount = CLASSIFIED_KEYS.length;
              return (
                <button
                  type="button"
                  onClick={() => setClassifiedOpen((v) => !v)}
                  aria-expanded={classifiedOpen}
                  data-open={classifiedOpen}
                  className={
                    isPixel
                      ? 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 px-btn'
                      : 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition'
                  }
                >
                  <Settings2 size={14} className="t8-api-settings-icon" />
                  <span className="text-xs font-bold">分类独立 API Key【可选】</span>
                  <span
                    className="t8-api-settings-badge ml-1 px-1.5 py-0.5 text-[10px] rounded border"
                    data-tone={configuredCount > 0 ? 'success' : 'muted'}
                  >
                    已配置 {configuredCount}/{totalCount}
                  </span>
                  <span className={`ml-auto flex items-center gap-1 text-[11px] ${hintCls}`}>
                    {classifiedOpen ? '收起' : '展开'}
                    {classifiedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
              );
            })()}
            {!classifiedOpen && (
              <div className={`text-[11px] mt-2 ${hintCls}`}>
                不必担心：<b>未填项会自动 fallback 到贞贞工坊通用 Key</b>，新手可直接保存忽略此区块。
              </div>
            )}
            {classifiedOpen && (
              <div className="mt-3">
                <div className={`text-[11px] ${hintCls} mb-3`}>
                  为不同模型系列单独配置 Key；<b>未填则自动 fallback 到贞贞工坊通用 Key</b>。后端会根据调用的模型名/路由自动选择。
                </div>
                <div className="space-y-4">
                  {CLASSIFIED_KEYS.map((spec) => renderKey(spec, { fallbackHint: true }))}
                </div>
              </div>
            )}
          </div>

          {/* v1.8.x: 扩展 API 平台，高级可选 */}
          <div className="t8-api-settings-divider pt-3 border-t">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              data-open={advancedOpen}
              className={
                isPixel
                  ? 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 px-btn'
                  : 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition'
              }
            >
              <ServerCog size={14} className="t8-api-settings-icon" />
              <span className="text-xs font-bold shrink-0">扩展 API 平台【高级/可选】</span>
              <span className={`hidden sm:inline text-[11px] ${hintCls}`}>给高级用户接入第三方平台，默认不影响主流程</span>
              <span className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
                <span
                  className="t8-api-settings-badge px-1.5 py-0.5 text-[10px] rounded border"
                  data-tone={advancedSummary.enabledCount > 0 ? 'success' : 'muted'}
                >
                  已启用 {advancedSummary.enabledCount}/{advancedProvidersInput.length || 5}
                </span>
                <span className={`text-[10px] ${hintCls}`}>密钥 {advancedSummary.configuredKeyCount}</span>
              </span>
              <span className={`flex items-center gap-1 text-[11px] ${hintCls}`}>
                {advancedOpen ? '收起' : '展开'}
                {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {!advancedOpen && (
              <div className={`text-[11px] mt-2 ${hintCls}`}>
                未配置或未启用时不会影响贞贞工坊、RunningHub、LLM 独立 Key 等主流程。
              </div>
            )}
            {advancedOpen && (
              <div className="mt-3 space-y-3">
                <div className={`text-[11px] leading-relaxed ${hintCls}`}>
                  这里不是必填项。它只用于 ModelScope、火山引擎、本地 ComfyUI、即梦 CLI 和 OpenAI 兼容接口；平台开启后，还需要在具体节点的“高级来源”里选择它才会生效。
                  当前状态：已启用 {advancedSummary.enabledCount} 个，已配置密钥 {advancedSummary.configuredKeyCount} 个，ComfyUI {advancedSummary.comfyuiConfigured ? '已填写地址' : '未填写地址'}，即梦 CLI {advancedSummary.jimengConfigured ? '已填写路径' : '未填写路径'}。
                </div>
                {advancedProvidersInput.length === 0 ? (
                  <div className={`text-xs ${hintCls}`}>后端尚未返回扩展平台卡片，请先保存或刷新设置。</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-3 items-start">
                    <div className={`space-y-2 min-w-0 ${isPixel ? '' : 'lg:sticky lg:top-0'}`}>
                      {advancedProvidersInput.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => setActiveAdvancedProviderId(provider.id)}
                          data-active={activeAdvancedProvider?.id === provider.id}
                          data-enabled={!!provider.enabled}
                          className={
                            isPixel
                              ? 't8-api-settings-provider-card w-full !block text-left px-2 py-2 px-btn'
                              : 't8-api-settings-provider-card w-full block text-left px-2 py-2 rounded-md border text-xs transition'
                          }
                        >
                          <div className="flex items-center gap-2 min-w-0 w-full">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${provider.enabled ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                            <span className="font-bold min-w-0 truncate">{ADVANCED_PROVIDER_LABELS[provider.protocol] || provider.label || provider.id}</span>
                            <span className={`ml-auto text-[10px] shrink-0 ${provider.enabled ? 'text-emerald-500' : hintCls}`}>
                              {provider.enabled ? '已启用' : '未启用'}
                            </span>
                          </div>
                          <div className={`mt-1 text-[10px] leading-snug ${hintCls}`}>
                            {ADVANCED_PROVIDER_GUIDES[provider.protocol]?.nodeScopes.join(' / ') || provider.protocol}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="min-w-0">
                      {activeAdvancedProvider && renderAdvancedProviderForm(activeAdvancedProvider)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 云端上传目标：素材右键上传到 OSS/COS/网盘 */}
          <div className="t8-api-settings-divider pt-3 border-t">
            <button
              type="button"
              onClick={() => setCloudUploadOpen((v) => !v)}
              aria-expanded={cloudUploadOpen}
              data-open={cloudUploadOpen}
              className={
                isPixel
                  ? 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 px-btn'
                  : 't8-api-settings-toggle w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition'
              }
            >
              <CloudUpload size={14} className="t8-api-settings-icon" />
              <span className="text-xs font-bold shrink-0">云端上传目标【可选】</span>
              <span className={`hidden sm:inline text-[11px] ${hintCls}`}>素材右键上传到对象存储或网盘，不影响主流程</span>
              <span className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
                <span
                  className="t8-api-settings-badge px-1.5 py-0.5 text-[10px] rounded border"
                  data-tone={cloudSummary.enabledCount > 0 ? 'success' : 'muted'}
                >
                  已启用 {cloudSummary.enabledCount}/{cloudSummary.totalCount || 4}
                </span>
                <span className={`text-[10px] ${hintCls}`}>已配置 {cloudSummary.configuredCount}</span>
              </span>
              <span className={`flex items-center gap-1 text-[11px] ${hintCls}`}>
                {cloudUploadOpen ? '收起' : '展开'}
                {cloudUploadOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {!cloudUploadOpen && (
              <div className={`text-[11px] mt-2 ${hintCls}`}>
                未启用时右键菜单不会出现云端上传目标；已启用后可把图像 / 视频 / 音频复制到外部存储。
              </div>
            )}
            {cloudUploadOpen && (
              <div className="mt-3 space-y-3">
                <div className={`text-[11px] leading-relaxed ${hintCls}`}>
                  这里用于外部归档与分享。第一版腾讯云 COS 和阿里云 OSS 支持真实上传；百度网盘和夸克网盘先保留配置位，等稳定授权或 CLI 方案接入后会复用同一个入口。
                  {cloudSummary.defaultLabel ? ` 当前默认目标：${cloudSummary.defaultLabel}。` : ''}
                </div>
                {cloudUploadTargetsInput.length === 0 ? (
                  <div className={`text-xs ${hintCls}`}>后端尚未返回云端上传目标，请先保存或刷新设置。</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-3 items-start">
                    <div className={`space-y-2 min-w-0 ${isPixel ? '' : 'lg:sticky lg:top-0'}`}>
                      {cloudUploadTargetsInput.map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => setActiveCloudTargetId(target.id)}
                          data-active={activeCloudTarget?.id === target.id}
                          data-enabled={!!target.enabled}
                          className={
                            isPixel
                              ? 't8-api-settings-provider-card w-full !block text-left px-2 py-2 px-btn'
                              : 't8-api-settings-provider-card w-full block text-left px-2 py-2 rounded-md border text-xs transition'
                          }
                        >
                          <div className="flex items-center gap-2 min-w-0 w-full">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${target.enabled ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                            <span className="font-bold min-w-0 truncate">{target.label || CLOUD_UPLOAD_LABELS[target.provider] || target.id}</span>
                            <span className={`ml-auto text-[10px] shrink-0 ${target.enabled ? 'text-emerald-500' : hintCls}`}>
                              {target.enabled ? '已启用' : '未启用'}
                            </span>
                          </div>
                          <div className={`mt-1 text-[10px] leading-snug ${hintCls}`}>
                            {CLOUD_UPLOAD_LABELS[target.provider] || target.provider}
                            {target.isDefault ? ' · 默认' : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="min-w-0">
                      {activeCloudTarget && renderCloudTargetForm(activeCloudTarget)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* v1.2.10.2: 文件自动保存路径 */}
          <div className="t8-api-settings-divider pt-3 border-t">
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <FolderOpen size={14} className="t8-api-settings-icon" />
              文件自动保存路径
              <span className={`text-[11px] font-normal ${hintCls}`}>· 所有可执行节点生成的图像/视频/音频均会自动复制一份到此路径</span>
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={fileSavePathInput}
                onChange={(e) => setFileSavePathInput(e.target.value)}
                placeholder="例：D:\\zhenzhen 或 ~/zhenzhen · 路径不存在时会自动创建"
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className={`flex items-center gap-2 flex-wrap text-[11px] mt-1.5 ${hintCls}`}>
              <span className="flex items-center gap-1.5">
                <Lock size={11} /> 仅保存在本地机, 不上传上游。同名文件不覆盖。
              </span>
            </div>
          </div>

          {/* v1.3.1: 画布自动保存路径 */}
          <div className="t8-api-settings-divider pt-3 border-t">
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <FolderOpen size={14} className="t8-api-settings-icon" />
              画布自动保存路径
              <span className={`text-[11px] font-normal ${hintCls}`}>· 当前画布变更后自动导出 JSON，方便更换版本后导入</span>
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={canvasAutoSavePathInput}
                onChange={(e) => setCanvasAutoSavePathInput(e.target.value)}
                placeholder="例：D:\\zhenzhen 或 ~/zhenzhen · 实际保存到此路径下的 T8-penguin-canvas\\canvases"
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className={`flex items-center gap-2 flex-wrap text-[11px] mt-1.5 ${hintCls}`}>
              <span className="flex items-center gap-1.5">
                <Lock size={11} /> 默认路径由后端按平台返回：Windows 为 D:\zhenzhen，macOS/Linux 为用户目录下的 zhenzhen。
              </span>
            </div>
          </div>

          {/* v1.3.4: 资源库路径 */}
          <div className="t8-api-settings-divider pt-3 border-t">
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <FolderOpen size={14} className="t8-api-settings-icon" />
              资源库路径
              <span className={`text-[11px] font-normal ${hintCls}`}>· 资源文件与分类索引都保存在此路径，更换版本后可继续读取</span>
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={resourceLibraryPathInput}
                onChange={(e) => setResourceLibraryPathInput(e.target.value)}
                placeholder="例：D:\\zhenzhen\\resources 或 ~/zhenzhen/resources · 路径不存在时会自动创建"
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className={`flex items-center gap-2 flex-wrap text-[11px] mt-1.5 ${hintCls}`}>
              <span className="flex items-center gap-1.5">
                <Lock size={11} /> 加入资源库会复制一份到此目录，删除资源只删除资源库副本。
              </span>
            </div>
          </div>

          {/* v1.3.6: 主题模板路径 */}
          <div className="t8-api-settings-divider pt-3 border-t">
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <FolderOpen size={14} className="t8-api-settings-icon" />
              主题模板路径
              <span className={`text-[11px] font-normal ${hintCls}`}>· 导入或编辑后的主题 JSON 保存在此路径</span>
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={themeTemplatePathInput}
                onChange={(e) => setThemeTemplatePathInput(e.target.value)}
                placeholder="例：D:\\zhenzhen\\theme-templates 或 ~/zhenzhen/theme-templates · 路径不存在时会自动创建"
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className={`flex items-center gap-2 flex-wrap text-[11px] mt-1.5 ${hintCls}`}>
              <span className="flex items-center gap-1.5">
                <Lock size={11} /> 内置主题不可删除；自定义主题可导入、导出、编辑和删除。
              </span>
            </div>
          </div>

          {/* 本地 Eagle API */}
          <div className="t8-api-settings-divider pt-3 border-t">
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <ExternalLink size={14} className="t8-api-settings-icon" />
              Eagle 本地接口
              <span className={`text-[11px] font-normal ${hintCls}`}>· 发送素材到本机 Eagle 时使用</span>
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={eagleApiBaseInput}
                onChange={(e) => setEagleApiBaseInput(e.target.value)}
                placeholder="http://127.0.0.1:41595"
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className={`flex items-center gap-2 flex-wrap text-[11px] mt-1.5 ${hintCls}`}>
              <span className="flex items-center gap-1.5">
                <Lock size={11} /> 后端只允许 127.0.0.1 / localhost，避免把本地素材发送到远端代理。
              </span>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              ❌ {error}
            </div>
          )}
          {backupMessage && (
            <div
              className={
                isPixel
                  ? 'text-xs px-3 py-2 border border-[var(--px-ink)] bg-[var(--px-yellow)] text-[var(--px-ink)]'
                  : `text-xs rounded-md px-3 py-2 border ${
                      backupMessage.includes('失败') || backupMessage.includes('不正确')
                        ? 'text-red-300 bg-red-500/10 border-red-500/25'
                        : isDark
                          ? 'text-amber-100 bg-amber-500/10 border-amber-500/25'
                          : 'text-amber-800 bg-amber-50 border-amber-200'
                    }`
              }
            >
              {backupMessage}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div
          className={`t8-api-settings-footer flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0 ${
            isPixel
              ? 'border-[var(--px-ink)]'
              : ''
          }`}
        >
          <input
            ref={backupFileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={() => backupFileInputRef.current?.click()}
            className={
              isPixel
                ? 't8-api-settings-secondary-btn px-btn flex items-center gap-2'
                : 't8-api-settings-secondary-btn px-3 py-2 text-sm rounded-md border flex items-center gap-2'
            }
            title="导入设置备份，回填后需点击保存生效"
          >
            <FileUp size={14} />
            导入设置
          </button>
          <button
            type="button"
            onClick={handleExportSettings}
            className={
              isPixel
                ? 't8-api-settings-secondary-btn px-btn flex items-center gap-2'
                : 't8-api-settings-secondary-btn px-3 py-2 text-sm rounded-md border flex items-center gap-2'
            }
            title="导出包含明文 API Key 的私密备份"
          >
            <Download size={14} />
            导出设置
          </button>
          <button
            onClick={onClose}
            className={
              isPixel
                ? 't8-api-settings-secondary-btn px-btn'
                : 't8-api-settings-secondary-btn px-4 py-2 text-sm rounded-md border'
            }
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className={
              isPixel
                ? 't8-api-settings-primary-btn px-btn px-btn--mint disabled:opacity-50 flex items-center gap-2'
                : 't8-api-settings-primary-btn px-4 py-2 text-sm rounded-md flex items-center gap-2 disabled:opacity-50'
            }
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <span>✓ 已保存</span>
            ) : (
              <Save size={14} />
            )}
            {!loading && !saved && '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
