import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Handle,
  Position,
  useNodeConnections,
  useNodesData,
  useReactFlow,
  type NodeProps,
  type Node,
} from '@xyflow/react';
import { MonitorPlay, Type as TypeIcon, Image as ImageIcon, Video as VideoIcon, Music, Download, Pencil, Check, Edit3 } from 'lucide-react';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useThemeStore } from '../../stores/theme';
import { PORT_COLOR } from '../../config/portTypes';
import ImageEditModal, { type ImageEditProduceMeta } from './ImageEditModal';
import { useMaterialDropTarget } from '../../hooks/useMaterialDropTarget';
import { useDragMaterialStore, type MaterialPayload } from '../../stores/dragMaterial';
import ResizableCorners from './ResizableCorners';

/**
 * OutputNode - 通用输出素材节点 (中继展示型)
 *
 * 设计:
 *   1. 输入: 接收上游任意 文本/图像/视频/音频 连入 (target handle, 左侧)
 *   2. 自动遍历上游节点的 data, 抽取所有可识别的:
 *      - 文本: prompt / reply / text / outputText
 *      - 图像: imageUrl / imageUrls[] / urls[] / generatedImages[]
 *      - 视频: videoUrl
 *      - 音频: audioUrl
 *   3. 分区显示, 图像/视频按原始宽高比 (object-contain + maxHeight) 不强制裁剪
 *   4. 文本双击进入可编辑状态, 编辑保存到 data.outputText (覆盖上游 live 文本)
 *      置空 outputText 时再次显示上游原文
 *   5. 输出: 收集到的 文本/图像/视频/音频 同时透传到本节点自身 data 的
 *      prompt / imageUrl / imageUrls / urls / videoUrl / audioUrl 字段上,
 *      下游节点能像读上游一样读到 (source handle, 右侧, any)
 *
 * 渲染联动机制(重要):
 *   - 上游订阅: useNodeConnections + useNodesData (xyflow 官方 hook)
 *   - 下游透传: useEffect 监听 collected + displayText 变化,
 *     写不同字段避免踩 outputText (后者是「用户编辑覆盖」标记),
 *     同时手式比较 cur/next, 一致时不调 update 以免产生循环。
 */

const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(u);
const isAudioUrl = (u: string) => /\.(mp3|wav|ogg|m4a|flac)(\?|$)/i.test(u);

interface Collected {
  texts: string[];
  images: string[];
  videos: string[];
  audios: string[];
}

const OutputNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const d = (data as any) || {};
  const rf = useReactFlow();

  // 节点本地尺寸 state: 默认 (320, 高度由内容撑开)
  // 拖角后由 ResizableCorners onResize 同步具体 px — 保证节点始终有具体尺寸 → wrapper measured 准确
  // → keepAspectRatio 生效 (同比例缩放) + handleBounds 准确 (连线稳定)
  const [size, setSize] = useState<{ w: number; h?: number }>({ w: 320 });

  // 订阅连入本节点 target handle 的连接变化
  const connections = useNodeConnections({ id, handleType: 'target' });
  const upstreamIds = useMemo(
    () => Array.from(new Set(connections.map((c) => c.source))),
    [connections]
  );
  // 订阅上游节点的 data, 任何上游 data 变化都会触发重渲染
  const upstreamNodes = useNodesData(upstreamIds);

  // v1.2.8.4: 收集每个上游 source 上被连接的 sourceHandle 集合,
  //           供 FramePair 等多端口节点按 handle 区分输出 (与 useUpstreamMaterials 对齐)
  const handleMap = useMemo(() => {
    const m = new Map<string, Set<string | null>>();
    for (const c of connections) {
      let set = m.get(c.source);
      if (!set) { set = new Set<string | null>(); m.set(c.source, set); }
      set.add((c as any).sourceHandle ?? null);
    }
    return m;
  }, [connections]);

  // 细粒度字段签名: 防止 xyflow useNodesData 返回引用稳定导致 useMemo 漏重算;
  // 纯字符串变化 React 可靠跟踪，上游任何一个被迫关心的字段变动均会重算 collected。
  const upstreamSig = useMemo(() => {
    const list = Array.isArray(upstreamNodes) ? upstreamNodes : [];
    return list
      .map((n: any) => {
        const ud = n?.data || {};
        const arr1 = Array.isArray(ud.imageUrls) ? ud.imageUrls.join(',') : '';
        const arr2 = Array.isArray(ud.urls) ? ud.urls.join(',') : '';
        const arr3 = Array.isArray(ud.generatedImages) ? ud.generatedImages.join(',') : '';
        const arr4 = Array.isArray(ud.consumedTexts) ? ud.consumedTexts.join('\u241F') : '';
        return [
          n?.id || '',
          ud.outputText || '',
          ud.reply || '',
          ud.prompt || '',
          ud.text || '',
          ud.imageUrl || '',
          ud.videoUrl || '',
          ud.audioUrl || '',
          ud.audioUrl_1 || '', // Suno 双轨副轨; 漏写会导致只显示第 1 首
          ud.firstFrameUrl || '', // v1.2.8.4: FramePair 双端口字段
          ud.lastFrameUrl || '',
          ud.__loopAccumulate ? `LA:${ud.__loopAccumulate}` : '', // v1.2.9.1: 循环累积标记 — 进入/退出循环时需重算 collected
          arr1,
          arr2,
          arr3,
          arr4,
        ].join('§');
      })
      .join('|');
  }, [upstreamNodes]);

  const collected = useMemo<Collected>(() => {
    const out: Collected = { texts: [], images: [], videos: [], audios: [] };

    // 「被 LLM 消化」文本跳过集: 与 useUpstreamMaterials 保持一致。
    // 场景: TextNode 同时连 LLM 和 OutputNode 时, 避免 原始 prompt + LLM reply 同现 2 条。
    const skipTextSet = new Set<string>();
    {
      const list0 = Array.isArray(upstreamNodes) ? upstreamNodes : [];
      for (const n of list0) {
        const ud: any = n?.data || {};
        const hasReply = typeof ud.reply === 'string' && ud.reply.trim().length > 0;
        if (!hasReply) continue;
        if (Array.isArray(ud.consumedTexts)) {
          for (const t of ud.consumedTexts) {
            if (typeof t === 'string') {
              const s = t.trim();
              if (s) skipTextSet.add(s);
            }
          }
        }
      }
    }

    const pushUnique = (arr: string[], v: any) => {
      if (typeof v !== 'string') return;
      const s = v.trim();
      if (!s) return;
      if (arr.indexOf(s) === -1) arr.push(s);
    };
    const pushUniqueText = (arr: string[], v: any) => {
      if (typeof v !== 'string') return;
      const s = v.trim();
      if (!s) return;
      if (skipTextSet.has(s)) return; // 已被 LLM 消化
      if (arr.indexOf(s) === -1) arr.push(s);
    };

    const list = Array.isArray(upstreamNodes) ? upstreamNodes : [];
    for (const n of list) {
      const ud: any = n?.data || {};
      const sid = (n as any)?.id || '';
      const handles = handleMap.get(sid) || new Set<string | null>([null]);

      // === v1.2.9.0: 循环累积模式 —— 上游节点被 LoopNode 标记 __loopAccumulate 时,
      //             跳过该上游的 fresh 字段收集 (让本节点 direct*Urls / directOutputText 的累积值独占显示)。
      //             这样跨轮产物不会被生成节点「本轮覆盖」的 fresh 担换, 循环结束后标记被 LoopNode 清除, 恢复正常透传。
      if (ud.__loopAccumulate) continue;

      // 文本
      pushUniqueText(out.texts, ud.outputText);
      pushUniqueText(out.texts, ud.reply);
      pushUniqueText(out.texts, ud.prompt);
      pushUniqueText(out.texts, ud.text);

      // === v1.2.8.4: FramePair 双端口语义 ===
      // 节点同时具备 firstFrameUrl + lastFrameUrl 字段时按 sourceHandle 过滤,
      //   - 'first' 端口 → 只输出首帧
      //   - 'last'  端口 → 只输出尾帧
      //   - null/默认  → 同时输出两帧 (autoOutput / 手动接默认 handle 的兼容)
      // 跳过通用 imageUrl/imageUrls 分支, 避免历史残留字段把双图都捞过来。
      const isFramePair =
        Object.prototype.hasOwnProperty.call(ud, 'firstFrameUrl') &&
        Object.prototype.hasOwnProperty.call(ud, 'lastFrameUrl');
      if (isFramePair) {
        const wantFirst = handles.has('first') || (handles.has(null) && !handles.has('last'));
        const wantLast = handles.has('last') || (handles.has(null) && !handles.has('first'));
        if (wantFirst) pushUnique(out.images, ud.firstFrameUrl);
        if (wantLast) pushUnique(out.images, ud.lastFrameUrl);
        // 视频/音频 此节点不会有, 跳过
        continue;
      }

      // 图像 - 单
      pushUnique(out.images, ud.imageUrl);
      // 图像 - 多
      const arrFields = ['imageUrls', 'urls', 'generatedImages'];
      for (const f of arrFields) {
        const v = ud[f];
        if (Array.isArray(v)) v.forEach((u) => pushUnique(out.images, u));
      }

      // 视频
      pushUnique(out.videos, ud.videoUrl);

      // 音频 (audioUrl 主轨, audioUrl_1 副轨——AudioNode/SunoNode 双输出口)
      pushUnique(out.audios, ud.audioUrl);
      pushUnique(out.audios, ud.audioUrl_1);
    }

    // 独立模式 (双击编辑生成的产物 OutputNode):
    //   节点本身携带 directImageUrl/directImageUrls, 未连任何上游也能独立展示。
    //   这些产物不会被 pickKind/pickIndex 过滤干预, 在下面独立补补。
    //   v1.5: 新增 directVideoUrl / directAudioUrl / outputText 以支持跨节点拖拽投放。
    if (typeof d.directImageUrl === 'string' && d.directImageUrl) {
      pushUnique(out.images, d.directImageUrl);
    }
    if (Array.isArray(d.directImageUrls)) {
      d.directImageUrls.forEach((u: any) => pushUnique(out.images, u));
    }
    if (typeof d.directVideoUrl === 'string' && d.directVideoUrl) {
      pushUnique(out.videos, d.directVideoUrl);
    }
    // v1.2.8.3: 多产物数组 (LoopNode 串联 / 并联跨轮累积)
    if (Array.isArray(d.directVideoUrls)) {
      d.directVideoUrls.forEach((u: any) => pushUnique(out.videos, u));
    }
    if (typeof d.directAudioUrl === 'string' && d.directAudioUrl) {
      pushUnique(out.audios, d.directAudioUrl);
    }
    if (Array.isArray(d.directAudioUrls)) {
      d.directAudioUrls.forEach((u: any) => pushUnique(out.audios, u));
    }
    // v1.2.8.5: 循环器跨轮累积的文本联接作为独立一项加入 (已含 —— 分隔符)
    if (typeof d.directOutputText === 'string' && d.directOutputText) {
      pushUniqueText(out.texts, d.directOutputText);
    }

    // 兜底: 一些节点把视频/音频塞在 imageUrl, 通过扩展名识别再纠正
    out.images = out.images.filter((u) => {
      if (isVideoUrl(u)) {
        if (out.videos.indexOf(u) === -1) out.videos.push(u);
        return false;
      }
      if (isAudioUrl(u)) {
        if (out.audios.indexOf(u) === -1) out.audios.push(u);
        return false;
      }
      return true;
    });

    // === pickKind / pickIndex 过滤 ===
    // Canvas 自动创建多个 OutputNode 映射上游多项输出时,
    // 会在 data 里标记 pickKind ('image'/'video'/'audio') + pickIndex,
    // 则本节点只保留对应 kind 的第 pickIndex 项, 避免多图场景下
    // 所有 OutputNode 都重复显示全部输出。
    // 手动连连的 OutputNode 不带 pickKind => 保留原语义 (显示上游全部).
    const pickKind: string | undefined = d.pickKind;
    const pickIndex: number | undefined =
      typeof d.pickIndex === 'number' ? d.pickIndex : undefined;
    if (pickKind && typeof pickIndex === 'number') {
      if (pickKind === 'image') {
        out.images = out.images[pickIndex] ? [out.images[pickIndex]] : [];
        out.videos = [];
        out.audios = [];
        // 图像项模式下还保留文本 (提示词) 以便下游可读
      } else if (pickKind === 'video') {
        out.videos = out.videos[pickIndex] ? [out.videos[pickIndex]] : [];
        out.images = [];
        out.audios = [];
      } else if (pickKind === 'audio') {
        out.audios = out.audios[pickIndex] ? [out.audios[pickIndex]] : [];
        out.images = [];
        out.videos = [];
      }
    }

    return out;
  }, [upstreamNodes, upstreamSig, handleMap, d.pickKind, d.pickIndex, d.directImageUrl, d.directImageUrls, d.directVideoUrl, d.directVideoUrls, d.directAudioUrl, d.directAudioUrls, d.directOutputText]);

  // 文本编辑
  const overrideText: string = typeof d.outputText === 'string' ? d.outputText : '';
  const liveText = collected.texts.join('\n\n──────\n\n');
  const displayText = overrideText !== '' ? overrideText : liveText;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const enterEdit = () => {
    setDraft(displayText);
    setEditing(true);
    setTimeout(() => taRef.current?.focus(), 30);
  };
  const saveEdit = () => {
    update({ outputText: draft });
    setEditing(false);
  };
  const cancelEdit = () => {
    setEditing(false);
  };
  const restoreLive = () => {
    update({ outputText: '' });
    setEditing(false);
  };

  const isEdited = overrideText !== '' && overrideText !== liveText;
  const HANDLE = PORT_COLOR.any;
  const accent = '#5eead4'; // teal-300, 与 nodeRegistry color: 'teal' 对齐

  const total = collected.texts.length + collected.images.length + collected.videos.length + collected.audios.length;

  // === 双击图片 → 裁剪/宫格弹窗 ===
  // 仅针对 collected.images 中的单张图生效; 产物“不”修改本节点, 而是
  // 以 directImageUrl 独立模式创建 N 个新 OutputNode (沉淀在本节点的右下区),
  // 取 id 前缀 'output-auto-edit-' 以与源 output-auto-* 区分 (不受重排接管).
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const handleProduce = (urls: string[], _meta: ImageEditProduceMeta) => {
    if (!urls || urls.length === 0) return;
    const me = rf.getNode(id);
    const myW = (me as any)?.measured?.width || (me as any)?.width || 320;
    const myH = (me as any)?.measured?.height || (me as any)?.height || 360;
    const baseX = (me?.position?.x ?? 0) + myW + 80;
    const baseY = me?.position?.y ?? 0;
    const COLS = 3;
    const COL_W = 350;
    const ROW_H = Math.max(360, myH); // 以本节点高度为下限避免重叠
    const ts = Date.now();
    const newNodes: Node[] = urls.map((u, i) => {
      const newId = `output-auto-edit-${id}-${ts}-${i}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      return {
        id: newId,
        type: 'output',
        position: {
          x: baseX + (i % COLS) * COL_W,
          y: baseY + Math.floor(i / COLS) * ROW_H,
        },
        data: {
          directImageUrl: u,
          // 便于下游节点从 data 读取 (与现有 effect 透传不冲突)
          imageUrl: u,
        },
      } as Node;
    });
    rf.addNodes(newNodes);
  };

  // === 跨节点拖拽: source (从 collected.* 拖出) ===
  // 独立函数避开 hooks-in-loop 限制
  const startDrag = useDragMaterialStore((s) => s.start);
  const beginMaterialDrag = (e: React.MouseEvent, payload: MaterialPayload) => {
    if (e.button !== 0) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag(payload, e.clientX, e.clientY);
  };

  // === 跨节点拖拽: target (接收后以 direct* 独立模式补充, 不依赖上游) ===
  const handleDrop = (payload: MaterialPayload) => {
    if (payload.kind === 'image' && payload.url) {
      const cur: string[] = Array.isArray(d.directImageUrls) ? d.directImageUrls : [];
      if (!d.directImageUrl) {
        update({ directImageUrl: payload.url });
      } else if (cur.indexOf(payload.url) === -1) {
        update({ directImageUrls: [...cur, payload.url] });
      }
    } else if (payload.kind === 'video' && payload.url) {
      update({ directVideoUrl: payload.url });
    } else if (payload.kind === 'audio' && payload.url) {
      update({ directAudioUrl: payload.url });
    } else if (payload.kind === 'text' && typeof payload.text === 'string') {
      update({ outputText: payload.text });
    }
  };
  const { dropProps, isAccepting } = useMaterialDropTarget({
    id,
    accepts: ['image', 'video', 'audio', 'text'],
    onDrop: handleDrop,
  });

  // === v1.2.9.2: 循环累积自接管 —— OutputNode 自己检测上游 __loopAccumulate 并将 fresh 追加到自身 direct*Urls
  //         不依赖 LoopNode 跨节点 setNodes 写回 (避免时序冲突/覆盖), LoopNode 只负责注入/清除 __loopAccumulate 标记。
  // === v1.2.9.4: 改用 rf.setNodes 函数式形式读取自身节点最新 data 计算 merge ——避免闭包陈旧 d.directImageUrls
  //         在快速多轮循环下被后来的 useEffect fire 覆盖 (表现为: ImageNode/VideoNode 等下游 OutputNode 只累积到 1−2 张)。
  //         同时该机制是「通用」的 ——后续新增任何 EXEC 节点, 只要 update 写入 imageUrl/imageUrls/urls/generatedImages/videoUrl/videoUrls/audioUrl/audioUrl_1/audioUrls/outputText/reply/text
  //         中任一字段, 下游 OutputNode 均可累积, 无需修改。
  useEffect(() => {
    const list = Array.isArray(upstreamNodes) ? upstreamNodes : [];
    const hasAccumUpstream = list.some((n: any) => n?.data?.__loopAccumulate);
    if (!hasAccumUpstream) return;
    const freshImgs: string[] = [];
    const freshVids: string[] = [];
    const freshAuds: string[] = [];
    const freshTxts: string[] = [];
    const pushUniqLocal = (arr: string[], v: any) => {
      if (typeof v !== 'string') return;
      const s = v.trim();
      if (!s) return;
      if (arr.indexOf(s) === -1) arr.push(s);
    };
    for (const n of list) {
      const ud: any = n?.data || {};
      if (!ud.__loopAccumulate) continue;
      const sid = (n as any)?.id || '';
      const handles = handleMap.get(sid) || new Set<string | null>([null]);
      const isFP =
        Object.prototype.hasOwnProperty.call(ud, 'firstFrameUrl') &&
        Object.prototype.hasOwnProperty.call(ud, 'lastFrameUrl');
      if (isFP) {
        const wantFirst = handles.has('first') || (handles.has(null) && !handles.has('last'));
        const wantLast = handles.has('last') || (handles.has(null) && !handles.has('first'));
        if (wantFirst) pushUniqLocal(freshImgs, ud.firstFrameUrl);
        if (wantLast) pushUniqLocal(freshImgs, ud.lastFrameUrl);
        continue;
      }
      // 通用采集 —— 任何 EXEC 节点写入以下任一字段都会被累积
      pushUniqLocal(freshImgs, ud.imageUrl);
      if (Array.isArray(ud.imageUrls)) ud.imageUrls.forEach((u: any) => pushUniqLocal(freshImgs, u));
      if (Array.isArray(ud.urls)) ud.urls.forEach((u: any) => pushUniqLocal(freshImgs, u));
      if (Array.isArray(ud.generatedImages)) ud.generatedImages.forEach((u: any) => pushUniqLocal(freshImgs, u));
      pushUniqLocal(freshVids, ud.videoUrl);
      if (Array.isArray(ud.videoUrls)) ud.videoUrls.forEach((u: any) => pushUniqLocal(freshVids, u));
      pushUniqLocal(freshAuds, ud.audioUrl);
      pushUniqLocal(freshAuds, ud.audioUrl_1);
      if (Array.isArray(ud.audioUrls)) ud.audioUrls.forEach((u: any) => pushUniqLocal(freshAuds, u));
      if (typeof ud.outputText === 'string' && ud.outputText) pushUniqLocal(freshTxts, ud.outputText);
      if (typeof ud.reply === 'string' && ud.reply) pushUniqLocal(freshTxts, ud.reply);
      if (typeof ud.text === 'string' && ud.text) pushUniqLocal(freshTxts, ud.text);
    }
    if (freshImgs.length === 0 && freshVids.length === 0 && freshAuds.length === 0 && freshTxts.length === 0) return;
    // v1.2.9.4: 函数式 setNodes —— 从 store 最新 data 读取 cur direct*Urls, 避免闭包旧值被其他 useEffect 覆盖
    rf.setNodes((nds) => nds.map((nd) => {
      if (nd.id !== id) return nd;
      const od: any = nd.data || {};
      const curImgs: string[] = Array.isArray(od.directImageUrls) ? od.directImageUrls : [];
      const curVids: string[] = Array.isArray(od.directVideoUrls) ? od.directVideoUrls : [];
      const curAuds: string[] = Array.isArray(od.directAudioUrls) ? od.directAudioUrls : [];
      const curTxts: string[] = typeof od.directOutputText === 'string' && od.directOutputText
        ? od.directOutputText.split('\n\n')
        : [];
      const mergedImgs = curImgs.slice(); freshImgs.forEach((u) => { if (mergedImgs.indexOf(u) === -1) mergedImgs.push(u); });
      const mergedVids = curVids.slice(); freshVids.forEach((u) => { if (mergedVids.indexOf(u) === -1) mergedVids.push(u); });
      const mergedAuds = curAuds.slice(); freshAuds.forEach((u) => { if (mergedAuds.indexOf(u) === -1) mergedAuds.push(u); });
      const mergedTxts = curTxts.slice(); freshTxts.forEach((t) => { if (mergedTxts.indexOf(t) === -1) mergedTxts.push(t); });
      let changed = false;
      const nextData: any = { ...od };
      if (mergedImgs.length !== curImgs.length) { nextData.directImageUrls = mergedImgs; changed = true; }
      if (mergedVids.length !== curVids.length) { nextData.directVideoUrls = mergedVids; changed = true; }
      if (mergedAuds.length !== curAuds.length) { nextData.directAudioUrls = mergedAuds; changed = true; }
      if (mergedTxts.length !== curTxts.length) { nextData.directOutputText = mergedTxts.join('\n\n'); changed = true; }
      return changed ? { ...nd, data: nextData } : nd;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamSig]);

  // === 下游透传: 将 collected + displayText 写到自身 data 供下游节点读取 ===
  // 仅在生成的输出实际变化时调用 update, 避免 setNode 风暴.
  // 不踩 outputText (保留 「用户编辑覆盖」 语义), 文本透传到 prompt/text/reply.
  //
  // ⚡ 过滤规则 (需求 #3):
  //   - 若 collected 同时含有非文本素材 (图/视/音任一), 下游只需要非文本部分,
  //     清空 prompt/text/reply (避免下游生成节点误将上下文提示词一起当参考文本)
  //   - 若只有文本 (纯文本输出), 仍将文本透传到 prompt/text/reply
  useEffect(() => {
    const hasNonText =
      collected.images.length > 0 ||
      collected.videos.length > 0 ||
      collected.audios.length > 0;
    const passText = hasNonText ? '' : (displayText || '');
    const next: any = {
      prompt: passText,
      text: passText,
      reply: passText,
      imageUrl: collected.images[0] || '',
      imageUrls: collected.images.slice(),
      urls: collected.images.slice(),
      videoUrl: collected.videos[0] || '',
      audioUrl: collected.audios[0] || '',
      audioUrl_1: collected.audios[1] || '', // 透传 Suno 双轨副轨避免串联丢失
    };
    const cur: any = {
      prompt: d.prompt || '',
      text: d.text || '',
      reply: d.reply || '',
      imageUrl: d.imageUrl || '',
      imageUrls: Array.isArray(d.imageUrls) ? d.imageUrls : [],
      urls: Array.isArray(d.urls) ? d.urls : [],
      videoUrl: d.videoUrl || '',
      audioUrl: d.audioUrl || '',
      audioUrl_1: d.audioUrl_1 || '',
    };
    const changed =
      cur.prompt !== next.prompt ||
      cur.text !== next.text ||
      cur.reply !== next.reply ||
      cur.imageUrl !== next.imageUrl ||
      cur.videoUrl !== next.videoUrl ||
      cur.audioUrl !== next.audioUrl ||
      cur.audioUrl_1 !== next.audioUrl_1 ||
      JSON.stringify(cur.imageUrls) !== JSON.stringify(next.imageUrls) ||
      JSON.stringify(cur.urls) !== JSON.stringify(next.urls);
    if (changed) update(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayText, collected]);

  // === 选中节点上方浮动「Edit」按钮 ===
  // 仅当节点被选中且至少存在一张图像时出现，等价于双击图像触发
  // ImageEditModal（裁剪 / 宫格切分），多图时编辑第一张。
  const canEditImage = selected && collected.images.length > 0;
  const onClickEditTopBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (collected.images.length > 0) setEditingUrl(collected.images[0]);
  };

  return (
    <div
      className="relative flex flex-col"
      style={{ width: size.w, height: size.h, minWidth: 260 }}
      {...dropProps}
    >
      {/* 四角同比例缩放 (仅选中时出现) — 主题色 teal-300 */}
      <ResizableCorners
        selected={selected}
        minWidth={260}
        minHeight={160}
        accent={accent}
        onResize={(_e, p) => setSize({ w: p.width, h: p.height })}
      />
      {/* 选中时浮动「Edit」按钮 — 仅图像类型可用，与双击预览图等价 */}
      {canEditImage && (
        <button
          type="button"
          className="nodrag nopan"
          onClick={onClickEditTopBtn}
          onMouseDown={(e) => e.stopPropagation()}
          title="编辑图像（裁剪 / 宫格切分），等同双击预览图"
          style={{
            position: 'absolute',
            top: -34,
            left: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            height: 26,
            background: isDark ? 'rgba(28,28,32,0.92)' : 'rgba(255,255,255,0.95)',
            color: accent,
            border: `1px solid ${accent}66`,
            borderRadius: 6,
            boxShadow: isDark ? '0 6px 24px rgba(0,0,0,0.4)' : '0 6px 24px rgba(0,0,0,0.12)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            zIndex: 30,
          }}
        >
          <Edit3 size={12} />
          <span>Edit</span>
        </button>
      )}
      {/* target handle (左侧) - 上游任意类型可连入 */}
      <Handle
        type="target"
        position={Position.Left}
        className="!border-0"
        style={{
          background: HANDLE,
          width: 12,
          height: 12,
          minWidth: 12,
          minHeight: 12,
          top: '50%',
          left: -6,
          transform: 'translateY(-50%)',
          zIndex: 12,
          pointerEvents: 'all',
        }}
        title="文本 / 图像 / 视频 / 音频 任意类型可连入"
      />
      {/* source handle (右侧) - 作为中继节点可继续向下游透传 (any) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!border-0"
        style={{
          background: HANDLE,
          width: 12,
          height: 12,
          minWidth: 12,
          minHeight: 12,
          top: '50%',
          right: -6,
          transform: 'translateY(-50%)',
          zIndex: 12,
          pointerEvents: 'all',
        }}
        title="透传 文本 / 图像 / 视频 / 音频 到下游"
      />

      {/* 内层裁切容器: 圆角 + 越界裁切, 不影响外层 handle */}
      {/* 高度逻辑: root 默认 height=auto 时 内层也 auto 跟随内容自然高;
          root 拖角后有具体 px 时, 内层 flex-1 撑满剩余 + min-h-0 允许内容 overflow */}
      <div
        className={`rounded-xl border-2 transition-colors ${size.h ? 'flex-1 min-h-0' : ''}`}
        style={{
          background: isDark ? 'rgb(20,20,22)' : 'rgb(255,255,255)',
          overflow: 'auto',
          width: '100%',
          borderColor: isAccepting
            ? '#22c55e'
            : selected
              ? accent
              : isDark
                ? 'rgba(255,255,255,.15)'
                : 'rgba(0,0,0,.1)',
          boxShadow: isAccepting ? '0 0 0 3px rgba(34,197,94,0.25)' : undefined,
        }}
      >

      {/* 头部 */}
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b ${
          isDark ? 'border-white/10' : 'border-black/10'
        }`}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{
            background: accent + '33',
            color: accent,
            boxShadow: `inset 0 0 0 1px ${accent}66`,
          }}
        >
          <MonitorPlay size={13} />
        </div>
        <div className={`flex-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          输出素材
        </div>
        <span className={`text-[10px] ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
          {total} 项
        </span>
      </div>

      {/* body */}
      <div className="p-2.5 space-y-3" onMouseDown={(e) => e.stopPropagation()}>
        {total === 0 && (
          <div
            className={`rounded flex items-center justify-center text-[11px] py-3 px-2 ${
              isDark ? 'text-white/40' : 'text-zinc-400'
            }`}
          >
            连入上游 文本 / 图像 / 视频 / 音频 节点
          </div>
        )}

        {/* 文本区 */}
        {(collected.texts.length > 0 || isEdited) && (
          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
              <TypeIcon size={11} />
              <span className="flex-1">文本{isEdited ? ' · 已编辑' : ''}</span>
              {!editing && (
                <button
                  onClick={enterEdit}
                  className={`p-0.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                  title="双击文本或点此编辑"
                >
                  <Pencil size={10} />
                </button>
              )}
              {isEdited && !editing && (
                <button
                  onClick={restoreLive}
                  className={`text-[10px] px-1 rounded ${isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-zinc-600'}`}
                  title="恢复为上游 live 文本"
                >
                  恢复
                </button>
              )}
            </div>
            {!editing ? (
              <div
                onDoubleClick={enterEdit}
                onWheelCapture={(e) => e.stopPropagation()}
                className={`nowheel whitespace-pre-wrap break-words text-[12px] leading-relaxed rounded px-2 py-1.5 cursor-text ${
                  isDark ? 'bg-white/5 text-white/85' : 'bg-black/5 text-zinc-800'
                }`}
                style={{ maxHeight: 200, overflow: 'auto' }}
                title="双击编辑"
              >
                {displayText || <span className="opacity-50">(空)</span>}
              </div>
            ) : (
              <div className="space-y-1">
                <textarea
                  ref={taRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  rows={6}
                  className={`w-full rounded px-2 py-1.5 text-[12px] outline-none nodrag nowheel ${
                    isDark
                      ? 'bg-black/40 text-white border border-teal-400/40'
                      : 'bg-white text-zinc-900 border border-teal-500/50'
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') cancelEdit();
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
                  }}
                />
                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={cancelEdit}
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      isDark ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-black/5 hover:bg-black/10 text-zinc-700'
                    }`}
                  >
                    取消
                  </button>
                  <button
                    onClick={saveEdit}
                    className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 text-zinc-900"
                    style={{ background: accent }}
                  >
                    <Check size={10} /> 保存
                  </button>
                </div>
                <div className={`text-[10px] ${isDark ? 'text-white/30' : 'text-zinc-400'}`}>
                  Ctrl+Enter 保存 / Esc 取消
                </div>
              </div>
            )}
          </div>
        )}

        {/* 图像区 */}
        {collected.images.length > 0 && (
          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
              <ImageIcon size={11} />
              <span>图像 ({collected.images.length})</span>
            </div>
            {/* 单张：全宽大图预览；多张：3 列网格（一行最多 3 张，超过自动换行） */}
            <div
              className={
                collected.images.length >= 2
                  ? 'grid grid-cols-3 gap-1.5'
                  : 'space-y-1'
              }
            >
              {collected.images.map((u, i) => (
                <div key={i} className="space-y-0.5">
                  <img
                    src={u}
                    alt={`图像 ${i + 1}`}
                    className="w-full h-auto rounded block cursor-zoom-in"
                    style={{
                      background: '#0008',
                      objectFit: 'contain',
                      maxHeight: collected.images.length >= 2 ? 140 : 480,
                    }}
                    data-drag-source
                    data-drag-kind="image"
                    data-drag-url={u}
                    data-drag-preview={u}
                    data-drag-node-id={id}
                    onMouseDown={(e) =>
                      beginMaterialDrag(e, { kind: 'image', url: u, sourceNodeId: id, previewUrl: u })
                    }
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingUrl(u);
                    }}
                    title="双击编辑 (裁剪 / 宫格切分) · Ctrl+拖拽可送到其他节点"
                  />
                  <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                    <span className="truncate flex-1" title={u}>{u.split('/').pop()}</span>
                    <a
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                        isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-zinc-600'
                      }`}
                    >
                      <Download size={10} /> 下载
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 视频区 */}
        {collected.videos.length > 0 && (
          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
              <VideoIcon size={11} />
              <span>视频 ({collected.videos.length})</span>
            </div>
            {collected.videos.map((u, i) => (
              <div key={i} className="space-y-0.5">
                <video
                  src={u}
                  controls
                  className="w-full h-auto rounded block"
                  style={{ background: '#000', objectFit: 'contain', maxHeight: 480 }}
                  data-drag-source
                  data-drag-kind="video"
                  data-drag-url={u}
                  data-drag-preview={u}
                  data-drag-node-id={id}
                  onMouseDown={(e) =>
                    beginMaterialDrag(e, { kind: 'video', url: u, sourceNodeId: id, previewUrl: u })
                  }
                />
                <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                  <span className="truncate flex-1" title={u}>{u.split('/').pop()}</span>
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                      isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-zinc-600'
                    }`}
                  >
                    <Download size={10} /> 下载
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 音频区 */}
        {collected.audios.length > 0 && (
          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
              <Music size={11} />
              <span>音频 ({collected.audios.length})</span>
            </div>
            {collected.audios.map((u, i) => (
              <div key={i} className="space-y-0.5">
                <audio
                  src={u}
                  controls
                  className="w-full"
                  data-drag-source
                  data-drag-kind="audio"
                  data-drag-url={u}
                  data-drag-node-id={id}
                  onMouseDown={(e) =>
                    beginMaterialDrag(e, { kind: 'audio', url: u, sourceNodeId: id })
                  }
                />
                <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                  <span className="truncate flex-1" title={u}>{u.split('/').pop()}</span>
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                      isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-zinc-600'
                    }`}
                  >
                    <Download size={10} /> 下载
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      {editingUrl && (
        <ImageEditModal
          srcUrl={editingUrl}
          onClose={() => setEditingUrl(null)}
          onProduce={handleProduce}
        />
      )}
    </div>
  );
};

export default memo(OutputNode);
