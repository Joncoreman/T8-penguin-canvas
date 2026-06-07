'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

function loadAchievementManifest() {
  const candidates = [];
  if (process.env.T8PC_RES) {
    candidates.push(path.join(process.env.T8PC_RES, 'shared', 'achievementManifest.json'));
  }
  candidates.push(path.resolve(__dirname, '..', '..', '..', 'shared', 'achievementManifest.json'));
  candidates.push(path.resolve(process.cwd(), 'shared', 'achievementManifest.json'));

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, 'utf8'));
      }
    } catch (_) {}
  }
  return require('../../../shared/achievementManifest.json');
}

const manifest = loadAchievementManifest();

const SCHEMA = 't8-achievements';
const VERSION = 1;
const MAX_EVENTS = 120;
const MAX_TICK_SECONDS = 30;
const SESSION_GAP_MS = 5 * 60 * 1000;
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;
const THEME_STYLES = new Set(manifest.themes.map((theme) => theme.style));
const EVENT_TYPES = new Set([
  'theme.active_tick',
  'theme.switched',
  'hidden_mode.enabled',
  'hidden_mode.used',
  'node.created',
  'node.run_success',
  'resource.saved',
  'workflow.saved',
  'panorama.generated',
  'parsehub.resolved',
  'dragon_ball.collected',
  'dragon_ball.set_completed',
]);
const CREATIVE_EVENT_TYPES = new Set([
  'hidden_mode.enabled',
  'hidden_mode.used',
  'node.created',
  'node.run_success',
  'resource.saved',
  'workflow.saved',
  'panorama.generated',
  'parsehub.resolved',
  'dragon_ball.collected',
  'dragon_ball.set_completed',
]);

function nowIso(ts = Date.now()) {
  return new Date(ts).toISOString();
}

function localDateKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function safeText(value, fallback = '') {
  return String(value || fallback)
    .trim()
    .replace(/[^\w.\-:/]/g, '')
    .slice(0, 96);
}

function normalizeTheme(style) {
  const raw = String(style || '').trim();
  return THEME_STYLES.has(raw) ? raw : 'tech';
}

function buildDefinitions() {
  return manifest.themes.flatMap((theme) => {
    const timeDefs = manifest.timeMilestones.map((milestone) => ({
      id: `${theme.style}-time-${milestone.key}`,
      theme: theme.style,
      themeLabel: theme.label,
      title: milestone.titleTemplate.replace('{theme}', theme.label),
      description: milestone.descriptionTemplate.replace('{theme}', theme.label),
      rarity: milestone.rarity,
      condition: {
        type: 'time',
        seconds: milestone.seconds,
        count: milestone.seconds,
        metric: 'activeSeconds',
      },
      medal: milestone.rarity === 'master',
      hidden: false,
    }));
    const featuredDefs = theme.featured.map((item) => ({
      id: `${theme.style}-${item.idSuffix}`,
      theme: theme.style,
      themeLabel: theme.label,
      title: item.title,
      description: item.description,
      rarity: item.rarity,
      condition: item.condition,
      medal: item.rarity === 'master' || item.rarity === 'gold' || item.rarity === 'hidden',
      hidden: item.rarity === 'hidden',
    }));
    return [...timeDefs, ...featuredDefs];
  });
}

const DEFINITIONS = buildDefinitions();
const DEFINITIONS_BY_ID = new Map(DEFINITIONS.map((definition) => [definition.id, definition]));

function emptyThemeStats() {
  return {
    activeSeconds: 0,
    sessions: 0,
    lastActiveAt: '',
    dailySeconds: {},
    nodesCreated: 0,
    runsSucceeded: 0,
    resourcesSaved: 0,
    workflowsSaved: 0,
    hiddenModeActivations: 0,
    hiddenModeUses: 0,
    panoramasGenerated: 0,
    parseHubResolved: 0,
    dragonBallsCollected: 0,
    dragonBallSetsCompleted: 0,
    nodeTypeCounts: {},
    nodeRunCounts: {},
    hiddenModes: {},
  };
}

