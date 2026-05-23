import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { AlertCircle, Loader2, Workflow, Sparkles, Square, Search, RefreshCw } from 'lucide-react';
import { submitRh, queryRh, fetchRhAppInfo, uploadRhAsset } from '../../services/generation';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';

/**
 * RunningHubNode - 主工作流节点
 * 输入: webappId(必填) + 点搜索拉取 nodeInfoList 在节点内展开为表单
 * 可选: 上游 RhConfig / image / video / audio / upload 节点补充参数
 * 流程: submit → 5s 轮询 outputs → 转存到 /output → 显示
 */

// ========== fieldType → valueType 映射 ==========
// RH apiCallDemo 返回的 fieldType: IMAGE / VIDEO / AUDIO / STRING / TEXT / NUMBER / FLOAT / INTEGER / BOOLEAN / LIST / SELECT
function inferValueType(fieldType: string | undefined): 'text' | 'number' | 'image' | 'video' | 'audio' {
  const t = String(fieldType || '').toUpperCase();
  if (t === 'IMAGE') return 'image';
  if (t === 'VIDEO') return 'video';
  if (t === 'AUDIO') return 'audio';
  if (t === 'NUMBER' || t === 'FLOAT' || t === 'INTEGER' || t === 'INT') return 'number';
  return 'text';
}

// 从上游节点 data 中提取对应 kind 的第一个 url
function extractUpstreamUrl(d: any, kind: 'image' | 'video' | 'audio'): string {
  if (!d) return '';
  if (kind === 'image') {
    if (typeof d.imageUrl === 'string' && d.imageUrl) return d.imageUrl;
    if (Array.isArray(d.imageUrls) && d.imageUrls[0]) return d.imageUrls[0];
    if (Array.isArray(d.urls) && d.urls[0]) return d.urls[0];
    if (Array.isArray(d.generatedImages) && d.generatedImages[0]) return d.generatedImages[0];
    if (d.uploadType === 'image' && typeof d.url === 'string') return d.url;
  } else if (kind === 'video') {
    if (typeof d.videoUrl === 'string' && d.videoUrl) return d.videoUrl;
    if (d.uploadType === 'video' && typeof d.url === 'string') return d.url;
  } else if (kind === 'audio') {
    if (typeof d.audioUrl === 'string' && d.audioUrl) return d.audioUrl;
    if (d.uploadType === 'audio' && typeof d.url === 'string') return d.url;
  }
  return '';
}

const paramKey = (nodeId: any, fieldName: any) => `${nodeId}::${fieldName}`;

const RunningHubNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const hasAutoOutput = useHasAutoOutput(id);
  const { getEdges, getNodes } = useReactFlow();
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);
  const [fetchingInfo, setFetchingInfo] = useState(false);

  const d = data as any;
  const webappId: string = d?.webappId || '';
  const instanceType: string = d?.instanceType || '';
  const status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' = d?.status || 'idle';
  const taskId: string | undefined = d?.taskId;
  const urls: string[] = d?.urls || [];
  const appInfo: any = d?.appInfo;
  // paramValues: 在节点内为每个 nodeInfoList 条目保存的当前编辑值
  // 结构: { 'nodeId::fieldName': { value: string; sourceFromUpstream?: boolean } }
  const paramValues: Record<string, { value: string; sourceFromUpstream?: boolean }> = d?.paramValues || {};

  const stopPoll = () => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };
  useEffect(() => () => stopPoll(), []);

  // ========== 上游节点 ==========
  const upstreamNodes = useMemo(() => {
    const edges = getEdges();
    const nodes = getNodes();
    const upIds = edges.filter((e) => e.target === id).map((e) => e.source);
    return upIds.map((uid) => nodes.find((n) => n.id === uid)).filter(Boolean) as any[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, d]);

  const findUpstreamUrl = (kind: 'image' | 'video' | 'audio'): string => {
    for (const n of upstreamNodes) {
      const u = extractUpstreamUrl(n.data, kind);
      if (u) return u;
    }
    return '';
  };

  // ========== 保存某一条 paramValue ==========
  const setParam = (k: string, patch: Partial<{ value: string; sourceFromUpstream: boolean }>) => {
    const cur = paramValues[k] || { value: '' };
    const next = { ...paramValues, [k]: { ...cur, ...patch } };
    update({ paramValues: next });
  };

  // 对于媒体类字段，随上游节点 url 变化同步回填：
  //   - sourceFromUpstream === true   → 已启用，连续跟进
  //   - sourceFromUpstream === undefined → 用户从未交互过（包括拉取后只填了默认 fieldValue），
  //                                       一旦上游出现对应 url → 自动启用 + 填值（避免用户漏勾导致提交默认值）
  //   - sourceFromUpstream === false  → 用户主动取消过，不动
  useEffect(() => {
    const list: any[] = appInfo?.nodeInfoList;
    if (!Array.isArray(list) || list.length === 0) return;
    let changed = false;
    const next = { ...paramValues };
    for (const it of list) {
      const vt = inferValueType(it?.fieldType);
      if (vt !== 'image' && vt !== 'video' && vt !== 'audio') continue;
      const k = paramKey(it.nodeId, it.fieldName);
      const cur = next[k];
      const upUrl = findUpstreamUrl(vt);
      if (!upUrl) continue;
      if (cur?.sourceFromUpstream === false) continue; // 用户主动关闭
      if (cur?.sourceFromUpstream === true) {
        if (upUrl !== cur.value) {
          next[k] = { ...cur, value: upUrl };
          changed = true;
        }
      } else {
        // undefined → 首次看到上游，自动启用
        next[k] = { value: upUrl, sourceFromUpstream: true };
        changed = true;
      }
    }
    if (changed) update({ paramValues: next });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamNodes, appInfo]);

  // ========== 收集上游 RhConfig nodeInfoList（保留向后兼容）==========
  const collectUpstreamConfigList = () => {
    const list: any[] = [];
    for (const n of upstreamNodes) {
      const arr = (n?.data as any)?.nodeInfoList;
      if (Array.isArray(arr)) list.push(...arr);
    }
    return list;
  };

  // ========== 从节点内表单 + 上游 RhConfig 合并出原始 nodeInfoList（同一个 (nodeId,fieldName) 表单优先） ==========
  // 同样接受可选的 override 参数让 handleRun 同步路径能用 freshly fetched 结果
  const buildRawNodeInfoList = (
    overrideList?: any[],
    overrideValues?: Record<string, { value: string; sourceFromUpstream?: boolean }>,
  ): any[] => {
    const seen = new Set<string>();
    const out: any[] = [];
    // 1. 节点内表单
    const list: any[] = overrideList ?? appInfo?.nodeInfoList ?? [];
    const values = overrideValues ?? paramValues;
    for (const it of list) {
      const k = paramKey(it.nodeId, it.fieldName);
      const vt = inferValueType(it?.fieldType);
      const v = values[k]?.value;
      // 未填 且 原始 fieldValue 为空且非必填 → 跳过
      const finalVal = v != null && v !== '' ? v : (it?.fieldValue ?? '');
      seen.add(k);
      out.push({
        nodeId: it.nodeId,
        fieldName: it.fieldName,
        fieldValue: finalVal,
        valueType: vt,
      });
    }
    // 2. 上游 RhConfig 补充（同 key 已被节点内覆盖则跳过）
    const upstreamList = collectUpstreamConfigList();
    for (const it of upstreamList) {
      const k = paramKey(it?.nodeId, it?.fieldName);
      if (seen.has(k)) continue;
      out.push(it);
    }
    return out;
  };

  /**
   * 提交前处理：将 valueType=image|video|audio 且 fieldValue 是 url 的条目
   * 调 /upload-asset 转成 RH 内部 fileName。text/number 原样保留。
   * 输出: 干净的 nodeInfoList（仅含 nodeId/fieldName/fieldValue）。
   */
  const resolveNodeInfoList = async (raw: any[]): Promise<any[]> => {
    const out: any[] = [];
    for (const it of raw) {
      const nodeId = it?.nodeId;
      const fieldName = it?.fieldName;
      let fieldValue = it?.fieldValue;
      const vt = it?.valueType;
      if (!nodeId || !fieldName) continue;
      if (vt === 'image' || vt === 'video' || vt === 'audio') {
        const v = String(fieldValue || '').trim();
        if (!v) continue; // 未提供资源 → 跳过该条目
        // 判定为本地/远程 url 的样式 → 走 /upload-asset 转 fileName
        // 包含：https:// / /files/output/ / /output/ / /files/input/ / /input/
        const isUrlLike =
          /^https?:\/\//i.test(v) ||
          v.startsWith('/files/output/') ||
          v.startsWith('/output/') ||
          v.startsWith('/files/input/') ||
          v.startsWith('/input/');
        if (isUrlLike) {
          const r = await uploadRhAsset(v);
          fieldValue = r.fileName;
        } else {
          fieldValue = v;
        }
      } else if (vt === 'number') {
        const num = Number(fieldValue);
        fieldValue = Number.isFinite(num) ? num : fieldValue;
      }
      out.push({ nodeId, fieldName, fieldValue });
    }
    return out;
  };

  const startPolling = (tid: string) => {
    stopPoll();
    let elapsed = 0;
    const POLL_INT = 5000;
    const MAX = 480;
    pollTimer.current = window.setInterval(async () => {
      elapsed += 1;
      if (elapsed > MAX) {
        stopPoll();
        update({ status: 'error', error: '轮询超时' });
        setError('轮询超时');
        return;
      }
      try {
        const r = await queryRh(tid);
        if (r.status === 'SUCCESS') {
          stopPoll();
          // 按后缀分流到 imageUrl/videoUrl/audioUrl，避免视频 url 被填到 imageUrl 导致
          // OutputNode 当图片渲染而空白。
          const list: string[] = Array.isArray(r.urls) ? r.urls : [];
          const isImg = (u: string) => /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(u);
          const isVid = (u: string) => /\.(mp4|webm|mov|m4v|mkv)$/i.test(u);
          const isAud = (u: string) => /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(u);
          const firstImg = list.find(isImg);
          const firstVid = list.find(isVid);
          const firstAud = list.find(isAud);
          const patch: any = { status: 'success', urls: list };
          if (firstImg) patch.imageUrl = firstImg;
          if (firstVid) patch.videoUrl = firstVid;
          if (firstAud) patch.audioUrl = firstAud;
          // 都不匹配时退回原逻辑（首个当 imageUrl）以保证向后兼容
          if (!firstImg && !firstVid && !firstAud && list[0]) patch.imageUrl = list[0];
          update(patch);
        } else if (r.status === 'FAILED') {
          stopPoll();
          // failReason 可能是 ComfyUI 报错对象(含 traceback/exception_type 等)，
          // 需序列化为字符串避免 React JSX 直接渲染 object 崩溃
          let reason: string;
          if (r.failReason == null) {
            reason = `RH 失败 code=${r.code}`;
          } else if (typeof r.failReason === 'string') {
            reason = r.failReason;
          } else {
            try {
              const o: any = r.failReason;
              reason = o?.exception_message || o?.message || JSON.stringify(o);
            } catch {
              reason = `RH 失败 code=${r.code}`;
            }
          }
          update({ status: 'error', error: reason });
          setError(reason);
        } else {
          update({ status: 'polling', rhCode: r.code });
        }
      } catch (e: any) {
        console.warn('RH 轮询出错', e?.message);
      }
    }, POLL_INT);
  };

  // 返回本次拉取与计算后的可用 list + paramValues，供 handleRun 同步路径直接使用
  // （避免 React state 异步更新后 closure 还指向旧值）
  const handleFetchInfo = async (): Promise<{
    list: any[];
    paramValues: Record<string, { value: string; sourceFromUpstream?: boolean }>;
  } | null> => {
    setError(null);
    if (!webappId) {
      setError('请先填写 webappId');
      return null;
    }
    setFetchingInfo(true);
    try {
      const info = await fetchRhAppInfo(webappId);
      const list: any[] = info?.nodeInfoList || [];
      const next: Record<string, { value: string; sourceFromUpstream?: boolean }> = { ...paramValues };
      for (const it of list) {
        const k = paramKey(it.nodeId, it.fieldName);
        const vt = inferValueType(it?.fieldType);
        if (k in next) continue;
        if (vt === 'image' || vt === 'video' || vt === 'audio') {
          const upUrl = findUpstreamUrl(vt);
          if (upUrl) {
            next[k] = { value: upUrl, sourceFromUpstream: true };
            continue;
          }
        }
        next[k] = { value: it?.fieldValue ?? '' };
      }
      update({ appInfo: info, paramValues: next });
      return { list, paramValues: next };
    } catch (e: any) {
      setError(e?.message || '查询失败');
      return null;
    } finally {
      setFetchingInfo(false);
    }
  };

  // 自动拉取：第一次 webappId 有值 且 上游有媒体节点 且 还未拉取过任何 appInfo 时，
  // 静默拉一次，避免用户漏点搜索按钮导致提交空 nodeInfoList 后 RH 用了应用默认参数。
  const autoFetchedRef = useRef(false);
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!webappId) return;
    if (appInfo) return;
    if (fetchingInfo) return;
    const hasUpstreamMedia = !!(findUpstreamUrl('image') || findUpstreamUrl('video') || findUpstreamUrl('audio'));
    if (!hasUpstreamMedia) return;
    autoFetchedRef.current = true;
    void handleFetchInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webappId, upstreamNodes, appInfo]);

  const handleRun = async () => {
    setError(null);
    if (!webappId) {
      setError('请先填写 webappId');
      return;
    }
    // 兑底：如果还没拉过 appInfo 且上游接了媒体节点，先同步拉一次，
    // 避免提交空 nodeInfoList 后 RH 黙默用了应用默认参数。
    let freshList: any[] | null = null;
    let freshValues: Record<string, { value: string; sourceFromUpstream?: boolean }> | null = null;
    if (!appInfo?.nodeInfoList?.length) {
      const hasUpstreamMedia = !!(findUpstreamUrl('image') || findUpstreamUrl('video') || findUpstreamUrl('audio'));
      if (hasUpstreamMedia) {
        const r = await handleFetchInfo();
        if (r) {
          freshList = r.list;
          freshValues = r.paramValues;
        }
      }
    }
    update({ status: 'submitting', error: null, urls: [], taskId: null });
    try {
      const rawList = buildRawNodeInfoList(freshList ?? undefined, freshValues ?? undefined);
      // 提交前：把媒体类 url 转成 RH 内部 fileName
      const nodeInfoList = await resolveNodeInfoList(rawList);
      const r = await submitRh({
        webappId,
        nodeInfoList,
        instanceType: instanceType || undefined,
      });
      update({ status: 'polling', taskId: r.taskId });
      startPolling(r.taskId);
    } catch (e: any) {
      setError(e?.message || '提交失败');
      update({ status: 'error', error: e?.message });
    }
  };

  // 接入运行总线,供批量运行调起(不重复调起轮询中的任务)
  useRunTrigger(id, async () => {
    if (status === 'submitting' || status === 'polling') return;
    await handleRun();
  });

  const handleStop = () => {
    stopPoll();
    update({ status: 'idle' });
  };

  const isBusy = status === 'submitting' || status === 'polling';
  const nodeInfoList: any[] = appInfo?.nodeInfoList || [];

  return (
    <div
      className={`relative rounded-xl border-2 transition-all w-[340px] ${
        selected ? 'border-cyan-400 shadow-2xl shadow-cyan-500/20' : 'border-white/15 hover:border-white/30'
      }`}
      style={{ background: 'rgba(20,20,22,.92)', backdropFilter: 'blur(8px)' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-cyan-400 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-cyan-400 !border-0" />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: 'rgba(6,182,212,.2)', color: '#67e8f9', boxShadow: 'inset 0 0 0 1px rgba(6,182,212,.45)' }}
        >
          <Workflow size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">RunningHub</div>
          <div className="text-[10px] text-white/40 truncate">{appInfo?.appName || appInfo?.name || 'AI 工作流'}</div>
        </div>
      </div>

      <div className="p-2.5 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
        <div>
          <label className="text-[10px] text-white/50 block mb-1">Webapp ID</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={webappId}
              onChange={(e) => update({ webappId: e.target.value })}
              placeholder="1234567890"
              className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/30"
            />
            <button
              onClick={handleFetchInfo}
              disabled={fetchingInfo}
              title="拉取应用信息"
              className="px-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 disabled:opacity-50"
            >
              {fetchingInfo ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
            </button>
          </div>
        </div>

        {/* 参数表单：拉取 nodeInfoList 后逐条展开 */}
        {nodeInfoList.length > 0 && (
          <div className="rounded border border-cyan-500/20 bg-cyan-500/5 p-2 space-y-2 max-h-[420px] overflow-auto">
            <div className="text-[10px] text-cyan-200/80 flex items-center justify-between">
              <span>参数 ({nodeInfoList.length})</span>
              <span className="text-white/30">点击字段可编辑</span>
            </div>
            {nodeInfoList.map((it: any, i: number) => {
              const vt = inferValueType(it?.fieldType);
              const k = paramKey(it.nodeId, it.fieldName);
              const cur = paramValues[k] || { value: it?.fieldValue ?? '' };
              const isMedia = vt === 'image' || vt === 'video' || vt === 'audio';
              const fieldDataOptions = (() => {
                const fd = it?.fieldData;
                if (Array.isArray(fd) && fd.length > 0 && fd.every((x) => typeof x === 'string' || typeof x === 'number')) return fd as any[];
                return null;
              })();
              return (
                <div key={i} className="space-y-1 pb-2 border-b border-white/5 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-white/80 font-medium truncate">{it.fieldName}</span>
                    <span className="text-[9px] text-cyan-300/60 px-1 rounded bg-cyan-500/10">{vt}</span>
                    <span className="text-[9px] text-white/30">#{it.nodeId}</span>
                  </div>
                  {it?.description && (
                    <div className="text-[9px] text-white/40 leading-tight">{it.description}</div>
                  )}
                  {isMedia ? (
                    <>
                      <div className="flex items-center justify-between text-[10px]">
                        <label className="flex items-center gap-1 text-cyan-200/80 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!cur.sourceFromUpstream}
                            onChange={(e) => setParam(k, { sourceFromUpstream: e.target.checked })}
                            className="accent-cyan-400"
                          />
                          从上游自动获取
                        </label>
                        {cur.sourceFromUpstream && (
                          <button
                            onClick={() => {
                              const u = findUpstreamUrl(vt);
                              if (u) setParam(k, { value: u });
                            }}
                            className="flex items-center gap-1 text-cyan-200/80 hover:text-cyan-100"
                            title="重新同步上游 url"
                          >
                            <RefreshCw size={9} /> 同步
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={cur.value}
                        onChange={(e) => setParam(k, { value: e.target.value })}
                        placeholder={cur.sourceFromUpstream ? '(从上游自动填入)' : `${vt} url 或 fileName`}
                        readOnly={!!cur.sourceFromUpstream}
                        className={`w-full rounded border px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/30 ${
                          cur.sourceFromUpstream
                            ? 'bg-cyan-500/10 border-cyan-500/30 cursor-not-allowed'
                            : 'bg-white/5 border-white/10 focus:border-white/30'
                        }`}
                      />
                      {vt === 'image' && (() => {
                        // 只有真正可加载的 url 才预览：http(s):// 或本地静态路径；
                        // RH 内部 fileName（如 api/xxx.png、纯 hash）不能加载，不渲染避免破图占位符
                        const v = cur.value || '';
                        const isHttpUrl = /^https?:\/\//i.test(v);
                        const isLocalUrl =
                          v.startsWith('/files/output/') ||
                          v.startsWith('/output/') ||
                          v.startsWith('/files/input/') ||
                          v.startsWith('/input/');
                        const isImgExt = /\.(png|jpe?g|webp|gif|bmp|avif)(\?.*)?$/i.test(v);
                        if (!(isHttpUrl || isLocalUrl) || !isImgExt) return null;
                        return (
                          <img
                            src={v}
                            alt="预览"
                            className="w-full max-h-24 object-contain rounded border border-white/10"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        );
                      })()}
                    </>
                  ) : fieldDataOptions ? (
                    <select
                      value={cur.value}
                      onChange={(e) => setParam(k, { value: e.target.value })}
                      className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30"
                    >
                      {!cur.value && <option value="">(选择)</option>}
                      {fieldDataOptions.map((opt, oi) => (
                        <option key={oi} value={String(opt)}>{String(opt)}</option>
                      ))}
                    </select>
                  ) : vt === 'number' ? (
                    <input
                      type="number"
                      value={cur.value}
                      onChange={(e) => setParam(k, { value: e.target.value })}
                      placeholder={String(it?.fieldValue ?? '')}
                      className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
                    />
                  ) : (
                    <textarea
                      value={cur.value}
                      onChange={(e) => setParam(k, { value: e.target.value })}
                      placeholder={String(it?.fieldValue ?? '')}
                      rows={2}
                      className="w-full resize-none rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div>
          <label className="text-[10px] text-white/50 block mb-1">实例类型(可选)</label>
          <input
            type="text"
            value={instanceType}
            onChange={(e) => update({ instanceType: e.target.value })}
            placeholder="plus"
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
        </div>

        {!isBusy ? (
          <button
            onClick={handleRun}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-xs font-medium transition-colors"
          >
            <Sparkles size={12} /> 运行工作流
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-zinc-500/20 hover:bg-zinc-500/30 text-zinc-200 text-xs font-medium transition-colors"
          >
            <Square size={11} /> 停止
          </button>
        )}

        {isBusy && (
          <div className="flex items-center gap-1 text-[10px] text-cyan-200/80">
            <Loader2 size={11} className="animate-spin" />
            {status === 'submitting' ? '提交任务...' : '轮询中'}
            {taskId && <span className="ml-auto text-white/30">{String(taskId).slice(0, 10)}…</span>}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-1 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </div>

      {urls.length > 0 && !hasAutoOutput && (
        <div className="border-t border-white/10 p-2 space-y-1">
          {urls.map((u, i) => {
            if (/\.(mp4|webm|mov)$/i.test(u)) {
              return <video key={i} src={u} controls className="w-full rounded" />;
            }
            if (/\.(mp3|wav|ogg)$/i.test(u)) {
              return <audio key={i} src={u} controls className="w-full h-8" />;
            }
            return <img key={i} src={u} alt={`输出 ${i}`} className="w-full rounded object-cover" />;
          })}
        </div>
      )}
    </div>
  );
};

export default memo(RunningHubNode);
