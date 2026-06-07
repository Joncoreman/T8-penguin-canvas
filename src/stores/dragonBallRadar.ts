import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DRAGON_BALL_STARS = [1, 2, 3, 4, 5, 6, 7] as const;
export type DragonBallStar = (typeof DRAGON_BALL_STARS)[number];

export const DRAGON_BALL_SPAWN_INTERVAL_MS = 60_000;
export const DRAGON_BALL_SPAWN_VISIBLE_MS = 5_000;
export const DRAGON_BALL_COLLECT_TTL_MS = 15 * 60_000;
export const DRAGON_BALL_HOLD_TO_COLLECT_MS = 3_000;
export const DRAGON_BALL_SHENRON_ANIMATION_MS = 4_500;

export interface DragonBallPoint {
  x: number;
  y: number;
}

export interface DragonBallSpawn extends DragonBallPoint {
  id: string;
  star: DragonBallStar;
  mapX: number;
  mapY: number;
  spawnedAt: number;
  expiresAt: number;
}

export interface DragonBallCollected extends DragonBallPoint {
  star: DragonBallStar;
  collectedAt: number;
  expiresAt: number;
}

export interface DragonBallTrackingTarget extends DragonBallPoint {
  star: DragonBallStar;
  progressMs: number;
  startedAt: number | null;
}

interface DragonBallCollectResult {
  collected: boolean;
  star: DragonBallStar | null;
  completed: boolean;
  firstCompletion: boolean;
}

interface DragonBallRadarState {
  collected: Partial<Record<DragonBallStar, DragonBallCollected>>;
  activeSpawn: DragonBallSpawn | null;
  trackingTarget: DragonBallTrackingTarget | null;
  nextSpawnAt: number;
  shenronUnlockedAt: string | null;
  shenronModeActive: boolean;
  shenronAnimationUntil: number;
  cleanupExpired: (now?: number) => void;
  setNextSpawnAt: (nextSpawnAt: number) => void;
  spawnBall: (spawn: DragonBallSpawn) => void;
  expireActiveSpawn: () => void;
  beginTracking: (spawn: DragonBallSpawn) => void;
  cancelTracking: () => void;
  setTrackingProgress: (progressMs: number, startedAt: number | null) => void;
  collectTracked: (now?: number) => DragonBallCollectResult;
  setShenronModeActive: (active: boolean) => void;
  resetDragonBalls: () => void;
}

function initialNextSpawnAt() {
  return Date.now() + DRAGON_BALL_SPAWN_INTERVAL_MS;
}

function buildCollectedForShenronTest(
  now = Date.now(),
  missingStar: DragonBallStar = 7,
): Partial<Record<DragonBallStar, DragonBallCollected>> {
  const collected: Partial<Record<DragonBallStar, DragonBallCollected>> = {};
  for (const star of DRAGON_BALL_STARS) {
    if (star === missingStar) continue;
    collected[star] = {
      star,
      x: 0,
      y: 0,
      collectedAt: now,
      expiresAt: now + DRAGON_BALL_COLLECT_TTL_MS,
    };
  }
  return collected;
}

export function pruneDragonBallCollected(
  collected: Partial<Record<DragonBallStar, DragonBallCollected>>,
  now = Date.now(),
  shenronUnlocked = false,
): Partial<Record<DragonBallStar, DragonBallCollected>> {
  if (shenronUnlocked) return { ...collected };
  const next: Partial<Record<DragonBallStar, DragonBallCollected>> = {};
  for (const star of DRAGON_BALL_STARS) {
    const item = collected[star];
    if (item && item.expiresAt > now) next[star] = item;
  }
  return next;
}

export function availableDragonBallStars(
  collected: Partial<Record<DragonBallStar, DragonBallCollected>>,
  now = Date.now(),
  shenronUnlocked = false,
) {
  const activeCollected = pruneDragonBallCollected(collected, now, shenronUnlocked);
  return DRAGON_BALL_STARS.filter((star) => !activeCollected[star]);
}

export function hasCollectedAllDragonBalls(collected: Partial<Record<DragonBallStar, DragonBallCollected>>) {
  return DRAGON_BALL_STARS.every((star) => Boolean(collected[star]));
}

function sameDragonBallCollection(
  a: Partial<Record<DragonBallStar, DragonBallCollected>>,
  b: Partial<Record<DragonBallStar, DragonBallCollected>>,
) {
  return DRAGON_BALL_STARS.every((star) => a[star] === b[star]);
}

const emptyCollectResult: DragonBallCollectResult = {
  collected: false,
  star: null,
  completed: false,
  firstCompletion: false,
};

