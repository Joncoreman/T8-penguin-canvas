/**
 * useMaterialDropTarget —— 节点声明可接收的素材类型并响应投放
 *
 * 用法:
 *   const { dropProps, isHover, isAccepting } = useMaterialDropTarget({
 *     id,
 *     accepts: ['image', 'text'],
 *     onDrop: (payload) => { ... },
 *   });
 *   <div {...dropProps} className={isHover ? '...' : ''}>
 *
 * 实现:
 *   - dropProps 输出 data-drop-kinds, data-node-id 给 elementFromPoint 命中
 *   - 监听 window 'penguin:material-drop' 事件, 过滤 detail.targetNodeId === id
 *   - 自我屏蔽: 来源节点 id === 当前节点 id 时不接受 (避免拖回自己)
 */
import { useEffect, useMemo } from 'react';
import {
  MATERIAL_DROP_EVENT,
  useDragMaterialStore,
  type MaterialDropEventDetail,
  type MaterialKind,
  type MaterialPayload,
} from '../stores/dragMaterial';

interface Options {
  id: string;
  accepts: MaterialKind[];
  onDrop: (payload: MaterialPayload) => void;
  /** 是否允许来自自身节点的素材 (默认 false) */
  allowSelf?: boolean;
}

export function useMaterialDropTarget({ id, accepts, onDrop, allowSelf }: Options) {
  const dragging = useDragMaterialStore((s) => s.dragging);
  const payload = useDragMaterialStore((s) => s.payload);
  const hoverTargetId = useDragMaterialStore((s) => s.hoverTargetId);
  const hoverAccepts = useDragMaterialStore((s) => s.hoverAccepts);

  const acceptsKey = accepts.join(',');

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<MaterialDropEventDetail>;
      const detail = ce.detail;
      if (!detail || detail.targetNodeId !== id) return;
      if (!accepts.includes(detail.payload.kind)) return;
      if (!allowSelf && detail.payload.sourceNodeId === id) return;
      onDrop(detail.payload);
    };
    window.addEventListener(MATERIAL_DROP_EVENT, handler as EventListener);
    return () => window.removeEventListener(MATERIAL_DROP_EVENT, handler as EventListener);
  }, [id, acceptsKey, onDrop, allowSelf]);

  const dropProps = useMemo(
    () => ({
      'data-drop-kinds': acceptsKey,
      'data-node-id': id,
    }),
    [acceptsKey, id],
  );

  // 高亮态: 仅当本节点是当前 hover 目标且接受 payload.kind 时
  const isHover = dragging && hoverTargetId === id;
  const isAccepting =
    isHover &&
    hoverAccepts &&
    !!payload &&
    accepts.includes(payload.kind) &&
    (allowSelf || payload.sourceNodeId !== id);

  return { dropProps, isHover, isAccepting };
}
