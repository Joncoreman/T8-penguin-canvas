import { create } from 'zustand';
import * as api from '../services/api';
import { resolveThemeTemplate } from '../theme/defaultTemplates';
import { getAchievementTheme, normalizeAchievementTheme, type AchievementThemeStyle } from '../data/achievementManifest';
import { useThemeStore } from './theme';

export type AchievementDrawerTab = 'overview' | 'themes' | 'medals' | 'films';
export type HiddenModeCeremonyKind = 'rh-duck' | 'yyh-portrait' | 'dragon-ball-shenron' | 'generic';

export interface AchievementNotification {
  id: string;
  title: string;
  themeId: AchievementThemeStyle;
  theme: string;
  rarity: string;
  createdAt: number;
  filmTitle?: string;
}

export interface HiddenModeCeremony {
  id: string;
  kind: HiddenModeCeremonyKind;
  themeId: AchievementThemeStyle;
  themeLabel: string;
  title: string;
  subtitle: string;
  createdAt: number;
}

interface AchievementState {
  profile: api.AchievementProfile | null;
  manifest: Record<string, any> | null;
  definitions: api.AchievementDefinitionData[];
  summary: api.AchievementSummary | null;
  loading: boolean;
  error: string | null;
  drawerOpen: boolean;
  activeTab: AchievementDrawerTab;
  activeTheme: AchievementThemeStyle | null;
  notifications: AchievementNotification[];
  ceremonies: HiddenModeCeremony[];
  loadProfile: () => Promise<void>;
  recordEvent: (payload: api.AchievementEventPayload) => Promise<void>;
  openDrawer: (tab?: AchievementDrawerTab, theme?: AchievementThemeStyle | string | null) => void;
  closeDrawer: () => void;
  setActiveTheme: (theme: AchievementThemeStyle | string | null) => void;
  dismissNotification: (id: string) => void;
  dismissCeremony: (id: string) => void;
  setPreferences: (patch: Partial<api.AchievementProfile['preferences']>) => Promise<void>;
  reset: () => Promise<void>;
  exportData: () => Promise<api.AchievementProfile | null>;
  importData: (data: api.AchievementProfile | Record<string, any>) => Promise<void>;
}

function currentAchievementTheme(): AchievementThemeStyle {
  const state = useThemeStore.getState();
  const tpl = resolveThemeTemplate(state.templateId, state.customTemplates);
  return normalizeAchievementTheme(tpl.visuals?.style || state.style);
}

function applyProfileResponse(set: (patch: Partial<AchievementState>) => void, data: api.AchievementProfileData) {
  set({
    profile: data.profile,
    manifest: data.manifest,
    definitions: data.definitions || [],
    summary: data.summary,
    error: null,
  });
}

function hiddenCeremonyKind(kind?: string | null): HiddenModeCeremonyKind {
  const raw = String(kind || '').trim();
  if (raw === 'rh-duck') return 'rh-duck';
  if (raw === 'yyh-portrait') return 'yyh-portrait';
  if (raw === 'dragon-ball-shenron') return 'dragon-ball-shenron';
  return 'generic';
}

function hiddenCeremonyCopy(kind: HiddenModeCeremonyKind, themeId: AchievementThemeStyle) {
  if (kind === 'rh-duck') {
    return {
      title: '隐藏解码模式已开启',
      subtitle: '红色终端通道已接入，RUN 将优先尝试鸭鸭图解码。',
    };
  }
  if (kind === 'yyh-portrait') {
    return {
      title: '隐藏词库已开启',
      subtitle: '灵界肖像词库开始响应，肖像大师将进入特殊提示流。',
    };
  }
  if (kind === 'dragon-ball-shenron') {
    return {
      title: '神龙模式已开启',
      subtitle: '七星归位，画布进入青色神龙主题。',
    };
  }
  const theme = getAchievementTheme(themeId);
  return {
    title: '隐藏模式已开启',
    subtitle: `${theme.shortLabel || theme.label} 的隐藏通道已经点亮。`,
  };
}

