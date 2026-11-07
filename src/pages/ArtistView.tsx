import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Disc3, User } from 'lucide-react';
import { supabase, ITEM_WITH_GRAPH_SELECT } from '../lib/supabase';
import { Artist, VinylItem, mapSupabaseItem } from '../types/database';

export const ArtistView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [artistItems, setArtistItems] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArtistData = async () => {
      if (!id) return;
      setLoading(true);

      // 1. Получаем данные об исполнителе
      const { data: artistData } = await supabase
        .from('artists')
        .select('*')
        .eq('id', id)
        .single();

      if (artistData) setArtist(artistData);

      // 2. Получаем ID всех релизов этого исполнителя через связующую таблицу release_artists
      const { data: links } = await supabase
        .from('release_artists')
        .select('release_id')
        .eq('artist_id', id);

      const releaseIds = (links || []).map((l) => l.release_id);

      if (releaseIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('items')
          .select(ITEM_WITH_GRAPH_SELECT)
          .in('release_id', releaseIds)
          .eq('status', 'active');

        if (itemsData) {
          setArtistItems(itemsData.map(mapSupabaseItem));
        }
      }

      setLoading(false);
    };

    loadArtistData();
  }, [id]);

  if (loading) {
    return <div className="py-16 text-center text-zinc-500 text-sm">Загрузка дискографии...</div>;
  }

  if (!artist) {
    return <div className="py-16 text-center text-zinc-500 text-sm">Исполнитель не найден.</div>;
  }

  return (
    <div className="pb-24 space-y-5">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <User className="w-7 h-7" />
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-wider text-amber-500 font-semibold">
            Исполнитель
          </span>
          <h1 className="text-xl font-extrabold text-white">{artist.name}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Пластинок в наличии: {artistItems.length}
          </p>
        </div>
      </div>

      {artistItems.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">
          Сейчас в продаже нет активных пластинок этого исполнителя.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {artistItems.map((item) => {
            const cover = item.photos[0] || item.release.default_cover_url;
            return (
              <Link
                key={item.id}
                to={`/record/${item.id}`}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div className="aspect-square bg-zinc-950 flex items-center justify-center relative">
                  {cover ? (
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc3 className="w-10 h-10 text-zinc-700" />
                  )}
                  {item.condition_media && (
                    <span className="absolute top-2 left-2 bg-black/75 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                      {item.condition_media}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-xs font-bold text-white truncate">{item.release.title}</h3>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs font-extrabold text-amber-400">
                      {item.price.toLocaleString('ru-RU')} ₽
                    </span>
                    {item.release.year && (
                      <span className="text-[10px] text-zinc-500">{item.release.year}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};