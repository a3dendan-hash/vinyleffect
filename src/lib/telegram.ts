import WebApp from '@twa-dev/sdk';

export const initTelegramApp = () => {
  try {
    WebApp.ready();
    WebApp.expand();

    const root = document.documentElement;
    root.style.setProperty('--tg-bg-color', WebApp.themeParams.bg_color || '#0a0a0a');
    root.style.setProperty('--tg-secondary-bg', WebApp.themeParams.secondary_bg_color || '#111111');
    root.style.setProperty('--tg-text-color', WebApp.themeParams.text_color || '#ffffff');
    root.style.setProperty('--tg-hint-color', WebApp.themeParams.hint_color || '#888888');
    root.style.setProperty('--tg-button-color', WebApp.themeParams.button_color || '#8b5cf6');
    root.style.setProperty('--tg-button-text', WebApp.themeParams.button_text_color || '#ffffff');
  } catch (e) {
    console.warn('Telegram WebApp SDK запущен вне окружения Telegram', e);
  }
};

export const getTelegramUser = () => {
  const user = WebApp.initDataUnsafe?.user;
  if (user) return user;
  return null;
};

export const isAdminUser = (): boolean => {
  const user = getTelegramUser();
  if (!user) {
    // В dev-режиме на ПК админка доступна для настройки и импорта
    return true;
  }

  const rawAdmins = (import.meta as any).env?.VITE_ADMIN_TELEGRAM_ID || '194615771,8584180753';
  const adminIds = String(rawAdmins)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return adminIds.includes(String(user.id));
};

export const haptic = {
  light: () => {
    try {
      WebApp.HapticFeedback?.impactOccurred('light');
    } catch {}
  },
  medium: () => {
    try {
      WebApp.HapticFeedback?.impactOccurred('medium');
    } catch {}
  },
  success: () => {
    try {
      WebApp.HapticFeedback?.notificationOccurred('success');
    } catch {}
  },
  error: () => {
    try {
      WebApp.HapticFeedback?.notificationOccurred('error');
    } catch {}
  },
  selection: () => {
    try {
      WebApp.HapticFeedback?.selectionChanged();
    } catch {}
  },
};

export { WebApp };
