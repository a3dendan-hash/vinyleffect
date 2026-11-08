import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  ChevronDown,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { supabase, ITEM_CATALOG_SELECT } from '../lib/supabase';
import { VinylItem, mapSupabaseItem } from '../types/database';
import { useCart } from '../context/CartContext';
import { haptic } from '../lib/telegram';

const CLIENT_BATCH_SIZE = 48;

export const Catalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [displayCount, setDisplayCount] = useState(CLIENT_BATCH_SIZE);
  const [showFilters, setShowFilters] = useState(false);

  // Поисковые и фильтрующие состояния
  const [query, setQuery] = useState('');
  const [genreTab, setGenreTab] = useState<'all' | 'soviet' | 'rock' | 'jazz' | 'synth'>('all');
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

  // Загружаем сразу ВСЮ базу данных пластинок (параллельные чанки по 1000)
  // Это обеспечивает мгновенный поиск по всем 2900 пластинкам без задержек и постоянного кликанья
  useEffect(() => {
    let isCancelled = false;

    const loadAllCatalogItems = async () => {
      setLoading(true);
      try {
        // Запрашиваем 3 диапазона параллельно для максимальной скорости (0-999, 1000-1999, 2000-2999)
        const ranges = ['0-999', '1000-1999', '2000-2999', '3000-3999'];
        const chunkPromises = ranges.map(async (r) => {
          const [from, to] = r.split('-').map(Number);
          const { data, error } = await supabase
            .from('items')
            .select(ITEM_CATALOG_SELECT)
            .in('status', ['active', 'draft'])
            .range(from, to)
            .order('created_at', { ascending: false });

          if (error) {
            console.warn(`Error loading chunk ${r}:`, error);
            return [];
          }
          return data || [];
        });

        const chunks = await Promise.all(chunkPromises);
        if (isCancelled) return;

        const combined = chunks.flat();
        const mapped = combined.map(mapSupabaseItem);
        setItems(mapped);
        setLoadingProgress({ current: mapped.length, total: mapped.length });
      } catch (e) {
        console.error('Failed to load full catalog:', e);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadAllCatalogItems();

    return () => {
      isCancelled = true;
    };
  }, []);

  const allGenres = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.release.genre))).filter(Boolean).sort(),
    [items]
  );
  const allStyles = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.release.style))).filter(Boolean).sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const titleMatch = (item.release?.title || '').toLowerCase().includes(q);
        const artistMatch = (item.release?.artists || []).some((a) => a.name.toLowerCase().includes(q));
        const labelMatch = (item.release?.label || '').toLowerCase().includes(q);
        const catnoMatch = (item.release?.catno || '').toLowerCase().includes(q);
        const countryMatch = (item.release?.country || '').toLowerCase().includes(q);
        const yearMatch = String(item.release?.year || '').includes(q);
        if (!titleMatch && !artistMatch && !labelMatch && !catnoMatch && !countryMatch && !yearMatch) return false;
      }

      // Быстрые вкладки из дизайна Atelier Monolith
      if (genreTab === 'soviet') {
        const isSoviet = (item.release?.artists || []).some((a) =>
          /кино|цой|оборона|аквариум|ддт|наутилус|ария|зоопарк|пикник|мелодия/i.test(a.name)
        ) || (item.release?.country && /ussr|ссср|russia/i.test(item.release.country));
        if (!isSoviet) return false;
      } else if (genreTab === 'rock') {
        const isRock = item.release.genre.some((g) => /rock/i.test(g)) || item.release.style.some((s) => /rock|hard rock|metal/i.test(s));
        if (!isRock) return false;
      } else if (genreTab === 'jazz') {
        const isJazz = item.release.genre.some((g) => /jazz|funk|soul|blues/i.test(g));
        if (!isJazz) return false;
      } else if (genreTab === 'synth') {
        const isSynth = item.release.genre.some((g) => /electronic|synth/i.test(g)) || item.release.style.some((s) => /synth-pop|new wave|post-punk|industrial/i.test(s));
        if (!isSynth) return false;
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
  }, [items, query, genreTab, selectedGenre, selectedStyle, selectedLabel, selectedCondition, maxPrice, sortBy]);

  // Сброс видимого диапазона при изменении поискового запроса или фильтра
  useEffect(() => {
    setDisplayCount(CLIENT_BATCH_SIZE);
  }, [query, genreTab, selectedGenre, selectedStyle, selectedLabel, selectedCondition, maxPrice, sortBy]);

  const displayedSlice = useMemo(() => {
    return filteredItems.slice(0, displayCount);
  }, [filteredItems, displayCount]);

  const loadMoreCards = () => {
    haptic.light();
    setDisplayCount((prev) => Math.min(prev + CLIENT_BATCH_SIZE, filteredItems.length));
  };

  const resetAllFilters = () => {
    haptic.light();
    setQuery('');
    setGenreTab('all');
    setSelectedGenre('');
    setSelectedStyle('');
    setSelectedLabel('');
    setSelectedCondition('');
    setMaxPrice('');
    setSortBy('newest');
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(
    genreTab !== 'all' || selectedGenre || selectedStyle || selectedLabel || selectedCondition || maxPrice || sortBy !== 'newest'
  );

  return (
    <div className="pb-24">
      {/* Баннер "ВИНИЛПИТЕР" в стиле Swiss Minimal */}
      <section className="pt-2 pb-6 border-b border-[#1f1f1f] mb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono text-[#8b5cf6] uppercase tracking-widest block mb-1">
              МАГАЗИН ОРИГИНАЛЬНОГО ВИНИЛА
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              ПЛАСТИНКИ В НАЛИЧИИ В СПБ
            </h1>
          </div>
          <div className="text-xs text-[#888888] font-mono max-w-md">
            Все экземпляры оценены по стандарту Goldmine. Фотографии реальных конвертов и дисков.
            <div className="pt-1 text-white flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span>Санкт-Петербург · ул. Рубинштейна</span>
              <a href="tel:+79219675106" className="text-[#8b5cf6] hover:underline font-bold ml-1">
                +7 921 967-51-06
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Быстрые переключатели жанров */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 mb-4 scrollbar-none font-mono text-xs">
        {[
          { key: 'all', label: `Все в наличии (${items.length})` },
          { key: 'soviet', label: 'Русский рок' },
          { key: 'rock', label: 'Классический рок' },
          { key: 'jazz', label: 'Джаз / Фанк' },
          { key: 'synth', label: 'Синти / Пост-панк' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              haptic.selection();
              setGenreTab(tab.key as any);
            }}
            className={`px-3.5 py-2 rounded-xl transition border shrink-0 ${
              genreTab === tab.key
                ? 'bg-white text-black font-semibold border-white'
                : 'bg-[#141414] text-[#a3a3a3] hover:text-white border-[#222222]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Поиск и фильтры с мгновенным откликом по всем 2900 пластинкам */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Поиск по всем ${items.length || 2900} пластинкам (артист, альбом, год, лейбл)...`}
            className="w-full bg-[#111111] border border-[#262626] rounded-2xl pl-10 pr-9 py-2.5 text-xs font-mono text-white placeholder-[#666666] focus:border-[#8b5cf6] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 font-mono text-xs">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#111111] border border-[#262626] rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#8b5cf6] flex-1 sm:flex-none"
          >
            <option value="newest">Сначала новые</option>
            <option value="price_asc">По цене (возрастание)</option>
            <option value="price_desc">По цене (убывание)</option>
            <option value="year_desc">По году выпуска</option>
          </select>

          <button
            onClick={() => {
              haptic.light();
              setShowFilters((prev) => !prev);
            }}
            className={`px-4 py-2.5 rounded-2xl border flex items-center gap-1.5 transition ${
              showFilters || hasActiveFilters
                ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                : 'bg-[#111111] text-[#a3a3a3] border-[#262626] hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Фильтры</span>
          </button>
        </div>
      </div>

      {/* Панель фильтрации */}
      {showFilters && (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <label className="block text-[#888888] mb-1">Жанр</label>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-[#171717] border border-[#262626] rounded-xl px-2.5 py-2 text-white"
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
            <label className="block text-[#888888] mb-1">Стиль</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="w-full bg-[#171717] border border-[#262626] rounded-xl px-2.5 py-2 text-white"
            >
              <option value="">Все стили</option>
              {allStyles.map((s) => (
                <option key={s} value={s}>
                  #{s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[#888888] mb-1">Состояние (Goldmine)</label>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="w-full bg-[#171717] border border-[#262626] rounded-xl px-2.5 py-2 text-white"
            >
              <option value="">Любое</option>
              {['M', 'NM', 'NM-', 'EX', 'VG+', 'VG', 'G+', 'G'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[#888888] mb-1">Макс. цена (₽)</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="До..."
              className="w-full bg-[#171717] border border-[#262626] rounded-xl px-2.5 py-2 text-white"
            />
          </div>
        </div>
      )}

      {/* Активные фильтры и счетчик найденного */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#888888]">
            Найдено: <strong className="text-white">{filteredItems.length}</strong> из {items.length}
          </span>
          {genreTab !== 'all' && (
            <span className="bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-[#c084fc] px-2.5 py-1 rounded-lg">
              Раздел: {genreTab}
            </span>
          )}
          {selectedGenre && (
            <span className="bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-[#c084fc] px-2.5 py-1 rounded-lg">
              Жанр: {selectedGenre}
            </span>
          )}
          {selectedStyle && (
            <span className="bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-[#c084fc] px-2.5 py-1 rounded-lg">
              Стиль: #{selectedStyle}
            </span>
          )}
          {selectedCondition && (
            <span className="bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-[#c084fc] px-2.5 py-1 rounded-lg">
              Состояние: {selectedCondition}
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetAllFilters}
            className="text-xs text-[#888888] hover:text-white underline"
          >
            Сбросить все фильтры
          </button>
        )}
      </div>

      {/* Сетка пластинок витрины */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-12 h-12 rounded-full vinyl-grooves spin-vinyl mx-auto" />
          <p className="text-xs font-mono text-white font-bold">Загрузка каталога винила...</p>
          <p className="text-[11px] font-mono text-[#888888]">
            Загружаем полную базу всех пластинок для мгновенного поиска...
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-[#111111] border border-[#222222] rounded-3xl p-8">
          <Disc3 className="w-12 h-12 text-[#444444] mx-auto" />
          <h3 className="font-bold text-white text-base">Ничего не найдено</h3>
          <p className="text-xs text-[#888888] font-mono">
            По запросу "{query}" ничего не нашлось среди {items.length} пластинок.
          </p>
          <button
            onClick={resetAllFilters}
            className="px-4 py-2 bg-white text-black font-mono font-semibold text-xs rounded-xl"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {displayedSlice.map((item) => {
              const cover = item.photos[0] || item.release.default_cover_url;
              const inCart = isInCart(item.id);

              return (
                <article
                  key={item.id}
                  className="group bg-[#111111] border border-[#222222] hover:border-[#8b5cf6]/60 transition-all flex flex-col justify-between rounded-2xl overflow-hidden shadow-lg"
                >
                  <div>
                    <Link
                      to={`/record/${item.id}`}
                      onClick={() => haptic.light()}
                      className="relative block w-full aspect-square overflow-hidden bg-black border-b border-[#222222]"
                    >
                      {cover ? (
                        <img
                          src={cover}
                          alt={item.release.title}
                          loading="lazy"
                          className="w-full h-full object-cover grayscale-[15%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Disc3 className="w-12 h-12 text-[#333333]" />
                        </div>
                      )}

                      <div className="absolute top-2.5 left-2.5">
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-[#0a0a0a]/90 border border-[#333333] text-[#f5f5f5] rounded">
                          {item.condition_media || 'NM-'} • {item.release_type || 'Оригинал'}
                        </span>
                      </div>

                      {item.important_details?.includes('Цветной') && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-900/90 text-purple-200 border border-purple-700 rounded flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Цветной
                          </span>
                        </div>
                      )}
                    </Link>

                    <div className="p-4 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#737373]">
                        <span className="truncate max-w-[140px]">
                          {item.release.label ? item.release.label : 'Лейбл'}
                          {item.release.year ? ` • ${item.release.year}` : ''}
                        </span>
                        <span>{item.release.country || 'Импорт'}</span>
                      </div>

                      <h3 className="text-sm font-bold text-white uppercase group-hover:text-[#8b5cf6] transition-colors leading-snug truncate">
                        {(item.release?.artists || []).map((a) => a.name).join(', ') || 'Разные исполнители'}
                      </h3>
                      <p className="text-xs text-[#a3a3a3] truncate">{item.release.title}</p>
                    </div>
                  </div>

                  <div className="p-4 pt-2 border-t border-[#1a1a1a] flex items-center justify-between">
                    <span className="text-sm font-semibold font-mono text-white">
                      {item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : 'По запросу'}
                    </span>

                    <button
                      onClick={() => {
                        haptic.light();
                        addToCart(item);
                      }}
                      disabled={inCart}
                      className={`px-3.5 py-1.5 font-mono text-xs rounded-xl transition border ${
                        inCart
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-[#1a1a1a] hover:bg-white text-[#d4d4d4] hover:text-black border-[#2c2c2c] hover:border-white'
                      }`}
                    >
                      {inCart ? 'В корзине' : 'В корзину'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Быстрое листание следующей порции из уже загруженных в память пластинок */}
          {displayedSlice.length < filteredItems.length && (
            <div className="pt-8 text-center font-mono">
              <button
                onClick={loadMoreCards}
                className="px-8 py-3.5 bg-[#141414] hover:bg-[#1f1f1f] text-white border border-[#262626] rounded-2xl text-xs font-bold transition inline-flex items-center gap-2 shadow-lg"
              >
                <ChevronDown className="w-4 h-4 text-[#8b5cf6]" />
                <span>
                  Показать еще {Math.min(CLIENT_BATCH_SIZE, filteredItems.length - displayedSlice.length)} (показано {displayedSlice.length} из {filteredItems.length})
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
