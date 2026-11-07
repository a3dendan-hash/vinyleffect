import WebApp from '@twa-dev/sdk';

export const initTelegramApp = () => {
  try {
    WebApp.ready();
    WebApp.expand();

    // Синхронизация CSS-переменных с цветовой схемой Telegram
    const root = document.documentElement;
    root.style.setProperty('--tg-bg-color', WebApp.themeParams.bg_color || '#121214');
    root.style.setProperty('--tg-secondary-bg', WebApp.themeParams.secondary_bg_color || '#1c1c1f');
    root.style.setProperty('--tg-text-color', WebApp.themeParams.text_color || '#ffffff');
    root.style.setProperty('--tg-hint-color', WebApp.themeParams.hint_color || '#8e8e93');
    root.style.setProperty('--tg-button-color', WebApp.themeParams.button_color || '#f59e0b');
    root.style.setProperty('--tg-button-text', WebApp.themeParams.button_text_color || '#ffffff');
  } catch (e) {
    console.warn('Telegram WebApp SDK запущен вне окружения Telegram', e);
  }
};

export const getTelegramUser = () => {
  const user = WebApp.initDataUnsafe?.user;
  if (user) return user;

  // Fallback для локальной отладки в браузере
  if (import.meta.env.DEV) {
    return {
      id: Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID || 123456789),
      first_name: 'DevAdmin',
      username: 'dev_vinyl_admin',
    };
  }
  return null;
};

export const isAdminUser = (): boolean => {
  const user = getTelegramUser();
  const adminId = import.meta.env.VITE_ADMIN_TELEGRAM_ID;
  if (!user || !adminId) return false;
  return String(user.id) === String(adminId);
};

export const haptic = {
  light: () => WebApp.HapticFeedback?.impactOccurred('light'),
  medium: () => WebApp.HapticFeedback?.impactOccurred('medium'),
  success: () => WebApp.HapticFeedback?.notificationOccurred('success'),
  error: () => WebApp.HapticFeedback?.notificationOccurred('error'),
  selection: () => WebApp.HapticFeedback?.selectionChanged(),
};

export { WebApp };