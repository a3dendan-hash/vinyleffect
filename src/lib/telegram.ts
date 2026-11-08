import WebApp from '@twa-dev/sdk';

export const initTelegramApp = () => {
  try {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      WebApp.ready?.();
      WebApp.expand?.();
    }

    const root = document.documentElement;
    const params = WebApp?.themeParams || {};
    root.style.setProperty('--tg-bg-color', params.bg_color || '#0a0a0a');
    root.style.setProperty('--tg-secondary-bg', params.secondary_bg_color || '#111111');
    root.style.setProperty('--tg-text-color', params.text_color || '#ffffff');
    root.style.setProperty('--tg-hint-color', params.hint_color || '#888888');
    root.style.setProperty('--tg-button-color', params.button_color || '#8b5cf6');
    root.style.setProperty('--tg-button-text', params.button_text_color || '#ffffff');
  } catch (e) {
    console.warn('Telegram WebApp SDK init error', e);
  }
};

export const getTelegramUser = () => {
  try {
    const user = WebApp?.initDataUnsafe?.user;
    if (user) return user;
  } catch {}
  return null;
};

export const isAdminUser = (): boolean => {
  try {
    const user = getTelegramUser();
    if (!user) {
      return true; // Вне Telegram всегда режим администратора для настройки
    }

    const rawAdmins = (import.meta as any).env?.VITE_ADMIN_TELEGRAM_ID || '194615771,8584180753';
    const adminIds = String(rawAdmins)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    return adminIds.includes(String(user.id));
  } catch {
    return true;
  }
};

export const haptic = {
  light: () => {
    try {
      WebApp?.HapticFeedback?.impactOccurred?.('light');
    } catch {}
  },
  medium: () => {
    try {
      WebApp?.HapticFeedback?.impactOccurred?.('medium');
    } catch {}
  },
  success: () => {
    try {
      WebApp?.HapticFeedback?.notificationOccurred?.('success');
    } catch {}
  },
  error: () => {
    try {
      WebApp?.HapticFeedback?.notificationOccurred?.('error');
    } catch {}
  },
  selection: () => {
    try {
      WebApp?.HapticFeedback?.selectionChanged?.();
    } catch {}
  },
};

export { WebApp };
