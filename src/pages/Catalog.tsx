import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Disc3, X, ShoppingBag, Check } from 'lucide-react';
import { supabase, ITEM_WITH_GRAPH_SELECT } from '../lib/supabase';
import { VinylItem, mapSupabaseItem } from '../types/database';
import { useCart } from '../context/CartContext';
import { haptic } from '../lib/telegram';

export const Catalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Поисковые и фильтрующие состояния
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>(searchParams.get('genre') || '');
  const [selectedStyle, setSelectedStyle] = useState<string>(searchParams.get('style') || '');
  const [selectedLabel, setSelectedLabel] = useState<string>(searchParams.get('label') || '');
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const { addToCart, isInCart } = useCart();

  // Синхронизация URL-параметров при переходе по графу связей (клик по жанру/стилю/лейблу)
  useEffect(() => {
    setSelectedGenre(searchParams.get('genre') || '');
    setSelectedStyle(searchParams.get('style') || '');
    setSelectedLabel(searchParams.get('label') || '');
  }, [searchParams]);

  useEffect(() => {
    const loadActiveCatalog = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select(ITEM_WITH_GRAPH_SELECT)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setItems(data.map(mapSupabaseItem));
      }
      setLoading(false);
    };
    loadActiveCatalog();
  }, []);

  // Динамическое формирование списков доступных жанров и стилей
  const allGenres = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.release.genre))).sort(),
    [items]
  );
  const allStyles = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.release.style))).sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const titleMatch = item.release.title.toLowerCase().includes(q);
        const artistMatch = item.release.artists.some((a) => a.name.toLowerCase().includes(q));
        if (!titleMatch && !artistMatch) return false;
      }

      if (selectedGenre && !item.release.genre.includes(selectedGenre)) return false;
      if (selectedStyle && !item.release.style.includes(selectedStyle)) return false;
      if (selectedLabel && item.release.label !== selectedLabel) return false;
      if (selectedCondition && item.condition_media !== selectedCondition) return false;
      if (maxPrice && item.price > Number(maxPrice)) return false;

      return true;
    });
  }, [items, query, selectedGenre, selectedStyle, selectedLabel, selectedCondition, maxPrice]);

  const resetAllFilters = () => {
    haptic.light();
    setQuery('');
    setSelectedGenre('');
    setSelectedStyle('');
    setSelectedLabel('');
    setSelectedCondition('');
    setMaxPrice('');
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(
    selectedGenre || selectedStyle || selectedLabel || selectedCondition || maxPrice
  );

  return (
    <div className="pb-24">
      {/* Живой поиск и кнопка фильтров */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по альбому или исполнителю..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => {
            haptic.light();
            setShowFilters((prev) => !prev);
          }}
          className={`px-3.5 rounded-2xl border flex items-center gap-1.5 text-xs font-semibold transition ${
            showFilters || hasActiveFilters
              ? 'bg-amber-500 text-black border-amber-500'
              : 'bg-zinc-900 text-zinc-300 border-zinc-800'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Активные чипсы фильтров графа */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {selectedGenre && (
            <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs px-2.5 py-1 rounded-full">
              Жанр: {selectedGenre}
            </span>
          )}
          {selectedStyle && (
            <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs px-2.5 py-1 rounded-full">
              Стиль: {selectedStyle}
            </span>
          )}
          {selectedLabel && (
            <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs px-2.5 py-1 rounded-full">
              Лейбл: {selectedLabel}
            </span>
          )}
          <button
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white ml-1"
          >
            <X className="w-3.5 h-3.5" /> Сбросить
          </button>
        </div>
      )}

      {/* Раскрывающаяся панель расширенных фильтров */}
      {showFilters && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1">Жанр</label>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-white"
            >
              <option value="">Все жанры</option>
              {allGenres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 mb-1">Стиль</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-white"
            >
              <option value="">Все стили</option>
              {allStyles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 mb-1">Состояние пластинки</label>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-white"
            >
              <option value="">Любое</option>
              {['M', 'NM', 'VG+', 'VG', 'G+'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 mb-1">Цена до (₽)</label>
            <input
              type="number"
              placeholder="Без лимита"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-white"
            />
          </div>
        </div>
      )}

      {/* Сетка карточек пластинок */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-zinc-900 rounded-2xl h-64 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          Пластинки по заданным параметрам не найдены.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((item) => {
            const cover = item.photos[0] || item.release.default_cover_url;
            const inCart = isInCart(item.id);

            return (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800/90 rounded-2xl overflow-hidden flex flex-col justify-between group"
              >
                <Link to={`/record/${item.id}`} className="block">
                  <div className="relative aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden">
                    {cover ? (
                      <img
                        src={cover}
                        alt={item.release.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <Disc3 className="w-12 h-12 text-zinc-700" />
                    )}

                    {/* Бейдж состояния Goldmine */}
                    {item.condition_media && (
                      <span className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-amber-500/30">
                        {item.condition_media} / {item.condition_sleeve}
                      </span>
                    )}

                    {item.release.year && (
                      <span className="absolute bottom-2 right-2 bg-black/70 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-md">
                        {item.release.year}
                      </span>
                    )}
                  </div>

                  <div className="p-3 pb-2">
                    <p className="text-[11px] text-amber-400 font-medium truncate">
                      {item.release.artists.map((a) => a.name).join(', ')}
                    </p>
                    <h3 className="text-xs font-bold text-white line-clamp-1 mt-0.5">
                      {item.release.title}
                    </h3>
                  </div>
                </Link>

                <div className="px-3 pb-3 pt-1 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-white">
                    {item.price.toLocaleString('ru-RU')} ₽
                  </span>
                  <button
                    onClick={() => addToCart(item)}
                    disabled={inCart}
                    className={`p-2 rounded-xl transition ${
                      inCart
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500 hover:bg-amber-400 text-black'
                    }`}
                  >
                    {inCart ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};