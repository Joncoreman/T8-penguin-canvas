import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  SelectionMode,
  ViewportPortal,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Copy, CopyPlus, Trash2, FolderPlus } from 'lucide-react';
import { useCanvasStore } from '../stores/canvas';
import { useThemeStore } from '../stores/theme';
import { useRunBusStore } from '../stores/runBus';
import { useGroupBusStore, GROUP_COLORS, DEFAULT_GROUP_NAME } from '../stores/groupBus';
import { topologicalSort } from '../utils/topologicalSort';
import * as api from '../services/api';
import CanvasToolbar from './CanvasToolbar';
import TerminalPanel from './TerminalPanel';
import { useCanvasHistory } from '../hooks/useCanvasHistory';
import type { CanvasTemplate } from '../config/canvasTemplates';
import PlaceholderNode from './nodes/PlaceholderNode';
import TextNode from './nodes/TextNode';
import ImageNode from './nodes/ImageNode';
import LLMNode from './nodes/LLMNode';
import VideoNode from './nodes/VideoNode';
import AudioNode from './nodes/AudioNode';
import RunningHubNode from './nodes/RunningHubNode';
import RhConfigNode from './nodes/RhConfigNode';
import ResizeNode from './nodes/ResizeNode';
import UpscaleNode from './nodes/UpscaleNode';
import GridCropNode from './nodes/GridCropNode';
import CombineNode from './nodes/CombineNode';
import RemoveBgNode from './nodes/RemoveBgNode';
import ImageCompareNode from './nodes/ImageCompareNode';
import ToolboxParamNode from './nodes/ToolboxParamNode';
import IdeaNode from './nodes/IdeaNode';
import BpNode from './nodes/BpNode';
import RelayNode from './nodes/RelayNode';
import VideoOutputNode from './nodes/VideoOutputNode';
import PortraitMetadataNode from './nodes/PortraitMetadataNode';
import StoryboardGridNode from './nodes/StoryboardGridNode';
import PresetImageNode from './nodes/PresetImageNode';
import DrawingBoardNode from './nodes/DrawingBoardNode';
import BrowserNode from './nodes/BrowserNode';
import FrameExtractorNode from './nodes/FrameExtractorNode';
import UploadNode from './nodes/UploadNode';
import GroupBoxNode from './nodes/GroupBoxNode';
import { NODE_REGISTRY } from '../config/nodeRegistry';
import type { NodeType, NodeMeta } from '../types/canvas';
import {
  isConnectionValid,
  getNodeOutputs,
  getNodeInputs,
  arePortsCompatible,
  PORT_COLOR,
  PORT_LABEL,
  NODE_PORTS,
  type PortType,
} from '../config/portTypes';

// Phase 4 阶段:全部 24 个节点均已实现业务逻辑
const SPECIFIC_NODES: Record<string, any> = {
  // Core (8)
  text: TextNode,
  image: ImageNode,
  video: VideoNode,
  seedance: VideoNode, // 复用 VideoNode,默认 model = seedance-2.0
  audio: AudioNode,
  llm: LLMNode,
  runninghub: RunningHubNode,
  'rh-config': RhConfigNode,
  // Special (5)
  'multi-angle-3d': PresetImageNode,
  'panorama-720': PresetImageNode,
  'penguin-portrait': PresetImageNode,
  'portrait-metadata': PortraitMetadataNode,
  'storyboard-grid': StoryboardGridNode,
  // Utility (9)
  'drawing-board': DrawingBoardNode,
  browser: BrowserNode,
  'image-compare': ImageCompareNode,
  'frame-extractor': FrameExtractorNode,
  resize: ResizeNode,
  combine: CombineNode,
  'remove-bg': RemoveBgNode,
  upscale: UpscaleNode,
  'grid-crop': GridCropNode,
  // Auxiliary (5)
  edit: ImageNode, // 复用 ImageNode,默认偏向 edit 能力
  idea: IdeaNode,
  bp: BpNode,
  relay: RelayNode,
  'video-output': VideoOutputNode,
  // Toolbox (2)
  cinematic: ToolboxParamNode,
  'video-motion': ToolboxParamNode,
  // Input (1) - 上传素材
  upload: UploadNode,
};

// 节点初始 data(用于区分共享组件的 kind/preset/model 等)
const INITIAL_DATA: Record<string, Record<string, any>> = {
  image: { model: 'gpt-image-2', aspectRatio: '1:1', sizeLevel: '1K', referenceImages: [] },
  edit: { mode: 'edit', model: 'gpt-image-2', aspectRatio: '1:1', sizeLevel: '1K', referenceImages: [] },
  seedance: { model: 'seedance-2.0' },
  cinematic: { kind: 'cinematic' },
  'video-motion': { kind: 'video-motion' },
  'multi-angle-3d': { preset: 'multi-angle-3d' },
  'panorama-720': { preset: 'panorama-720' },
  'penguin-portrait': { preset: 'penguin-portrait' },
  upload: { uploadType: null },
};

// 可被“批量运行”调起的节点类型集合
const EXECUTABLE_NODE_TYPES = new Set<string>([
  'image', 'edit',
  'multi-angle-3d', 'panorama-720', 'penguin-portrait',
  'video', 'seedance', 'audio', 'llm', 'runninghub',
  'resize', 'upscale', 'grid-crop', 'remove-bg', 'combine',
  'frame-extractor',
]);

// 网格吸附步长 / 对齐阈值(世界坐标)
const SNAP_GRID: [number, number] = [20, 20];
const ALIGN_THRESHOLD = 6;

// 把所有节点类型都注册到对应组件(已实现的用业务组件,其余用 Placeholder)
const nodeTypes = NODE_REGISTRY.reduce<Record<string, any>>((acc, m) => {
  acc[m.type] = SPECIFIC_NODES[m.type] || PlaceholderNode;
  return acc;
}, {});
// 节点组容器(不在 NODE_REGISTRY 中,作为独立的视觉容器节点类型)
nodeTypes.groupBox = GroupBoxNode;

