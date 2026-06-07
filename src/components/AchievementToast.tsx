import { Film, Medal, X } from 'lucide-react';
import { useEffect } from 'react';
import { useAchievementStore } from '../stores/achievements';

export default function AchievementToast() {
  const notifications = useAchievementStore((state) => state.notifications);
  const dismiss = useAchievementStore((state) => state.dismissNotification);
  const openDrawer = useAchievementStore((state) => state.openDrawer);

  useEffect(() => {
    const timers = notifications.map((item) =>
      window.setTimeout(() => dismiss(item.id), 7200),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismiss, notifications]);

  if (notifications.length === 0) return null;

  return (
    <div className="t8-achievement-toast-stack" data-canvas-floating-ui="achievement-toast">
      {notifications.map((item) => (
        <div
          key={item.id}
          className="t8-achievement-toast"
          onClick={() => openDrawer(item.filmTitle ? 'films' : 'themes', item.themeId)}
        >
          <div className="t8-achievement-toast__icon">
            {item.filmTitle ? <Film size={18} /> : <Medal size={18} />}
          </div>
          <div className="t8-achievement-toast__body">
            <strong>{item.title}</strong>
            <span>{item.theme} · {item.filmTitle ? `影片馆已更新：${item.filmTitle}` : '新勋章已点亮'}</span>
          </div>
          <button
            type="button"
            className="t8-mini-icon-button"
            onClick={(event) => {
              event.stopPropagation();
              dismiss(item.id);
            }}
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
