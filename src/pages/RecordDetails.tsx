import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Disc3,
  ShoppingBag,
  Check,
  Tag,
  Layers,
  Globe,
  Calendar,
  ExternalLink,
  Sparkles,
  Info,
  MapPin,
  Phone,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [sameArtistItems, setSameArtistItems] = useState<VinylItem[]>([]);
  const [similarGenreItems, setSimilarGenreItems] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecordAndGraph = async () => {
      if (!id) return;
      setLoading(true);
      setActivePhotoIdx(0);

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

      // Graph recommendations: other active items
      const { data: allActiveData } = await supabase
        .from('items')
        .select(ITEM_WITH_GRAPH_SELECT)
        .eq('status', 'active')
        .neq('id', currentItem.id)
        .limit(30);

      if (allActiveData) {
        const allActive = allActiveData.map(mapSupabaseItem);
        const currentArtistIds = new Set(currentItem.release.artists.map((a) => a.id));
        const primaryGenre = currentItem.release.genre[0];

        const byArtist = allActive.filter((other) =>
          other.release.artists.some((a) => currentArtistIds.has(a.id))
        );
        setSameArtistItems(byArtist.slice(0, 6));

        if (primaryGenre) {
          const byGenre = allActive.filter(
            (other) =>
              other.release.genre.includes(primaryGenre) &&
              !other.release.artists.some((a) => currentArtistIds.has(a.id))
          );
          setSimilarGenreItems(byGenre.slice(0, 6));
        }
      }

      setLoading(false);
    };

    loadRecordAndGraph();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-12 h-12 rounded-full vinyl-grooves spin-vinyl mx-auto" />
        <p className="text-zinc-500 text-xs font-mono">Загрузка карточки пластинки...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="py-20 text-center space-y-3">
        <Disc3 className="w-12 h-12 text-zinc-700 mx-auto" />
        <p className="text-zinc-400 text-sm">Пластинка не найдена или снята с витрины.</p>
        <button
          onClick={() => navigate('/')}
          className="text-xs text-[#8b5cf6] underline font-mono"
        >
          Вернуться в каталог
        </button>
      </div>
    );
  }

  const allPhotos = item.photos.length > 0 ? item.photos : [];
  const inCart = isInCart(item.id);
  const hasDiscogsUri = Boolean(item.release.discogs_uri);

  return (
    <div className="pb-28 space-y-6 max-w-4xl mx-auto">
      {/* Кликабельная галерея реальных фотографий пластинки */}
      <div className="space-y-3">
        <div
          onClick={() => {
            if (allPhotos.length > 0) {
              haptic.light();
              setIsLightboxOpen(true);
            }
          }}
          className="relative aspect-square w-full max-w-md mx-auto rounded-3xl bg-[#111111] border border-[#222222] overflow-hidden flex items-center justify-center cursor-zoom-in group shadow-2xl"
        >
          {allPhotos[activePhotoIdx] ? (
            <img
              src={allPhotos[activePhotoIdx]}
              alt={item.release.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="relative w-40 h-40 rounded-full vinyl-grooves flex items-center justify-center p-2 spin-vinyl">
              <div className="w-16 h-16 rounded-full bg-[#0a0a0a] border border-[#262626] flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-white" />
              </div>
            </div>
          )}

          {allPhotos.length > 0 && (
            <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 text-xs text-white">
              <Maximize2 className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span className="font-mono text-[11px]">Нажмите для зума ({activePhotoIdx + 1}/{allPhotos.length})</span>
            </div>
          )}

          {item.release_type && (
            <div className="absolute top-3 left-3 bg-[#0a0a0a]/90 backdrop-blur-md px-3 py-1 rounded-xl border border-[#333333] text-[11px] font-mono font-bold text-white uppercase tracking-wider">
              {item.release_type}
            </div>
          )}
        </div>

        {allPhotos.length > 1 && (
          <div className="flex justify-center gap-2 overflow-x-auto pb-1 max-w-md mx-auto">
            {allPhotos.map((url, idx) => (
              <button
                key={idx}
                onClick={() => {
                  haptic.selection();
                  setActivePhotoIdx(idx);
                }}
                className={`w-16 h-16 rounded-2xl overflow-hidden border-2 shrink-0 transition ${
                  activePhotoIdx === idx ? 'border-[#8b5cf6] scale-105' : 'border-[#222222] opacity-60 hover:opacity-100'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Полноэкранный Lightbox для фото */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-8">
          <div className="flex items-center justify-between text-white pb-3">
            <span className="font-mono text-xs text-[#a3a3a3]">
              {item.release.title} · Фото {activePhotoIdx + 1} из {allPhotos.length}
            </span>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative">
            <img
              src={allPhotos[activePhotoIdx]}
              alt=""
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
            {allPhotos.length > 1 && (
              <>
                <button
                  onClick={() => {
                    haptic.light();
                    setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : allPhotos.length - 1));
                  }}
                  className="absolute left-2 p-3 rounded-full bg-black/60 border border-white/20 text-white"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => {
                    haptic.light();
                    setActivePhotoIdx((prev) => (prev < allPhotos.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-2 p-3 rounded-full bg-black/60 border border-white/20 text-white"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <div className="flex justify-center gap-2 overflow-x-auto pt-3">
            {allPhotos.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setActivePhotoIdx(idx)}
                className={`w-12 h-12 rounded-xl overflow-hidden border-2 ${
                  activePhotoIdx === idx ? 'border-[#8b5cf6]' : 'border-transparent opacity-40'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Основная карточка паспорта пластинки */}
      <div className="bg-[#111111] border border-[#222222] rounded-3xl p-6 sm:p-8 space-y-6 text-white shadow-2xl">
        {/* Артист, Альбом, Год и Бейджи */}
        <div className="border-b border-[#222222] pb-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {item.release.artists.map((artist) => (
              <Link
                key={artist.id}
                to={`/artist/${artist.id}`}
                onClick={() => haptic.light()}
                className="text-base font-bold text-[#8b5cf6] hover:underline uppercase tracking-wide"
              >
                {artist.name}
              </Link>
            ))}
            {item.release.year && (
              <span className="text-xs font-mono text-[#888888] bg-[#1a1a1a] px-2.5 py-0.5 rounded-lg border border-[#2a2a2a]">
                {item.release.year}
              </span>
            )}
            {item.release.country && (
              <span className="text-xs font-mono text-[#888888] bg-[#1a1a1a] px-2.5 py-0.5 rounded-lg border border-[#2a2a2a]">
                {item.release.country}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            {item.release.title}
          </h1>

          {/* Важные детали (Limited edition, Numbered, Цветной винил) */}
          {Boolean(item.important_details) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {item.important_details?.split(',').map((detail, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-950/60 text-[#c084fc] border border-purple-800/50 text-xs font-mono font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {detail.trim()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Сетка характеристик (Goldmine, Лейбл, Каталожный номер, Формат) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0c0c0c] p-4 rounded-2xl border border-[#1f1f1f] text-xs font-mono">
          <div className="space-y-1">
            <span className="text-[#737373] block text-[11px]">Конверт (Sleeve)</span>
            <span className="text-white font-bold text-sm text-emerald-400">
              {item.condition_sleeve || 'NM'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[#737373] block text-[11px]">Винил (Media)</span>
            <span className="text-white font-bold text-sm text-[#8b5cf6]">
              {item.condition_media || 'NM-'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[#737373] block text-[11px]">Лейбл</span>
            <span className="text-white font-semibold truncate block">
              {item.release.label || 'Не указан'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[#737373] block text-[11px]">Формат</span>
            <span className="text-white font-semibold truncate block">
              {item.release.format_details || '12" Vinyl'}
            </span>
          </div>
        </div>

        {/* Дополнительная техническая информация (Каталожный номер, Матрица, Runout) */}
        {(item.extra_info || item.release.catno) && (
          <div className="bg-[#141414] border border-[#222222] rounded-2xl p-4 space-y-2">
            <h3 className="text-xs font-mono text-[#888888] uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#8b5cf6]" />
              Дополнительная информация и матрицы
            </h3>
            <div className="text-xs font-mono text-[#e5e5e5] whitespace-pre-line leading-relaxed">
              {item.extra_info || `Каталожный номер: ${item.release.catno}`}
            </div>
          </div>
        )}

        {/* Жанры и Стили */}
        {(item.release.genre.length > 0 || item.release.style.length > 0) && (
          <div className="space-y-2">
            <span className="text-xs font-mono text-[#737373] uppercase tracking-wider block">Стили и направления:</span>
            <div className="flex flex-wrap gap-2">
              {item.release.genre.map((g) => (
                <button
                  key={g}
                  onClick={() => navigate(`/?genre=${encodeURIComponent(g)}`)}
                  className="px-3 py-1 rounded-xl bg-[#1c1c1c] text-[#d4d4d4] hover:text-white border border-[#2e2e2e] text-xs font-mono transition"
                >
                  {g}
                </button>
              ))}
              {item.release.style.map((s) => (
                <button
                  key={s}
                  onClick={() => navigate(`/?style=${encodeURIComponent(s)}`)}
                  className="px-3 py-1 rounded-xl bg-[#8b5cf6]/10 text-[#c084fc] border border-[#8b5cf6]/30 text-xs font-mono transition"
                >
                  #{s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Прямая ссылка на релиз в Discogs */}
        {hasDiscogsUri && (
          <div className="pt-2">
            <a
              href={item.release.discogs_uri!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#171717] hover:bg-[#202020] text-xs font-mono text-[#a3a3a3] hover:text-white border border-[#2a2a2a] transition"
            >
              <ExternalLink className="w-4 h-4 text-[#8b5cf6]" />
              <span>Посмотреть официальный релиз на Discogs.com</span>
            </a>
          </div>
        )}

        {/* Контакты и самовывоз */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white">
              <MapPin className="w-4 h-4 text-[#8b5cf6] shrink-0" />
              <span className="font-semibold">г. Санкт-Петербург</span>
            </div>
            <p className="text-[#737373]">Самовывоз и курьерская отправка в бронекоробе</p>
          </div>
          <a
            href="tel:+79219675106"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] text-white border border-[#2e2e2e] font-bold text-sm transition"
          >
            <Phone className="w-4 h-4 text-[#8b5cf6]" />
            +7 921 967-51-06
          </a>
        </div>

        {/* Цена и добавление в корзину */}
        <div className="pt-4 border-t border-[#222222] flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono text-[#888888] block">Стоимость пластинки:</span>
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
              {item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : 'Цена по запросу'}
            </span>
          </div>

          <button
            onClick={() => {
              haptic.medium();
              addToCart(item);
            }}
            disabled={inCart || item.status !== 'active'}
            className={`px-6 py-4 rounded-2xl font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-2.5 transition shadow-lg ${
              inCart
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-white hover:bg-[#8b5cf6] text-black hover:text-white shadow-white/10'
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
                <span>Добавить в корзину</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Другие релизы этого артиста */}
      {sameArtistItems.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-sm font-bold font-mono uppercase text-white px-1">
            Другие релизы исполнителя ({sameArtistItems.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {sameArtistItems.map((relItem) => {
              const cover = relItem.photos[0] || relItem.release.default_cover_url;
              return (
                <Link
                  key={relItem.id}
                  to={`/record/${relItem.id}`}
                  onClick={() => haptic.light()}
                  className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden hover:border-[#8b5cf6]/50 transition group"
                >
                  <div className="aspect-square bg-black overflow-hidden flex items-center justify-center">
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <Disc3 className="w-8 h-8 text-[#333333]" />
                    )}
                  </div>
                  <div className="p-2.5 space-y-1 font-mono">
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-[#8b5cf6]">
                      {relItem.release.title}
                    </h4>
                    <p className="text-[11px] text-[#888888]">
                      {relItem.price > 0 ? `${relItem.price.toLocaleString('ru-RU')} ₽` : 'Под заказ'}
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
