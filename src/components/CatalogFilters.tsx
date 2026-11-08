import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

export interface FilterState {
  search: string;
  condition: string;
  sortBy: 'newest' | 'price_asc' | 'price_desc' | 'year_desc';
}

interface Props {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  totalCount: number;
}

const GRADES = ['ALL', 'M', 'NM', 'VG+', 'VG', 'G+', 'G'];

export const CatalogFilters: React.FC<Props> = ({ filters, onChange, totalCount }) => {
  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 mb-5 space-y-3">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Строка поиска */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Поиск по артисту, названию альбома, лейблу..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Выпадающий список сортировки */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-zinc-400 shrink-0 hidden sm:block" />
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value as FilterState['sortBy'] })}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 w-full md:w-auto"
          >
            <option value="newest">Сначала новые</option>
            <option value="price_asc">Сначала дешевле</option>
            <option value="price_desc">Сначала дороже</option>
            <option value="year_desc">По году релиза</option>
          </select>
        </div>
      </div>

      {/* Кнопки фильтра по состоянию пластинки */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs text-zinc-400 mr-1">Состояние:</span>
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onChange({ ...filters, condition: g })}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filters.condition === g
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {g === 'ALL' ? 'Все' : g}
            </button>
          ))}
        </div>

        <span className="text-xs text-zinc-400 ml-auto">
          Найдено: <strong className="text-white">{totalCount}</strong>
        </span>
      </div>
    </div>
  );
};
