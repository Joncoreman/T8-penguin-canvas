/**
 * useMaterialDragSource —— 节点内素材缩略图启动跨节点拖拽
 *
 * 用法:
 *   const onMouseDown = useMaterialDragSource(payload);
 *   <img onMouseDown={onMouseDown} ... />
 *
 * 触发条件:
 *   仅当鼠标左键按下时同时按住 Ctrl/Meta 键, 才会进入拖拽模式;
 *   否则把事件透给 ReactFlow (节点拖动 / 框选) — 不破坏现有交互。
 */
import { useCallback } from 'react';
import { useDragMaterialStore, type MaterialPayload } from '../stores/dragMaterial';

export function useMaterialDragSource(getPayload: () => MaterialPayload | null) {
  const start = useDragMaterialStore((s) => s.start);

  return useCallback(
    (e: React.MouseEvent) => {
      // 只响应 Ctrl/Meta + 左键
      if (e.button !== 0) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const payload = getPayload();
      if (!payload) return;
      if (!payload.url && !payload.text) return;
      // 阻止 ReactFlow 节点拖动 / 框选
      e.preventDefault();
      e.stopPropagation();
      start(payload, e.clientX, e.clientY);
    },
    [getPayload, start],
  );
}
