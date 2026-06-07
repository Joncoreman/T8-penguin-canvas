import { useEffect } from 'react';
import { Eye, KeyRound, Sparkles, X } from 'lucide-react';
import { useAchievementStore, type HiddenModeCeremonyKind } from '../stores/achievements';

function iconFor(kind: HiddenModeCeremonyKind) {
  if (kind === 'rh-duck') return <KeyRound size={26} />;
  if (kind === 'yyh-portrait') return <Eye size={26} />;
  return <Sparkles size={28} />;
}

function labelFor(kind: HiddenModeCeremonyKind) {
  if (kind === 'rh-duck') return 'ACCESS GRANTED';
  if (kind === 'yyh-portrait') return 'SPIRIT GATE';
  if (kind === 'dragon-ball-shenron') return 'SHENRON MODE';
  return 'HIDDEN MODE';
}

export default function AchievementCeremonyLayer() {
  const ceremony = useAchievementStore((state) => state.ceremonies[0]);
  const dismissCeremony = useAchievementStore((state) => state.dismissCeremony);

  useEffect(() => {
    if (!ceremony) return;
    const timer = window.setTimeout(() => dismissCeremony(ceremony.id), 4600);
    return () => window.clearTimeout(timer);
  }, [ceremony?.id, dismissCeremony]);

  if (!ceremony) return null;

  return (
    <div
      className={`t8-hidden-ceremony is-${ceremony.kind}`}
      data-canvas-floating-ui="achievement-ceremony"
      role="status"
      aria-live="polite"
    >
      <div className="t8-hidden-ceremony__scrim" />
      <div className="t8-hidden-ceremony__stage">
        <div className="t8-hidden-ceremony__sigil" aria-hidden="true">
          {iconFor(ceremony.kind)}
        </div>
        <div className="t8-hidden-ceremony__scan" aria-hidden="true" />
        <div className="t8-hidden-ceremony__label">{labelFor(ceremony.kind)}</div>
        <h3>{ceremony.title}</h3>
        <p>{ceremony.subtitle}</p>
        <span>{ceremony.themeLabel}</span>
        <button
          type="button"
          className="t8-mini-icon-button t8-hidden-ceremony__close"
          onClick={() => dismissCeremony(ceremony.id)}
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
