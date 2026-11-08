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

const GRADES = ['ALL', 'M', 'NM', 'EX', 'VG+', 'VG', 'G+', 'G'];

export const CatalogFilters: React.FC<Props> = ({ filters, onChange, totalCount }) => {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 mb-5 space-y-3 font-mono text-xs">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Строка поиска */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Поиск по исполнителю, названию альбома, лейблу..."
            className="w-full bg-[#171717] border border-[#262626] rounded-xl pl-10 pr-9 py-2 text-white placeholder-[#666666] focus:outline-none focus:border-[#8b5cf6]"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Сортировка */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#888888] shrink-0 hidden sm:block" />
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value as FilterState['sortBy'] })}
            className="bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8b5cf6] w-full md:w-auto"
          >
            <option value="newest">Сначала новые</option>
            <option value="price_asc">По цене (возрастание)</option>
            <option value="price_desc">По цене (убывание)</option>
            <option value="year_desc">По году выпуска</option>
          </select>
        </div>
      </div>

      {/* Кнопки состояния Goldmine */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[#888888] mr-1">Состояние:</span>
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onChange({ ...filters, condition: g })}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filters.condition === g
                  ? 'bg-[#8b5cf6] text-white font-bold'
                  : 'bg-[#171717] text-[#888888] hover:text-white border border-[#262626]'
              }`}
            >
              {g === 'ALL' ? 'Все' : g}
            </button>
          ))}
        </div>

        <span className="text-[#888888] ml-auto">
          Найдено: <strong className="text-white">{totalCount}</strong>
        </span>
      </div>
    </div>
  );
};
