import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Disc3,
  X,
  MapPin,
  ChevronDown,
  Loader2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { supabase, ITEM_CATALOG_SELECT } from '../lib/supabase';
import { VinylItem, mapSupabaseItem } from '../types/database';
import { haptic } from '../lib/telegram';
import { resolveArtistCountry } from '../lib/artistCountry';

const CLIENT_BATCH_SIZE = 48;
const CACHE_KEY = 'vp_catalog_cache_v6';

export const Catalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Инициализация из локального кэша для мгновенного отображения витрины
  const [items, setItems] = useState<VinylItem[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return !cached;
    } catch {
      return true;
    }
  });

  const [displayCount, setDisplayCount] = useState(CLIENT_BATCH_SIZE);
  const [showFilters, setShowFilters] = useState(false);

  // Состояния фильтрации (все фильтры собраны во вкладке "Фильтры")
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>(searchParams.get('genre') || '');
  const [selectedStyle, setSelectedStyle] = useState<string>(searchParams.get('style') || '');
  const [selectedLabel, setSelectedLabel] = useState<string>(searchParams.get('label') || '');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [selectedReleaseType, setSelectedReleaseType] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'year_desc'>('newest');

  useEffect(() => {
    setSelectedGenre(searchParams.get('genre') || '');
    setSelectedStyle(searchParams.get('style') || '');
    setSelectedLabel(searchParams.get('label') || '');
  }, [searchParams]);

  // Загружаем ТОЛЬКО активные пластинки (status = 'active') для витрины покупателей
  useEffect(() => {
    let isCancelled = false;

    const loadActiveCatalog = async () => {
      try {
        const { data, error } = await supabase
          .from('items')
          .select(ITEM_CATALOG_SELECT)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (!error && data && !isCancelled) {
          const mapped = data.map(mapSupabaseItem);
          setItems(mapped);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
          } catch {}
        }
      } catch (err) {
        console.error('Catalog load error:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadActiveCatalog();

    return () => {
      isCancelled = true;
    };
  }, []);

  // СТРОГО: выпадающие списки фильтров содержат ТОЛЬКО значения, которые реально есть на витрине
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      (item.release?.genre || []).forEach((g) => {
        if (g && typeof g === 'string' && g.trim()) set.add(g.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const allStyles = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      (item.release?.style || []).forEach((s) => {
        if (s && typeof s === 'string' && s.trim()) set.add(s.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const lbl = item.release?.label;
      if (lbl && typeof lbl === 'string' && lbl.trim()) set.add(lbl.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const allCountries = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const c = item.release?.country;
      if (c && typeof c === 'string' && c.trim()) set.add(c.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Фильтрация товаров на клиенте
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

      // Фильтр по жанру
      if (selectedGenre && !item.release.genre.includes(selectedGenre)) return false;

      // Фильтр по стилю
      if (selectedStyle && !item.release.style.includes(selectedStyle)) return false;

      // Фильтр по лейблу
      if (selectedLabel && item.release.label !== selectedLabel) return false;

      // Фильтр по стране
      if (selectedCountry && item.release.country !== selectedCountry) return false;

      // Фильтр по состоянию
      if (selectedCondition && item.condition_media !== selectedCondition) return false;

      // Фильтр по типу издания
      if (selectedReleaseType && item.release_type !== selectedReleaseType) return false;

      // Фильтр по цене (от / до)
      if (minPrice && item.price < Number(minPrice)) return false;
      if (maxPrice && item.price > Number(maxPrice)) return false;

      // Фильтр по годам (от / до)
      if (yearFrom && (item.release.year || 0) < Number(yearFrom)) return false;
      if (yearTo && (item.release.year || 0) > Number(yearTo)) return false;

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'year_desc') return (b.release.year || 0) - (a.release.year || 0);
      return 0;
    });
  }, [
    items,
    query,
    selectedGenre,
    selectedStyle,
    selectedLabel,
    selectedCountry,
    selectedCondition,
    selectedReleaseType,
    minPrice,
    maxPrice,
    yearFrom,
    yearTo,
    sortBy,
  ]);

  useEffect(() => {
    setDisplayCount(CLIENT_BATCH_SIZE);
  }, [
    query,
    selectedGenre,
    selectedStyle,
    selectedLabel,
    selectedCountry,
    selectedCondition,
    selectedReleaseType,
    minPrice,
    maxPrice,
    yearFrom,
    yearTo,
    sortBy,
  ]);

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
    setSelectedGenre('');
    setSelectedStyle('');
    setSelectedLabel('');
    setSelectedCountry('');
    setSelectedCondition('');
    setSelectedReleaseType('');
    setMinPrice('');
    setMaxPrice('');
    setYearFrom('');
    setYearTo('');
    setSortBy('newest');
    setSearchParams({});
  };

  const activeFiltersCount = [
    selectedGenre,
    selectedStyle,
    selectedLabel,
    selectedCountry,
    selectedCondition,
    selectedReleaseType,
    minPrice,
    maxPrice,
    yearFrom,
    yearTo,
  ].filter(Boolean).length;

  return (
    <div className="pb-24">
      {/* Шапка каталога */}
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
            Магазин виниловых пластинок
            <div className="pt-1 text-white flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span>Санкт-Петербург · ул. Рубинштейна</span>
            </div>
          </div>
        </div>
      </section>

      {/* Поисковая строка и кнопка вызова панели Фильтры */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Поиск по витрине (${items.length} пластинок в наличии)...`}
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
              showFilters || activeFiltersCount > 0
                ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                : 'bg-[#111111] text-[#a3a3a3] border-[#262626] hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Панель «Фильтры» (только присутствующие на витрине параметры) */}
      {showFilters && (
        <div className="bg-[#111111] border border-[#222222] rounded-3xl p-5 mb-5 space-y-4 font-mono text-xs shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#222222] pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#8b5cf6]" />
              <h3 className="font-bold text-white uppercase tracking-wider text-xs">Параметры фильтрации витрины</h3>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-[#888888] hover:text-white flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Сбросить всё ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Жанр (только с витрины) */}
            <div>
              <label className="block text-[#888888] mb-1.5 font-medium">Жанр (в наличии)</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2.5 text-white focus:border-[#8b5cf6] focus:outline-none"
              >
                <option value="">Все жанры</option>
                {allGenres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Стиль (только с витрины) */}
            <div>
              <label className="block text-[#888888] mb-1.5 font-medium">Стиль (в наличии)</label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2.5 text-white focus:border-[#8b5cf6] focus:outline-none"
              >
                <option value="">Все стили</option>
                {allStyles.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Лейбл (только с витрины) */}
            <div>
              <label className="block text-[#888888] mb-1.5 font-medium">Лейбл</label>
              <select
                value={selectedLabel}
                onChange={(e) => setSelectedLabel(e.target.value)}
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2.5 text-white focus:border-[#8b5cf6] focus:outline-none"
              >
                <option value="">Все лейблы</option>
                {allLabels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Страна производства (только с витрины) */}
            <div>
              <label className="block text-[#888888] mb-1.5 font-medium">Страна производства</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2.5 text-white focus:border-[#8b5cf6] focus:outline-none"
              >
                <option value="">Все страны</option>
                {allCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Состояние по Goldmine */}
            <div>
              <label className="block text-[#888888] mb-1.5 font-medium">Состояние (Goldmine)</label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2.5 text-white focus:border-[#8b5cf6] focus:outline-none"
              >
                <option value="">Любое состояние</option>
                {['M', 'NM', 'NM-', 'EX', 'VG+', 'VG', 'G+', 'G'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Тип издания */}
            <div>
              <label className="block text-[#888888] mb-1.5 font-medium">Тип издания</label>
              <select
                value={selectedReleaseType}
                onChange={(e) => setSelectedReleaseType(e.target.value)}
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2.5 text-white focus:border-[#8b5cf6] focus:outline-none"
              >
                <option value="">Все типы</option>
                <option value="Оригинал">Оригинал</option>
                <option value="Переиздание">Переиздание</option>
              </select>
            </div>

            {/* Диапазон цен (от / до) */}
            <div>
              <label className="block text-[#888888] mb-1.5 font-medium">Цена (₽)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="От ₽"
                  className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white placeholder-[#555555] focus:border-[#8b5cf6] focus:outline-none"
                />
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="До ₽"
                  className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white placeholder-[#555555] focus:border-[#8b5cf6] focus:outline-none"
                />
              </div>
            </div>

            {/* Диапазон года (от / до) */}
            <div>
              <label className="block text-[#888888] mb-1.5 font-medium">Год выпуска</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  placeholder="От"
                  className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white placeholder-[#555555] focus:border-[#8b5cf6] focus:outline-none"
                />
                <input
                  type="number"
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  placeholder="До"
                  className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white placeholder-[#555555] focus:border-[#8b5cf6] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Счетчик и активные бейджи */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#888888]">
            Найдено: <strong className="text-white">{filteredItems.length}</strong> из {items.length} в наличии
          </span>
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
          {selectedCountry && (
            <span className="bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-[#c084fc] px-2.5 py-1 rounded-lg">
              Страна: {selectedCountry}
            </span>
          )}
          {selectedCondition && (
            <span className="bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-[#c084fc] px-2.5 py-1 rounded-lg">
              Состояние: {selectedCondition}
            </span>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <button
            onClick={resetAllFilters}
            className="text-xs text-[#888888] hover:text-white underline ml-auto"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {/* Сетка пластинок витрины */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 rounded-full vinyl-grooves spin-vinyl mx-auto" />
          <p className="text-xs font-mono text-white font-bold">Загрузка каталога витрины...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-[#111111] border border-[#222222] rounded-3xl p-8">
          <Disc3 className="w-12 h-12 text-[#444444] mx-auto" />
          <h3 className="font-bold text-white text-base">Ничего не найдено</h3>
          <p className="text-xs text-[#888888] font-mono">
            {activeFiltersCount > 0
              ? 'Попробуйте изменить выбранные параметры фильтрации.'
              : 'В данный момент витрина обновляется.'}
          </p>
          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 bg-white text-black font-mono font-semibold text-xs rounded-xl"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {displayedSlice.map((item) => {
              const cover = item.photos[0] || item.release.default_cover_url;
              const artistNames = (item.release?.artists || []).map((a) => a.name).join(', ') || 'Разные исполнители';
              const artistCountry = resolveArtistCountry(artistNames, item.release.discogs_notes);
              const releaseCountry = item.release.country || 'Импорт';

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
                          decoding="async"
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

                    <div className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#737373]">
                        <span className="truncate max-w-[140px]">
                          {item.release.label ? item.release.label : 'Лейбл'}
                          {item.release.year ? ` • ${item.release.year}` : ''}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#8b5cf6] border border-[#2a2a2a] text-[10px]">
                          {item.release_type || 'Оригинал'}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white uppercase group-hover:text-[#8b5cf6] transition-colors leading-snug truncate">
                        {artistNames}
                      </h3>
                      <p className="text-xs text-[#a3a3a3] truncate">{item.release.title}</p>

                      {/* Страна релиза (где сделана) и страна авторов */}
                      <div className="pt-2 space-y-1 text-[11px] font-mono border-t border-[#1a1a1a]">
                        <div className="flex items-center justify-between text-[#888888]">
                          <span>Сделано в:</span>
                          <span className="text-white font-medium truncate max-w-[145px]">{releaseCountry}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#888888]">
                          <span>Страна авторов:</span>
                          <span className="text-[#c084fc] font-medium truncate max-w-[145px]">{artistCountry}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-2.5 border-t border-[#1a1a1a] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-[#737373] block">Стоимость:</span>
                      <span className="text-sm font-semibold font-mono text-white">
                        {item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : 'Цена по запросу'}
                      </span>
                    </div>

                    <Link
                      to={`/record/${item.id}`}
                      onClick={() => haptic.light()}
                      className="px-3.5 py-1.5 font-mono text-xs rounded-xl transition border bg-[#1a1a1a] hover:bg-[#8b5cf6] text-[#d4d4d4] hover:text-white border-[#2c2c2c] hover:border-[#8b5cf6]"
                    >
                      Подробнее
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

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
