import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_SHORTCUTS,
  findShortcutConflicts,
  mergeShortcutMap,
  resetAllShortcuts,
  resetShortcutAction,
  validateShortcutCombo,
  type ShortcutCombo,
  type ShortcutConflict,
  type ShortcutMap,
} from '../utils/keyboardShortcuts';

interface ShortcutState {
  shortcuts: ShortcutMap;
  setActionShortcuts: (actionId: string, combos: ShortcutCombo[]) => { ok: true } | { ok: false; reason: string; conflicts?: ShortcutConflict[] };
  clearActionShortcuts: (actionId: string) => void;
  resetAction: (actionId: string) => void;
  resetAll: () => void;
}

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      shortcuts: mergeShortcutMap(DEFAULT_SHORTCUTS),
      setActionShortcuts: (actionId, combos) => {
        const normalized = combos.filter((combo) => validateShortcutCombo(combo).ok);
        if (normalized.length !== combos.length) {
          return { ok: false, reason: 'invalid' };
        }
        const conflicts = findShortcutConflicts(DEFAULT_SHORTCUTS, get().shortcuts, actionId, normalized);
        if (conflicts.length > 0) {
          return { ok: false, reason: 'conflict', conflicts };
        }
        set((state) => ({ shortcuts: { ...state.shortcuts, [actionId]: normalized } }));
        return { ok: true };
      },
      clearActionShortcuts: (actionId) => {
        set((state) => ({ shortcuts: { ...state.shortcuts, [actionId]: [] } }));
      },
      resetAction: (actionId) => {
        set((state) => ({ shortcuts: resetShortcutAction(DEFAULT_SHORTCUTS, state.shortcuts, actionId) }));
      },
      resetAll: () => {
        set((state) => ({ shortcuts: resetAllShortcuts(DEFAULT_SHORTCUTS, state.shortcuts) }));
      },
    }),
    {
      name: 't8-canvas-shortcuts',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<ShortcutState>;
        return {
          ...current,
          shortcuts: mergeShortcutMap(DEFAULT_SHORTCUTS, p.shortcuts),
        };
      },
    },
  ),
);
