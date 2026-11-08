import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Disc3, User } from 'lucide-react';
import { supabase, ITEM_WITH_GRAPH_SELECT } from '../lib/supabase';
import { Artist, VinylItem, mapSupabaseItem } from '../types/database';
import { haptic } from '../lib/telegram';

export const ArtistView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [artistItems, setArtistItems] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArtistData = async () => {
      if (!id) return;
      setLoading(true);

      const { data: artistData } = await supabase
        .from('artists')
        .select('*')
        .eq('id', id)
        .single();

      if (artistData) setArtist(artistData);

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
    return (
      <div className="py-20 text-center space-y-2 font-mono text-xs text-[#888888]">
        <div className="w-10 h-10 rounded-full vinyl-grooves spin-vinyl mx-auto" />
        <p>Загрузка дискографии артиста...</p>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="py-16 text-center text-[#888888] font-mono text-sm">
        Исполнитель не найден в базе.
      </div>
    );
  }

  return (
    <div className="pb-24 space-y-5 max-w-5xl mx-auto">
      <div className="bg-[#111111] border border-[#222222] rounded-3xl p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 flex items-center justify-center text-[#8b5cf6]">
          <User className="w-7 h-7" />
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#8b5cf6] font-bold">
            Исполнитель
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{artist.name}</h1>
          <p className="text-xs font-mono text-[#888888] mt-0.5">
            Пластинок на витрине: {artistItems.length}
          </p>
        </div>
      </div>

      {artistItems.length === 0 ? (
        <div className="text-center py-16 text-[#666666] font-mono text-xs bg-[#111111] border border-[#222222] rounded-3xl p-8">
          Сейчас на витрине нет активных пластинок этого исполнителя. Они могут быть в черновиках.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {artistItems.map((item) => {
            const cover = item.photos[0] || item.release.default_cover_url;
            return (
              <Link
                key={item.id}
                to={`/record/${item.id}`}
                onClick={() => haptic.light()}
                className="bg-[#111111] border border-[#222222] hover:border-[#8b5cf6]/50 rounded-2xl overflow-hidden flex flex-col justify-between transition group shadow-md"
              >
                <div className="aspect-square bg-black flex items-center justify-center relative overflow-hidden">
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <Disc3 className="w-10 h-10 text-[#333333]" />
                  )}
                  {item.condition_media && (
                    <span className="absolute top-2 left-2 bg-black/80 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-[#333333]">
                      {item.condition_media}
                    </span>
                  )}
                </div>
                <div className="p-3 font-mono space-y-1">
                  <h3 className="text-xs font-bold text-white truncate group-hover:text-[#8b5cf6]">
                    {item.release.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-white">
                      {item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : 'По запросу'}
                    </span>
                    {item.release.year && (
                      <span className="text-[10px] text-[#737373]">{item.release.year}</span>
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