export const useDragonBallRadarStore = create<DragonBallRadarState>()(
  persist(
    (set, get) => ({
      collected: {},
      activeSpawn: null,
      trackingTarget: null,
      nextSpawnAt: initialNextSpawnAt(),
      shenronUnlockedAt: null,
      shenronModeActive: false,
      shenronAnimationUntil: 0,

      cleanupExpired(now = Date.now()) {
        const state = get();
        const collected = pruneDragonBallCollected(state.collected, now, Boolean(state.shenronUnlockedAt));
        const trackingActiveSpawn = Boolean(
          state.activeSpawn && state.trackingTarget && state.activeSpawn.star === state.trackingTarget.star,
        );
        const activeSpawn =
          state.activeSpawn && (state.activeSpawn.expiresAt > now || trackingActiveSpawn) ? state.activeSpawn : null;
        const sameCollected = sameDragonBallCollection(state.collected, collected);
        if (sameCollected && state.activeSpawn === activeSpawn) return;
        set({
          ...(sameCollected ? {} : { collected }),
          ...(state.activeSpawn === activeSpawn ? {} : { activeSpawn }),
        });
      },

      setNextSpawnAt(nextSpawnAt) {
        if (get().nextSpawnAt === nextSpawnAt) return;
        set({ nextSpawnAt });
      },

      spawnBall(spawn) {
        set({
          activeSpawn: spawn,
          nextSpawnAt: spawn.spawnedAt + DRAGON_BALL_SPAWN_INTERVAL_MS,
        });
      },

      expireActiveSpawn() {
        if (!get().activeSpawn) return;
        set({ activeSpawn: null });
      },

      beginTracking(spawn) {
        set({
          activeSpawn: {
            ...spawn,
            expiresAt: Math.max(spawn.expiresAt, Date.now() + DRAGON_BALL_HOLD_TO_COLLECT_MS + 2_500),
          },
          trackingTarget: {
            star: spawn.star,
            x: spawn.x,
            y: spawn.y,
            progressMs: 0,
            startedAt: null,
          },
        });
      },

      cancelTracking() {
        set({ trackingTarget: null });
      },

      setTrackingProgress(progressMs, startedAt) {
        const target = get().trackingTarget;
        if (!target) return;
        const nextProgressMs = Math.max(0, Math.floor(progressMs));
        if (target.progressMs === nextProgressMs && target.startedAt === startedAt) return;
        set({ trackingTarget: { ...target, progressMs: nextProgressMs, startedAt } });
      },

      collectTracked(now = Date.now()) {
        let result: DragonBallCollectResult = emptyCollectResult;
        set((state) => {
          const target = state.trackingTarget;
          if (!target) return {};
          const collected = pruneDragonBallCollected(state.collected, now, Boolean(state.shenronUnlockedAt));
          collected[target.star] = {
            star: target.star,
            x: target.x,
            y: target.y,
            collectedAt: now,
            expiresAt: now + DRAGON_BALL_COLLECT_TTL_MS,
          };
          const completed = hasCollectedAllDragonBalls(collected);
          const firstCompletion = completed && !state.shenronUnlockedAt;
          result = {
            collected: true,
            star: target.star,
            completed,
            firstCompletion,
          };
          return {
            collected,
            trackingTarget: null,
            activeSpawn: null,
            shenronUnlockedAt: firstCompletion ? new Date(now).toISOString() : state.shenronUnlockedAt,
            shenronModeActive: completed ? true : state.shenronModeActive,
            shenronAnimationUntil: firstCompletion ? now + DRAGON_BALL_SHENRON_ANIMATION_MS : state.shenronAnimationUntil,
          };
        });
        return result;
      },

      setShenronModeActive(active) {
        if (!get().shenronUnlockedAt) return;
        if (get().shenronModeActive === active) return;
        set({ shenronModeActive: active });
      },

      resetDragonBalls() {
        set({
          collected: {},
          activeSpawn: null,
          trackingTarget: null,
          nextSpawnAt: initialNextSpawnAt(),
          shenronUnlockedAt: null,
          shenronModeActive: false,
          shenronAnimationUntil: 0,
        });
      },
    }),
    {
      name: 't8-dragon-ball-radar',
      partialize: (state) => ({
        collected: pruneDragonBallCollected(state.collected, Date.now(), Boolean(state.shenronUnlockedAt)),
        nextSpawnAt: state.nextSpawnAt,
        shenronUnlockedAt: state.shenronUnlockedAt,
        shenronModeActive: state.shenronModeActive,
        shenronAnimationUntil: state.shenronAnimationUntil,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<DragonBallRadarState>;
        const unlocked = Boolean(p.shenronUnlockedAt);
        return {
          ...current,
          collected: pruneDragonBallCollected(p.collected || {}, Date.now(), unlocked),
          nextSpawnAt: Number(p.nextSpawnAt) || initialNextSpawnAt(),
          shenronUnlockedAt: typeof p.shenronUnlockedAt === 'string' ? p.shenronUnlockedAt : null,
          shenronModeActive: Boolean(p.shenronModeActive && p.shenronUnlockedAt),
          shenronAnimationUntil: Number(p.shenronAnimationUntil) || 0,
        };
      },
    },
  ),
);

export function seedDragonBallRadarForShenronTest(missingStar: DragonBallStar = 7, now = Date.now()) {
  useDragonBallRadarStore.setState({
    collected: buildCollectedForShenronTest(now, missingStar),
    activeSpawn: null,
    trackingTarget: null,
    nextSpawnAt: now + 1_000,
    shenronUnlockedAt: null,
    shenronModeActive: false,
    shenronAnimationUntil: 0,
  });
}
