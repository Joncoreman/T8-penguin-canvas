import { useCallback, useEffect, useState } from 'react';
import { FolderPlus, Library, Plus, X } from 'lucide-react';
import { useThemeStore } from '../stores/theme';
import { useCanvasStore } from '../stores/canvas';
import * as api from '../services/api';
import type { ResourceCategory, ResourceKind, ResourceMaterialSetKind, ResourceMediaKind } from '../services/api';

interface MenuState {
  x: number;
  y: number;
  kind: ResourceKind;
  url?: string;
  previewUrl?: string;
  sourceNodeId?: string;
  title?: string;
  materialSetKind?: ResourceMaterialSetKind;
  materialSetItems?: NonNullable<Parameters<typeof api.addResourceSet>[0]['materialSetItems']>;
}

function isResourceKind(value: string | null): value is ResourceMediaKind {
  return value === 'image' || value === 'video' || value === 'audio';
}

function baseName(url: string) {
  try {
    const u = url.startsWith('http') ? new URL(url) : new URL(url, 'http://local');
    const b = decodeURIComponent(u.pathname.split('/').pop() || '');
    return b || '资源';
  } catch {
    return url.split('/').pop() || '资源';
  }
}

export default function MaterialContextMenu() {
  const { theme, style } = useThemeStore();
  const activeCanvasId = useCanvasStore((s) => s.activeId);
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [message, setMessage] = useState('');

  const close = useCallback(() => {
    setMenu(null);
    setMessage('');
  }, []);

  const loadCategories = useCallback(async (kind: ResourceKind) => {
    const r = await api.getResourceCategories(kind);
    if (r.success) setCategories(r.data);
  }, []);

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const source = target?.closest('[data-drag-source]') as HTMLElement | null;
      if (!source) return;
      const kind = source.getAttribute('data-drag-kind');
      const url = source.getAttribute('data-drag-url') || '';
      if (!isResourceKind(kind) || !url) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const next: MenuState = {
        x: e.clientX,
        y: e.clientY,
        kind,
        url,
        previewUrl: source.getAttribute('data-drag-preview') || url,
        sourceNodeId: source.getAttribute('data-drag-node-id') || '',
        title: source.getAttribute('data-resource-title') || source.getAttribute('alt') || baseName(url),
      };
      setMenu(next);
      setMessage('');
      loadCategories(kind);
    };
    const onMaterialSetMenu = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const materialSetKind = detail.materialSetKind as ResourceMaterialSetKind | undefined;
      const materialSetItems = Array.isArray(detail.materialSetItems) ? detail.materialSetItems : [];
      if (!materialSetKind || materialSetItems.length === 0) return;
      setMenu({
        x: Number(detail.x) || window.innerWidth / 2,
        y: Number(detail.y) || window.innerHeight / 2,
        kind: 'set',
        sourceNodeId: String(detail.sourceNodeId || ''),
        title: String(detail.title || '素材集'),
        materialSetKind,
        materialSetItems,
      });
      setMessage('');
      loadCategories('set');
    };
    document.addEventListener('contextmenu', onContext, true);
    window.addEventListener('penguin:open-material-set-resource-menu', onMaterialSetMenu as EventListener);
    return () => {
      document.removeEventListener('contextmenu', onContext, true);
      window.removeEventListener('penguin:open-material-set-resource-menu', onMaterialSetMenu as EventListener);
    };
  }, [loadCategories]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-resource-context-menu]')) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [menu, close]);

  const addToCategory = async (categoryId: string) => {
    if (!menu) return;
    const r = menu.kind === 'set'
      ? await api.addResourceSet({
          materialSetKind: menu.materialSetKind!,
          materialSetItems: menu.materialSetItems || [],
          categoryId,
          title: menu.title,
          sourceNodeId: menu.sourceNodeId,
          sourceCanvasId: activeCanvasId || '',
        })
      : await api.addResourceItem({
          url: menu.url || '',
          kind: menu.kind as ResourceMediaKind,
          categoryId,
          title: menu.title,
          sourceNodeId: menu.sourceNodeId,
          sourceCanvasId: activeCanvasId || '',
        });
    if (r.success) {
      const duplicate = (r as any).duplicate;
      setMessage(duplicate ? '已存在，已定位到该分类' : '已加入资源库');
      window.dispatchEvent(new CustomEvent('penguin:resources-changed'));
      window.setTimeout(close, 650);
    } else {
      setMessage(r.error || '加入失败');
    }
  };

  const createCategory = async () => {
    if (!menu) return;
    const name = window.prompt('新建分类');
    if (!name?.trim()) return;
    const r = await api.addResourceCategory(menu.kind, name.trim());
    if (r.success) {
      setCategories((prev) => [...prev, r.data]);
      await addToCategory(r.data.id);
    } else {
      setMessage(r.error || '分类创建失败');
    }
  };

  if (!menu) return null;

  const itemCls = isPixel
    ? 'w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-[var(--px-yellow)]'
    : `w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 ${
        isDark ? 'text-zinc-100 hover:bg-white/10' : 'text-zinc-800 hover:bg-black/5'
      }`;

  return (
    <div
      data-resource-context-menu
      className="fixed z-[80] overflow-hidden"
      style={{
        left: Math.min(menu.x, window.innerWidth - 240),
        top: Math.min(menu.y, window.innerHeight - 360),
        width: 220,
        background: isPixel ? '#FFFFFF' : isDark ? 'rgba(20,20,22,.98)' : 'rgba(255,255,255,.98)',
        color: isPixel ? '#1A1410' : isDark ? '#fff' : '#18181b',
        border: isPixel ? '2px solid #1A1410' : `1px solid ${isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}`,
        borderRadius: isPixel ? 12 : 8,
        boxShadow: isPixel ? '4px 4px 0 #1A1410' : '0 18px 50px rgba(0,0,0,.35)',
      }}
    >
      <div
        className="px-3 py-2 text-[11px] font-semibold flex items-center gap-2"
        style={{
          borderBottom: isPixel ? '2px solid #1A1410' : `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
          background: isPixel ? '#A8E6C9' : 'transparent',
        }}
      >
        <Library size={13} />
        <span className="flex-1 truncate">{menu.kind === 'set' ? '保存素材集' : '加入资源库'}</span>
        <button onClick={close} title="关闭">
          <X size={12} />
        </button>
      </div>
      {menu.kind === 'image' && menu.previewUrl && (
        <div className="h-24 bg-black overflow-hidden">
          <img src={menu.previewUrl} className="w-full h-full object-cover" draggable={false} />
        </div>
      )}
      {menu.kind === 'set' && (
        <div className={`px-3 py-2 text-[11px] ${isPixel ? 'bg-[var(--px-muted)]' : isDark ? 'bg-white/5 text-white/65' : 'bg-black/5 text-zinc-600'}`}>
          {menu.title || '素材集'} · {menu.materialSetItems?.length || 0} 项
        </div>
      )}
      <div className="max-h-56 overflow-y-auto py-1">
        {categories.map((cat) => (
          <button key={cat.id} className={itemCls} onClick={() => addToCategory(cat.id)}>
            <Plus size={12} />
            <span className="truncate">{cat.name}</span>
          </button>
        ))}
        <button className={itemCls} onClick={createCategory}>
          <FolderPlus size={12} />
          <span>新建分类...</span>
        </button>
      </div>
      {message && (
        <div className={`px-3 py-2 text-[11px] ${isPixel ? 'border-t-2 border-[var(--px-ink)] bg-[var(--px-yellow)]' : isDark ? 'border-t border-white/10 text-white/70' : 'border-t border-black/10 text-zinc-600'}`}>
          {message}
        </div>
      )}
    </div>
  );
}
