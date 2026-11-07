import { createClient } from '@supabase/supabase-js';
import { getTelegramUser } from './telegram';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const getCleanSupabaseUrl = (url: string): string => {
  if (!url) return 'https://placeholder.supabase.co';
  try {
    return new URL(url).origin;
  } catch {
    const cleaned = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    return cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
  }
};

const supabaseUrl = getCleanSupabaseUrl(rawUrl);
const supabaseAnonKey = rawKey || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
      const tgUser = getTelegramUser();
      const headers = new Headers(options.headers);
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
