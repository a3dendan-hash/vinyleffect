import { createClient } from '@supabase/supabase-js';
import { getTelegramUser } from './telegram';

const rawUrl = 'https://miqxmalujcxozgoqpskv.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcXhtYWx1amN4b3pnb3Fwc2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNjU3MjksImV4cCI6MjEwOTY0MTcyOX0.2DAK3ho2GwEWUo_TaFBSL1e-JiLND3MsweOwSximVG8';

const rawKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim() || fallbackKey;

export const supabase = createClient(rawUrl, rawKey, {
  global: {
    fetch: (url: any, options: any = {}) => {
      const tgUser = getTelegramUser();
      const headers = new Headers(options.headers || {});
      headers.set('x-telegram-user-id', tgUser ? String(tgUser.id) : 'anonymous');
      headers.set('x-admin-token', 'vinilpiter-secret-admin');
      return fetch(url, { ...options, headers });
    },
  },
});

// Легковесный запрос для каталога и админки (мгновенная загрузка всех 2900 пластинок без тяжелых треклистов и описаний)
export const ITEM_CATALOG_SELECT = `
  id,
  price,
  status,
  condition_media,
  condition_sleeve,
  release_type,
  important_details,
  photos,
  custom_images,
  created_at,
  release:releases (
    id,
    title,
    year,
    country,
    label,
    catno,
    discogs_release_id,
    discogs_uri,
    genre,
    style,
    default_cover_url,
    cover_url,
    format_details,
    release_artists (
      artist:artists (id, name)
    )
  )
`;

// Полный запрос с треклистом, описанием и всеми фото для страницы конкретной пластинки
export const ITEM_WITH_GRAPH_SELECT = `
  *,
  release:releases (
    *,
    release_artists (
      artist:artists (*)
    )
  )
`;
