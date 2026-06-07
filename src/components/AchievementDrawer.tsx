import { useMemo, useRef, type ChangeEvent } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, CheckCircle2, ChevronRight, Clock3, Download, Eye, FileUp, Film, Lock, Medal, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';
import {
  achievementManifest,
  buildAchievementDefinitions,
  formatAchievementSeconds,
  getAchievementTheme,
  type AchievementDefinition,
  type AchievementFilmReward,
  type AchievementThemeManifest,
} from '../data/achievementManifest';
import { type AchievementDrawerTab, useAchievementStore } from '../stores/achievements';
import type { AchievementDailyTask, AchievementDefinitionData, AchievementThemeShowcase } from '../services/api';

const RARITY_LABEL: Record<string, string> = {
  bronze: '铜',
  silver: '银',
  gold: '金',
  master: '大师',
  hidden: '隐藏',
};

const TAB_ITEMS: Array<{ id: AchievementDrawerTab; label: string }> = [
  { id: 'overview', label: '总览' },
  { id: 'themes', label: '主题' },
  { id: 'medals', label: '勋章' },
  { id: 'films', label: '影片馆' },
];

const TASK_GROUP_LABELS = {
  time: '时长任务',
  featured: '主题任务',
  hidden: '隐藏任务',
} as const;

type TaskGroup = keyof typeof TASK_GROUP_LABELS;

function normalizeDefinition(def: AchievementDefinitionData | AchievementDefinition): AchievementDefinition {
  return def as AchievementDefinition;
}

function progressFor(stats: any, definition: AchievementDefinition) {
  const condition = definition.condition || {};
  const target = Math.max(1, Number(condition.seconds || condition.count) || 1);
  let current = 0;
  if (condition.type === 'time') current = Number(stats?.activeSeconds) || 0;
  else if (condition.type === 'counter' && condition.metric) current = Number(stats?.[condition.metric]) || 0;
  else if (condition.type === 'nodeCreated') {
    current = (condition.nodeTypes || []).reduce((sum, type) => sum + (Number(stats?.nodeTypeCounts?.[type]) || 0), 0);
  } else if (condition.type === 'nodeRun') {
    current = (condition.nodeTypes || []).reduce((sum, type) => sum + (Number(stats?.nodeRunCounts?.[type]) || 0), 0);
  } else if (condition.type === 'hidden') {
    const mode = condition.mode === 'used' ? 'used' : 'enabled';
    current = Number(stats?.hiddenModes?.[condition.kind || '']?.[mode]) || 0;
  }
  return { current, target, ratio: Math.max(0, Math.min(1, current / target)) };
}

function nextDefinition(themeDefinitions: AchievementDefinition[], stats: any, unlocked: Record<string, any>) {
  return themeDefinitions.find((definition) => !unlocked[definition.id] && progressFor(stats, definition).ratio < 1) || null;
}

function taskGroupFor(definition: AchievementDefinition): TaskGroup {
  if (definition.condition?.type === 'time') return 'time';
  if (definition.hidden || definition.rarity === 'hidden' || definition.condition?.type === 'hidden') return 'hidden';
  return 'featured';
}

function progressTextFor(stats: any, definition: AchievementDefinition) {
  const progress = progressFor(stats, definition);
  if (definition.condition?.type === 'time') {
    return `${formatAchievementSeconds(progress.current)} / ${formatAchievementSeconds(progress.target)}`;
  }
  return `${Math.min(progress.current, progress.target)} / ${progress.target}`;
}

function currentValueLabel(stats: any, definition: AchievementDefinition) {
  const condition = definition.condition || {};
  if (condition.type === 'time') return '有效创作时长';
  if (condition.type === 'hidden') return condition.mode === 'used' ? '隐藏模式产出' : '隐藏模式开启';
  if (condition.type === 'nodeCreated') return '节点创建';
  if (condition.type === 'nodeRun') return '节点运行成功';
  if (condition.metric === 'dragonBallsCollected') return '龙珠收集';
  if (condition.metric === 'dragonBallSetsCompleted') return '七星归位';
  if (condition.metric === 'panoramasGenerated') return '3D 全景生成';
  if (condition.metric === 'runsSucceeded') return '运行成功';
  if (condition.metric === 'nodesCreated') return '节点创建';
  return '当前进度';
}