function defaultData() {
  const profileId = `local_${crypto.randomBytes(8).toString('hex')}`;
  return {
    schema: SCHEMA,
    version: VERSION,
    profileId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    themeStats: Object.fromEntries(manifest.themes.map((theme) => [theme.style, emptyThemeStats()])),
    events: [],
    unlockedAchievements: {},
    claimedMedals: {},
    unlockedFilms: {},
    preferences: {
      enabled: true,
      showToast: true,
      showTopBadge: true,
    },
  };
}

function ensureDir() {
  fs.mkdirSync(path.dirname(config.ACHIEVEMENTS_FILE), { recursive: true });
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function secondsValue(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeDailySeconds(value) {
  const source = ensureObject(value);
  const dailySeconds = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const amount = secondsValue(rawValue);
    if (amount <= 0) continue;
    let key = String(rawKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      const parsed = Date.parse(key);
      if (!Number.isFinite(parsed)) continue;
      key = localDateKey(parsed);
    }
    dailySeconds[key] = secondsValue(dailySeconds[key]) + amount;
  }
  return dailySeconds;
}

function sumDailySeconds(dailySeconds) {
  return Object.values(ensureObject(dailySeconds)).reduce((sum, value) => sum + secondsValue(value), 0);
}

function dateKeyTime(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!match) return NaN;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

function startOfLocalWeek(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

function endOfLocalWeek(ts = Date.now()) {
  return startOfLocalWeek(ts) + (7 * 24 * 60 * 60 * 1000);
}

function rangeSeconds(dailySeconds, startMs, endMs) {
  return Object.entries(ensureObject(dailySeconds)).reduce((sum, [key, value]) => {
    const time = dateKeyTime(key);
    if (!Number.isFinite(time) || time < startMs || time >= endMs) return sum;
    return sum + secondsValue(value);
  }, 0);
}

function bestKnownActiveSeconds(raw, dailySeconds) {
  const dailyTotal = sumDailySeconds(dailySeconds);
  return Math.max(
    dailyTotal,
    secondsValue(raw.activeSeconds),
    secondsValue(raw.totalActiveSeconds),
    secondsValue(raw.totalSeconds),
    secondsValue(raw.usageSeconds),
    secondsValue(raw.durationSeconds),
    secondsValue(raw.timeSeconds),
  );
}

function ensureThemeStats(data, theme) {
  const key = normalizeTheme(theme);
  data.themeStats = ensureObject(data.themeStats);
  const raw = ensureObject(data.themeStats[key]);
  const dailySeconds = normalizeDailySeconds(raw.dailySeconds);
  data.themeStats[key] = {
    ...emptyThemeStats(),
    ...raw,
    activeSeconds: bestKnownActiveSeconds(raw, dailySeconds),
    sessions: secondsValue(raw.sessions),
    dailySeconds,
    nodeTypeCounts: ensureObject(raw.nodeTypeCounts),
    nodeRunCounts: ensureObject(raw.nodeRunCounts),
    hiddenModes: ensureObject(raw.hiddenModes),
  };
  return data.themeStats[key];
}

function sanitizeData(raw) {
  const data = raw && typeof raw === 'object' ? raw : defaultData();
  data.schema = SCHEMA;
  data.version = VERSION;
  data.profileId = safeText(data.profileId, `local_${crypto.randomBytes(8).toString('hex')}`);
  data.createdAt = typeof data.createdAt === 'string' ? data.createdAt : nowIso();
  data.updatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : nowIso();
  data.events = Array.isArray(data.events) ? data.events.slice(-MAX_EVENTS) : [];
  data.unlockedAchievements = ensureObject(data.unlockedAchievements);
  data.claimedMedals = ensureObject(data.claimedMedals);
  data.unlockedFilms = ensureObject(data.unlockedFilms);
  data.preferences = {
    enabled: data.preferences?.enabled !== false,
    showToast: data.preferences?.showToast !== false,
    showTopBadge: data.preferences?.showTopBadge !== false,
  };
  manifest.themes.forEach((theme) => ensureThemeStats(data, theme.style));
  return data;
}

function loadData() {
  ensureDir();
  if (!fs.existsSync(config.ACHIEVEMENTS_FILE)) {
    const recovered = loadRecoveryData();
    if (recovered) {
      saveData(recovered);
      return recovered;
    }
    const data = defaultData();
    saveData(data);
    return data;
  }
  try {
    const raw = loadJsonFromFile(config.ACHIEVEMENTS_FILE);
    const before = JSON.stringify(raw);
    const data = sanitizeData(raw);
    if (JSON.stringify(data) !== before) saveData(data);
    return data;
  } catch (error) {
    const backup = quarantineCorruptFile();
    console.warn(
      '[achievements] achievements.json 已损坏，尝试从备份恢复:',
      error?.message || error,
      backup ? `broken=${backup}` : '',
    );
    const data = loadRecoveryData() || defaultData();
    saveData(data);
    return data;
  }
}

function saveData(data) {
  ensureDir();
  data.updatedAt = nowIso();
  const file = config.ACHIEVEMENTS_FILE;
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    backupExistingFile(file);
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temp, file);
  } finally {
    try { if (fs.existsSync(temp)) fs.rmSync(temp, { force: true }); } catch (_) {}
  }
}