interface CanvasInnerProps {
  onAddNodeRef?: React.MutableRefObject<((type: NodeType) => void) | null>;
}

function CanvasInner({ onAddNodeRef }: CanvasInnerProps) {
  const { activeId } = useCanvasStore();
  const { theme, style } = useThemeStore();
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const lastSavedRef = useRef<string>('');

  // 选中节点 / 剪贴板
  const [selectedCount, setSelectedCount] = useState(0);
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[]; incomingEdges?: Edge[]; outgoingEdges?: Edge[] } | null>(null);
  const [clipboardCount, setClipboardCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 拖线到空白处的候选节点菜单(connection picker)
  const [picker, setPicker] = useState<{
    fromNodeId: string;
    fromHandleType: 'source' | 'target';
    flowPos: { x: number; y: number };
    screenPos: { x: number; y: number };
  } | null>(null);
  const connectingFromRef = useRef<{
    nodeId: string;
    handleType: 'source' | 'target';
  } | null>(null);

  // 吸附 + 对齐辅助线
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guides, setGuides] = useState<{ vertical: number[]; horizontal: number[] }>({
    vertical: [],
    horizontal: [],
  });

  // 批量运行状态
  const [isRunning, setIsRunning] = useState(false);
  const cancelRunRef = useRef(false);
  const batchTotal = useRunBusStore((s) => s.batchTotal);
  const batchDone = useRunBusStore((s) => s.batchDoneCount);

  // 选区右键菜单(框选后右键 或 节点上右键)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    ids: string[];
  } | null>(null);

  // 历史栈
  const applySnapshot = useCallback((snap: { nodes: Node[]; edges: Edge[] }) => {
    setNodes(snap.nodes);
    setEdges(snap.edges);
  }, []);
  const { capture: histCapture, undo: histUndo, redo: histRedo, reset: histReset, canUndo, canRedo } =
    useCanvasHistory(applySnapshot);
  const captureTimer = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // 节点/连线变更后,在拖拽结束 + 短暂防抖窗口内压栈一次
  const scheduleCapture = useCallback(
    (snap: { nodes: Node[]; edges: Edge[] }) => {
      if (isDraggingRef.current) return;
      if (captureTimer.current) window.clearTimeout(captureTimer.current);
      captureTimer.current = window.setTimeout(() => {
        histCapture(snap);
      }, 250);
    },
    [histCapture]
  );

  // 加载画布数据
  useEffect(() => {
    if (!activeId) {
      setNodes([]);
      setEdges([]);
      setLoaded(false);
      histReset();
      return;
    }
    setLoaded(false);
    api
      .getCanvasData(activeId)
      .then((data) => {
        const ns = data.nodes || [];
        const es = data.edges || [];
        setNodes(ns);
        setEdges(es);
        lastSavedRef.current = JSON.stringify({ nodes: ns, edges: es });
        histReset({ nodes: ns, edges: es });
        setLoaded(true);
      })
      .catch((e) => {
        console.error('加载画布失败', e);
        setNodes([]);
        setEdges([]);
        histReset();
        setLoaded(true);
      });
  }, [activeId, histReset]);

  // nodes/edges 变化后压栈(节流防止拖拽中海量入栈)
  useEffect(() => {
    if (!loaded) return;
    scheduleCapture({ nodes, edges });
  }, [nodes, edges, loaded, scheduleCapture]);

  // 自动保存(防抖 800ms,防空数据覆盖)
  useEffect(() => {
    if (!activeId || !loaded) return;
    const snapshot = JSON.stringify({ nodes, edges });
    if (snapshot === lastSavedRef.current) return;
    if (nodes.length === 0 && lastSavedRef.current !== '' && JSON.parse(lastSavedRef.current).nodes?.length > 0) {
      // 防止空数据覆盖
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await api.saveCanvasData(activeId, { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } });
        lastSavedRef.current = snapshot;
      } catch (e) {
        console.error('保存画布失败', e);
      }
    }, 800);
  }, [nodes, edges, activeId, loaded]);

  // 添加节点(供 Sidebar 调用) —— 默认落在当前视口中心
  const addNode = useCallback(
    (type: NodeType) => {
      const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // 以 ReactFlow 画布容器中心为默认插入点；拿不到则 fallback 到 window 中心
      const flowEl =
        document.querySelector('.react-flow') as HTMLElement | null;
      const rect = flowEl?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const center = screenToFlowPosition({ x: cx, y: cy });
      // 小的随机偏移避免连续添加时完全重叠
      const jitter = () => (Math.random() - 0.5) * 80;
      const newNode: Node = {
        id,
        type,
        position: {
          x: center.x - 160 + jitter(),
          y: center.y - 100 + jitter(),
        },
        data: { ...(INITIAL_DATA[type] || {}) },
      };
      setNodes((prev) => [...prev, newNode]);
    },
    [screenToFlowPosition]
  );

  // ===== 复制 / 粘贴 / 删除 =====
  const handleCopy = useCallback(() => {
    const sel = nodes.filter((n) => n.selected);
    if (sel.length === 0) return;
    const ids = new Set(sel.map((n) => n.id));
    // 内部边: source/target 都在选中集合 —— 普通粘贴/快速复制会使用
    const selEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    // 外部入边: target 在选中集合,source 不在 —— Ctrl+Shift+V 连边粘贴使用
    const incomingEdges = edges.filter((e) => !ids.has(e.source) && ids.has(e.target));
    // 外部出边: source 在选中集合,target 不在
    const outgoingEdges = edges.filter((e) => ids.has(e.source) && !ids.has(e.target));
    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(sel)),
      edges: JSON.parse(JSON.stringify(selEdges)),
      incomingEdges: JSON.parse(JSON.stringify(incomingEdges)),
      outgoingEdges: JSON.parse(JSON.stringify(outgoingEdges)),
    };
    setClipboardCount(sel.length);
  }, [nodes, edges]);

  // 普通粘贴: 仅复制选中节点 + 其内部边(与原逻辑一致)
  // withLinks=true: Ctrl+Shift+V 额外复制原节点的外部入边/出边 —— 将新节点与原画布上还存在的邻居连接
  const handlePaste = useCallback((withLinks = false) => {
    const cb = clipboardRef.current as (typeof clipboardRef.current & {
      incomingEdges?: Edge[];
      outgoingEdges?: Edge[];
    }) | null;
    if (!cb || cb.nodes.length === 0) return;
    // 运行时字段黑名单(复制/粘贴时必须重置,避免新节点显示为进行中/携带旧 taskId)
    const RUNTIME_KEYS = [
      'status', 'taskId', 'progress', 'error',
      'isRunning', 'isPolling', 'pollingTimer',
    ];
    const sanitize = (data: any) => {
      const next: any = { ...(data || {}) };
      for (const k of RUNTIME_KEYS) delete next[k];
      next.status = 'idle';
      return next;
    };
    const idMap = new Map<string, string>();
    const stamp = Date.now();
    const newNodes = cb.nodes.map((n, idx) => {
      const newId = `${n.type}-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        selected: true,
        position: {
          x: (n.position?.x ?? 0) + 40,
          y: (n.position?.y ?? 0) + 40,
        },
        data: sanitize(n.data),
      } as Node;
    });
    // 内部边: source/target 都映射到新节点
    const newInternalEdges = cb.edges
      .map((e, idx) => {
        const s = idMap.get(e.source);
        const t = idMap.get(e.target);
        if (!s || !t) return null;
        return {
          ...e,
          id: `e-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          source: s,
          target: t,
        } as Edge;
      })
      .filter(Boolean) as Edge[];
    let extraEdges: Edge[] = [];
    if (withLinks) {
      // 外部入边: source 保留(原节点须仍在画布), target 映射为新节点
      const incoming = (cb.incomingEdges || [])
        .map((e, idx) => {
          const sourceStillExists = nodes.some((n) => n.id === e.source);
          const t = idMap.get(e.target);
          if (!sourceStillExists || !t) return null;
          return {
            ...e,
            id: `e-in-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            source: e.source,
            target: t,
          } as Edge;
        })
        .filter(Boolean) as Edge[];
      // 外部出边: source 映射为新节点, target 保留
      const outgoing = (cb.outgoingEdges || [])
        .map((e, idx) => {
          const targetStillExists = nodes.some((n) => n.id === e.target);
          const s = idMap.get(e.source);
          if (!targetStillExists || !s) return null;
          return {
            ...e,
            id: `e-out-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            source: s,
            target: e.target,
          } as Edge;
        })
        .filter(Boolean) as Edge[];
      extraEdges = [...incoming, ...outgoing];
    }
    // 取消其他节点的选中,新粘贴节点设为选中
    setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...newNodes]);
    setEdges((prev) => [...prev, ...newInternalEdges, ...extraEdges]);
  }, [nodes]);

  const handleDuplicate = useCallback(() => {
    handleCopy();
    // 在 copy 完成后下一帧执行 paste(由于上面的 setClipboardCount 是异步)
    setTimeout(() => handlePaste(false), 0);
  }, [handleCopy, handlePaste]);

  const handleDeleteSelected = useCallback(() => {
    setNodes((prev) => {
      const removeIds = new Set(prev.filter((n) => n.selected).map((n) => n.id));
      if (removeIds.size === 0) return prev;
      setEdges((eds) =>
        eds.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target) && !e.selected)
      );
      return prev.filter((n) => !removeIds.has(n.id));
    });
    setEdges((prev) => prev.filter((e) => !e.selected));
  }, []);

  // ===== 导入 / 导出 =====
  const handleExport = useCallback(() => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-${activeId || 'export'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [nodes, edges, activeId]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const txt = String(reader.result || '');
          const json = JSON.parse(txt);
          const importedNodes = Array.isArray(json.nodes) ? json.nodes : [];
          const importedEdges = Array.isArray(json.edges) ? json.edges : [];
          if (!confirm(`导入将替换当前画布(${importedNodes.length} 个节点 / ${importedEdges.length} 条连线),是否继续?`)) {
            return;
          }
          setNodes(importedNodes);
          setEdges(importedEdges);
        } catch (err) {
          alert('导入失败:JSON 解析错误');
          console.error(err);
        }
      };
      reader.readAsText(file);
      // 允许重复选同一文件
      e.target.value = '';
    },
    []
  );

  // ===== 应用模板 =====
  const handleApplyTemplate = useCallback((tpl: CanvasTemplate) => {
    const built = tpl.build();
    // 偏移现有 nodes 数量,避免重叠
    setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...built.nodes.map((n) => ({ ...n, selected: true }))]);
    setEdges((prev) => [...prev, ...built.edges]);
  }, []);

  // ===== 批量运行 =====
  // 通用: 在指定节点子集上拓扑排序 + 串行调 runBus
  const runNodesByOrder = useCallback(
    async (subNodes: Node[], subEdges: Edge[]) => {
      const order = topologicalSort(subNodes, subEdges, EXECUTABLE_NODE_TYPES);
      if (order.length === 0) return 0;
      cancelRunRef.current = false;
      setIsRunning(true);
      const { triggerRun, setBatchProgress, cancelAll } = useRunBusStore.getState();
      setBatchProgress(order.length, 0);
      try {
        for (let i = 0; i < order.length; i++) {
          if (cancelRunRef.current) break;
          const id = order[i];
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              unsub();
              window.clearTimeout(timer);
              resolve();
            };
            const unsub = useRunBusStore.subscribe((state) => {
              if (state.lastDone && state.lastDone.id === id) finish();
              if (cancelRunRef.current) finish();
            });
            // 安全超时 5 分钟(轮询任务可能较长)
            const timer = window.setTimeout(finish, 5 * 60 * 1000);
            triggerRun(id, 'batch');
          });
          setBatchProgress(order.length, i + 1);
        }
      } finally {
        cancelAll();
        setIsRunning(false);
        cancelRunRef.current = false;
      }
      return order.length;
    },
    []
  );

  const handleRunAll = useCallback(async () => {
    if (isRunning) return;
    const order = topologicalSort(nodes, edges, EXECUTABLE_NODE_TYPES);
    if (order.length === 0) {
      alert('画布上没有可执行节点');
      return;
    }
    await runNodesByOrder(nodes, edges);
  }, [isRunning, nodes, edges, runNodesByOrder]);

  // 组执行: 仅在选中的节点子集上运行(仅保留子集内部边作为依赖)
  const handleRunGroup = useCallback(
    async (ids: string[]) => {
      if (isRunning) return;
      const idSet = new Set(ids);
      const subNodes = nodes.filter((n) => idSet.has(n.id));
      const subEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));
      const executable = subNodes.filter((n) => n.type && EXECUTABLE_NODE_TYPES.has(n.type));
      if (executable.length === 0) {
        alert('所选节点中没有可执行节点');
        return;
      }
      await runNodesByOrder(subNodes, subEdges);
    },
    [isRunning, nodes, edges, runNodesByOrder]
  );

  // ===== 节点组(GroupBox) =====
  // 拖动组节点时使用,记录上一帧位置以计算 delta 同步偏移成员节点
  const groupDragRef = useRef<{ groupId: string; lastX: number; lastY: number } | null>(null);

  // 创建节点组: 计算 bounding box, 生成 type='groupBox' 节点装进 nodes
  const handleCreateGroup = useCallback(
    (ids: string[]) => {
      // 排除 groupBox 自身(不允许嵌套组)
      const targets = nodes.filter((n) => ids.includes(n.id) && n.type !== 'groupBox');
      if (targets.length < 1) {
        alert('请先选中要打组的节点');
        return;
      }
      const PAD = 30;
      const HEADER = 40;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of targets) {
        const w = (n as any).width || (n as any).measured?.width || 200;
        const h = (n as any).height || (n as any).measured?.height || 100;
        const x = n.position.x;
        const y = n.position.y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
      }
      const groupX = minX - PAD;
      const groupY = minY - PAD - HEADER;
      const groupW = (maxX - minX) + PAD * 2;
      const groupH = (maxY - minY) + PAD * 2 + HEADER;
      const newId = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      // 随机选一个颜色
      const color = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
      const groupNode: Node = {
        id: newId,
        type: 'groupBox',
        position: { x: groupX, y: groupY },
        data: {
          name: DEFAULT_GROUP_NAME,
          color,
          memberIds: targets.map((n) => n.id),
          width: groupW,
          height: groupH,
        },
        // 置于普通节点之下(负 1000 避免选中时 zIndex 被括号调高)
        zIndex: -1000,
        draggable: true,
        selectable: true,
        deletable: true,
        // 不参与连接校验(本身无 Handle)
        connectable: false,
      } as Node;
      // 插入到最前面,确保渲染顺序在底(配合 zIndex 负值)
      setNodes((prev) => [groupNode, ...prev.map((n) => ({ ...n, selected: false }))]);
    },
    [nodes]
  );

  // 监听 GroupBox 的执行请求 / 删除请求
  const executeReq = useGroupBusStore((s) => s.executeReq);
  const deleteReq = useGroupBusStore((s) => s.deleteReq);
  const clearExecuteReq = useGroupBusStore((s) => s.clearExecute);
  const clearDeleteReq = useGroupBusStore((s) => s.clearDelete);

  useEffect(() => {
    if (!executeReq) return;
    handleRunGroup(executeReq.memberIds);
    clearExecuteReq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executeReq?.ts]);

  useEffect(() => {
    if (!deleteReq) return;
    setNodes((prev) => prev.filter((n) => n.id !== deleteReq.groupId));
    clearDeleteReq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteReq?.ts]);

  const handleCancelRun = useCallback(() => {
    cancelRunRef.current = true;
    useRunBusStore.getState().cancelAll();
  }, []);

  // ===== 智能对齐辅助线 =====
  const onNodeDrag = useCallback(
    (_e: any, node: Node) => {
      // 拖动 GroupBox 节点: 联动所有成员节点同步偏移
      if (node.type === 'groupBox') {
        const ref = groupDragRef.current;
        if (!ref || ref.groupId !== node.id) {
          groupDragRef.current = { groupId: node.id, lastX: node.position.x, lastY: node.position.y };
          return;
        }
        const dx = node.position.x - ref.lastX;
        const dy = node.position.y - ref.lastY;
        if (dx === 0 && dy === 0) return;
        ref.lastX = node.position.x;
        ref.lastY = node.position.y;
        const memberIds: string[] = (node.data as any)?.memberIds ?? [];
        if (memberIds.length === 0) return;
        const idSet = new Set(memberIds);
        setNodes((prev) =>
          prev.map((n) =>
            idSet.has(n.id)
              ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
              : n
          )
        );
        return;
      }
      if (!snapEnabled) return;
      const w = (node as any).width || (node as any).measured?.width || 200;
      const h = (node as any).height || (node as any).measured?.height || 100;
      const tx = node.position.x;
      const ty = node.position.y;
      const targets = { L: tx, C: tx + w / 2, R: tx + w, T: ty, M: ty + h / 2, B: ty + h };
      const vGuides = new Set<number>();
      const hGuides = new Set<number>();
      let snapDX: number | null = null;
      let snapDY: number | null = null;
      let bestVDiff = ALIGN_THRESHOLD;
      let bestHDiff = ALIGN_THRESHOLD;
      for (const other of nodes) {
        if (other.id === node.id) continue;
        const ow = (other as any).width || (other as any).measured?.width || 200;
        const oh = (other as any).height || (other as any).measured?.height || 100;
        const ox = other.position.x;
        const oy = other.position.y;
        const oVals = { L: ox, C: ox + ow / 2, R: ox + ow, T: oy, M: oy + oh / 2, B: oy + oh };
        // 垂直辅助线(列对齐): L/C/R 对 L/C/R
        for (const tk of ['L', 'C', 'R'] as const) {
          for (const ok of ['L', 'C', 'R'] as const) {
            const diff = Math.abs(targets[tk] - oVals[ok]);
            if (diff < ALIGN_THRESHOLD) {
              vGuides.add(oVals[ok]);
              if (diff < bestVDiff) {
                bestVDiff = diff;
                snapDX = oVals[ok] - targets[tk];
              }
            }
          }
        }
        // 水平辅助线(行对齐): T/M/B 对 T/M/B
        for (const tk of ['T', 'M', 'B'] as const) {
          for (const ok of ['T', 'M', 'B'] as const) {
            const diff = Math.abs(targets[tk] - oVals[ok]);
            if (diff < ALIGN_THRESHOLD) {
              hGuides.add(oVals[ok]);
              if (diff < bestHDiff) {
                bestHDiff = diff;
                snapDY = oVals[ok] - targets[tk];
              }
            }
          }
        }
      }
      setGuides({ vertical: Array.from(vGuides), horizontal: Array.from(hGuides) });
      // 弱吸附:调整当前拖拽节点位置
      if (snapDX !== null || snapDY !== null) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  position: {
                    x: tx + (snapDX ?? 0),
                    y: ty + (snapDY ?? 0),
                  },
                }
              : n
          )
        );
      }
    },
    [nodes, snapEnabled]
  );

  const onNodeDragStop = useCallback(() => {
    setGuides({ vertical: [], horizontal: [] });
    groupDragRef.current = null;
  }, []);

  // ===== 右键菜单 =====
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // 选区右键(框选 ≥ 1 个节点后右键)
  const onSelectionContextMenu = useCallback(
    (e: React.MouseEvent, sels: Node[]) => {
      e.preventDefault();
      const ids = sels.map((n) => n.id);
      if (ids.length === 0) return;
      setContextMenu({ x: e.clientX, y: e.clientY, ids });
    },
    []
  );

  // 节点上右键: 若未选中则仅选中此节点
  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      let ids: string[];
      const currentSelected = nodes.filter((n) => n.selected).map((n) => n.id);
      if (currentSelected.includes(node.id) && currentSelected.length > 1) {
        ids = currentSelected;
      } else {
        setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === node.id })));
        ids = [node.id];
      }
      setContextMenu({ x: e.clientX, y: e.clientY, ids });
    },
    [nodes]
  );

  // 空白处右键: 关闭菜单
  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      setContextMenu(null);
    },
    []
  );

  // 记录最新选中的节点 id 列表(以便 onSelectionEnd 读取)
  const lastSelectedIdsRef = useRef<string[]>([]);
  const onSelectionChange = useCallback(
    ({ nodes: ns }: { nodes: Node[]; edges: Edge[] }) => {
      lastSelectedIdsRef.current = ns.map((n) => n.id);
    },
    []
  );

  // 框选结束: 若选中 ≥ 2 个节点则自动弹出菜单
  const onSelectionEnd = useCallback((e: React.MouseEvent) => {
    const ids = lastSelectedIdsRef.current;
    if (!ids || ids.length < 2) return;
    const x = (e as any)?.clientX ?? 0;
    const y = (e as any)?.clientY ?? 0;
    if (!x && !y) return;
    setContextMenu({ x, y, ids });
  }, []);

  // 暴露 addNode 给父组件
  useEffect(() => {
    if (onAddNodeRef) {
      onAddNodeRef.current = addNode;
    }
    return () => {
      if (onAddNodeRef) onAddNodeRef.current = null;
    };
  }, [onAddNodeRef, addNode]);

  // xyflow 事件
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // 检测拖拽状态,避免拖拽中频繁压栈
      for (const c of changes) {
        if (c.type === 'position') {
          if ((c as any).dragging === true) {
            isDraggingRef.current = true;
          } else if ((c as any).dragging === false) {
            isDraggingRef.current = false;
          }
        }
      }
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        // 同步选中数(用 next 计算更准确)
        const selCount = next.reduce((acc, n) => acc + (n.selected ? 1 : 0), 0);
        setSelectedCount(selCount);
        return next;
      });
    },
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) => {
      // 连接有效性校验(防止绕过 isValidConnection 的底层调用)
      const src = nodes.find((n) => n.id === params.source);
      const tgt = nodes.find((n) => n.id === params.target);
      if (!isConnectionValid(src, tgt)) return;
      // 根据上游输出类型染色连线
      const outs = src ? getNodeOutputs(src) : [];
      const ins = tgt ? getNodeInputs(tgt) : [];
      const matched = outs.find((o) => ins.includes(o) || o === 'any' || ins.includes('any'));
      const color = matched && matched !== 'any' ? PORT_COLOR[matched] : undefined;
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...(color ? { style: { stroke: color, strokeWidth: 2 } } : {}),
            data: { portType: matched ?? 'any' },
          },
          eds
        )
      );
    },
    [nodes]
  );

  // ReactFlow 拖线连接时的实时校验(在连线处于“预览”阶段就拦截不兼容连接)
  const onIsValidConnection = useCallback(
    (params: Connection | Edge) => {
      const src = nodes.find((n) => n.id === (params as Connection).source);
      const tgt = nodes.find((n) => n.id === (params as Connection).target);
      return isConnectionValid(src, tgt);
    },
    [nodes]
  );

  // ===== 拖线到空白处 → 弹出候选节点菜单 =====
  const onConnectStart = useCallback(
    (_e: any, params: { nodeId: string | null; handleType: 'source' | 'target' | null }) => {
      if (!params.nodeId || !params.handleType) return;
      connectingFromRef.current = { nodeId: params.nodeId, handleType: params.handleType };
    },
    []
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const from = connectingFromRef.current;
      connectingFromRef.current = null;
      if (!from) return;
      // 终点是否落在 Handle / 节点 / 连线上:任何一项命中都交给 ReactFlow 默认连接逻辑处理,不弹出候选菜单
      // 仅当鼠标释放在“空白画布”(pane / background 本体或其隔层子)时才弹菜单
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const onHandle = !!target.closest('.react-flow__handle');
      const onNode = !!target.closest('.react-flow__node');
      const onEdge = !!target.closest('.react-flow__edge');
      // 如果落在 Handle/节点/连线 上,让 ReactFlow 自己处理(已连 / 不连),则不弹菜单
      if (onHandle || onNode || onEdge) return;
      // 获取坐标
      const clientX =
        (event as MouseEvent).clientX ?? (event as TouchEvent).changedTouches?.[0]?.clientX ?? 0;
      const clientY =
        (event as MouseEvent).clientY ?? (event as TouchEvent).changedTouches?.[0]?.clientY ?? 0;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setPicker({
        fromNodeId: from.nodeId,
        fromHandleType: from.handleType,
        flowPos,
        screenPos: { x: clientX, y: clientY },
      });
    },
    [screenToFlowPosition]
  );

  // 计算候选节点列表(根据起始节点输出/输入类型过滤)
  const pickerCandidates = useMemo<Array<NodeMeta & { matchedTypes: PortType[] }>>(() => {
    if (!picker) return [];
    const fromNode = nodes.find((n) => n.id === picker.fromNodeId);
    if (!fromNode) return [];
    // 从 source handle 拉出: 源节点输出 → 候选节点需要有能收这些输出的输入
    // 从 target handle 拉出: 源节点输入 → 候选节点需要有能被其接受的输出
    const isFromSource = picker.fromHandleType === 'source';
    const fromOuts = isFromSource ? getNodeOutputs(fromNode) : [];
    const fromIns = !isFromSource ? getNodeInputs(fromNode) : [];

    return NODE_REGISTRY.flatMap((meta) => {
      // 不推荐带动态输出的 upload 作为候选 source⚡但允许它作为 target(upload 本身不受输入,实际最后会被过滤)
      const ports = NODE_PORTS[meta.type];
      if (!ports) return [];
      let matched: PortType[] = [];
      if (isFromSource) {
        // 需要 meta.inputs 与 fromOuts 有交集
        if (!arePortsCompatible(fromOuts, ports.inputs)) return [];
        matched = fromOuts.filter((t) => ports.inputs.includes(t) || ports.inputs.includes('any') || t === 'any');
      } else {
        // 拖出 target handle⚡需要 meta.outputs 与 fromIns 有交集
        // upload 节点 outputs 动态为 [],在此考虑 image/video/audio 均可作为潜在输出源
        const candidateOuts = meta.type === 'upload' ? (['image', 'video', 'audio'] as PortType[]) : ports.outputs;
        if (!arePortsCompatible(candidateOuts, fromIns)) return [];
        matched = candidateOuts.filter((t) => fromIns.includes(t) || fromIns.includes('any') || t === 'any');
      }
      return [{ ...meta, matchedTypes: matched }];
    });
  }, [picker, nodes]);

  // 点击候选项→ 在拖落位置创建节点并自动连线
  const handlePickCandidate = useCallback(
    (meta: NodeMeta) => {
      if (!picker) return;
      const id = `${meta.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newNode: Node = {
        id,
        type: meta.type,
        position: picker.flowPos,
        data: { ...(INITIAL_DATA[meta.type] || {}) },
      };
      setNodes((prev) => [...prev, newNode]);

      // 创建连线:根据 source/target 方向
      const isFromSource = picker.fromHandleType === 'source';
      const params: Connection = isFromSource
        ? { source: picker.fromNodeId, target: id, sourceHandle: null, targetHandle: null }
        : { source: id, target: picker.fromNodeId, sourceHandle: null, targetHandle: null };

      // 染色(使用 nodes + 新节点计算)
      const fromNode = nodes.find((n) => n.id === picker.fromNodeId);
      const tempNewNode = newNode;
      const src = isFromSource ? fromNode : tempNewNode;
      const tgt = isFromSource ? tempNewNode : fromNode;
      const outs = src ? getNodeOutputs(src) : [];
      const ins = tgt ? getNodeInputs(tgt) : [];
      const matched = outs.find((o) => ins.includes(o) || o === 'any' || ins.includes('any'));
      const color = matched && matched !== 'any' ? PORT_COLOR[matched] : undefined;

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...(color ? { style: { stroke: color, strokeWidth: 2 } } : {}),
            data: { portType: matched ?? 'any' },
          },
          eds
        )
      );
      setPicker(null);
    },
    [picker, nodes]
  );

  // ===== 全局快捷键 =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 当焦点在表单元素中时不拦截
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isEditing =
        tag === 'input' ||
        tag === 'textarea' ||
        (e.target as HTMLElement | null)?.isContentEditable;
      const ctrl = e.ctrlKey || e.metaKey;
      // Undo / Redo 全局拦截(即使在输入框,Ctrl+Z 也属于画布,但更友好的是输入框内不抢占)
      if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (isEditing) return;
        e.preventDefault();
        histUndo();
        return;
      }
      if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        if (isEditing) return;
        e.preventDefault();
        histRedo();
        return;
      }
      if (isEditing) return;
      if (ctrl && e.key.toLowerCase() === 'c') {
        handleCopy();
      } else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'v') {
        // Ctrl+Shift+V: 连边粘贴 — 新节点与原画布邻居保持连接
        e.preventDefault();
        handlePaste(true);
      } else if (ctrl && e.key.toLowerCase() === 'v') {
        handlePaste(false);
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // xyflow 内置 Backspace 删除,但在节点未选中时仍可能删除连线;
        // 我们手动处理仅删除选中,避免输入边缘情况
        if (selectedCount > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (ctrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setNodes((prev) => prev.map((n) => ({ ...n, selected: true })));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [histUndo, histRedo, handleCopy, handlePaste, handleDuplicate, handleDeleteSelected, selectedCount]);

  const isDark = theme === 'dark';
    const isPixel = style === 'pixel';
    const guideColor = isPixel ? '#FF89A7' : '#fb923c';
    const edgeStroke = isPixel ? '#1A1410' : isDark ? '#71717a' : '#a1a1aa';
    const dotColor = isPixel
      ? isDark ? '#5C4D3E' : '#C8B89A'
      : isDark ? '#27272a' : '#d4d4d8';
  const bgColor = isPixel
    ? isDark ? '#1F1A14' : '#FAF3E7'
    : isDark ? '#0a0a0b' : '#fafafa';

  const memoNodeTypes = useMemo(() => nodeTypes, []);

  if (!activeId) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: bgColor, color: isDark ? '#71717a' : '#52525b' }}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">🐧</div>
          <p>请先在左侧创建或选择一个画布</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative" style={{ background: bgColor }}>
      <CanvasToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        selectedCount={selectedCount}
        clipboardCount={clipboardCount}
        onUndo={histUndo}
        onRedo={histRedo}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDeleteSelected}
        onExport={handleExport}
        onImport={handleImportClick}
        onApplyTemplate={handleApplyTemplate}
        onRunAll={handleRunAll}
        onCancelRun={handleCancelRun}
        isRunning={isRunning}
        batchTotal={batchTotal}
        batchDone={batchDone}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled((v) => !v)}
      />
      <TerminalPanel />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={memoNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={onIsValidConnection}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionContextMenu={onSelectionContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onSelectionChange={onSelectionChange}
        onSelectionEnd={onSelectionEnd}
        selectionKeyCode={['Control', 'Meta']}
        multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
        selectionMode={SelectionMode.Partial}
        snapToGrid={snapEnabled}
        snapGrid={SNAP_GRID}
        elevateNodesOnSelect={false}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          style: { stroke: edgeStroke, strokeWidth: isPixel ? 2.5 : 2 },
          animated: false,
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={isPixel ? 1.6 : 1.2}
          color={dotColor}
        />
        {/* 对齐辅助线:在世界坐标系中随视口变换 */}
        {(guides.vertical.length > 0 || guides.horizontal.length > 0) && (
          <ViewportPortal>
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              {guides.vertical.map((x, i) => (
                <line
                  key={`v-${i}-${x}`}
                  x1={x}
                  y1={-100000}
                  x2={x}
                  y2={100000}
                  stroke={guideColor}
                  strokeWidth={isPixel ? 1.5 : 1}
                  strokeDasharray={isPixel ? '8 4' : '6 4'}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {guides.horizontal.map((y, i) => (
                <line
                  key={`h-${i}-${y}`}
                  x1={-100000}
                  y1={y}
                  x2={100000}
                  y2={y}
                  stroke={guideColor}
                  strokeWidth={isPixel ? 1.5 : 1}
                  strokeDasharray={isPixel ? '8 4' : '6 4'}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </ViewportPortal>
        )}
        <Controls
          style={{
            background: isDark ? 'rgba(20,20,22,.9)' : 'rgba(255,255,255,.9)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'}`,
            borderRadius: 8,
          }}
        />
        <MiniMap
          pannable
          zoomable
          style={{
            background: isDark ? 'rgba(20,20,22,.9)' : 'rgba(255,255,255,.9)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'}`,
            borderRadius: 8,
          }}
          maskColor={isDark ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.6)'}
          nodeColor={() => (isDark ? '#a1a1aa' : '#52525b')}
        />
      </ReactFlow>

      {/* 拖线到空白处弹出的候选节点菜单 */}
      {picker && (
        <>
          {/* 遮罩层:点击空白关闭 */}
          <div
            className="absolute inset-0 z-30"
            onClick={() => setPicker(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setPicker(null);
            }}
          />
          <div
            className="absolute z-40 rounded-xl overflow-hidden"
            style={{
              left: Math.min(picker.screenPos.x, window.innerWidth - 280),
              top: Math.min(picker.screenPos.y, window.innerHeight - 360),
              width: 260,
              maxHeight: 360,
              background: isPixel
                ? '#FFFFFF'
                : isDark
                  ? 'rgba(20,20,22,.96)'
                  : 'rgba(255,255,255,.98)',
              border: isPixel
                ? '2px solid #1A1410'
                : `1px solid ${isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}`,
              boxShadow: isPixel
                ? '4px 4px 0 #1A1410'
                : '0 12px 40px rgba(0,0,0,.35)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              className="px-3 py-2 text-[11px] font-semibold flex items-center justify-between"
              style={{
                color: isPixel ? '#1A1410' : isDark ? '#fff' : '#18181b',
                borderBottom: isPixel
                  ? '2px solid #1A1410'
                  : `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
                background: isPixel ? '#A8E6C9' : 'transparent',
              }}
            >
              <span>
                {picker.fromHandleType === 'source' ? '连接到…' : '从…输入'}
              </span>
              <span
                className="text-[10px] font-normal opacity-60"
                style={{ color: isPixel ? '#1A1410' : undefined }}
              >
                {pickerCandidates.length} 个候选
              </span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
              {pickerCandidates.length === 0 && (
                <div
                  className="px-3 py-4 text-[11px] text-center"
                  style={{ color: isDark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.4)' }}
                >
                  没有可连接的节点
                </div>
              )}
              {pickerCandidates.map((cand) => {
                const primary = cand.matchedTypes[0] ?? 'any';
                const dotColor = PORT_COLOR[primary];
                return (
                  <button
                    key={cand.type}
                    onClick={() => handlePickCandidate(cand)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                    style={{
                      background: 'transparent',
                      color: isPixel ? '#1A1410' : isDark ? '#e4e4e7' : '#27272a',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = isPixel
                        ? '#FFE08A'
                        : isDark
                          ? 'rgba(255,255,255,.06)'
                          : 'rgba(0,0,0,.04)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: dotColor,
                        boxShadow: isPixel ? '0 0 0 1.5px #1A1410' : `0 0 0 2px ${dotColor}33`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate">{cand.label}</div>
                      <div
                        className="text-[10px] truncate"
                        style={{
                          color: isPixel ? '#7a6f5e' : isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.45)',
                        }}
                      >
                        {cand.description}
                      </div>
                    </div>
                    <div
                      className="flex gap-1 flex-shrink-0"
                      title={cand.matchedTypes.map((t) => PORT_LABEL[t]).join(' / ')}
                    >
                      {cand.matchedTypes.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{
                            background: PORT_COLOR[t] + '33',
                            color: isPixel ? '#1A1410' : PORT_COLOR[t],
                            border: isPixel ? `1.5px solid #1A1410` : `1px solid ${PORT_COLOR[t]}66`,
                          }}
                        >
                          {PORT_LABEL[t]}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 右键菜单(框选 右键 或 节点右键) */}
      {contextMenu && (() => {
        const ids = contextMenu.ids;
        const selNodes = nodes.filter((n) => ids.includes(n.id));
        const exeCount = selNodes.filter((n) => n.type && EXECUTABLE_NODE_TYPES.has(n.type)).length;
        const menuItemCls = isPixel
          ? 'w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-[var(--px-yellow)] disabled:opacity-40 disabled:hover:bg-transparent'
          : `w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 disabled:opacity-40 ${
              isDark
                ? 'text-zinc-100 hover:bg-white/10 disabled:hover:bg-transparent'
                : 'text-zinc-800 hover:bg-black/5 disabled:hover:bg-transparent'
            }`;
        return (
          <>
            {/* 遮罩层 */}
            <div
              className="absolute inset-0 z-30"
              onClick={closeContextMenu}
              onContextMenu={(e) => {
                e.preventDefault();
                closeContextMenu();
              }}
            />
            <div
              className="absolute z-40 overflow-hidden"
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 220),
                top: Math.min(contextMenu.y, window.innerHeight - 220),
                width: 200,
                background: isPixel
                  ? '#FFFFFF'
                  : isDark
                    ? 'rgba(20,20,22,.96)'
                    : 'rgba(255,255,255,.98)',
                border: isPixel
                  ? '2px solid #1A1410'
                  : `1px solid ${isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}`,
                borderRadius: isPixel ? 12 : 8,
                boxShadow: isPixel
                  ? '4px 4px 0 #1A1410'
                  : '0 12px 40px rgba(0,0,0,.35)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                className="px-3 py-2 text-[11px] font-semibold flex items-center justify-between"
                style={{
                  color: isPixel ? '#1A1410' : isDark ? '#fff' : '#18181b',
                  borderBottom: isPixel
                    ? '2px solid #1A1410'
                    : `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
                  background: isPixel ? '#A8E6C9' : 'transparent',
                }}
              >
                <span>已选 {ids.length} 个节点</span>
                <span className="text-[10px] font-normal opacity-60">
                  可执行 {exeCount}
                </span>
              </div>
              <button
                className={menuItemCls}
                disabled={isRunning || exeCount === 0}
                onClick={() => {
                  closeContextMenu();
                  handleRunGroup(ids);
                }}
              >
                <Play size={13} fill="currentColor" />
                <span>组执行 ({exeCount})</span>
              </button>
              <button
                className={menuItemCls}
                disabled={ids.filter((i) => {
                  const n = nodes.find((x) => x.id === i);
                  return n && n.type !== 'groupBox';
                }).length === 0}
                onClick={() => {
                  closeContextMenu();
                  handleCreateGroup(ids);
                }}
              >
                <FolderPlus size={13} />
                <span>打组 (选中后)</span>
              </button>
              <button
                className={menuItemCls}
                onClick={() => {
                  closeContextMenu();
                  handleCopy();
                }}
              >
                <Copy size={13} />
                <span>复制 (Ctrl+C)</span>
              </button>
              <button
                className={menuItemCls}
                onClick={() => {
                  closeContextMenu();
                  handleDuplicate();
                }}
              >
                <CopyPlus size={13} />
                <span>快速复制 (Ctrl+D)</span>
              </button>
              <button
                className={menuItemCls}
                onClick={() => {
                  closeContextMenu();
                  handleDeleteSelected();
                }}
                style={{ color: isPixel ? '#B91C1C' : '#f87171' }}
              >
                <Trash2 size={13} />
                <span>删除 (Delete)</span>
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

interface CanvasProps {
  onAddNodeRef?: React.MutableRefObject<((type: NodeType) => void) | null>;
}

export default function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
