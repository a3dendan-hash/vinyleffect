import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Edit3,
  Disc3,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
  ExternalLink,
  Send,
  Eye,
  Trash2,
  ChevronDown,
  Sparkles,
  RotateCcw,
  LayoutGrid,
  List,
} from 'lucide-react';
import { supabase, ITEM_CATALOG_SELECT } from '../lib/supabase';
import { VinylItem, ItemStatus, mapSupabaseItem } from '../types/database';
import { DiscogsImporter } from '../components/admin/DiscogsImporter';
import { ItemEditorModal } from '../components/admin/ItemEditorModal';
import { haptic } from '../lib/telegram';
import { DISCOGS_GENRES, DISCOGS_STYLES, DISCOGS_TOKEN } from '../lib/discogs';
import { resolveArtistCountry } from '../lib/artistCountry';

const CLIENT_ADMIN_BATCH = 80;

// Компонент обложки с мгновенной автоматической подгрузкой из Discogs API
const DraftCover: React.FC<{
  item: VinylItem;
  className?: string;
}> = ({ item, className = '' }) => {
  const discogsId = item.release?.discogs_release_id;
  const initialCover =
    item.photos?.[0] ||
    item.release?.default_cover_url ||
    item.release?.cover_url ||
    (discogsId ? localStorage.getItem(`vp_cover_${discogsId}`) : null);

  const [coverUrl, setCoverUrl] = useState<string | null>(initialCover);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (coverUrl) return;
    if (!discogsId) return;

    const cached = localStorage.getItem(`vp_cover_${discogsId}`);
    if (cached) {
      setCoverUrl(cached);
      return;
    }

    let isCancelled = false;
    const fetchCover = async () => {
      try {
        setLoading(true);
        const res = await fetch(`https://api.discogs.com/releases/${discogsId}`, {
          headers: {
            Authorization: `Discogs token=${DISCOGS_TOKEN}`,
            'User-Agent': 'VinylPeterDashboard/1.0 (+https://t.me/vinyleffect)',
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        const img = data.images?.[0]?.uri;
        if (img && !isCancelled) {
          try {
            localStorage.setItem(`vp_cover_${discogsId}`, img);
          } catch {}
          setCoverUrl(img);

          // Обновляем в Supabase в фоне, чтобы обложка сохранилась навсегда
          supabase
            .from('releases')
            .update({
              default_cover_url: img,
              cover_url: img,
              discogs_photos: (data.images || []).map((x: any) => x.uri).filter(Boolean),
            })
            .eq('id', item.release.id)
            .then(() => {});

          supabase
            .from('items')
            .update({ photos: [img] })
            .eq('id', item.id)
            .then(() => {});
        }
      } catch {
        // silent fail
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchCover();

    return () => {
      isCancelled = true;
    };
  }, [discogsId, item.id, item.release?.id, coverUrl]);

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={item.release.title}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${className}`}
      />
    );
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-[#0d0d0d] text-zinc-600 ${className}`}>
      {loading ? (
        <Loader2 className="w-5 h-5 text-[#8b5cf6] animate-spin" />
      ) : (
        <Disc3 className="w-6 h-6 text-zinc-700 animate-pulse" />
      )}
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const [items, setItems] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ItemStatus>('draft');
  const [editingItem, setEditingItem] = useState<VinylItem | null>(null);
  const [displayCount, setDisplayCount] = useState(CLIENT_ADMIN_BATCH);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [counts, setCounts] = useState<{ draft: number; active: number; sold: number }>({
    draft: 0,
    active: 0,
    sold: 0,
  });

  // Состояния фильтрации админки
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [selectedReleaseType, setSelectedReleaseType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [priceTypeFilter, setPriceTypeFilter] = useState<'all' | 'with_price' | 'no_price'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'title_asc'>('newest');

  const fetchCounts = async () => {
    try {
      const [d, a, s] = await Promise.all([
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
      ]);
      setCounts({
        draft: d.count || 0,
        active: a.count || 0,
        sold: s.count || 0,
      });
    } catch (e) {
      console.warn('Count fetch error:', e);
    }
  };

  const fetchAllAdminItems = async () => {
    setLoading(true);
    try {
      const ranges = ['0-999', '1000-1999', '2000-2999', '3000-3999'];
      const chunkPromises = ranges.map(async (r) => {
        const [from, to] = r.split('-').map(Number);
        const { data, error } = await supabase
          .from('items')
          .select(ITEM_CATALOG_SELECT)
          .eq('status', statusFilter)
          .range(from, to)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn(`Error loading admin chunk ${r}:`, error);
          return [];
        }
        return data || [];
      });

      const chunks = await Promise.all(chunkPromises);
      const combined = chunks.flat();
      const mapped = combined.map(mapSupabaseItem);
      setItems(mapped);
      setDisplayCount(CLIENT_ADMIN_BATCH);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    fetchAllAdminItems();
  }, [statusFilter]);

  const handleQuickStatusChange = async (itemId: string, newStatus: ItemStatus) => {
    haptic.selection();
    const { error } = await supabase.from('items').update({ status: newStatus }).eq('id', itemId);
    if (!error) {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      fetchCounts();
    }
  };

  const handlePublishWithPrice = async (item: VinylItem, newPrice: number) => {
    haptic.success();
    const { error } = await supabase
      .from('items')
      .update({ status: 'active', price: newPrice })
      .eq('id', item.id);

    if (!error) {
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      fetchCounts();
    }
  };

  const handleDeleteItem = async (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Удалить эту пластинку из базы?')) return;
    haptic.medium();
    const { error } = await supabase.from('items').delete().eq('id', itemId);
    if (!error) {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      fetchCounts();
    } else {
      alert('Ошибка при удалении: ' + error.message);
    }
  };

  // Списки для выпадающих фильтров
  const allGenres = useMemo(() => {
    const fromItems = items.flatMap((i) => i.release.genre).filter(Boolean);
    return Array.from(new Set(fromItems)).sort();
  }, [items]);

  const allStyles = useMemo(() => {
    const fromItems = items.flatMap((i) => i.release.style).filter(Boolean);
    return Array.from(new Set(fromItems)).sort();
  }, [items]);

  const allLabels = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.release.label))).filter(Boolean).sort() as string[];
  }, [items]);

  // Список стран: объединяем страну релиза и страну авторов, добавляя пресеты
  const allCountries = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.release?.country) set.add(item.release.country);
      const artistsStr = (item.release?.artists || []).map((a) => a.name).join(', ');
      const ac = resolveArtistCountry(artistsStr, item.release?.discogs_notes);
      if (ac && ac !== 'Импорт' && ac !== 'Международный') {
        set.add(ac);
      }
    });

    ['СССР / Россия', 'Великобритания (UK)', 'США (USA)', 'Германия (Germany)', 'Франция (France)', 'Италия (Italy)', 'Швеция (Sweden)'].forEach((c) => set.add(c));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Фильтрация и поиск по всей базе черновиков
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const queryWords = q ? q.split(/\s+/).filter(Boolean) : [];

    const list = items.filter((item) => {
      // 1. Полнотекстовый поиск по словам (артист, название, лейбл, номер, код Discogs, страна)
      if (queryWords.length > 0) {
        const artistsStr = (item.release?.artists || []).map((a) => a.name).join(' ');
        const artistCountry = resolveArtistCountry(artistsStr, item.release?.discogs_notes);
        const searchable = [
          item.release?.title,
          artistsStr,
          item.release?.label,
          item.release?.catno,
          item.release?.country,
          artistCountry,
          item.release?.discogs_release_id,
          item.extra_info,
          item.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const allMatched = queryWords.every((word) => searchable.includes(word));
        if (!allMatched) return false;
      }

      // 2. Фильтр по жанру
      if (selectedGenre && !item.release.genre.includes(selectedGenre)) return false;

      // 3. Фильтр по стилю
      if (selectedStyle && !item.release.style.includes(selectedStyle)) return false;

      // 4. Фильтр по лейблу
      if (selectedLabel && item.release.label !== selectedLabel) return false;

      // 5. Фильтр по стране (проверяем и страну производства, и страну авторов)
      if (selectedCountry) {
        const artistsStr = (item.release?.artists || []).map((a) => a.name).join(' ');
        const artistCountry = resolveArtistCountry(artistsStr, item.release?.discogs_notes).toLowerCase();
        const releaseCountry = (item.release?.country || '').toLowerCase();
        const sel = selectedCountry.toLowerCase();

        const matchRelease = releaseCountry.includes(sel);
        const matchArtist = artistCountry.includes(sel);
        const isSovietMatch =
          (sel.includes('ссср') || sel.includes('russia') || sel.includes('росс') || sel.includes('ussr')) &&
          (artistCountry.includes('ссср') || artistCountry.includes('росс') || releaseCountry.includes('russia') || releaseCountry.includes('ussr'));
        const isUkMatch =
          (sel.includes('uk') || sel.includes('великобрит')) &&
          (artistCountry.includes('uk') || artistCountry.includes('великобрит') || releaseCountry.includes('uk'));
        const isUsMatch =
          (sel.includes('usa') || sel.includes('сша')) &&
          (artistCountry.includes('usa') || artistCountry.includes('сша') || releaseCountry.includes('us'));

        if (!matchRelease && !matchArtist && !isSovietMatch && !isUkMatch && !isUsMatch) {
          return false;
        }
      }

      // 6. Фильтр по состоянию
      if (selectedCondition && item.condition_media !== selectedCondition) return false;

      // 7. Фильтр по типу издания
      if (selectedReleaseType && item.release_type !== selectedReleaseType) return false;

      // 8. Фильтр по цене
      if (minPrice && item.price < Number(minPrice)) return false;
      if (maxPrice && item.price > Number(maxPrice)) return false;

      // 9. Фильтр по годам
      if (yearFrom && (item.release.year || 0) < Number(yearFrom)) return false;
      if (yearTo && (item.release.year || 0) > Number(yearTo)) return false;

      // 10. Фильтр по типу цены
      if (priceTypeFilter === 'with_price' && item.price <= 0) return false;
      if (priceTypeFilter === 'no_price' && item.price > 0) return false;

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'title_asc') return (a.release?.title || '').localeCompare(b.release?.title || '');
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
    priceTypeFilter,
    sortBy,
  ]);

  const displayedSlice = useMemo(() => {
    return filtered.slice(0, displayCount);
  }, [filtered, displayCount]);

  const loadMoreAdminSlice = () => {
    haptic.light();
    setDisplayCount((prev) => Math.min(prev + CLIENT_ADMIN_BATCH, filtered.length));
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
    setPriceTypeFilter('all');
    setSortBy('newest');
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
    priceTypeFilter !== 'all' ? priceTypeFilter : '',
  ].filter(Boolean).length;

  return (
    <div className="pb-24 w-full">
      {/* Модуль загрузки Wantlist CSV из Discogs */}
      <DiscogsImporter
        onImportComplete={() => {
          fetchCounts();
          fetchAllAdminItems();
        }}
      />

      {/* Переключатель вкладок по статусу (Черновики / Витрина / Продано) */}
      <div className="grid grid-cols-3 gap-2 bg-[#111111] p-1.5 rounded-2xl border border-[#222222] mb-5 font-mono text-xs">
        {(['draft', 'active', 'sold'] as ItemStatus[]).map((st) => (
          <button
            key={st}
            onClick={() => {
              haptic.selection();
              setStatusFilter(st);
            }}
            className={`py-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
              statusFilter === st
                ? 'bg-[#8b5cf6] text-white shadow-lg shadow-[#8b5cf6]/20'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            {st === 'draft' && `Черновики (${counts.draft})`}
            {st === 'active' && `Витрина (${counts.active})`}
            {st === 'sold' && `Продано (${counts.sold})`}
          </button>
        ))}
      </div>

      {/* Поиск, вид сетки и панель «Фильтры» */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 mb-5 space-y-3 font-mono text-xs shadow-md">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Поиск по всем ${items.length} ${statusFilter === 'draft' ? 'черновикам' : 'пластинкам'} по артисту, названию, коду...`}
              className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl pl-10 pr-9 py-2 text-white placeholder-[#666666] focus:border-[#8b5cf6] focus:outline-none"
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

          <div className="flex items-center gap-2">
            {/* Переключатель режима отображения: Сетка vs Список */}
            <div className="flex items-center bg-[#171717] p-1 rounded-xl border border-[#2a2a2a]">
              <button
                onClick={() => {
                  haptic.light();
                  setViewMode('grid');
                }}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid'
                    ? 'bg-[#8b5cf6] text-white shadow'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Сетка (для полноэкранного режима)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  haptic.light();
                  setViewMode('list');
                }}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'list'
                    ? 'bg-[#8b5cf6] text-white shadow'
                    : 'text-[#888888] hover:text-white'
                }`}
                title="Список"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8b5cf6]"
            >
              <option value="newest">Сначала новые</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
              <option value="title_asc">По названию (А-Я)</option>
            </select>

            <button
              onClick={() => {
                haptic.light();
                setShowFilters((prev) => !prev);
              }}
              className={`px-4 py-2 rounded-xl border flex items-center gap-1.5 transition ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                  : 'bg-[#171717] text-[#a3a3a3] border-[#2a2a2a] hover:text-white'
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

        {/* Раскрывающаяся панель фильтров админки */}
        {showFilters && (
          <div className="bg-[#141414] border border-[#282828] rounded-2xl p-4 mt-3 space-y-3 pt-3">
            <div className="flex items-center justify-between border-b border-[#222222] pb-2">
              <span className="font-bold text-white uppercase text-[11px]">Фильтры раздела ({statusFilter})</span>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="text-xs text-[#888888] hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Сбросить всё ({activeFiltersCount})</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[#888888] mb-1">Страна (производство и авторы)</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 text-white"
                >
                  <option value="">Все страны</option>
                  {allCountries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {allGenres.length > 0 && (
                <div>
                  <label className="block text-[#888888] mb-1">Жанр</label>
                  <select
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 text-white"
                  >
                    <option value="">Все жанры</option>
                    {allGenres.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {allStyles.length > 0 && (
                <div>
                  <label className="block text-[#888888] mb-1">Стиль</label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 text-white"
                  >
                    <option value="">Все стили</option>
                    {allStyles.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[#888888] mb-1">Лейбл</label>
                <select
                  value={selectedLabel}
                  onChange={(e) => setSelectedLabel(e.target.value)}
                  className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 text-white"
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
                <label className="block text-[#888888] mb-1">Состояние (Goldmine)</label>
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                  className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 text-white"
                >
                  <option value="">Любое состояние</option>
                  {['M', 'NM', 'NM-', 'EX', 'VG+', 'VG', 'G+', 'G'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#888888] mb-1">Тип издания</label>
                <select
                  value={selectedReleaseType}
                  onChange={(e) => setSelectedReleaseType(e.target.value)}
                  className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 text-white"
                >
                  <option value="">Все типы</option>
                  <option value="Оригинал">Оригинал</option>
                  <option value="Переиздание">Переиздание</option>
                </select>
              </div>

              <div>
                <label className="block text-[#888888] mb-1">Тип цены</label>
                <select
                  value={priceTypeFilter}
                  onChange={(e) => setPriceTypeFilter(e.target.value as any)}
                  className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 text-white"
                >
                  <option value="all">Все цены</option>
                  <option value="with_price">С указанной ценой (&gt;0 ₽)</option>
                  <option value="no_price">Без цены (0 ₽)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#888888] mb-1">Цена от (₽)</label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="От ₽"
                  className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-[#888888] mb-1">Цена до (₽)</label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="До ₽"
                  className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          </div>
        )}

        <div className="text-[11px] text-[#737373] flex items-center justify-between">
          <span>
            Показано <strong className="text-white">{filtered.length}</strong> из {items.length} (активный фильтр)
          </span>
          <span className="text-[#8b5cf6]">Кликните на карточку для открытия полного редактора</span>
        </div>
      </div>

      {/* Список / Сетка пластинок текущей вкладки */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#8b5cf6] animate-spin mx-auto" />
          <p className="text-xs font-mono text-[#888888]">Загрузка базы пластинок...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center space-y-2 bg-[#111111] border border-[#222222] rounded-3xl p-8 font-mono">
          <Disc3 className="w-10 h-10 text-[#444444] mx-auto" />
          <h4 className="text-white text-sm font-bold">Ничего не найдено</h4>
          <p className="text-xs text-[#737373]">
            {statusFilter === 'draft'
              ? 'Черновики не соответствуют параметрам поиска или фильтрации.'
              : 'Перенесите пластинки из черновиков на витрину.'}
          </p>
          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="mt-3 px-4 py-2 bg-white text-black font-semibold rounded-xl text-xs"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* РЕЖИМ СЕТКИ: МАКСИМАЛЬНОЕ КОЛИЧЕСТВО НА ПОЛНОМ ЭКРАНЕ (2-8 колонок) */
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-3 sm:gap-4">
            {displayedSlice.map((item) => {
              const artistNames = (item.release?.artists || []).map((a) => a.name).join(', ') || 'Разные исполнители';
              const artistCountry = resolveArtistCountry(artistNames, item.release.discogs_notes);
              const releaseCountry = item.release.country || 'Импорт';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    haptic.light();
                    setEditingItem(item);
                  }}
                  className="bg-[#111111] border border-[#222222] hover:border-[#8b5cf6] rounded-2xl overflow-hidden flex flex-col justify-between transition-all shadow-md cursor-pointer group hover:bg-[#151515] relative"
                >
                  <div>
                    {/* Обложка с мгновенной авто-подгрузкой */}
                    <div className="relative aspect-square w-full bg-black border-b border-[#222222] overflow-hidden">
                      <DraftCover item={item} />

                      {/* Бейджи состояния и типа издания */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-black/85 backdrop-blur-sm border border-[#333333] text-white rounded">
                          {item.condition_media || 'NM-'} • {item.release_type || 'Оригинал'}
                        </span>
                      </div>

                      {/* ВСЕГДА ВИДИМЫЕ ПЛАВАЮЩИЕ КНОПКИ РЕДАКТИРОВАНИЯ И УДАЛЕНИЯ В ВЕРХНЕМ ПРАВОМ УГЛУ */}
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic.light();
                            setEditingItem(item);
                          }}
                          className="p-1.5 bg-black/90 hover:bg-[#8b5cf6] text-white rounded-lg border border-white/20 transition shadow-lg"
                          title="Редактировать карточку"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id, e);
                          }}
                          className="p-1.5 bg-black/90 hover:bg-red-600 text-red-400 hover:text-white rounded-lg border border-white/20 transition shadow-lg"
                          title="Удалить пластинку"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {item.important_details?.includes('Цветной') && (
                        <div className="absolute bottom-2 right-2 z-10">
                          <span className="text-[9px] font-mono px-1.5 py-0.5 bg-purple-950/90 text-purple-200 border border-purple-700 rounded flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            Цветной
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Метаданные релиза */}
                    <div className="p-3 space-y-1 font-mono">
                      <div className="flex items-center justify-between text-[10px] text-[#737373]">
                        <span className="truncate max-w-[100px]">{item.release.label || 'Лейбл'}</span>
                        <span>{item.release.year || ''}</span>
                      </div>

                      <h4 className="text-xs font-bold text-white uppercase truncate group-hover:text-[#8b5cf6] transition">
                        {artistNames}
                      </h4>
                      <p className="text-[11px] text-[#aaaaaa] truncate">{item.release.title}</p>

                      {/* Страны: Производство и Авторы */}
                      <div className="pt-1.5 space-y-0.5 text-[10px] border-t border-[#1c1c1c]">
                        <div className="flex items-center justify-between text-[#737373]">
                          <span>Сделано:</span>
                          <span className="text-white font-medium truncate max-w-[95px]">{releaseCountry}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#737373]">
                          <span>Авторы:</span>
                          <span className="text-[#c084fc] font-medium truncate max-w-[95px]">{artistCountry}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Нижний бар: цена и действия (никогда не обрезаются) */}
                  <div
                    className="p-3 pt-2 border-t border-[#1a1a1a] flex flex-col gap-2 font-mono"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[#737373]">Цена:</span>
                      <span className="text-xs font-bold text-white">
                        {item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : '0 ₽'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 w-full">
                      {statusFilter === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const p = prompt('Укажите цену для публикации на витрину (₽):', String(item.price || 4900));
                            if (p !== null) {
                              const num = parseInt(p, 10);
                              if (!isNaN(num)) {
                                handlePublishWithPrice(item, num);
                              }
                            }
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-[#8b5cf6] text-black hover:text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 shadow min-w-0"
                          title="Опубликовать в каталог"
                        >
                          <Send className="w-3 h-3 shrink-0" />
                          <span className="truncate">В каталог</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(item.id, 'draft')}
                          className="flex-1 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-[#888888] hover:text-white border border-[#2a2a2a] rounded-xl text-[11px] transition text-center min-w-0"
                        >
                          В черновики
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-white border border-[#2a2a2a] rounded-xl transition shrink-0"
                        title="Редактировать"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="p-1.5 bg-[#1a1a1a] hover:bg-red-950 text-red-400 hover:text-red-300 border border-[#2a2a2a] rounded-xl transition shrink-0"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {displayedSlice.length < filtered.length && (
            <div className="pt-4 text-center">
              <button
                onClick={loadMoreAdminSlice}
                className="px-8 py-3.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-2xl font-mono text-xs text-[#a3a3a3] hover:text-white transition inline-flex items-center gap-2 shadow-lg"
              >
                <ChevronDown className="w-4 h-4 text-[#8b5cf6]" />
                <span>
                  Показать еще {Math.min(CLIENT_ADMIN_BATCH, filtered.length - displayedSlice.length)} (показано {displayedSlice.length} из {filtered.length})
                </span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* РЕЖИМ СПИСКА (ПОСТРОЧНО) */
        <div className="space-y-3">
          {displayedSlice.map((item) => {
            const artistNames = (item.release?.artists || []).map((a) => a.name).join(', ') || 'Разные исполнители';
            const artistCountry = resolveArtistCountry(artistNames, item.release.discogs_notes);
            const releaseCountry = item.release.country || 'Импорт';

            return (
              <div
                key={item.id}
                onClick={() => {
                  haptic.light();
                  setEditingItem(item);
                }}
                className="bg-[#111111] border border-[#222222] hover:border-[#8b5cf6] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition shadow-md cursor-pointer group hover:bg-[#161616]"
              >
                {/* Превью и метаданные */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-16 h-16 rounded-xl bg-black border border-[#262626] overflow-hidden shrink-0 flex items-center justify-center">
                    <DraftCover item={item} />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#8b5cf6] font-mono truncate">
                        {artistNames}
                      </span>
                      {item.release.year && (
                        <span className="text-[10px] font-mono text-[#888888]">({item.release.year})</span>
                      )}
                      {item.release_type && (
                        <span className="text-[9px] font-mono bg-[#1f1f1f] border border-[#2f2f2f] text-[#aaaaaa] px-1.5 py-0.2 rounded">
                          {item.release_type}
                        </span>
                      )}
                      {item.important_details?.includes('Цветной') && (
                        <span className="text-[9px] font-mono bg-purple-950/70 border border-purple-800/60 text-[#c084fc] px-1.5 py-0.2 rounded flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          Цветной
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-white truncate group-hover:text-[#8b5cf6] transition">
                      {item.release.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#888888]">
                      <span>Конверт: <strong className="text-white">{item.condition_sleeve || 'NM'}</strong></span>
                      <span>•</span>
                      <span>Винил: <strong className="text-[#8b5cf6]">{item.condition_media || 'NM-'}</strong></span>
                      {item.release.label && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{item.release.label}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Сделано: {releaseCountry}</span>
                      <span>•</span>
                      <span className="text-[#c084fc]">
                        Авторы: {artistCountry}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 pt-0.5" onClick={(e) => e.stopPropagation()}>
                      {item.release.discogs_release_id && (
                        <a
                          href={item.release.discogs_uri || `https://www.discogs.com/release/${item.release.discogs_release_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-[#8b5cf6] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Discogs #{item.release.discogs_release_id}</span>
                        </a>
                      )}

                      <Link
                        to={`/record/${item.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-[#737373] hover:text-white transition"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Открыть карточку</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Цена и действия админа */}
                <div
                  className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#222222]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-left sm:text-right font-mono">
                    <span className="text-[10px] text-[#737373] block">Цена витрины</span>
                    <span className="text-sm font-bold text-white">
                      {item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : 'Не задана (0 ₽)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {statusFilter === 'draft' && (
                      <button
                        onClick={() => {
                          const p = prompt('Укажите цену для публикации в каталог (₽):', String(item.price || 4900));
                          if (p !== null) {
                            const num = parseInt(p, 10);
                            if (!isNaN(num)) {
                              handlePublishWithPrice(item, num);
                            }
                          }
                        }}
                        className="px-3 py-2 bg-white hover:bg-[#8b5cf6] text-black hover:text-white font-mono font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow"
                        title="Опубликовать в каталог"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">В каталог</span>
                      </button>
                    )}

                    {statusFilter === 'active' && (
                      <button
                        onClick={() => handleQuickStatusChange(item.id, 'draft')}
                        className="px-2.5 py-2 bg-[#171717] hover:bg-[#252525] text-[#888888] hover:text-white border border-[#2a2a2a] text-xs font-mono rounded-xl transition"
                        title="Вернуть в черновики"
                      >
                        В черновики
                      </button>
                    )}

                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-2 bg-[#171717] hover:bg-[#252525] text-white border border-[#2a2a2a] rounded-xl transition"
                      title="Редактировать карточку"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => handleDeleteItem(item.id, e)}
                      className="p-2 bg-[#171717] hover:bg-red-900/40 text-[#666666] hover:text-red-400 border border-[#2a2a2a] rounded-xl transition"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {displayedSlice.length < filtered.length && (
            <div className="pt-4 text-center">
              <button
                onClick={loadMoreAdminSlice}
                className="px-8 py-3.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] rounded-2xl font-mono text-xs text-[#a3a3a3] hover:text-white transition inline-flex items-center gap-2 shadow-lg"
              >
                <ChevronDown className="w-4 h-4 text-[#8b5cf6]" />
                <span>
                  Показать еще {Math.min(CLIENT_ADMIN_BATCH, filtered.length - displayedSlice.length)} (показано {displayedSlice.length} из {filtered.length})
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно полного редактирования карточки пластинки */}
      {editingItem && (
        <ItemEditorModal
          item={editingItem}
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            fetchCounts();
            fetchAllAdminItems();
          }}
        />
      )}
    </div>
  );
};
