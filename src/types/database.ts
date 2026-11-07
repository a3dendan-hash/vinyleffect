export type MediaCondition = 'M' | 'NM' | 'VG+' | 'VG' | 'G+' | 'G' | 'F' | 'P';
export type SleeveCondition = MediaCondition | 'Generic';
export type ItemStatus = 'draft' | 'active' | 'reserved' | 'sold';

export interface Artist {
  id: string;
  name: string;
  discogs_artist_id: string | null;
}

export interface Release {
  id: string;
  title: string;
  year: number | null;
  genre: string[];
  style: string[];
  label: string | null;
  country: string | null;
  discogs_release_id: string | null;
  default_cover_url: string | null;
  artists: Artist[];
}

export interface VinylItem {
  id: string;
  release_id: string;
  price: number;
  condition_media: MediaCondition | null;
  condition_sleeve: SleeveCondition | null;
  description: string | null;
  photos: string[];
  status: ItemStatus;
  created_at: string;
  release: Release;
}

// Вспомогательная функция трансформации ответа PostgREST в плоский массив артистов
export function mapSupabaseItem(raw: any): VinylItem {
  const releaseRaw = raw.release || raw.releases || {};
  const artists: Artist[] = (releaseRaw.release_artists || [])
    .map((ra: any) => ra.artist)
    .filter(Boolean);

  return {
    id: raw.id,
    release_id: raw.release_id,
    price: Number(raw.price || 0),
    condition_media: raw.condition_media,
    condition_sleeve: raw.condition_sleeve,
    description: raw.description || '',
    photos: raw.photos || [],
    status: raw.status,
    created_at: raw.created_at,
    release: {
      id: releaseRaw.id,
      title: releaseRaw.title || 'Без названия',
      year: releaseRaw.year,
      genre: releaseRaw.genre || [],
      style: releaseRaw.style || [],
      label: releaseRaw.label || null,
      country: releaseRaw.country || null,
      discogs_release_id: releaseRaw.discogs_release_id || null,
      default_cover_url: releaseRaw.default_cover_url || null,
      artists,
    },
  };
}