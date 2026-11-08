import React, { useEffect, useMemo, useState } from 'react';
import {
  Edit3,
  Disc3,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
  ExternalLink,
  Check,
  Send,
  Eye,
  Trash2,
  Tag,
  Sparkles,
} from 'lucide-react';
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

  // Состояния фильтров для админки
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

  const handlePublishWithPrice = async (item: VinylItem, newPrice: number) => {
    haptic.success();
    const { error } = await supabase
      .from('items')
      .update({ status: 'active', price: newPrice })
      .eq('id', item.id);

    if (!error) {
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'active', price: newPrice } : it))
      );
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Удалить эту пластинку из базы?')) return;
    haptic.medium();
    const { error } = await supabase.from('items').delete().eq('id', itemId);
    if (!error) {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
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
        const titleMatch = (item.release?.title || '').toLowerCase().includes(q);
        const artistMatch = (item.release?.artists || []).some((a) => a.name.toLowerCase().includes(q));
        const labelMatch = (item.release?.label || '').toLowerCase().includes(q);
        const catnoMatch = (item.release?.catno || '').toLowerCase().includes(q);
        if (!titleMatch && !artistMatch && !labelMatch && !catnoMatch) return false;
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
    <div className="pb-24 max-w-7xl mx-auto">
      {/* Модуль загрузки Wantlist CSV из Discogs */}
      <DiscogsImporter onImportComplete={fetchAdminItems} />

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

      {/* Поиск и фильтры админки */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 mb-5 space-y-3 font-mono text-xs">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по артисту, названию, каталожному номеру..."
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8b5cf6]"
            >
              <option value="">Любое состояние</option>
              {['M', 'NM', 'EX', 'VG+', 'VG', 'G+', 'G'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as any)}
              className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8b5cf6]"
            >
              <option value="all">Все цены</option>
              <option value="with_price">С ценой (&gt;0 ₽)</option>
              <option value="no_price">Без цены (0 ₽)</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="col-span-2 sm:col-span-1 bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8b5cf6]"
            >
              <option value="newest">Сначала новые</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
              <option value="title_asc">По названию (А-Я)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Список пластинок текущей вкладки */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#8b5cf6] animate-spin mx-auto" />
          <p className="text-xs font-mono text-[#888888]">Загрузка базы данных...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center space-y-2 bg-[#111111] border border-[#222222] rounded-3xl p-8 font-mono">
          <Disc3 className="w-10 h-10 text-[#444444] mx-auto" />
          <h4 className="text-white text-sm font-bold">В этой вкладке ничего нет</h4>
          <p className="text-xs text-[#737373]">
            {statusFilter === 'draft'
              ? 'Загрузите wantlist.csv чтобы наполнить черновики.'
              : 'Перенесите пластинки из черновиков на витрину.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const cover = item.photos[0] || item.release.default_cover_url;

            return (
              <div
                key={item.id}
                className="bg-[#111111] border border-[#222222] hover:border-[#333333] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition shadow-md"
              >
                {/* Превью и метаданные */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-16 h-16 rounded-xl bg-black border border-[#262626] overflow-hidden shrink-0 flex items-center justify-center">
                    {cover ? (
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Disc3 className="w-8 h-8 text-[#444444]" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#8b5cf6] font-mono truncate">
                        {(item.release?.artists || []).map((a) => a.name).join(', ') || 'Разные исполнители'}
                      </span>
                      {item.release.year && (
                        <span className="text-[10px] font-mono text-[#888888]">({item.release.year})</span>
                      )}
                      {item.release_type && (
                        <span className="text-[9px] font-mono bg-[#1f1f1f] border border-[#2f2f2f] text-[#aaaaaa] px-1.5 py-0.2 rounded">
                          {item.release_type}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-white truncate">{item.release.title}</h4>

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
                      {item.release.country && (
                        <>
                          <span>•</span>
                          <span>{item.release.country}</span>
                        </>
                      )}
                    </div>

                    {item.release.discogs_uri && (
                      <a
                        href={item.release.discogs_uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-[#8b5cf6] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Discogs #{item.release.discogs_release_id || 'ID'}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Цена и действия админа */}
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#222222]">
                  <div className="text-left sm:text-right font-mono">
                    <span className="text-[10px] text-[#737373] block">Цена витрины</span>
                    <span className="text-sm font-bold text-white">
                      {item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : 'Не задана (0 ₽)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Кнопка "Опубликовать в каталог" для черновика */}
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
                      onClick={() => handleDeleteItem(item.id)}
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
            fetchAdminItems();
          }}
        />
      )}
    </div>
  );
};
