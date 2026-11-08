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

export const ITEM_WITH_GRAPH_SELECT = `
  *,
  release:releases (
    *,
    release_artists (
      artist:artists (*)
    )
  )
`;
