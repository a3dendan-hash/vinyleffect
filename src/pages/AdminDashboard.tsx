import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Disc3, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { supabase, ITEM_WITH_GRAPH_SELECT } from '../lib/supabase';
import { VinylItem, ItemStatus, mapSupabaseItem } from '../types/database';
import { DiscogsImporter } from '../components/admin/DiscogsImporter';
import { ItemEditorModal } from '../components/admin/ItemEditorModal';
import { haptic } from '../lib/telegram';

export const AdminDashboard: React.FC = () => {
  const [items, setItems] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ItemStatus>('draft');
  const [editingItem, setEditingItem] = useState<VinylItem | null>(null);

  // Состояния фильтров для админки (работают во всех вкладках)
  const [query, setQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState<'all' | 'with_price' | 'no_price'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'title_asc'>('newest');

  const fetchAdminItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('items')
      .select(ITEM_WITH_GRAPH_SELECT)
      .range(0, 4999)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data.map(mapSupabaseItem));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAdminItems();
  }, []);

  const handleQuickStatusChange = async (itemId: string, newStatus: ItemStatus) => {
    haptic.selection();
    const { error } = await supabase.from('items').update({ status: newStatus }).eq('id', itemId);
    if (!error) {
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: newStatus } : it)));
    }
  };

  const counts = {
    draft: items.filter((i) => i.status === 'draft').length,
    active: items.filter((i) => i.status === 'active').length,
    sold: items.filter((i) => i.status === 'sold').length,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = items.filter((item) => {
      if (item.status !== statusFilter) return false;

      if (q) {
        const titleMatch = item.release.title.toLowerCase().includes(q);
        const artistMatch = item.release.artists.some((a) => a.name.toLowerCase().includes(q));
        const labelMatch = (item.release.label || '').toLowerCase().includes(q);
        if (!titleMatch && !artistMatch && !labelMatch) return false;
      }

      if (conditionFilter && item.condition_media !== conditionFilter) return false;
      if (priceFilter === 'with_price' && item.price <= 0) return false;
      if (priceFilter === 'no_price' && item.price > 0) return false;

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'title_asc') return a.release.title.localeCompare(b.release.title);
      return 0;
    });
  }, [items, statusFilter, query, conditionFilter, priceFilter, sortBy]);

  return (
    <div className="pb-24">
      <DiscogsImporter onImportComplete={fetchAdminItems} />

      {/* Переключатель вкладок по статусу (Без резервов) */}
      <div className="grid grid-cols-3 gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 mb-4">
        {(['draft', 'active', 'sold'] as ItemStatus[]).map((st) => (
          <button
            key={st}
            onClick={() => {
              haptic.selection();
              setStatusFilter(st);
            }}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
              statusFilter === st ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {st === 'draft' && `Черновики (${counts.draft})`}
            {st === 'active' && `Витрина (${counts.active})`}
            {st === 'sold' && `Продано (${counts.sold})`}
          </button>
        ))}
      </div>

      {/* Панель фильтров и поиска для администратора */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 mb-5 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по артисту, альбому или лейблу..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">Любое состояние</option>
              {['M', 'NM', 'VG+', 'VG', 'G+', 'G'].map((c) => (
                <option key={c} value={c}>
                  Состояние: {c}
                </option>
              ))}
            </select>

            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">Все по цене</option>
              <option value="with_price">С указанной ценой</option>
              <option value="no_price">Без цены (0 ₽)</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="col-span-2 sm:col-span-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="newest">Сначала новые</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
              <option value="title_asc">По алфавиту (А–Я)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            Найдено в разделе: <strong className="text-white">{filtered.length}</strong>
          </span>
          {(query || conditionFilter || priceFilter !== 'all') && (
            <button
              onClick={() => {
                setQuery('');
                setConditionFilter('');
                setPriceFilter('all');
              }}
              className="text-amber-400 hover:underline"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">
          По выбранным фильтрам пластинок не найдено.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => {
            const cover = item.photos[0] || item.release.default_cover_url;
            return (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex items-center gap-3 hover:border-zinc-700 transition"
              >
                <div className="w-16 h-16 rounded-xl bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {cover ? (
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc3 className="w-6 h-6 text-zinc-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-400 font-medium truncate">
                    {item.release.artists.map((a) => a.name).join(', ')}
                  </p>
                  <h4 className="text-sm font-bold text-white truncate">{item.release.title}</h4>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                    <span className={item.price > 0 ? 'text-white font-semibold' : 'text-zinc-500'}>
                      {item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : 'Без цены'}
                    </span>
                    {item.condition_media && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {item.condition_media} / {item.condition_sleeve}
                      </span>
                    )}
                  </div>
                </div>

                {/* Быстрая смена статуса и редактирование */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-black transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Оформить</span>
                  </button>

                  <select
                    value={item.status}
                    onChange={(e) => handleQuickStatusChange(item.id, e.target.value as ItemStatus)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-300"
                  >
                    <option value="draft">Черновик</option>
                    <option value="active">На витрине</option>
                    <option value="sold">Продана</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingItem && (
        <ItemEditorModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={fetchAdminItems}
        />
      )}
    </div>
  );
};
