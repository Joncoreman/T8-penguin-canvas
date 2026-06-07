import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ViewportPortal, useReactFlow } from '@xyflow/react';
import { Power, Radar, RotateCcw, Sparkles } from 'lucide-react';
import { trackAchievementEvent } from '../stores/achievements';
import {
  DRAGON_BALL_COLLECT_TTL_MS,
  DRAGON_BALL_HOLD_TO_COLLECT_MS,
  DRAGON_BALL_SPAWN_INTERVAL_MS,
  DRAGON_BALL_SPAWN_VISIBLE_MS,
  DRAGON_BALL_STARS,
  availableDragonBallStars,
  type DragonBallSpawn,
  type DragonBallStar,
  useDragonBallRadarStore,
} from '../stores/dragonBallRadar';

interface DragonBallRadarProps {
  visualStyle: string;
  viewportMoving: boolean;
  nodeDragging: boolean;
}

interface CollectFeedback {
  star: DragonBallStar;
  until: number;
}

interface RadarRuntimeSnapshot {
  collected: ReturnType<typeof useDragonBallRadarStore.getState>['collected'];
  activeSpawn: ReturnType<typeof useDragonBallRadarStore.getState>['activeSpawn'];
  trackingTarget: ReturnType<typeof useDragonBallRadarStore.getState>['trackingTarget'];
  nextSpawnAt: number;
  shenronUnlockedAt: string | null;
  shenronModeActive: boolean;
  viewportMoving: boolean;
  nodeDragging: boolean;
}

const DRAGON_BALL_RADAR_COLLAPSED_STORAGE_KEY = 't8.dragonBallRadar.collapsed.v1';

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function formatMs(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function starLabel(star: DragonBallStar) {
  return `${star} 星球`;
}

function playDragonBallCollectSound() {
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor() as AudioContext;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.72);
    master.connect(ctx.destination);

    const tones = [
      { freq: 523.25, at: 0 },
      { freq: 659.25, at: 0.08 },
      { freq: 783.99, at: 0.16 },
      { freq: 1046.5, at: 0.28 },
    ];
    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + tone.at;
      osc.type = tone.freq > 900 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(tone.freq, start);
      osc.frequency.exponentialRampToValueAtTime(tone.freq * 1.08, start + 0.18);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.016);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.34);
    });
    window.setTimeout(() => {
      void ctx.close();
    }, 900);
  } catch {
    /* best-effort feedback */
  }
}

function DragonBallOrb({ star, compact = false }: { star: DragonBallStar; compact?: boolean }) {
  return (
    <span
      className={`t8-dragonball-orb ${compact ? 'is-compact' : ''}`}
      data-star={star}
      aria-hidden="true"
    >
      <span className="t8-dragonball-orb__stars">
        {Array.from({ length: star }).map((_, index) => (
          <span key={index} data-index={index + 1}>★</span>
        ))}
      </span>
    </span>
  );
}

function buildSpawn(args: {
  star: DragonBallStar;
  now: number;
  getNodes: ReturnType<typeof useReactFlow>['getNodes'];
  screenToFlowPosition: ReturnType<typeof useReactFlow>['screenToFlowPosition'];
}): DragonBallSpawn {
  const mapX = 14 + Math.random() * 72;
  const mapY = 14 + Math.random() * 72;
  const px = clamp01(mapX / 100);
  const py = clamp01(mapY / 100);
  const nodes = args.getNodes();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const w = (node as any).measured?.width || (node as any).width || 360;
    const h = (node as any).measured?.height || (node as any).height || 260;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    const shell = document.querySelector<HTMLElement>('.t8-canvas-shell');
    const rect = shell?.getBoundingClientRect();
    const center = args.screenToFlowPosition({
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
    });
    minX = center.x - 1200;
    maxX = center.x + 1200;
    minY = center.y - 900;
    maxY = center.y + 900;
  } else {
    const padX = Math.max(900, (maxX - minX) * 0.34);
    const padY = Math.max(680, (maxY - minY) * 0.34);
    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;
  }

  const spawnedAt = args.now;
  return {
    id: `dragon-ball-${args.star}-${spawnedAt}`,
    star: args.star,
    x: minX + (maxX - minX) * px,
    y: minY + (maxY - minY) * py,
    mapX,
    mapY,
    spawnedAt,
    expiresAt: spawnedAt + DRAGON_BALL_SPAWN_VISIBLE_MS,
  };
}