function backupExistingFile(file = config.ACHIEVEMENTS_FILE) {
  if (!fs.existsSync(file)) return;
  const backup = `${file}.bak`;
  try {
    const sourceStat = fs.statSync(file);
    const backupStat = fs.existsSync(backup) ? fs.statSync(backup) : null;
    const shouldBackup = !backupStat
      || sourceStat.mtimeMs - backupStat.mtimeMs >= BACKUP_INTERVAL_MS
      || sourceStat.size !== backupStat.size;
    if (shouldBackup) fs.copyFileSync(file, backup);
  } catch (error) {
    console.warn('[achievements] backup failed:', error?.message || error);
  }
}

function recoveryCandidates() {
  const file = config.ACHIEVEMENTS_FILE;
  const dir = path.dirname(file);
  const name = path.basename(file);
  const candidates = [`${file}.bak`];
  try {
    const backups = fs.readdirSync(dir)
      .filter((item) => item.startsWith(`${name}.broken-`) || item.startsWith(`${name}.backup-`))
      .map((item) => path.join(dir, item))
      .filter((item) => fs.statSync(item).isFile())
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    candidates.push(...backups);
  } catch (_) {}
  return [...new Set(candidates)].filter((candidate) => fs.existsSync(candidate));
}

function loadJsonFromFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadRecoveryData() {
  for (const candidate of recoveryCandidates()) {
    try {
      const raw = loadJsonFromFile(candidate);
      const before = JSON.stringify(raw);
      const data = sanitizeData(raw?.data || raw);
      if (JSON.stringify(data) !== before) data.updatedAt = nowIso();
      console.warn('[achievements] recovered from backup:', candidate);
      return data;
    } catch (_) {}
  }
  return null;
}

function quarantineCorruptFile() {
  const file = config.ACHIEVEMENTS_FILE;
  if (!fs.existsSync(file)) return '';
  const backup = `${file}.broken-${Date.now()}`;
  try {
    fs.renameSync(file, backup);
    return backup;
  } catch (_) {
    try {
      fs.copyFileSync(file, backup);
      fs.rmSync(file, { force: true });
      return backup;
    } catch (_) {
      return '';
    }
  }
}

function countForNodeTypes(map, nodeTypes) {
  const source = ensureObject(map);
  const list = Array.isArray(nodeTypes) ? nodeTypes : [];
  if (list.length === 0) {
    return Object.values(source).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }
  return list.reduce((sum, nodeType) => sum + (Number(source[nodeType]) || 0), 0);
}

function hiddenCount(stats, condition) {
  const kind = safeText(condition.kind);
  const mode = condition.mode === 'used' ? 'used' : 'enabled';
  if (!kind) return 0;
  return Number(stats.hiddenModes?.[kind]?.[mode]) || 0;
}