function buildHiddenCeremony(payload: api.AchievementEventPayload, theme: AchievementThemeStyle): HiddenModeCeremony | null {
  if (payload.type !== 'hidden_mode.enabled') return null;
  const kind = hiddenCeremonyKind(payload.kind);
  const themeManifest = getAchievementTheme(theme);
  const copy = hiddenCeremonyCopy(kind, theme);
  const createdAt = Date.now();
  return {
    id: `${kind}-${theme}-${createdAt}`,
    kind,
    themeId: theme,
    themeLabel: themeManifest.label,
    title: copy.title,
    subtitle: copy.subtitle,
    createdAt,
  };
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  profile: null,
  manifest: null,
  definitions: [],
  summary: null,
  loading: false,
  error: null,
  drawerOpen: false,
  activeTab: 'overview',
  activeTheme: null,
  notifications: [],
  ceremonies: [],

  async loadProfile() {
    if (get().loading) return;
    set({ loading: true, error: null });
    const res = await api.getAchievementProfile();
    if (!res.success) {
      set({ loading: false, error: res.error || '加载成就失败' });
      return;
    }
    applyProfileResponse(set, res.data);
    set({ loading: false });
  },

  async recordEvent(payload) {
    const theme = normalizeAchievementTheme(payload.theme || currentAchievementTheme());
    const res = await api.recordAchievementEvent({ ...payload, theme });
    if (!res.success) {
      set({ error: res.error || '成就事件记录失败' });
      return;
    }
    applyProfileResponse(set, res.data);
    const profile = res.data.profile;
    const ceremony = res.data.ignored || profile?.preferences?.showToast === false
      ? null
      : buildHiddenCeremony({ ...payload, theme }, theme);
    if (ceremony) {
      set((state) => ({
        ceremonies: [ceremony, ...state.ceremonies].slice(0, 3),
      }));
    }
    const recentUnlocks = res.data.summary?.recentUnlocks || [];
    if (res.data.ignored || profile?.preferences?.showToast === false || recentUnlocks.length === 0) return;
    const recentFilms = res.data.summary?.recentFilms || [];
    const filmByAchievement = new Map(recentFilms.map((film) => [film.sourceAchievementId, film.title]));
    const createdAt = Date.now();
    const nextNotifications = recentUnlocks.map((achievement) => ({
      id: `${achievement.id}-${createdAt}`,
      title: achievement.title,
      themeId: normalizeAchievementTheme(achievement.theme),
      theme: achievement.themeLabel || achievement.theme,
      rarity: achievement.rarity,
      createdAt,
      filmTitle: filmByAchievement.get(achievement.id),
    }));
    set((state) => ({
      notifications: [...nextNotifications, ...state.notifications].slice(0, 4),
    }));
  },

  openDrawer(tab = 'overview', theme = null) {
    const activeTheme = tab === 'themes' && theme ? normalizeAchievementTheme(theme) : (tab === 'themes' ? get().activeTheme : null);
    set({ drawerOpen: true, activeTab: tab, activeTheme });
    void get().loadProfile();
  },

  closeDrawer() {
    set({ drawerOpen: false });
  },

  setActiveTheme(theme) {
    set({ activeTheme: theme ? normalizeAchievementTheme(theme) : null });
  },

  dismissNotification(id) {
    set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) }));
  },

  dismissCeremony(id) {
    set((state) => ({ ceremonies: state.ceremonies.filter((item) => item.id !== id) }));
  },

  async setPreferences(patch) {
    const res = await api.updateAchievementPreferences(patch);
    if (!res.success) {
      set({ error: res.error || '保存成就设置失败' });
      return;
    }
    applyProfileResponse(set, res.data);
  },

  async reset() {
    const res = await api.resetAchievements();
    if (!res.success) {
      set({ error: res.error || '重置成就失败' });
      return;
    }
    applyProfileResponse(set, res.data);
    set({ notifications: [], ceremonies: [], activeTheme: null });
  },

  async exportData() {
    const res = await api.exportAchievements();
    if (!res.success) {
      set({ error: res.error || '导出成就失败' });
      return null;
    }
    return res.data;
  },

  async importData(data) {
    const res = await api.importAchievements(data);
    if (!res.success) {
      set({ error: res.error || '导入成就失败' });
      return;
    }
    applyProfileResponse(set, res.data);
  },
}));

export function trackAchievementEvent(payload: api.AchievementEventPayload) {
  void useAchievementStore.getState().recordEvent(payload);
}

export function getCurrentAchievementTheme() {
  return currentAchievementTheme();
}
