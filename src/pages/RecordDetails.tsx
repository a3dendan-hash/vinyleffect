import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Disc3, ShoppingBag, Check, Tag, Layers, Globe, Calendar } from 'lucide-react';
import { supabase, ITEM_WITH_GRAPH_SELECT } from '../lib/supabase';
import { VinylItem, mapSupabaseItem } from '../types/database';
import { useCart } from '../context/CartContext';
import { haptic } from '../lib/telegram';

export const RecordDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, isInCart } = useCart();

  const [item, setItem] = useState<VinylItem | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [sameArtistItems, setSameArtistItems] = useState<VinylItem[]>([]);
  const [similarGenreItems, setSimilarGenreItems] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecordAndGraph = async () => {
      if (!id) return;
      setLoading(true);
      setActivePhotoIdx(0);

      // 1. Загружаем текущую пластинку
      const { data, error } = await supabase
        .from('items')
        .select(ITEM_WITH_GRAPH_SELECT)
        .eq('id', id)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const currentItem = mapSupabaseItem(data);
      setItem(currentItem);

      // 2. Загружаем все активные пластинки для построения графа рекомендаций
      const { data: allActiveData } = await supabase
        .from('items')
        .select(ITEM_WITH_GRAPH_SELECT)
        .eq('status', 'active')
        .neq('id', currentItem.id);

      if (allActiveData) {
        const allActive = allActiveData.map(mapSupabaseItem);
        const currentArtistIds = new Set(currentItem.release.artists.map((a) => a.id));
        const primaryGenre = currentItem.release.genre[0];

        // Граф 1: Другие релизы этого же исполнителя (или участников сплита)
        const byArtist = allActive.filter((other) =>
          other.release.artists.some((a) => currentArtistIds.has(a.id))
        );
        setSameArtistItems(byArtist.slice(0, 6));

        // Граф 2: Похожие альбомы в том же основном жанре
        if (primaryGenre) {
          const byGenre = allActive.filter(
            (other) =>
              other.release.genre.includes(primaryGenre) &&
              !other.release.artists.some((a) => currentArtistIds.has(a.id))
          );
          setSimilarGenreItems(byGenre.slice(0, 6));
        } else {
          setSimilarGenreItems([]);
        }
      }

      setLoading(false);
    };

    loadRecordAndGraph();
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-zinc-500 text-sm">Загрузка пластинки...</div>;
  }

  if (!item) {
    return <div className="py-20 text-center text-zinc-500 text-sm">Пластинка не найдена.</div>;
  }

  const allPhotos =
    item.photos.length > 0
      ? item.photos
      : item.release.default_cover_url
      ? [item.release.default_cover_url]
      : [];

  const inCart = isInCart(item.id);
  const primaryGenre = item.release.genre[0];

  return (
    <div className="pb-28 space-y-6">
      {/* Галерея живых фото экземпляра */}
      <div className="space-y-2.5">
        <div className="aspect-square rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
          {allPhotos[activePhotoIdx] ? (
            <img
              src={allPhotos[activePhotoIdx]}
              alt={item.release.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Disc3 className="w-20 h-20 text-zinc-700" />
          )}
        </div>

        {allPhotos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {allPhotos.map((url, idx) => (
              <button
                key={idx}
                onClick={() => {
                  haptic.selection();
                  setActivePhotoIdx(idx);
                }}
                className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                  activePhotoIdx === idx ? 'border-amber-500' : 'border-transparent opacity-60'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Заголовок, кликабельные артисты и цена */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
        <div>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {item.release.artists.map((artist) => (
              <Link
                key={artist.id}
                to={`/artist/${artist.id}`}
                onClick={() => haptic.light()}
                className="text-sm font-bold text-amber-400 hover:underline"
              >
                {artist.name}
              </Link>
            ))}
          </div>
          <h1 className="text-xl font-extrabold text-white">{item.release.title}</h1>
        </div>

        {/* Оценка состояния по Goldmine */}
        <div className="grid grid-cols-2 gap-2.5 bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/80">
          <div>
            <span className="text-[11px] text-zinc-400 block">Винил (Media)</span>
            <span className="text-sm font-bold text-amber-400">
              {item.condition_media || 'Не указано'}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 block">Конверт (Sleeve)</span>
            <span className="text-sm font-bold text-white">
              {item.condition_sleeve || 'Не указано'}
            </span>
          </div>
        </div>

        {/* Метаданные и кликабельные теги графа (Жанр, Стиль, Лейбл) */}
        <div className="space-y-2.5 text-xs">
          {item.release.label && (
            <div className="flex items-center gap-2 text-zinc-300">
              <Layers className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">Лейбл:</span>
              <button
                onClick={() => navigate(`/?label=${encodeURIComponent(item.release.label!)}`)}
                className="text-amber-400 hover:underline font-medium"
              >
                {item.release.label}
              </button>
            </div>
          )}

          {item.release.country && (
            <div className="flex items-center gap-2 text-zinc-300">
              <Globe className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">Страна:</span>
              <span>{item.release.country}</span>
            </div>
          )}

          {item.release.year && (
            <div className="flex items-center gap-2 text-zinc-300">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">Год издания:</span>
              <span>{item.release.year}</span>
            </div>
          )}

          {(item.release.genre.length > 0 || item.release.style.length > 0) && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {item.release.genre.map((g) => (
                <button
                  key={g}
                  onClick={() => navigate(`/?genre=${encodeURIComponent(g)}`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-medium"
                >
                  <Tag className="w-3 h-3" /> {g}
                </button>
              ))}
              {item.release.style.map((s) => (
                <button
                  key={s}
                  onClick={() => navigate(`/?style=${encodeURIComponent(s)}`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-medium"
                >
                  #{s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Описание экземпляра */}
        {item.description && (
          <div className="pt-2 border-t border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 mb-1">Описание экземпляра</h3>
            <p className="text-xs text-zinc-200 whitespace-pre-line leading-relaxed">
              {item.description}
            </p>
          </div>
        )}

        {/* Цена и кнопка добавления в корзину */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400 block">Стоимость экземпляра</span>
            <span className="text-2xl font-black text-white">
              {item.price.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <button
            onClick={() => addToCart(item)}
            disabled={inCart || item.status !== 'active'}
            className={`px-5 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition ${
              inCart
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500 hover:bg-amber-400 text-black'
            }`}
          >
            {inCart ? (
              <>
                <Check className="w-4 h-4" />
                <span>В корзине</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>В корзину</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ГРАФ СВЯЗЕЙ 1: Другие релизы этого исполнителя */}
      {sameArtistItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white px-1">Другие релизы этого исполнителя</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {sameArtistItems.map((relItem) => {
              const cover = relItem.photos[0] || relItem.release.default_cover_url;
              return (
                <Link
                  key={relItem.id}
                  to={`/record/${relItem.id}`}
                  className="w-36 shrink-0 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
                >
                  <div className="aspect-square bg-zinc-950 flex items-center justify-center">
                    {cover ? (
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Disc3 className="w-8 h-8 text-zinc-700" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <h4 className="text-xs font-bold text-white truncate">
                      {relItem.release.title}
                    </h4>
                    <p className="text-xs font-semibold text-amber-400 mt-1">
                      {relItem.price.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ГРАФ СВЯЗЕЙ 2: Похожие альбомы в жанре {genre} */}
      {primaryGenre && similarGenreItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white px-1">
            Похожие альбомы в жанре {primaryGenre}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {similarGenreItems.map((simItem) => {
              const cover = simItem.photos[0] || simItem.release.default_cover_url;
              return (
                <Link
                  key={simItem.id}
                  to={`/record/${simItem.id}`}
                  className="w-36 shrink-0 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
                >
                  <div className="aspect-square bg-zinc-950 flex items-center justify-center">
                    {cover ? (
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Disc3 className="w-8 h-8 text-zinc-700" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-[10px] text-zinc-400 truncate">
                      {simItem.release.artists.map((a) => a.name).join(', ')}
                    </p>
                    <h4 className="text-xs font-bold text-white truncate">
                      {simItem.release.title}
                    </h4>
                    <p className="text-xs font-semibold text-amber-400 mt-1">
                      {simItem.price.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};