function metricValue(stats, condition) {
  switch (condition.type) {
    case 'time':
      return Number(stats.activeSeconds) || 0;
    case 'nodeCreated':
      return countForNodeTypes(stats.nodeTypeCounts, condition.nodeTypes);
    case 'nodeRun':
      return countForNodeTypes(stats.nodeRunCounts, condition.nodeTypes);
    case 'hidden':
      return hiddenCount(stats, condition);
    case 'counter': {
      const metric = safeText(condition.metric);
      return Number(stats[metric]) || 0;
    }
    default:
      return 0;
  }
}

function conditionTarget(condition) {
  if (condition.type === 'time') return Number(condition.seconds) || Number(condition.count) || 1;
  return Number(condition.count) || 1;
}

function evaluateUnlocks(data, event) {
  const unlocked = [];
  for (const definition of DEFINITIONS) {
    if (data.unlockedAchievements[definition.id]) continue;
    const stats = ensureThemeStats(data, definition.theme);
    if (metricValue(stats, definition.condition) < conditionTarget(definition.condition)) continue;
    data.unlockedAchievements[definition.id] = {
      id: definition.id,
      theme: definition.theme,
      title: definition.title,
      rarity: definition.rarity,
      unlockedAt: nowIso(),
      eventType: event?.type || 'migration',
    };
    unlocked.push(definition);
  }

  const unlockedFilms = [];
  for (const film of manifest.films) {
    if (data.unlockedFilms[film.id]) continue;
    if (!data.unlockedAchievements[film.unlockAchievementId]) continue;
    data.unlockedFilms[film.id] = {
      id: film.id,
      theme: normalizeTheme(film.theme),
      title: film.title,
      unlockedAt: nowIso(),
      sourceAchievementId: film.unlockAchievementId,
      hasMedia: false,
      status: 'awaiting-media',
      lockedText: film.lockedText || '待解锁',
      unavailableText: film.unavailableText || '影片素材待提供',
      playedSeconds: 0,
    };
    unlockedFilms.push(data.unlockedFilms[film.id]);
  }
  return { unlocked, unlockedFilms };
}

function sanitizeEvent(payload) {
  const type = String(payload?.type || '').trim();
  if (!EVENT_TYPES.has(type)) return null;
  const at = Date.now();
  const event = {
    type,
    theme: normalizeTheme(payload?.theme),
    at: nowIso(at),
  };
  if (type === 'theme.active_tick') {
    event.amountSeconds = Math.max(0, Math.min(MAX_TICK_SECONDS, Math.floor(Number(payload?.amountSeconds) || 0)));
  }
  if (payload?.nodeType) event.nodeType = safeText(payload.nodeType);
  if (payload?.kind) event.kind = safeText(payload.kind);
  if (payload?.mode) event.mode = safeText(payload.mode);
  if (payload?.category) event.category = safeText(payload.category);
  return event;
}

function bump(map, key, amount = 1) {
  if (!key) return;
  map[key] = Math.max(0, Math.floor(Number(map[key]) || 0)) + amount;
}

