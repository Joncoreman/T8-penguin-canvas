import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Download, ExternalLink, Eye, EyeOff, FileUp, Info, KeyRound, Loader2, Lock, Save, Settings2, TestTube2, X, FolderOpen, ServerCog } from 'lucide-react';
import { useApiKeysStore, FIXED_ZHENZHEN_BASE, RH_BASE } from '../stores/apiKeys';
import { useThemeStore } from '../stores/theme';
import type { AdvancedProviderConfig, AdvancedProviderProtocol, ApiSettings } from '../types/canvas';
import { getRawSettings, testAdvancedProvider } from '../services/api';
import {
  advancedProviderSummary as summarizeAdvancedProviderForm,
  parseAdvancedProviderModelText,
  stringifyAdvancedProviderModels,
} from '../utils/advancedProviders';

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
  const [advancedComfyDrafts, setAdvancedComfyDrafts] = useState<Record<string, { workflowJson?: string; fields?: string }>>({});
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
    ? 'flex-1 px-3 py-2 rounded-[10px] text-sm outline-none px-input'
    : `flex-1 px-3 py-2 rounded-md text-sm outline-none border ${
        isDark
          ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30'
          : 'bg-black/5 border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-black/30'
      }`;

  const labelCls = isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-white/70' : 'text-zinc-700';
  const hintCls = isPixel ? 'text-[var(--px-ink-soft)]' : isDark ? 'text-white/40' : 'text-zinc-500';
  const eyeBtnCls = isPixel
    ? 'px-btn px-btn--icon px-btn--ghost'
    : `p-2 rounded-md ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`;

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

  const updateAdvancedProvider = (id: string, patch: Partial<AdvancedProviderConfig>) => {
    setAdvancedProvidersInput((prev) => prev.map((provider) => (
      provider.id === id ? { ...provider, ...patch } : provider
    )));
    setAdvancedDirty(true);
  };

  const updateAdvancedProviderNested = (
    id: string,
    key: 'volcengineConfig' | 'comfyuiConfig' | 'jimengConfig',
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

  const renderAdvancedProviderForm = (provider: AdvancedProviderConfig) => {
    const protocolLabel = ADVANCED_PROVIDER_LABELS[provider.protocol] || provider.protocol;
    const guide = ADVANCED_PROVIDER_GUIDES[provider.protocol];
    const isComfy = provider.protocol === 'comfyui';
    const isJimeng = provider.protocol === 'jimeng-cli';
    const isVolc = provider.protocol === 'volcengine';
    const sectionCls = isPixel
      ? 'border border-[var(--px-ink)] bg-white p-3 space-y-4 min-w-0'
      : `border rounded-xl p-3 sm:p-4 space-y-4 min-w-0 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-black/10 bg-black/[0.02]'}`;
    const formBlockCls = isPixel
      ? 'border border-[var(--px-ink)]/40 bg-[var(--px-paper)]/70 p-3 space-y-3'
      : `rounded-lg border p-3 space-y-3 ${isDark ? 'border-white/10 bg-black/10' : 'border-black/10 bg-white/70'}`;
    const fieldInputCls = `${inputCls.replace('flex-1 ', '')} w-full min-w-0`;
    const textareaCls = `${fieldInputCls} min-h-[76px] resize-y font-mono text-xs leading-relaxed`;
    const guideBoxCls = isPixel
      ? 'border border-[var(--px-ink)]/40 bg-white/80 p-3 text-[11px] leading-relaxed text-[var(--px-ink)]'
      : `rounded-lg border p-3 text-[11px] leading-relaxed ${
          isDark
            ? 'border-amber-300/20 bg-amber-300/10 text-amber-50/85'
            : 'border-amber-300/50 bg-amber-50 text-amber-900'
        }`;
    const smallPillCls = isPixel
      ? 'inline-flex items-center px-1.5 py-0.5 border border-[var(--px-ink)] bg-white text-[10px] font-bold text-[var(--px-ink)]'
      : `inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] font-semibold ${
          isDark ? 'border-white/10 bg-white/5 text-white/70' : 'border-black/10 bg-black/5 text-zinc-600'
        }`;
    const comfyWorkflow = (provider.comfyuiConfig?.workflows?.[0] || { id: 'workflow-1', name: '默认工作流' }) as NonNullable<NonNullable<AdvancedProviderConfig['comfyuiConfig']>['workflows']>[number];
    const comfyDraft = advancedComfyDrafts[provider.id] || {};
    const setComfyDraft = (patch: { workflowJson?: string; fields?: string }) => {
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
        updateComfyWorkflow({ workflowJson: JSON.parse(raw) });
        setAdvancedTestStatus((prev) => ({ ...prev, [provider.id]: { ok: true, message: '工作流 JSON 已解析' } }));
      } catch {
        setAdvancedTestStatus((prev) => ({ ...prev, [provider.id]: { ok: false, message: '工作流 JSON 格式不正确，修正后会自动保存' } }));
      }
    };
    const updateComfyFields = (raw: string) => {
      setComfyDraft({ fields: raw });
      try {
        const parsed = JSON.parse(raw || '[]');
        if (!Array.isArray(parsed)) throw new Error('fields must be array');
        updateComfyWorkflow({ fields: parsed });
        setAdvancedTestStatus((prev) => ({ ...prev, [provider.id]: { ok: true, message: '参数映射已解析' } }));
      } catch {
        setAdvancedTestStatus((prev) => ({ ...prev, [provider.id]: { ok: false, message: '参数映射 JSON 需要是数组' } }));
      }
    };
    const FormBlock = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
      <section className={formBlockCls}>
        <div className="space-y-1">
          <div className={`text-xs font-black ${labelCls}`}>{title}</div>
          {note && <p className={`text-[11px] leading-relaxed ${hintCls}`}>{note}</p>}
        </div>
        {children}
      </section>
    );

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
                ? 'px-btn text-[11px] px-2 py-1 shrink-0'
                : `px-2 py-1 text-[11px] rounded border shrink-0 inline-flex items-center gap-1 ${
                    isDark ? 'border-white/10 hover:bg-white/10' : 'border-black/10 hover:bg-black/5'
                  }`
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

        <FormBlock
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
        </FormBlock>

        {!isComfy && !isJimeng && (
          <FormBlock title="2. 连接密钥" note={guide?.connectionHint}>
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
          </FormBlock>
        )}

        {isVolc && (
          <FormBlock
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
          </FormBlock>
        )}

        {isComfy && (
          <FormBlock title="2. ComfyUI 工作流" note={guide?.connectionHint}>
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
              <span className={`text-[11px] ${labelCls}`}>工作流 JSON（从 ComfyUI 导出的 API 格式）</span>
              <textarea
                value={comfyDraft.workflowJson ?? (comfyWorkflow.workflowJson ? JSON.stringify(comfyWorkflow.workflowJson, null, 2) : '')}
                onChange={(e) => updateComfyWorkflowJson(e.target.value)}
                className={`${textareaCls} min-h-[140px]`}
                placeholder='粘贴 ComfyUI API workflow JSON，例如 {"1":{"class_type":"CLIPTextEncode","inputs":{"text":""}}}'
              />
              <p className={`text-[11px] ${hintCls}`}>不是普通前端 workflow 文件，需要在 ComfyUI 开启 dev mode 后导出的 API workflow。</p>
            </label>
            <label className="space-y-1 block">
              <span className={`text-[11px] ${labelCls}`}>参数映射 JSON（可选，高级用户）</span>
              <textarea
                value={comfyDraft.fields ?? JSON.stringify(comfyWorkflow.fields || [], null, 2)}
                onChange={(e) => updateComfyFields(e.target.value)}
                className={textareaCls}
                placeholder='[{"nodeId":"1","fieldName":"text","source":"prompt"}]'
              />
              <p className={`text-[11px] ${hintCls}`}>用于把节点 prompt、参考图等写入指定 ComfyUI 节点字段；不填时后端会尝试按常见字段自动写入。</p>
            </label>
          </FormBlock>
        )}

        {isJimeng && (
          <FormBlock title="2. 本地 CLI" note={guide?.connectionHint}>
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
          </FormBlock>
        )}

        {!isComfy && (
          <FormBlock title="3. 节点里可选的模型" note={guide?.modelHint}>
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
          </FormBlock>
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
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ✓ 已保存 {maskedDisplay}
            </span>
          )}
          {opts.fallbackHint && !hasSaved && (
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">
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
            ? `w-full ${advancedOpen ? 'max-w-4xl' : 'max-w-2xl'} mx-4 px-card overflow-hidden flex flex-col max-h-[90vh]`
            : `w-full ${advancedOpen ? 'max-w-4xl' : 'max-w-2xl'} mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
                isDark ? 'bg-zinc-900 border border-white/10' : 'bg-white border border-black/10'
              }`
        }
      >
        {/* 头部 */}
        <div
          className={`flex items-center gap-3 px-5 py-4 border-b shrink-0 ${
            isPixel
              ? 'border-[var(--px-ink)] bg-[var(--px-yellow)]'
              : isDark
                ? 'border-white/10'
                : 'border-black/10'
          }`}
        >
          <KeyRound size={18} className={isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-white/80' : 'text-zinc-700'} />
          <div className="flex-1">
            <h2
              className={`text-base font-semibold ${
                isPixel ? 'px-title text-[var(--px-ink)]' : isDark ? 'text-white' : 'text-zinc-900'
              }`}
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
                ? 'px-btn px-btn--icon px-btn--ghost'
                : `p-1.5 rounded-md ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`
            }
          >
            <X size={18} />
          </button>
        </div>

        {/* 表单 */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* 三套通用 Key */}
          {renderKey(COMMON_KEYS[0], { baseUrlNote: `Base URL 锁定: ${FIXED_ZHENZHEN_BASE}` })}
          {renderKey(COMMON_KEYS[1], { baseUrlNote: `Base URL: ${RH_BASE}` })}
          {renderKey(COMMON_KEYS[2], { baseUrlNote: `Base URL 锁定: ${FIXED_ZHENZHEN_BASE} (与贞贞同地址, Key 独立)` })}

          {/* 分类独立 Key（默认折叠，点击展开 —— 新手友好） */}
          <div className={`pt-3 border-t ${isPixel ? 'border-[var(--px-ink)]/30' : isDark ? 'border-white/10' : 'border-black/10'}`}>
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
                  className={
                    isPixel
                      ? `w-full flex items-center gap-2 px-3 py-2 px-btn ${classifiedOpen ? 'px-btn--mint' : ''}`
                      : `w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                          isDark
                            ? 'border-white/10 hover:bg-white/5 text-white/85'
                            : 'border-black/10 hover:bg-black/5 text-zinc-800'
                        }`
                  }
                >
                  <Settings2 size={14} className={isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-white/70' : 'text-zinc-600'} />
                  <span className={`text-xs font-bold ${isPixel ? 'text-[var(--px-ink)]' : ''}`}>分类独立 API Key【可选】</span>
                  <span
                    className={
                      isPixel
                        ? 'ml-1 px-1.5 py-0.5 text-[10px] border border-[var(--px-ink)] bg-white text-[var(--px-ink)]'
                        : `ml-1 px-1.5 py-0.5 text-[10px] rounded ${
                            configuredCount > 0
                              ? isDark
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : isDark
                                ? 'bg-white/10 text-white/60 border border-white/10'
                                : 'bg-black/5 text-zinc-500 border border-black/10'
                          }`
                    }
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
          <div className={`pt-3 border-t ${isPixel ? 'border-[var(--px-ink)]/30' : isDark ? 'border-white/10' : 'border-black/10'}`}>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className={
                isPixel
                  ? `w-full flex items-center gap-2 px-3 py-2 px-btn ${advancedOpen ? 'px-btn--mint' : ''}`
                  : `w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                      isDark
                        ? 'border-white/10 hover:bg-white/5 text-white/85'
                        : 'border-black/10 hover:bg-black/5 text-zinc-800'
                    }`
              }
            >
              <ServerCog size={14} className={isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-white/70' : 'text-zinc-600'} />
              <span className={`text-xs font-bold shrink-0 ${isPixel ? 'text-[var(--px-ink)]' : ''}`}>扩展 API 平台【高级/可选】</span>
              <span className={`hidden sm:inline text-[11px] ${hintCls}`}>给高级用户接入第三方平台，默认不影响主流程</span>
              <span className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
                <span
                  className={
                    isPixel
                      ? 'px-1.5 py-0.5 text-[10px] border border-[var(--px-ink)] bg-white text-[var(--px-ink)]'
                      : `px-1.5 py-0.5 text-[10px] rounded border ${
                          advancedSummary.enabledCount > 0
                            ? isDark
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : isDark
                              ? 'bg-white/10 text-white/60 border-white/10'
                              : 'bg-black/5 text-zinc-500 border-black/10'
                        }`
                  }
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
                          className={
                            isPixel
                              ? `w-full !block text-left px-2 py-2 px-btn ${activeAdvancedProvider?.id === provider.id ? 'px-btn--mint' : ''}`
                              : `w-full block text-left px-2 py-2 rounded-md border text-xs transition ${
                                  activeAdvancedProvider?.id === provider.id
                                    ? isDark
                                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                                      : 'border-emerald-400 bg-emerald-50 text-emerald-800'
                                    : isDark
                                      ? 'border-white/10 hover:bg-white/5 text-white/75'
                                      : 'border-black/10 hover:bg-black/5 text-zinc-700'
                                }`
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

          {/* v1.2.10.2: 文件自动保存路径 */}
          <div className={`pt-3 border-t ${isPixel ? 'border-[var(--px-ink)]/30' : isDark ? 'border-white/10' : 'border-black/10'}`}>
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <FolderOpen size={14} className={isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-cyan-300' : 'text-cyan-600'} />
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
          <div className={`pt-3 border-t ${isPixel ? 'border-[var(--px-ink)]/30' : isDark ? 'border-white/10' : 'border-black/10'}`}>
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <FolderOpen size={14} className={isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-emerald-300' : 'text-emerald-600'} />
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
          <div className={`pt-3 border-t ${isPixel ? 'border-[var(--px-ink)]/30' : isDark ? 'border-white/10' : 'border-black/10'}`}>
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <FolderOpen size={14} className={isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-fuchsia-300' : 'text-fuchsia-600'} />
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
          <div className={`pt-3 border-t ${isPixel ? 'border-[var(--px-ink)]/30' : isDark ? 'border-white/10' : 'border-black/10'}`}>
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <FolderOpen size={14} className={isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-sky-300' : 'text-sky-600'} />
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
          <div className={`pt-3 border-t ${isPixel ? 'border-[var(--px-ink)]/30' : isDark ? 'border-white/10' : 'border-black/10'}`}>
            <label className={`text-sm font-medium flex items-center gap-2 flex-wrap ${labelCls}`}>
              <ExternalLink size={14} className={isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-lime-300' : 'text-lime-700'} />
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
          className={`flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0 ${
            isPixel
              ? 'border-[var(--px-ink)] bg-[var(--px-muted)]'
              : isDark
                ? 'border-white/10 bg-white/[0.02]'
                : 'border-black/10 bg-black/[0.02]'
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
                ? 'px-btn flex items-center gap-2'
                : `px-3 py-2 text-sm rounded-md border flex items-center gap-2 ${
                    isDark
                      ? 'border-white/10 hover:bg-white/10 text-white/80'
                      : 'border-black/10 hover:bg-black/5 text-zinc-700'
                  }`
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
                ? 'px-btn flex items-center gap-2'
                : `px-3 py-2 text-sm rounded-md border flex items-center gap-2 ${
                    isDark
                      ? 'border-amber-400/25 hover:bg-amber-400/10 text-amber-100'
                      : 'border-amber-300 hover:bg-amber-50 text-amber-800'
                  }`
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
                ? 'px-btn'
                : `px-4 py-2 text-sm rounded-md ${
                    isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/5 text-zinc-700'
                  }`
            }
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className={
              isPixel
                ? 'px-btn px-btn--mint disabled:opacity-50 flex items-center gap-2'
                : 'px-4 py-2 text-sm rounded-md bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 disabled:opacity-50'
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