function hiddenModeHint(definition: AchievementDefinition) {
  const kind = String(definition.condition?.kind || '');
  if (kind === 'rh-duck') return '长按 RH 主题下图像上传节点的 RUN 进入隐藏解码。';
  if (kind === 'yyh-portrait') return '长按幽游主题下肖像大师节点的 RUN 开启隐藏词库。';
  if (kind === 'dragon-ball-shenron') return '七龙珠主题集齐 1 星到 7 星后开启神龙模式。';
  return '隐藏模式会在对应主题和节点条件满足时出现。';
}

function dailyTaskProgressText(task: AchievementDailyTask) {
  if (task.targetKind === 'time') {
    return `${formatAchievementSeconds(task.progress)} / ${formatAchievementSeconds(task.target)}`;
  }
  return `${Math.min(Math.floor(task.progress || 0), Math.floor(task.target || 0))} / ${Math.floor(task.target || 0)}`;
}

function compactDateTime(value?: string) {
  if (!value) return '暂无';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '暂无';
  return new Date(time).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function nodeTypeLabel(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '暂无';
  const labels: Record<string, string> = {
    image: '图像',
    video: '视频',
    llm: 'LLM',
    upload: '上传素材',
    'panorama-3d': '3D 全景',
    'portrait-master': '肖像大师',
    'pose-master': '姿势大师',
    cinematic: '电影感',
    'video-motion': '视频运镜',
  };
  return labels[raw] || raw;
}

function showcaseSummary(showcase?: AchievementThemeShowcase | null) {
  if (!showcase || !showcase.hasShowcase) return '还没有沉淀代表作，保存素材或工作流后这里会亮起来。';
  const parts = [
    showcase.resourcesSaved ? `资源 ${showcase.resourcesSaved}` : '',
    showcase.workflowsSaved ? `工作流 ${showcase.workflowsSaved}` : '',
    showcase.panoramasGenerated ? `全景 ${showcase.panoramasGenerated}` : '',
    showcase.parseHubResolved ? `解析 ${showcase.parseHubResolved}` : '',
  ].filter(Boolean);
  return parts.join(' · ') || '已有创作沉淀';
}

export default function AchievementDrawer() {
  const drawerOpen = useAchievementStore((state) => state.drawerOpen);
  const activeTab = useAchievementStore((state) => state.activeTab);
  const activeTheme = useAchievementStore((state) => state.activeTheme);
  const closeDrawer = useAchievementStore((state) => state.closeDrawer);
  const openDrawer = useAchievementStore((state) => state.openDrawer);
  const setActiveTheme = useAchievementStore((state) => state.setActiveTheme);
  const profile = useAchievementStore((state) => state.profile);
  const definitionsFromStore = useAchievementStore((state) => state.definitions);
  const summary = useAchievementStore((state) => state.summary);
  const loading = useAchievementStore((state) => state.loading);
  const error = useAchievementStore((state) => state.error);
  const setPreferences = useAchievementStore((state) => state.setPreferences);
  const reset = useAchievementStore((state) => state.reset);
  const exportData = useAchievementStore((state) => state.exportData);
  const importData = useAchievementStore((state) => state.importData);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const definitions = useMemo(
    () => (definitionsFromStore.length > 0 ? definitionsFromStore : buildAchievementDefinitions()).map(normalizeDefinition),
    [definitionsFromStore],
  );
  const definitionsByTheme = useMemo(() => {
    const map = new Map<string, AchievementDefinition[]>();
    definitions.forEach((definition) => {
      const list = map.get(definition.theme) || [];
      list.push(definition);
      map.set(definition.theme, list);
    });
    return map;
  }, [definitions]);
  const definitionsById = useMemo(() => new Map(definitions.map((definition) => [definition.id, definition])), [definitions]);
  const unlocked = profile?.unlockedAchievements || {};
  const films = achievementManifest.films;
  const preferences = profile?.preferences || { enabled: true, showToast: true, showTopBadge: true };
  const trackingEnabled = preferences.enabled !== false;
  const dailySuggestions = useMemo(() => {
    return achievementManifest.themes
      .map((theme) => {
        const stats = profile?.themeStats?.[theme.style] || {};
        const themeDefinitions = definitionsByTheme.get(theme.style) || [];
        const next = nextDefinition(themeDefinitions, stats, unlocked);
        return {
          theme,
          todaySeconds: Number(stats.dailySeconds?.[summary?.today || '']) || 0,
          next,
        };
      })
      .filter((item) => item.next)
      .sort((a, b) => a.todaySeconds - b.todaySeconds)
      .slice(0, 3);
  }, [definitionsByTheme, profile?.themeStats, summary?.today, unlocked]);
  const selectedTheme = activeTheme ? getAchievementTheme(activeTheme) : null;
  const selectedThemeDefinitions = selectedTheme ? definitionsByTheme.get(selectedTheme.style) || [] : [];
  const selectedThemeStats = selectedTheme ? profile?.themeStats?.[selectedTheme.style] || {} : {};
  const selectedThemeUnlockedCount = selectedThemeDefinitions.filter((definition) => unlocked[definition.id]).length;
  const selectedThemeFilms = selectedTheme
    ? achievementManifest.films.filter((film) => film.theme === selectedTheme.style)
    : [];
  const summaryDailyTasks = summary?.dailyTasks || [];
  const weeklyPassport = summary?.weeklyPassport;
  const creativeReview = summary?.creativeReview;
  const selectedThemeShowcase = selectedTheme ? summary?.themeShowcases?.[selectedTheme.style] || null : null;

  if (!drawerOpen) return null;

  const handleExport = async () => {
    const data = await exportData();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `t8-achievements-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!window.confirm('导入会覆盖当前本机成就与时长数据，确定继续吗？')) return;
      await importData(raw);
    } catch {
      window.alert('导入失败：请选择有效的成就 JSON 备份。');
    }
  };

  const renderTask = (definition: AchievementDefinition) => {
    const isUnlocked = Boolean(unlocked[definition.id]);
    const trackingDisabled = !trackingEnabled && !isUnlocked;
    const progress = progressFor(selectedThemeStats, definition);
    return (
      <article
        key={definition.id}
        className={`t8-achievement-theme-task ${isUnlocked ? 'is-unlocked' : ''} ${definition.hidden ? 'is-hidden-task' : ''} ${trackingDisabled ? 'is-tracking-disabled' : ''}`}
      >
        <div className="t8-achievement-theme-task__icon">
          {isUnlocked ? <CheckCircle2 size={17} /> : definition.hidden ? <Eye size={16} /> : <Medal size={16} />}
        </div>
        <div className="t8-achievement-theme-task__body">
          <div className="t8-achievement-theme-task__top">
            <strong>{definition.title}</strong>
            <span>{RARITY_LABEL[definition.rarity] || definition.rarity}</span>
          </div>
          <p>{definition.description}</p>
          {definition.hidden && <div className="t8-achievement-theme-task__hint">{hiddenModeHint(definition)}</div>}
          {trackingDisabled && (
            <div className="t8-achievement-theme-task__disabled">
              本地成就统计已关闭，完成动作不会写入；开启后，当前仍处于隐藏模式的入口会自动补记一次。
            </div>
          )}
          <div className="t8-achievement-theme-task__meta">
            <span>{currentValueLabel(selectedThemeStats, definition)}</span>
            <span>{isUnlocked ? `完成于 ${new Date(unlocked[definition.id].unlockedAt).toLocaleString()}` : progressTextFor(selectedThemeStats, definition)}</span>
          </div>
          <div className="t8-achievement-progress">
            <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </div>
        </div>
      </article>
    );
  };

  const renderThemeFilm = (film: AchievementFilmReward) => {
    const unlockedFilm = profile?.unlockedFilms?.[film.id];
    const source = definitionsById.get(film.unlockAchievementId);
    return (
      <article key={film.id} className={`t8-achievement-theme-film ${unlockedFilm ? 'is-unlocked' : ''}`}>
        <div className="t8-achievement-film__poster">
          {unlockedFilm ? <Film size={24} /> : <Lock size={20} />}
        </div>
        <div className="t8-achievement-film__body">
          <div className="t8-achievement-film__title">{film.title}</div>
          <div className="t8-achievement-film__status">
            {unlockedFilm ? `已解锁 · ${unlockedFilm.unavailableText || '影片素材待提供'}` : film.lockedText || '待解锁'}
          </div>
          <div className="t8-achievement-film__condition">解锁条件：{source?.title || film.unlockAchievementId}</div>
        </div>
      </article>
    );
  };

  const renderThemeDetail = (theme: AchievementThemeManifest) => {
    const next = nextDefinition(selectedThemeDefinitions, selectedThemeStats, unlocked);
    const grouped = selectedThemeDefinitions.reduce<Record<TaskGroup, AchievementDefinition[]>>((acc, definition) => {
      acc[taskGroupFor(definition)].push(definition);
      return acc;
    }, { time: [], featured: [], hidden: [] });
    return (
      <div className="t8-achievement-theme-detail" style={{ '--achievement-accent': theme.accent } as any}>
        <button type="button" className="t8-achievement-back" onClick={() => setActiveTheme(null)}>
          <ArrowLeft size={15} /> 返回主题列表
        </button>
        <section className="t8-achievement-theme-hero">
          <div>
            <span>{theme.shortLabel}</span>
            <h3>{theme.label}</h3>
          </div>
          <strong>{selectedThemeUnlockedCount}/{selectedThemeDefinitions.length}</strong>
        </section>
        <div className="t8-achievement-theme-detail__kpis">
          <div>
            <span>累计有效时长</span>
            <strong>{formatAchievementSeconds(selectedThemeStats.activeSeconds || 0)}</strong>
          </div>
          <div>
            <span>今日有效时长</span>
            <strong>{formatAchievementSeconds(selectedThemeStats.dailySeconds?.[summary?.today || ''] || 0)}</strong>
          </div>
          <div>
            <span>下一枚</span>
            <strong>{next?.title || '已点亮'}</strong>
          </div>
        </div>
        {next && (
          <div className="t8-achievement-theme-next">
            <Clock3 size={15} />
            <span>{next.description}</span>
            <strong>{progressTextFor(selectedThemeStats, next)}</strong>
          </div>
        )}
        <section className="t8-achievement-theme-showcase">
          <div className="t8-achievement-theme-showcase__head">
            <Sparkles size={15} />
            <strong>本主题代表作</strong>
            <span>{selectedThemeShowcase?.hasShowcase ? '已沉淀' : '待点亮'}</span>
          </div>
          <p>{showcaseSummary(selectedThemeShowcase)}</p>
          <div className="t8-achievement-theme-showcase__grid">
            <div>
              <span>资源库</span>
              <strong>{selectedThemeShowcase?.resourcesSaved || 0}</strong>
            </div>
            <div>
              <span>工作流</span>
              <strong>{selectedThemeShowcase?.workflowsSaved || 0}</strong>
            </div>
            <div>
              <span>全景</span>
              <strong>{selectedThemeShowcase?.panoramasGenerated || 0}</strong>
            </div>
          </div>
          <div className="t8-achievement-theme-showcase__foot">
            <span>主要分类：{selectedThemeShowcase?.topCategory || '暂无'}</span>
            <span>最近：{compactDateTime(selectedThemeShowcase?.lastActivityAt)}</span>
          </div>
        </section>
        {(['time', 'featured', 'hidden'] as TaskGroup[]).map((group) => (
          grouped[group].length > 0 && (
            <section key={group} className={`t8-achievement-theme-task-group is-${group}`}>
              <h4>{TASK_GROUP_LABELS[group]}</h4>
              <div className="t8-achievement-theme-task-list">
                {grouped[group].map(renderTask)}
              </div>
            </section>
          )
        ))}
        {selectedThemeFilms.length > 0 && (
          <section className="t8-achievement-theme-task-group is-film">
            <h4>奖励影片</h4>
            <div className="t8-achievement-theme-task-list">
              {selectedThemeFilms.map(renderThemeFilm)}
            </div>
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="t8-achievement-drawer" data-canvas-floating-ui="achievement-drawer">
      <div className="t8-achievement-drawer__backdrop" onClick={closeDrawer} />
      <aside className="t8-achievement-drawer__panel" role="dialog" aria-label="主题成就">
        <header className="t8-achievement-drawer__header">
          <div>
            <div className="t8-achievement-drawer__title">
              <Trophy size={18} />
              主题成就
            </div>
            <div className="t8-achievement-drawer__subtitle">
              仅统计本机有效创作时长；后台、无焦点、长时间无操作不累计。
            </div>
          </div>
          <button type="button" className="t8-mini-icon-button" onClick={closeDrawer} title="关闭">
            <X size={16} />
          </button>
        </header>

        <nav className="t8-achievement-tabs">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'is-active' : ''}
              onClick={() => openDrawer(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="t8-achievement-drawer__body">
          {error && <div className="t8-achievement-alert">{error}</div>}
          {loading && !profile && <div className="t8-achievement-empty">正在加载成就数据...</div>}
          {!trackingEnabled && (
            <div className="t8-achievement-alert t8-achievement-alert--disabled">
              <div>
                <strong>本地成就统计已关闭</strong>
                <span>时长、运行、隐藏模式和龙珠收集事件现在都会被忽略；开启后会自动补记当前仍开启的隐藏模式。</span>
              </div>
              <button type="button" className="t8-btn t8-btn-primary" onClick={() => void setPreferences({ enabled: true })}>
                开启并补记
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="t8-achievement-section">
              <div className="t8-achievement-kpis">
                <div>
                  <span>今日有效时长</span>
                  <strong>{formatAchievementSeconds(summary?.todaySeconds || 0)}</strong>
                </div>
                <div>
                  <span>累计时长</span>
                  <strong>{formatAchievementSeconds(summary?.totalActiveSeconds || 0)}</strong>
                </div>
                <div>
                  <span>已获成就</span>
                  <strong>{summary?.unlockedCount || 0}/{summary?.achievementCount || definitions.length}</strong>
                </div>
              </div>

              <div className="t8-achievement-card">
                <div className="t8-achievement-card__title">本地统计</div>
                <label className="t8-achievement-toggle">
                  <span>允许本地成就统计</span>
                  <input
                    type="checkbox"
                    checked={preferences.enabled}
                    onChange={(event) => void setPreferences({ enabled: event.target.checked })}
                  />
                </label>
                <label className="t8-achievement-toggle">
                  <span>显示解锁提示</span>
                  <input
                    type="checkbox"
                    checked={preferences.showToast}
                    onChange={(event) => void setPreferences({ showToast: event.target.checked })}
                  />
                </label>
                <label className="t8-achievement-toggle">
                  <span>顶部显示主题徽章数</span>
                  <input
                    type="checkbox"
                    checked={preferences.showTopBadge}
                    onChange={(event) => void setPreferences({ showTopBadge: event.target.checked })}
                  />
                </label>
              </div>

              <div className="t8-achievement-card t8-achievement-passport">
                <div className="t8-achievement-card__title">
                  <CalendarDays size={15} /> 周常创作护照
                </div>
                <div className="t8-achievement-passport__top">
                  <strong>{weeklyPassport?.completedThemeCount || 0}/{weeklyPassport?.targetThemeCount || 3}</strong>
                  <span>{weeklyPassport?.weekStart || summary?.today} - {weeklyPassport?.weekEnd || summary?.today}</span>
                </div>
                <div className="t8-achievement-progress">
                  <span style={{ width: `${Math.round((weeklyPassport?.ratio || 0) * 100)}%` }} />
                </div>
                {weeklyPassport?.themes?.length ? (
                  <div className="t8-achievement-passport__themes">
                    {weeklyPassport.themes.map((item) => (
                      <button
                        key={item.theme}
                        type="button"
                        className={item.completed ? 'is-complete' : ''}
                        style={{ '--achievement-accent': item.accent } as any}
                        onClick={() => openDrawer('themes', item.theme)}
                        title={`${item.themeLabel} · 本周 ${formatAchievementSeconds(item.weeklySeconds)} · 创作动作 ${item.actionCount}`}
                      >
                        <span>{item.shortLabel || item.themeLabel}</span>
                        <strong>{item.completed ? '已盖章' : formatAchievementSeconds(item.weeklySeconds)}</strong>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="t8-achievement-empty">本周还没有盖章主题，完成一次运行、保存或隐藏探索就会记录。</div>
                )}
              </div>

              <div className="t8-achievement-card t8-achievement-review">
                <div className="t8-achievement-card__title">
                  <BarChart3 size={15} /> 本地创作回顾
                </div>
                <div className="t8-achievement-review__grid">
                  <div>
                    <span>最常用主题</span>
                    <strong>{creativeReview?.topTheme?.themeLabel || '暂无'}</strong>
                  </div>
                  <div>
                    <span>本周有效时长</span>
                    <strong>{formatAchievementSeconds(creativeReview?.weeklyActiveSeconds || 0)}</strong>
                  </div>
                  <div>
                    <span>常用节点</span>
                    <strong>{nodeTypeLabel(creativeReview?.mostUsedNodeType?.key)}</strong>
                  </div>
                  <div>
                    <span>隐藏探索</span>
                    <strong>{creativeReview?.hiddenModeActivations || 0}</strong>
                  </div>
                </div>
                <p>
                  累计创建 {creativeReview?.nodesCreated || 0} 个节点，成功运行 {creativeReview?.runsSucceeded || 0} 次，保存资源 {creativeReview?.resourcesSaved || 0} 项。
                </p>
              </div>

              <div className="t8-achievement-card">
                <div className="t8-achievement-card__title">今日创作任务</div>
                {summaryDailyTasks.length === 0 && dailySuggestions.length === 0 ? (
                  <div className="t8-achievement-empty">今天已经没有新的轻任务建议，继续创作就好。</div>
                ) : (
                  <div className="t8-achievement-task-list">
                    {summaryDailyTasks.length > 0 ? summaryDailyTasks.map((task) => {
                      const theme = getAchievementTheme(task.theme);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          className="t8-achievement-task"
                          onClick={() => openDrawer('themes', task.theme)}
                          style={{ '--achievement-accent': task.accent || theme.accent } as any}
                          title={task.description}
                        >
                          <strong>{task.themeLabel || theme.label}</strong>
                          <span>{task.title} · {dailyTaskProgressText(task)}</span>
                        </button>
                      );
                    }) : dailySuggestions.map(({ theme, next, todaySeconds }) => (
                      <button
                        key={theme.style}
                        type="button"
                        className="t8-achievement-task"
                        onClick={() => openDrawer('themes', theme.style)}
                        style={{ '--achievement-accent': theme.accent } as any}
                        title={next?.description}
                      >
                        <strong>{theme.label}</strong>
                        <span>{next?.title || '继续创作'} · 今日 {formatAchievementSeconds(todaySeconds)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="t8-achievement-actions">
                <button type="button" className="t8-btn" onClick={handleExport}>
                  <Download size={14} /> 导出
                </button>
                <button type="button" className="t8-btn" onClick={() => fileRef.current?.click()}>
                  <FileUp size={14} /> 导入
                </button>
                <button
                  type="button"
                  className="t8-btn"
                  onClick={() => {
                    if (window.confirm('确定重置本机成就与时长吗？')) void reset();
                  }}
                >
                  <RotateCcw size={14} /> 重置
                </button>
              </div>
            </div>
          )}

          {activeTab === 'themes' && (
            selectedTheme ? renderThemeDetail(selectedTheme) : (
              <div className="t8-achievement-theme-grid">
                {achievementManifest.themes.map((theme) => {
                  const stats = profile?.themeStats?.[theme.style] || {};
                  const themeDefinitions = definitionsByTheme.get(theme.style) || [];
                  const unlockedCount = themeDefinitions.filter((definition) => unlocked[definition.id]).length;
                  const next = nextDefinition(themeDefinitions, stats, unlocked);
                  const progress = next ? progressFor(stats, next) : null;
                  return (
                    <button
                      key={theme.style}
                      type="button"
                      className="t8-achievement-theme-card"
                      style={{ '--achievement-accent': theme.accent } as any}
                      onClick={() => setActiveTheme(theme.style)}
                      title={`${theme.label}成就详情`}
                    >
                      <div className="t8-achievement-theme-card__top">
                        <strong>{theme.label}</strong>
                        <span>{unlockedCount}/{themeDefinitions.length}</span>
                      </div>
                      <div className="t8-achievement-theme-card__time">{formatAchievementSeconds(stats.activeSeconds || 0)}</div>
                      <div className="t8-achievement-progress">
                        <span style={{ width: `${Math.round((progress?.ratio || 1) * 100)}%` }} />
                      </div>
                      <div className="t8-achievement-theme-card__next">
                        <span>{next ? `下一枚：${next.title}` : '本阶段主题成就已全部点亮'}</span>
                        <ChevronRight size={14} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}

          {activeTab === 'medals' && (
            <div className="t8-achievement-medal-list">
              {definitions.map((definition) => {
                const isUnlocked = Boolean(unlocked[definition.id]);
                const theme = getAchievementTheme(definition.theme);
                const stats = profile?.themeStats?.[definition.theme] || {};
                const progress = progressFor(stats, definition);
                return (
                  <article key={definition.id} className={`t8-achievement-medal ${isUnlocked ? 'is-unlocked' : ''}`}>
                    <div className="t8-achievement-medal__icon">
                      {isUnlocked ? <Medal size={18} /> : <Lock size={16} />}
                    </div>
                    <div className="t8-achievement-medal__body">
                      <div className="t8-achievement-medal__title">
                        <strong>{definition.title}</strong>
                        <span>{theme.shortLabel} · {RARITY_LABEL[definition.rarity] || definition.rarity}</span>
                      </div>
                      <p>{definition.description}</p>
                      <div className="t8-achievement-progress">
                        <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {activeTab === 'films' && (
            <div className="t8-achievement-film-list">
              {films.map((film) => {
                const unlockedFilm = profile?.unlockedFilms?.[film.id];
                const source = definitionsById.get(film.unlockAchievementId);
                const unlockedSource = Boolean(unlocked[film.unlockAchievementId]);
                return (
                  <article key={film.id} className={`t8-achievement-film ${unlockedFilm ? 'is-unlocked' : ''}`}>
                    <div className="t8-achievement-film__poster">
                      {unlockedFilm ? <Film size={28} /> : <Lock size={24} />}
                    </div>
                    <div className="t8-achievement-film__body">
                      <div className="t8-achievement-film__title">{film.title}</div>
                      <div className="t8-achievement-film__status">
                        {unlockedFilm
                          ? `已解锁 · ${unlockedFilm.unavailableText || '影片素材待提供'}`
                          : film.lockedText || '待解锁'}
                      </div>
                      <div className="t8-achievement-film__condition">
                        解锁条件：{source?.title || film.unlockAchievementId}
                        {unlockedSource && !unlockedFilm ? ' · 等待刷新' : ''}
                      </div>
                    </div>
                    <button type="button" className="t8-btn" disabled>
                      <Film size={14} /> 待提供
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </main>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
      </aside>
    </div>
  );
}