function applyEventToStats(data, event) {
  const stats = ensureThemeStats(data, event.theme);
  if (event.type === 'theme.active_tick') {
    const requestedAmount = Math.max(0, Math.min(MAX_TICK_SECONDS, Number(event.amountSeconds) || 0));
    if (requestedAmount <= 0) return;
    const previous = stats.lastActiveAt ? Date.parse(stats.lastActiveAt) : 0;
    const current = Date.parse(event.at) || Date.now();
    const elapsedSincePrevious = previous > 0 ? Math.max(0, Math.floor((current - previous) / 1000)) : requestedAmount;
    const amount = previous > 0 ? Math.min(requestedAmount, elapsedSincePrevious) : requestedAmount;
    if (amount <= 0) return;
    if (!previous || current - previous > SESSION_GAP_MS) stats.sessions += 1;
    stats.activeSeconds += amount;
    const day = localDateKey(current);
    stats.dailySeconds[day] = Math.max(0, Math.floor(Number(stats.dailySeconds[day]) || 0)) + amount;
    stats.lastActiveAt = event.at;
    return;
  }
  if (event.type === 'node.created') {
    stats.nodesCreated += 1;
    bump(stats.nodeTypeCounts, event.nodeType || 'unknown');
    return;
  }
  if (event.type === 'node.run_success') {
    stats.runsSucceeded += 1;
    bump(stats.nodeRunCounts, event.nodeType || 'unknown');
    return;
  }
  if (event.type === 'hidden_mode.enabled' || event.type === 'hidden_mode.used') {
    const kind = event.kind || 'unknown';
    stats.hiddenModes[kind] = ensureObject(stats.hiddenModes[kind]);
    if (event.type === 'hidden_mode.enabled') {
      stats.hiddenModeActivations += 1;
      bump(stats.hiddenModes[kind], 'enabled');
    } else {
      stats.hiddenModeUses += 1;
      bump(stats.hiddenModes[kind], 'used');
    }
    return;
  }
  if (event.type === 'resource.saved') {
    stats.resourcesSaved += 1;
    return;
  }
  if (event.type === 'workflow.saved') {
    stats.workflowsSaved += 1;
    return;
  }
  if (event.type === 'panorama.generated') {
    stats.panoramasGenerated += 1;
    return;
  }
  if (event.type === 'parsehub.resolved') {
    stats.parseHubResolved += 1;
    return;
  }
  if (event.type === 'dragon_ball.collected') {
    stats.dragonBallsCollected += 1;
    return;
  }
  if (event.type === 'dragon_ball.set_completed') {
    stats.dragonBallSetsCompleted += 1;
  }
}

