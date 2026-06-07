import { useEffect, useMemo, useRef } from 'react';
import { useThemeStore } from '../stores/theme';
import { resolveThemeTemplate } from '../theme/defaultTemplates';
import { getCurrentAchievementTheme, trackAchievementEvent, useAchievementStore } from '../stores/achievements';
import { normalizeAchievementTheme } from '../data/achievementManifest';
import { useHiddenFeatureStore } from '../stores/hiddenFeatures';
import { useDragonBallRadarStore } from '../stores/dragonBallRadar';

const HEARTBEAT_MS = 15_000;
const IDLE_LIMIT_MS = 90_000;

export default function AchievementTracker() {
  const { templateId, customTemplates, style } = useThemeStore();
  const loadProfile = useAchievementStore((state) => state.loadProfile);
  const profileLoaded = useAchievementStore((state) => Boolean(state.profile));
  const trackingEnabled = useAchievementStore((state) => state.profile?.preferences?.enabled !== false);
  const rhDuckDoorUnlocked = useAchievementStore((state) => Boolean(state.profile?.unlockedAchievements?.['rh-duck-door']));
  const yyhPortraitDoorUnlocked = useAchievementStore((state) => Boolean(state.profile?.unlockedAchievements?.['yyh-portrait-door']));
  const dragonBallSevenStarsUnlocked = useAchievementStore((state) => Boolean(state.profile?.unlockedAchievements?.['dragon-ball-seven-stars']));
  const shenronModeUnlocked = useAchievementStore((state) => Boolean(state.profile?.unlockedAchievements?.['dragon-ball-shenron-mode']));
  const rhDuckUploadCount = useHiddenFeatureStore((state) => state.rhDuckUploadIds.length);
  const yyhPortraitCount = useHiddenFeatureStore((state) => state.yyhPortraitIds.length);
  const shenronUnlockedAt = useDragonBallRadarStore((state) => state.shenronUnlockedAt);
  const currentTheme = useMemo(() => {
    const tpl = resolveThemeTemplate(templateId, customTemplates);
    return normalizeAchievementTheme(tpl.visuals?.style || style);
  }, [customTemplates, style, templateId]);
  const lastInteractionRef = useRef(Date.now());
  const lastTickRef = useRef(Date.now());
  const previousThemeRef = useRef(currentTheme);
  const hiddenSyncRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const markActive = () => {
      lastInteractionRef.current = Date.now();
    };
    window.addEventListener('pointerdown', markActive, { passive: true });
    window.addEventListener('keydown', markActive);
    window.addEventListener('wheel', markActive, { passive: true });
    window.addEventListener('dragstart', markActive);
    return () => {
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('wheel', markActive);
      window.removeEventListener('dragstart', markActive);
    };
  }, []);

  useEffect(() => {
    if (previousThemeRef.current === currentTheme) return;
    trackAchievementEvent({ type: 'theme.switched', theme: currentTheme });
    previousThemeRef.current = currentTheme;
    lastTickRef.current = Date.now();
  }, [currentTheme]);

  useEffect(() => {
    if (!profileLoaded || !trackingEnabled) return;
    const syncOnce = (key: string, payload: Parameters<typeof trackAchievementEvent>[0]) => {
      if (hiddenSyncRef.current.has(key)) return;
      hiddenSyncRef.current.add(key);
      trackAchievementEvent(payload);
    };
    if (rhDuckUploadCount > 0 && !rhDuckDoorUnlocked) {
      syncOnce('rh-duck-enabled', {
        type: 'hidden_mode.enabled',
        theme: 'rh',
        kind: 'rh-duck',
        mode: 'enabled',
        nodeType: 'upload',
      });
    }
    if (yyhPortraitCount > 0 && !yyhPortraitDoorUnlocked) {
      syncOnce('yyh-portrait-enabled', {
        type: 'hidden_mode.enabled',
        theme: 'yyh',
        kind: 'yyh-portrait',
        mode: 'enabled',
        nodeType: 'portrait-master',
      });
    }
    if (shenronUnlockedAt && !dragonBallSevenStarsUnlocked) {
      syncOnce('dragon-ball-set-completed', {
        type: 'dragon_ball.set_completed',
        theme: 'dragon-ball',
        kind: 'seven-stars',
      });
    }
    if (shenronUnlockedAt && !shenronModeUnlocked) {
      syncOnce('dragon-ball-shenron-enabled', {
        type: 'hidden_mode.enabled',
        theme: 'dragon-ball',
        kind: 'dragon-ball-shenron',
        mode: 'enabled',
      });
    }
  }, [
    dragonBallSevenStarsUnlocked,
    profileLoaded,
    rhDuckDoorUnlocked,
    rhDuckUploadCount,
    shenronModeUnlocked,
    shenronUnlockedAt,
    trackingEnabled,
    yyhPortraitCount,
    yyhPortraitDoorUnlocked,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
      const focused = typeof document === 'undefined' || document.hasFocus();
      const recentlyActive = now - lastInteractionRef.current <= IDLE_LIMIT_MS;
      if (!visible || !focused || !recentlyActive) {
        lastTickRef.current = now;
        return;
      }
      const amountSeconds = Math.max(1, Math.min(30, Math.round((now - lastTickRef.current) / 1000)));
      lastTickRef.current = now;
      trackAchievementEvent({
        type: 'theme.active_tick',
        theme: getCurrentAchievementTheme(),
        amountSeconds,
      });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
