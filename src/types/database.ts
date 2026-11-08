export type MediaCondition = 'M' | 'NM' | 'EX' | 'VG+' | 'VG' | 'G+' | 'G' | 'F' | 'P';
export type SleeveCondition = MediaCondition | 'Generic';
export type ItemStatus = 'draft' | 'active' | 'reserved' | 'sold';

export interface Artist {
  id: string;
  name: string;
  discogs_artist_id: string | null;
}

export interface TrackItem {
  position?: string;
  type_?: string;
  title: string;
  duration?: string;
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
  cover_url: string | null;
  tracklist: TrackItem[] | null;
  discogs_photos: string[];
  format_details: string | null;
  catno: string | null;
  discogs_uri: string | null;
  discogs_notes: string | null;
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
  custom_images: string[];
  status: ItemStatus;
  created_at: string;
  release_type: string | null;
  important_details: string | null;
  extra_info: string | null;
  release: Release;
}

// Вспомогательная функция трансформации ответа PostgREST в плоский объект
export function mapSupabaseItem(raw: any): VinylItem {
  const releaseRaw = raw.release || raw.releases || {};
  const artists: Artist[] = (releaseRaw.release_artists || [])
    .map((ra: any) => ra.artist)
    .filter(Boolean);

  const rawPhotos = Array.isArray(raw.photos) ? raw.photos : [];
  const rawCustomImages = Array.isArray(raw.custom_images) ? raw.custom_images : [];
  const discogsPhotos = Array.isArray(releaseRaw.discogs_photos) ? releaseRaw.discogs_photos : [];

  const combinedPhotos = Array.from(
    new Set([...rawPhotos, ...rawCustomImages, ...discogsPhotos, releaseRaw.default_cover_url, releaseRaw.cover_url].filter(Boolean))
  );

  return {
    id: raw.id,
    release_id: raw.release_id,
    price: Number(raw.price || 0),
    condition_media: raw.condition_media || 'NM-',
    condition_sleeve: raw.condition_sleeve || 'NM',
    description: raw.description || '',
    photos: combinedPhotos,
    custom_images: rawCustomImages,
    status: raw.status,
    created_at: raw.created_at,
    release_type: raw.release_type || (releaseRaw.year && releaseRaw.year <= 1990 ? 'Оригинал' : 'Переиздание'),
    important_details: raw.important_details || null,
    extra_info: raw.extra_info || null,
    release: {
      id: releaseRaw.id,
      title: releaseRaw.title || 'Без названия',
      year: releaseRaw.year,
      genre: Array.isArray(releaseRaw.genre) ? releaseRaw.genre : [],
      style: Array.isArray(releaseRaw.style) ? releaseRaw.style : [],
      label: releaseRaw.label || null,
      country: releaseRaw.country || null,
      discogs_release_id: releaseRaw.discogs_release_id || null,
      default_cover_url: releaseRaw.default_cover_url || releaseRaw.cover_url || null,
      cover_url: releaseRaw.cover_url || releaseRaw.default_cover_url || null,
      tracklist: releaseRaw.tracklist || null,
      discogs_photos: discogsPhotos,
      format_details: releaseRaw.format_details || null,
      catno: releaseRaw.catno || null,
      discogs_uri: releaseRaw.discogs_uri || (releaseRaw.discogs_release_id ? `https://www.discogs.com/release/${releaseRaw.discogs_release_id}` : null),
      discogs_notes: releaseRaw.discogs_notes || null,
      artists,
    },
  };
}