function buildDailyTasks(data, today) {
  return manifest.themes
    .map((theme) => {
      const stats = ensureThemeStats(data, theme.style);
      const next = DEFINITIONS.find((definition) => {
        if (definition.theme !== theme.style) return false;
        if (data.unlockedAchievements[definition.id]) return false;
        return metricValue(stats, definition.condition) < conditionTarget(definition.condition);
      });
      if (!next) return null;
      const progress = metricValue(stats, next.condition);
      const target = conditionTarget(next.condition);
      return {
        id: `daily-${theme.style}-${next.id}`,
        theme: theme.style,
        themeLabel: theme.label,
        accent: theme.accent,
        achievementId: next.id,
        title: next.title,
        description: next.description,
        progress,
        target,
        ratio: Math.max(0, Math.min(1, progress / Math.max(1, target))),
        targetKind: next.condition?.type || 'counter',
        todaySeconds: secondsValue(stats.dailySeconds?.[today]),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.todaySeconds - b.todaySeconds) || (a.ratio - b.ratio))
    .slice(0, 4);
}

function weeklyActionCounts(events, startMs, endMs) {
  const counts = {};
  for (const event of Array.isArray(events) ? events : []) {
    const time = Date.parse(event?.at || '');
    if (!Number.isFinite(time) || time < startMs || time >= endMs) continue;
    if (!CREATIVE_EVENT_TYPES.has(event.type)) continue;
    const theme = normalizeTheme(event.theme);
    counts[theme] = secondsValue(counts[theme]) + 1;
  }
  return counts;
}

function buildWeeklyPassport(data) {
  const now = Date.now();
  const startMs = startOfLocalWeek(now);
  const endMs = endOfLocalWeek(now);
  const actionCounts = weeklyActionCounts(data.events, startMs, endMs);
  const themes = manifest.themes.map((theme) => {
    const stats = ensureThemeStats(data, theme.style);
    const weeklySeconds = rangeSeconds(stats.dailySeconds, startMs, endMs);
    const actionCount = secondsValue(actionCounts[theme.style]);
    const completed = weeklySeconds >= 600 || actionCount > 0;
    return {
      theme: theme.style,
      themeLabel: theme.label,
      shortLabel: theme.shortLabel,
      accent: theme.accent,
      weeklySeconds,
      actionCount,
      completed,
    };
  });
  const completedThemes = themes.filter((theme) => theme.completed);
  return {
    weekStart: localDateKey(startMs),
    weekEnd: localDateKey(endMs - 1),
    targetThemeCount: 3,
    completedThemeCount: completedThemes.length,
    ratio: Math.max(0, Math.min(1, completedThemes.length / 3)),
    themes: themes
      .filter((theme) => theme.completed || theme.weeklySeconds > 0 || theme.actionCount > 0)
      .sort((a, b) => Number(b.completed) - Number(a.completed) || b.weeklySeconds - a.weeklySeconds || b.actionCount - a.actionCount)
      .slice(0, 6),
  };
}

function topEntry(map) {
  let best = { key: '', value: 0 };
  for (const [key, value] of Object.entries(ensureObject(map))) {
    const amount = secondsValue(value);
    if (amount > best.value) best = { key, value: amount };
  }
  return best;
}

function buildCreativeReview(data, weeklyPassport, today) {
  const totals = {
    nodesCreated: 0,
    runsSucceeded: 0,
    resourcesSaved: 0,
    workflowsSaved: 0,
    hiddenModeActivations: 0,
  };
  const nodeRuns = {};
  let topTheme = null;
  let todayTopTheme = null;
  let weeklyActiveSeconds = 0;
  for (const theme of manifest.themes) {
    const stats = ensureThemeStats(data, theme.style);
    totals.nodesCreated += secondsValue(stats.nodesCreated);
    totals.runsSucceeded += secondsValue(stats.runsSucceeded);
    totals.resourcesSaved += secondsValue(stats.resourcesSaved);
    totals.workflowsSaved += secondsValue(stats.workflowsSaved);
    totals.hiddenModeActivations += secondsValue(stats.hiddenModeActivations);
    weeklyActiveSeconds += rangeSeconds(stats.dailySeconds, startOfLocalWeek(), endOfLocalWeek());
    for (const [nodeType, count] of Object.entries(ensureObject(stats.nodeRunCounts))) {
      nodeRuns[nodeType] = secondsValue(nodeRuns[nodeType]) + secondsValue(count);
    }
    const activeSeconds = secondsValue(stats.activeSeconds);
    const todaySeconds = secondsValue(stats.dailySeconds?.[today]);
    if (!topTheme || activeSeconds > topTheme.activeSeconds) {
      topTheme = { theme: theme.style, themeLabel: theme.label, activeSeconds };
    }
    if (!todayTopTheme || todaySeconds > todayTopTheme.todaySeconds) {
      todayTopTheme = { theme: theme.style, themeLabel: theme.label, todaySeconds };
    }
  }
  const mostUsedNodeType = topEntry(nodeRuns);
  return {
    topTheme,
    todayTopTheme,
    weeklyActiveSeconds,
    weeklyThemeCount: weeklyPassport.completedThemeCount,
    mostUsedNodeType: mostUsedNodeType.key ? mostUsedNodeType : null,
    recentCreativeEventCount: (Array.isArray(data.events) ? data.events : []).filter((event) => CREATIVE_EVENT_TYPES.has(event.type)).length,
    ...totals,
  };
}

function buildThemeShowcases(data) {
  const showcases = {};
  for (const theme of manifest.themes) {
    const stats = ensureThemeStats(data, theme.style);
    const categoryCounts = {};
    let lastActivityAt = '';
    for (const event of Array.isArray(data.events) ? data.events : []) {
      if (normalizeTheme(event.theme) !== theme.style) continue;
      if (!CREATIVE_EVENT_TYPES.has(event.type)) continue;
      if (!lastActivityAt || Date.parse(event.at || '') > Date.parse(lastActivityAt || '')) lastActivityAt = event.at || '';
      if (event.type === 'resource.saved' && event.category) {
        bump(categoryCounts, event.category);
      }
    }
    const topCategory = topEntry(categoryCounts);
    showcases[theme.style] = {
      theme: theme.style,
      themeLabel: theme.label,
      resourcesSaved: secondsValue(stats.resourcesSaved),
      workflowsSaved: secondsValue(stats.workflowsSaved),
      panoramasGenerated: secondsValue(stats.panoramasGenerated),
      parseHubResolved: secondsValue(stats.parseHubResolved),
      topCategory: topCategory.key || '',
      topCategoryCount: topCategory.value,
      lastActivityAt,
      hasShowcase: secondsValue(stats.resourcesSaved) + secondsValue(stats.workflowsSaved) + secondsValue(stats.panoramasGenerated) > 0,
    };
  }
  return showcases;
}

function buildSummary(data, unlockResult = { unlocked: [], unlockedFilms: [] }) {
  const today = localDateKey();
  const totalActiveSeconds = Object.values(data.themeStats || {}).reduce(
    (sum, stats) => sum + (Number(stats?.activeSeconds) || 0),
    0,
  );
  const todaySeconds = Object.values(data.themeStats || {}).reduce(
    (sum, stats) => sum + (Number(stats?.dailySeconds?.[today]) || 0),
    0,
  );
  const weeklyPassport = buildWeeklyPassport(data);
  return {
    today,
    todaySeconds,
    totalActiveSeconds,
    achievementCount: DEFINITIONS.length,
    unlockedCount: Object.keys(data.unlockedAchievements || {}).length,
    filmCount: manifest.films.length,
    unlockedFilmCount: Object.keys(data.unlockedFilms || {}).length,
    recentUnlocks: unlockResult.unlocked,
    recentFilms: unlockResult.unlockedFilms,
    dailyTasks: buildDailyTasks(data, today),
    weeklyPassport,
    creativeReview: buildCreativeReview(data, weeklyPassport, today),
    themeShowcases: buildThemeShowcases(data),
  };
}

function publicData(data, unlockResult) {
  return {
    profile: data,
    manifest,
    definitions: DEFINITIONS,
    summary: buildSummary(data, unlockResult),
  };
}

function getProfile() {
  const data = loadData();
  const unlockResult = evaluateUnlocks(data, null);
  if (unlockResult.unlocked.length > 0 || unlockResult.unlockedFilms.length > 0) saveData(data);
  return publicData(data, unlockResult);
}

function recordEvent(payload) {
  const data = loadData();
  const event = sanitizeEvent(payload);
  if (!event) return { ...publicData(data), ignored: true };
  if (data.preferences?.enabled === false && event.type !== 'theme.switched') {
    return { ...publicData(data), ignored: true, ignoredReason: 'achievement-tracking-disabled' };
  }
  applyEventToStats(data, event);
  data.events.push(event);
  data.events = data.events.slice(-MAX_EVENTS);
  const unlockResult = evaluateUnlocks(data, event);
  saveData(data);
  return { ...publicData(data, unlockResult), event, ignored: false };
}

function setPreferences(patch) {
  const data = loadData();
  data.preferences = {
    ...data.preferences,
    ...(typeof patch?.enabled === 'boolean' ? { enabled: patch.enabled } : {}),
    ...(typeof patch?.showToast === 'boolean' ? { showToast: patch.showToast } : {}),
    ...(typeof patch?.showTopBadge === 'boolean' ? { showTopBadge: patch.showTopBadge } : {}),
  };
  saveData(data);
  return publicData(data);
}

function resetData() {
  const data = defaultData();
  saveData(data);
  return publicData(data);
}

function exportData() {
  return loadData();
}

function importData(raw) {
  const data = sanitizeData(raw?.data || raw);
  const unlockResult = evaluateUnlocks(data, null);
  saveData(data);
  return publicData(data, unlockResult);
}

module.exports = {
  buildDefinitions,
  getProfile,
  recordEvent,
  setPreferences,
  resetData,
  exportData,
  importData,
  normalizeTheme,
  _private: {
    sanitizeEvent,
    metricValue,
    conditionTarget,
    defaultData,
    loadData,
  },
};
