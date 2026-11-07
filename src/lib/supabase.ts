import { createClient } from '@supabase/supabase-js';
import { getTelegramUser } from './telegram';

// Жестко задаем ваш URL, чтобы исключить любые ошибки чтения переменных окружения
const rawUrl = 'https://miqxmalujcxozgoqpskv.supabase.co';
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = createClient(rawUrl, rawKey, {
  global: {
    fetch: (url: any, options: any = {}) => {
      const tgUser = getTelegramUser();
      const headers = new Headers(options.headers || {});
      headers.set('x-telegram-user-id', tgUser ? String(tgUser.id) : 'anonymous');
      return fetch(url, { ...options, headers });
    },
  },
});

export const ITEM_WITH_GRAPH_SELECT = `
  *,
  release:releases (
    *,
    release_artists (
      artist:artists (*)
    )
  )
`;