export default function DragonBallRadar({ visualStyle, viewportMoving, nodeDragging }: DragonBallRadarProps) {
  const { getNodes, getViewport, screenToFlowPosition, setCenter } = useReactFlow();
  const [now, setNow] = useState(Date.now());
  const [collectFeedback, setCollectFeedback] = useState<CollectFeedback | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const holdStartedRef = useRef<number | null>(null);
  const isDragonBallTheme = visualStyle === 'dragon-ball';

  const collected = useDragonBallRadarStore((state) => state.collected);
  const activeSpawn = useDragonBallRadarStore((state) => state.activeSpawn);
  const trackingTarget = useDragonBallRadarStore((state) => state.trackingTarget);
  const nextSpawnAt = useDragonBallRadarStore((state) => state.nextSpawnAt);
  const shenronUnlockedAt = useDragonBallRadarStore((state) => state.shenronUnlockedAt);
  const shenronModeActive = useDragonBallRadarStore((state) => state.shenronModeActive);
  const shenronAnimationUntil = useDragonBallRadarStore((state) => state.shenronAnimationUntil);
  const cleanupExpired = useDragonBallRadarStore((state) => state.cleanupExpired);
  const spawnBall = useDragonBallRadarStore((state) => state.spawnBall);
  const expireActiveSpawn = useDragonBallRadarStore((state) => state.expireActiveSpawn);
  const beginTracking = useDragonBallRadarStore((state) => state.beginTracking);
  const cancelTracking = useDragonBallRadarStore((state) => state.cancelTracking);
  const setTrackingProgress = useDragonBallRadarStore((state) => state.setTrackingProgress);
  const collectTracked = useDragonBallRadarStore((state) => state.collectTracked);
  const setNextSpawnAt = useDragonBallRadarStore((state) => state.setNextSpawnAt);
  const setShenronModeActive = useDragonBallRadarStore((state) => state.setShenronModeActive);
  const resetDragonBalls = useDragonBallRadarStore((state) => state.resetDragonBalls);
  const radarRuntimeRef = useRef<RadarRuntimeSnapshot>({
    collected,
    activeSpawn,
    trackingTarget,
    nextSpawnAt,
    shenronUnlockedAt,
    shenronModeActive,
    viewportMoving,
    nodeDragging,
  });
  radarRuntimeRef.current = {
    collected,
    activeSpawn,
    trackingTarget,
    nextSpawnAt,
    shenronUnlockedAt,
    shenronModeActive,
    viewportMoving,
    nodeDragging,
  };

  const collectedStars = useMemo(
    () => DRAGON_BALL_STARS.filter((star) => Boolean(collected[star])),
    [collected],
  );
  const progressRatio = trackingTarget
    ? Math.max(0, Math.min(1, trackingTarget.progressMs / DRAGON_BALL_HOLD_TO_COLLECT_MS))
    : 0;
  const spawnRemainingMs = activeSpawn ? activeSpawn.expiresAt - now : 0;
  const nextSpawnRemainingMs = Math.max(0, nextSpawnAt - now);
  const showShenronAnimation = isDragonBallTheme && shenronAnimationUntil > now;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isDragonBallTheme && shenronModeActive) {
      root.setAttribute('data-dragonball-mode', 'shenron');
    } else {
      root.removeAttribute('data-dragonball-mode');
    }
    return () => root.removeAttribute('data-dragonball-mode');
  }, [isDragonBallTheme, shenronModeActive]);

  useEffect(() => {
    if (!isDragonBallTheme || typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(DRAGON_BALL_RADAR_COLLAPSED_STORAGE_KEY);
    setCollapsed(saved === '1');
  }, [isDragonBallTheme]);

  useEffect(() => {
    if (!isDragonBallTheme) return;
    cleanupExpired(Date.now());
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      cleanupExpired(current);
      const snapshot = radarRuntimeRef.current;

      if (snapshot.activeSpawn && snapshot.activeSpawn.expiresAt <= current) {
        expireActiveSpawn();
        return;
      }
      if (
        snapshot.shenronModeActive
        || snapshot.activeSpawn
        || snapshot.trackingTarget
        || snapshot.viewportMoving
        || snapshot.nodeDragging
      ) return;
      if (typeof document !== 'undefined' && (document.visibilityState !== 'visible' || !document.hasFocus())) return;
      if (current < snapshot.nextSpawnAt) return;

      const available = availableDragonBallStars(
        snapshot.collected,
        current,
        Boolean(snapshot.shenronUnlockedAt),
      );
      if (available.length === 0) {
        setNextSpawnAt(current + DRAGON_BALL_SPAWN_INTERVAL_MS);
        return;
      }
      const star = available[Math.floor(Math.random() * available.length)] || available[0];
      spawnBall(buildSpawn({ star, now: current, getNodes, screenToFlowPosition }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [
    cleanupExpired,
    expireActiveSpawn,
    getNodes,
    isDragonBallTheme,
    screenToFlowPosition,
    setNextSpawnAt,
    spawnBall,
  ]);

  useEffect(() => {
    if (!isDragonBallTheme || !trackingTarget) {
      holdStartedRef.current = null;
      return;
    }
    const timer = window.setInterval(() => {
      const current = Date.now();
      if (typeof document !== 'undefined' && (document.visibilityState !== 'visible' || !document.hasFocus())) {
        holdStartedRef.current = null;
        setTrackingProgress(0, null);
        return;
      }
      const shell = document.querySelector<HTMLElement>('.t8-canvas-shell');
      const rect = shell?.getBoundingClientRect();
      const center = screenToFlowPosition({
        x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      });
      const zoom = Math.max(0.12, getViewport().zoom || 1);
      const threshold = Math.max(150, 170 / zoom);
      const distance = Math.hypot(center.x - trackingTarget.x, center.y - trackingTarget.y);
      if (distance <= threshold) {
        if (!holdStartedRef.current) holdStartedRef.current = current;
        const progressMs = current - holdStartedRef.current;
        setTrackingProgress(progressMs, holdStartedRef.current);
        if (progressMs >= DRAGON_BALL_HOLD_TO_COLLECT_MS) {
          const result = collectTracked(current);
          if (result.collected && result.star) {
            playDragonBallCollectSound();
            setCollectFeedback({ star: result.star, until: current + 2_400 });
            trackAchievementEvent({
              type: 'dragon_ball.collected',
              theme: 'dragon-ball',
              kind: `${result.star}-star`,
            });
          }
          if (result.completed) {
            trackAchievementEvent({
              type: 'dragon_ball.set_completed',
              theme: 'dragon-ball',
              kind: 'seven-stars',
            });
          }
          if (result.firstCompletion) {
            trackAchievementEvent({
              type: 'hidden_mode.enabled',
              theme: 'dragon-ball',
              kind: 'dragon-ball-shenron',
              mode: 'enabled',
            });
          }
        }
      } else {
        holdStartedRef.current = null;
        setTrackingProgress(0, null);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [
    collectTracked,
    getViewport,
    isDragonBallTheme,
    screenToFlowPosition,
    setTrackingProgress,
    trackingTarget?.star,
    trackingTarget?.x,
    trackingTarget?.y,
  ]);

  if (!isDragonBallTheme) return null;

  const handleSpawnClick = () => {
    if (!activeSpawn) return;
    beginTracking(activeSpawn);
    const { zoom } = getViewport();
    setCenter(activeSpawn.x, activeSpawn.y, {
      zoom: Math.max(0.48, Math.min(1.15, zoom || 0.8)),
      duration: 620,
    });
  };

  const handleToggleShenron = () => {
    const next = !shenronModeActive;
    setShenronModeActive(next);
    if (next) {
      trackAchievementEvent({
        type: 'hidden_mode.enabled',
        theme: 'dragon-ball',
        kind: 'dragon-ball-shenron',
        mode: 'enabled',
      });
    }
  };

  const handleToggleCollapsed = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(DRAGON_BALL_RADAR_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* local preference is best-effort */
      }
      return next;
    });
  };

  return (
    <>
      <div
        className={`t8-dragonball-radar nodrag nopan ${collapsed ? 'is-collapsed' : 'is-expanded'} ${activeSpawn ? 'has-active-spawn' : ''}`}
        data-canvas-floating-ui="dragon-ball-radar"
        data-dragonball-radar-collapsed={collapsed ? 'true' : 'false'}
      >
        <button
          type="button"
          className="t8-dragonball-radar__toolbar-toggle"
          onClick={handleToggleCollapsed}
          title={collapsed ? '展开龙珠雷达' : '折叠龙珠雷达'}
          aria-label={collapsed ? '展开龙珠雷达' : '折叠龙珠雷达'}
          aria-expanded={!collapsed}
          aria-controls="t8-dragonball-radar-panel"
        >
          <Radar size={14} />
          <span>龙珠</span>
          <strong>{collectedStars.length}/7</strong>
        </button>

        {!collapsed && (
          <section
            id="t8-dragonball-radar-panel"
            className={`t8-dragonball-radar__panel ${shenronModeActive ? 'is-shenron' : ''}`}
          >
            <div className="t8-dragonball-radar__header">
            <span>
              <Radar size={14} />
              龙珠雷达
            </span>
            <strong>{collectedStars.length}/7</strong>
          </div>
          <div className="t8-dragonball-radar__slots">
            {DRAGON_BALL_STARS.map((star) => {
              const item = collected[star];
              const timeLeft = item ? item.expiresAt - now : 0;
              return (
                <div
                  key={star}
                  className={`t8-dragonball-radar__slot ${item ? 'is-collected' : ''} ${timeLeft > 0 && timeLeft < 60_000 ? 'is-ending' : ''}`}
                  title={item ? `${starLabel(star)} · ${shenronUnlockedAt ? '已归位' : formatMs(timeLeft)}` : starLabel(star)}
                >
                  <DragonBallOrb star={star} compact />
                  <span>{item ? (shenronUnlockedAt ? '归位' : formatMs(timeLeft)) : `${star}星`}</span>
                </div>
              );
            })}
          </div>
          <div className="t8-dragonball-radar__status">
            {collectFeedback && collectFeedback.until > now
              ? `${starLabel(collectFeedback.star)} 收集成功`
              : shenronModeActive
              ? '神龙模式已开启'
              : shenronUnlockedAt
                ? '七星已归位，可随时开启神龙模式'
                : trackingTarget
                  ? `保持视角 ${Math.ceil((DRAGON_BALL_HOLD_TO_COLLECT_MS - trackingTarget.progressMs) / 1000)}s`
                  : activeSpawn
                    ? `${starLabel(activeSpawn.star)} 反应中 · ${Math.max(0, Math.ceil(spawnRemainingMs / 1000))}s`
                    : `下一次反应 ${formatMs(nextSpawnRemainingMs)}`}
          </div>
          {trackingTarget && (
            <div className="t8-dragonball-radar__hold">
              <span style={{ width: `${Math.round(progressRatio * 100)}%` }} />
            </div>
          )}
          <div className="t8-dragonball-radar__actions">
            <button
              type="button"
              className="t8-dragonball-radar__action"
              onClick={(event) => {
                event.stopPropagation();
                handleToggleShenron();
              }}
              disabled={!shenronUnlockedAt}
              title={shenronModeActive ? '退出神龙模式' : '开启神龙模式'}
            >
              <Power size={12} />
              {shenronModeActive ? '退出' : '神龙'}
            </button>
            <button
              type="button"
              className="t8-dragonball-radar__action"
              onClick={(event) => {
                event.stopPropagation();
                resetDragonBalls();
              }}
              title="重置龙珠雷达"
            >
              <RotateCcw size={12} />
              </button>
            </div>
          {collectFeedback && collectFeedback.until > now && (
            <div className="t8-dragonball-radar__feedback">
              <Sparkles size={13} />
              {starLabel(collectFeedback.star)} 已归位
            </div>
          )}
          </section>
        )}
      </div>

      <div
        className={`t8-dragonball-radar__map-layer nodrag nopan ${activeSpawn ? 'has-active-spawn' : ''}`}
        data-canvas-floating-ui="dragon-ball-radar-map"
        aria-hidden={!activeSpawn}
      >
        {activeSpawn && (
          <button
            type="button"
            className={`t8-dragonball-radar__ping ${trackingTarget?.star === activeSpawn.star ? 'is-tracking' : ''}`}
            style={{ left: `${activeSpawn.mapX}%`, top: `${activeSpawn.mapY}%` }}
            onClick={(event) => {
              event.stopPropagation();
              if (!trackingTarget) handleSpawnClick();
            }}
            title={trackingTarget?.star === activeSpawn.star ? `${starLabel(activeSpawn.star)} 锁定中` : `雷达发现 ${starLabel(activeSpawn.star)}，点击跳转`}
            aria-label={trackingTarget?.star === activeSpawn.star ? `${starLabel(activeSpawn.star)} 锁定中` : `雷达发现 ${starLabel(activeSpawn.star)}，点击跳转`}
          >
            <DragonBallOrb star={activeSpawn.star} compact />
          </button>
        )}
      </div>

      {trackingTarget && (
        <ViewportPortal>
          <div
            className="t8-dragonball-radar__target"
            style={
              {
                left: trackingTarget.x,
                top: trackingTarget.y,
                '--dragon-ball-target-progress': progressRatio,
              } as any
            }
          >
            <DragonBallOrb star={trackingTarget.star} />
            <span>{Math.round(progressRatio * 100)}%</span>
          </div>
        </ViewportPortal>
      )}

      {showShenronAnimation && (
        <div className="t8-dragonball-shenron-cutscene" data-canvas-floating-ui="dragon-ball-shenron-cutscene">
          <div className="t8-dragonball-shenron-cutscene__balls">
            {DRAGON_BALL_STARS.map((star) => (
              <DragonBallOrb key={star} star={star} compact />
            ))}
          </div>
          <div className="t8-dragonball-shenron-cutscene__dragon" aria-hidden="true" />
          <div className="t8-dragonball-shenron-cutscene__title">
            <Sparkles size={22} />
            神龙降临
          </div>
        </div>
      )}
    </>
  );
}
