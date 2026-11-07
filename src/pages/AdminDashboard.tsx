import React, { useEffect, useState } from 'react';
import { Edit3, Disc3, Loader2 } from 'lucide-react';
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

  const fetchAdminItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('items')
      .select(ITEM_WITH_GRAPH_SELECT)
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

  const filtered = items.filter((i) => i.status === statusFilter);

  const counts = {
    draft: items.filter((i) => i.status === 'draft').length,
    active: items.filter((i) => i.status === 'active').length,
    reserved: items.filter((i) => i.status === 'reserved').length,
    sold: items.filter((i) => i.status === 'sold').length,
  };

  return (
    <div className="pb-24">
      <DiscogsImporter onImportComplete={fetchAdminItems} />

      {/* Переключатель вкладок по статусу */}
      <div className="grid grid-cols-4 gap-1.5 bg-zinc-900 p-1 rounded-2xl border border-zinc-800 mb-4">
        {(['draft', 'active', 'reserved', 'sold'] as ItemStatus[]).map((st) => (
          <button
            key={st}
            onClick={() => {
              haptic.selection();
              setStatusFilter(st);
            }}
            className={`py-2 rounded-xl text-xs font-semibold transition ${
              statusFilter === st ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {st === 'draft' && `Черновики (${counts.draft})`}
            {st === 'active' && `Витрина (${counts.active})`}
            {st === 'reserved' && `Резерв (${counts.reserved})`}
            {st === 'sold' && `Продано (${counts.sold})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">
          В этом разделе пока нет пластинок.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const cover = item.photos[0] || item.release.default_cover_url;
            return (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex items-center gap-3"
              >
                <div className="w-14 h-14 rounded-xl bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
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
                    <span>{item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : 'Без цены'}</span>
                    {item.condition_media && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {item.condition_media} / {item.condition_sleeve}
                      </span>
                    )}
                  </div>
                </div>

                {/* Быстрая смена статуса и редактирование */}
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Оформить</span>
                  </button>

                  {item.status !== 'draft' && (
                    <select
                      value={item.status}
                      onChange={(e) => handleQuickStatusChange(item.id, e.target.value as ItemStatus)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-300"
                    >
                      <option value="active">В продаже</option>
                      <option value="reserved">В резерве</option>
                      <option value="sold">Продана</option>
                      <option value="draft">В черновик</option>
                    </select>
                  )}
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