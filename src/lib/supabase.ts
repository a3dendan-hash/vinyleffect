import { createClient } from '@supabase/supabase-js';
import { getTelegramUser } from './telegram';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const tgUser = getTelegramUser();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      // Передаем Telegram ID в заголовке для проверки в RLS функции public.is_admin()
      'x-telegram-user-id': tgUser ? String(tgUser.id) : 'anonymous',
    },
  },
});

// Единый фрагмент SELECT для подгрузки графа связей пластинки
export const ITEM_WITH_GRAPH_SELECT = `
  *,
  release:releases (
    *,
    release_artists (
      artist:artists (*)
    )
  )
`;