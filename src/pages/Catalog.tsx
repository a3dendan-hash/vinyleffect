import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Disc3,
  X,
  ShoppingBag,
  Check,
  MapPin,
  Phone,
  Truck,
  CreditCard,
} from 'lucide-react';
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
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'year_desc'>('newest');

  const { addToCart, isInCart } = useCart();

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
        .range(0, 4999)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setItems(data.map(mapSupabaseItem));
      }
      setLoading(false);
    };
    loadActiveCatalog();
  }, []);

  // Динамическое формирование списков доступных жанров, стилей и лейблов
  const allGenres = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.release.genre))).filter(Boolean).sort(),
    [items]
  );
  const allStyles = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.release.style))).filter(Boolean).sort(),
    [items]
  );
  const allLabels = useMemo(
    () => Array.from(new Set(items.map((i) => i.release.label || ''))).filter(Boolean).sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const titleMatch = item.release.title.toLowerCase().includes(q);
        const artistMatch = item.release.artists.some((a) => a.name.toLowerCase().includes(q));
        const labelMatch = (item.release.label || '').toLowerCase().includes(q);
        if (!titleMatch && !artistMatch && !labelMatch) return false;
      }

      if (selectedGenre && !item.release.genre.includes(selectedGenre)) return false;
      if (selectedStyle && !item.release.style.includes(selectedStyle)) return false;
      if (selectedLabel && item.release.label !== selectedLabel) return false;
      if (selectedCondition && item.condition_media !== selectedCondition) return false;
      if (maxPrice && item.price > Number(maxPrice)) return false;

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'year_desc') return (b.release.year || 0) - (a.release.year || 0);
      return 0;
    });
  }, [items, query, selectedGenre, selectedStyle, selectedLabel, selectedCondition, maxPrice, sortBy]);

  const resetAllFilters = () => {
    haptic.light();
    setQuery('');
    setSelectedGenre('');
    setSelectedStyle('');
    setSelectedLabel('');
    setSelectedCondition('');
    setMaxPrice('');
    setSortBy('newest');
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(
    selectedGenre || selectedStyle || selectedLabel || selectedCondition || maxPrice || sortBy !== 'newest'
  );

  return (
    <div className="pb-24">
      {/* Приветственный баннер "О магазине, оплате и доставке" */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 mb-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-1.5">
          <h2 className="text-sm font-bold text-white">Добро пожаловать в VinylEffect!</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Кураторский магазин виниловых пластинок. Бережная оценка по стандарту Goldmine и надежная упаковка.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <span className="inline-flex items-center gap-1 text-zinc-300">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              г. Санкт-Петербург
            </span>
            <a
              href="tel:+79679675105"
              className="inline-flex items-center gap-1 text-amber-400 font-bold hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              +7 967 967-51-05
            </a>
          </div>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Оплата</span>
          </div>
          <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
            <li>Наличными при встрече (в пределах Санкт-Петербурга и его окрестностей);</li>
            <li>Перевод на карту Сбербанка (из любого отделения Сбербанка РФ).</li>
          </ul>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Truck className="w-3.5 h-3.5" />
            <span>Доставка</span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            Доставка осуществляется <strong>Почтой России</strong>, <strong>Яндекс Доставкой</strong>, <strong>СДЭКом</strong>, а также возможна личная встреча в Санкт-Петербурге.
          </p>
        </div>
      </div>

      {/* Живой поиск, сортировка и кнопка фильтров */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по альбому, исполнителю или лейблу..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-500 flex-1 sm:flex-none"
          >
            <option value="newest">Сначала новые</option>
            <option value="price_asc">Сначала дешевле</option>
            <option value="price_desc">Сначала дороже</option>
            <option value="year_desc">По году релиза</option>
          </select>

          <button
            onClick={() => {
              haptic.light();
              setShowFilters((prev) => !prev);
            }}
            className={`px-4 py-2.5 rounded-2xl border flex items-center gap-1.5 text-xs font-semibold transition ${
              showFilters || hasActiveFilters
                ? 'bg-amber-500 text-black border-amber-500'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Фильтры</span>
          </button>
        </div>
      </div>

      {/* Активные чипсы фильтров */}
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
          {selectedCondition && (
            <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs px-2.5 py-1 rounded-full">
              Состояние: {selectedCondition}
            </span>
          )}
          {maxPrice && (
            <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs px-2.5 py-1 rounded-full">
              До {maxPrice} ₽
            </span>
          )}
          <button
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white ml-1"
          >
            <X className="w-3.5 h-3.5" /> Сбросить все
          </button>
        </div>
      )}

      {/* Раскрывающаяся панель расширенных фильтров */}
      {showFilters && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
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
            <label className="block text-zinc-400 mb-1">Лейбл</label>
            <select
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-white"
            >
              <option value="">Все лейблы</option>
              {allLabels.map((l) => (
                <option key={l} value={l}>
                  {l}
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
              {['M', 'NM', 'VG+', 'VG', 'G+', 'G'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1">
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

      {/* Сетка карточек пластинок (до 5 в ряд на ПК) */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <div key={n} className="bg-zinc-900 rounded-2xl h-64 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          Пластинки по заданным параметрам не найдены.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item) => {
            const cover = item.photos[0] || item.release.default_cover_url;
            const inCart = isInCart(item.id);

            return (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800/90 rounded-2xl overflow-hidden flex flex-col justify-between group hover:border-zinc-700 transition"
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
