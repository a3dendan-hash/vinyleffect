import WebApp from '@twa-dev/sdk';

export const initTelegramApp = () => {
  try {
    WebApp.ready();
    WebApp.expand();

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

  // Если открыто в обычном браузере на ПК для проверки
  return null;
};

export const isAdminUser = (): boolean => {
  const user = getTelegramUser();
  if (!user) return false;

  const rawAdmins = import.meta.env.VITE_ADMIN_TELEGRAM_ID || '';
  const adminIds = String(rawAdmins)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return adminIds.includes(String(user.id));
};

export const haptic = {
  light: () => WebApp.HapticFeedback?.impactOccurred('light'),
  medium: () => WebApp.HapticFeedback?.impactOccurred('medium'),
  success: () => WebApp.HapticFeedback?.notificationOccurred('success'),
  error: () => WebApp.HapticFeedback?.notificationOccurred('error'),
  selection: () => WebApp.HapticFeedback?.selectionChanged(),
};

export { WebApp };
