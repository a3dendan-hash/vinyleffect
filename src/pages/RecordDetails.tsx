import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Disc3,
  MapPin,
  ExternalLink,
  Sparkles,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ListMusic,
  FileText,
  Barcode,
  Loader2,
} from 'lucide-react';
import { supabase, ITEM_WITH_GRAPH_SELECT, ITEM_CATALOG_SELECT } from '../lib/supabase';
import { VinylItem, mapSupabaseItem, TrackItem } from '../types/database';
import { haptic } from '../lib/telegram';
import { DISCOGS_TOKEN } from '../lib/discogs';
import { resolveArtistCountry } from '../lib/artistCountry';

interface DiscogsApiResponse {
  id: number;
  title: string;
  artists?: Array<{ id: number; name: string }>;
  year?: number;
  released?: string;
  country?: string;
  genres?: string[];
  styles?: string[];
  labels?: Array<{ name: string; catno: string }>;
  formats?: Array<{
    name: string;
    descriptions?: string[];
    text?: string;
  }>;
  identifiers?: Array<{
    type: string;
    value: string;
    description?: string;
  }>;
  images?: Array<{ uri: string }>;
  tracklist?: Array<{
    position: string;
    title: string;
    duration: string;
  }>;
  notes?: string;
  uri?: string;
}

export const RecordDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<VinylItem | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [sameArtistItems, setSameArtistItems] = useState<VinylItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadRecord = async () => {
      if (!id) return;
      setLoading(true);
      setActivePhotoIdx(0);

      try {
        // 1. Быстрая загрузка самой карточки пластинки
        const { data, error } = await supabase
          .from('items')
          .select(ITEM_WITH_GRAPH_SELECT)
          .eq('id', id)
          .single();

        if (error || !data) {
          if (!isCancelled) setLoading(false);
          return;
        }

        const currentItem = mapSupabaseItem(data);
        if (isCancelled) return;
        setItem(currentItem);
        setLoading(false);

        // 2. Фоновое автоматическое обогащение из Discogs API если страна, треклист или описание отсутствуют
        const discogsId = currentItem.release.discogs_release_id;
        const needsDiscogsEnrich =
          discogsId &&
          (!currentItem.release.country ||
            !currentItem.release.tracklist ||
            currentItem.release.tracklist.length === 0 ||
            !currentItem.release.discogs_notes ||
            !currentItem.release.catno ||
            currentItem.photos.length <= 1);

        if (needsDiscogsEnrich) {
          enrichWithLiveDiscogs(currentItem, discogsId, isCancelled);
        }

        // 3. Быстрая асинхронная подгрузка рекомендаций
        loadRecommendations(currentItem);
      } catch (e) {
        console.error('Error loading record:', e);
        if (!isCancelled) setLoading(false);
      }
    };

    loadRecord();

    return () => {
      isCancelled = true;
    };
  }, [id]);

  const loadRecommendations = async (currentItem: VinylItem) => {
    try {
      const { data: similarData } = await supabase
        .from('items')
        .select(ITEM_CATALOG_SELECT)
        .eq('status', 'active')
        .neq('id', currentItem.id)
        .limit(10);

      if (similarData) {
        const allActive = similarData.map(mapSupabaseItem);
        const currentArtistIds = new Set((currentItem.release?.artists || []).map((a) => a.id));

        const byArtist = allActive.filter((other) =>
          (other.release?.artists || []).some((a) => currentArtistIds.has(a.id))
        );
        const fallback = allActive.filter((other) =>
          !byArtist.some((b) => b.id === other.id)
        );
        setSameArtistItems([...byArtist, ...fallback].slice(0, 6));
      }
    } catch (e) {
      console.warn('Recommendations fetch error:', e);
    }
  };

  const enrichWithLiveDiscogs = async (currentItem: VinylItem, discogsId: string, isCancelled: boolean) => {
    try {
      setEnriching(true);
      const res = await fetch(`https://api.discogs.com/releases/${discogsId}`, {
        headers: {
          'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
          'User-Agent': 'VinylPeterMarketplace/1.0 (+https://t.me/vinyleffect)',
        },
      });

      if (!res.ok) return;
      const data: DiscogsApiResponse = await res.json();
      if (isCancelled) return;

      const exactCountry = data.country || currentItem.release.country;
      const exactYear = data.year || (data.released ? parseInt(data.released, 10) : currentItem.release.year);
      const exactLabel = data.labels?.[0]?.name || currentItem.release.label;
      const exactCatNo = data.labels?.[0]?.catno || currentItem.release.catno;
      const exactNotes = data.notes || currentItem.release.discogs_notes;
      const exactTracklist: TrackItem[] = (data.tracklist || []).map((t) => ({
        position: t.position || '',
        title: t.title || '',
        duration: t.duration || '',
      }));

      const discogsPhotos = (data.images || []).map((img) => img.uri).filter(Boolean);

      const formatStr = data.formats
        ? data.formats
            .map((f) => [f.name, ...(f.descriptions || []), f.text].filter(Boolean).join(' '))
            .join(', ')
        : currentItem.release.format_details;

      const importantDetailsList = currentItem.important_details
        ? currentItem.important_details.split(',').map((s) => s.trim())
        : [];

      if (data.formats?.some((f) => f.descriptions?.some((d) => /limited/i.test(d))) && !importantDetailsList.includes('Limited edition')) {
        importantDetailsList.push('Limited edition');
      }
      if (data.formats?.some((f) => f.descriptions?.some((d) => /numbered/i.test(d))) && !importantDetailsList.includes('Numbered')) {
        importantDetailsList.push('Numbered');
      }
      if (
        data.formats?.some((f) => /coloured|color|marbled|clear|splatter|red|blue|white/i.test(f.text || '')) &&
        !importantDetailsList.includes('Цветной винил')
      ) {
        importantDetailsList.push('Цветной винил');
      }

      const matrixIdentifiers = data.identifiers
        ? data.identifiers
            .map((id) => `${id.type}${id.description ? ` (${id.description})` : ''}: ${id.value}`)
            .join('\n')
        : '';

      const updatedExtraInfo = [
        exactCatNo ? `Каталожный номер: ${exactCatNo}` : null,
        matrixIdentifiers ? `Матрицы / Runout:\n${matrixIdentifiers}` : null,
        currentItem.extra_info,
      ]
        .filter(Boolean)
        .join('\n\n');

      const combinedPhotos = Array.from(
        new Set([...currentItem.photos, ...discogsPhotos].filter(Boolean))
      );

      // Обновляем состояние компонента мгновенно
      setItem((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          photos: combinedPhotos,
          important_details: importantDetailsList.join(', ') || prev.important_details,
          extra_info: updatedExtraInfo || prev.extra_info,
          release_type: exactYear && exactYear <= 1990 ? 'Оригинал' : prev.release_type || 'Оригинал',
          release: {
            ...prev.release,
            country: exactCountry,
            year: exactYear,
            label: exactLabel,
            catno: exactCatNo,
            discogs_notes: exactNotes,
            tracklist: exactTracklist.length > 0 ? exactTracklist : prev.release.tracklist,
            discogs_photos: discogsPhotos,
            format_details: formatStr || prev.release.format_details,
            discogs_uri: data.uri || prev.release.discogs_uri,
          },
        };
      });

      // Сохраняем в Supabase в фоне
      supabase
        .from('releases')
        .update({
          country: exactCountry,
          year: exactYear,
          label: exactLabel,
          catno: exactCatNo,
          discogs_notes: exactNotes,
          tracklist: exactTracklist,
          discogs_photos: discogsPhotos,
          format_details: formatStr,
          discogs_uri: data.uri || currentItem.release.discogs_uri,
        })
        .eq('id', currentItem.release.id)
        .then(() => {});

      if (importantDetailsList.length > 0 || updatedExtraInfo) {
        supabase
          .from('items')
          .update({
            important_details: importantDetailsList.join(', ') || null,
            extra_info: updatedExtraInfo || null,
            photos: combinedPhotos,
          })
          .eq('id', currentItem.id)
          .then(() => {});
      }
    } catch (e) {
      console.warn('Discogs auto-enrichment skipped:', e);
    } finally {
      if (!isCancelled) setEnriching(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-12 h-12 rounded-full vinyl-grooves spin-vinyl mx-auto" />
        <p className="text-zinc-500 text-xs font-mono">Загрузка паспорта пластинки...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="py-20 text-center space-y-3">
        <Disc3 className="w-12 h-12 text-zinc-700 mx-auto" />
        <p className="text-zinc-400 text-sm">Пластинка не найдена или снята с витрины.</p>
        <button
          onClick={() => navigate('/')}
          className="text-xs text-[#8b5cf6] underline font-mono"
        >
          Вернуться в каталог
        </button>
      </div>
    );
  }

  const allPhotos = item.photos.length > 0 ? item.photos : [];
  const tracklist = item.release.tracklist || [];
  const discogsCode = item.release.discogs_release_id;
  const artistsNames = (item.release?.artists || []).map((a) => a.name).join(', ') || 'Разные исполнители';
  const artistCountry = resolveArtistCountry(artistsNames, item.release.discogs_notes);
  const releaseCountry = item.release.country || 'Импорт';

  return (
    <div className="pb-28 space-y-6 max-w-4xl mx-auto">
      {/* Кликабельная галерея реальных фотографий пластинки из Discogs */}
      <div className="space-y-3">
        <div
          onClick={() => {
            if (allPhotos.length > 0) {
              haptic.light();
              setIsLightboxOpen(true);
            }
          }}
          className="relative aspect-square w-full max-w-md mx-auto rounded-3xl bg-[#111111] border border-[#222222] overflow-hidden flex items-center justify-center cursor-zoom-in group shadow-2xl"
        >
          {allPhotos[activePhotoIdx] ? (
            <img
              src={allPhotos[activePhotoIdx]}
              alt={item.release.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="relative w-40 h-40 rounded-full vinyl-grooves flex items-center justify-center p-2 spin-vinyl">
              <div className="w-16 h-16 rounded-full bg-[#0a0a0a] border border-[#262626] flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-white" />
              </div>
            </div>
          )}

          {allPhotos.length > 0 && (
            <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 text-xs text-white">
              <Maximize2 className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span className="font-mono text-[11px]">Фото {activePhotoIdx + 1}/{allPhotos.length}</span>
            </div>
          )}

          {item.release_type && (
            <div className="absolute top-3 left-3 bg-[#0a0a0a]/90 backdrop-blur-md px-3 py-1 rounded-xl border border-[#333333] text-[11px] font-mono font-bold text-white uppercase tracking-wider">
              {item.release_type}
            </div>
          )}

          {enriching && (
            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-[#8b5cf6]/40 flex items-center gap-1.5 text-[10px] font-mono text-[#c084fc]">
              <Loader2 className="w-3 h-3 animate-spin text-[#8b5cf6]" />
              <span>Синхронизация с Discogs...</span>
            </div>
          )}
        </div>

        {allPhotos.length > 1 && (
          <div className="flex justify-center gap-2 overflow-x-auto pb-1 max-w-md mx-auto scrollbar-none">
            {allPhotos.map((url, idx) => (
              <button
                key={idx}
                onClick={() => {
                  haptic.selection();
                  setActivePhotoIdx(idx);
                }}
                className={`w-16 h-16 rounded-2xl overflow-hidden border-2 shrink-0 transition ${
                  activePhotoIdx === idx ? 'border-[#8b5cf6] scale-105' : 'border-[#222222] opacity-60 hover:opacity-100'
                }`}
              >
                <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Полноэкранный Lightbox для фото */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-8">
          <div className="flex items-center justify-between text-white pb-3">
            <span className="font-mono text-xs text-[#a3a3a3]">
              {item.release.title} · Фото {activePhotoIdx + 1} из {allPhotos.length}
            </span>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative">
            <img
              src={allPhotos[activePhotoIdx]}
              alt=""
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
            {allPhotos.length > 1 && (
              <>
                <button
                  onClick={() => {
                    haptic.light();
                    setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : allPhotos.length - 1));
                  }}
                  className="absolute left-2 p-3 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black/90"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => {
                    haptic.light();
                    setActivePhotoIdx((prev) => (prev < allPhotos.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-2 p-3 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black/90"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <div className="flex justify-center gap-2 overflow-x-auto pt-3">
            {allPhotos.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setActivePhotoIdx(idx)}
                className={`w-12 h-12 rounded-xl overflow-hidden border-2 ${
                  activePhotoIdx === idx ? 'border-[#8b5cf6]' : 'border-transparent opacity-40 hover:opacity-100'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Основная карточка паспорта пластинки со всеми полями Discogs */}
      <div className="bg-[#111111] border border-[#222222] rounded-3xl p-6 sm:p-8 space-y-6 text-white shadow-2xl">
        <div className="border-b border-[#222222] pb-5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {(item.release?.artists || []).map((artist) => (
              <Link
                key={artist.id}
                to={`/artist/${artist.id}`}
                onClick={() => haptic.light()}
                className="text-base sm:text-lg font-bold text-[#8b5cf6] hover:underline uppercase tracking-wide"
              >
                {artist.name}
              </Link>
            ))}

            {discogsCode && (
              <a
                href={item.release.discogs_uri || `https://www.discogs.com/release/${discogsCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#a3a3a3] hover:text-white bg-[#1a1a1a] hover:bg-[#222222] px-2.5 py-0.5 rounded-lg border border-[#2a2a2a] inline-flex items-center gap-1 transition"
                title="Официальный код релиза на Discogs"
              >
                <ExternalLink className="w-3 h-3 text-[#8b5cf6]" />
                <span>Discogs #{discogsCode}</span>
              </a>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            {item.release.title}
          </h1>

          {/* Важные детали (Limited edition, Numbered, Цветной винил) */}
          {Boolean(item.important_details) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {item.important_details?.split(',').map((detail, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-950/60 text-[#c084fc] border border-purple-800/50 text-xs font-mono font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {detail.trim()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Сетка паспорта релиза в строгом стиле Discogs */}
        <div className="bg-[#0c0c0c] p-4 sm:p-5 rounded-2xl border border-[#1f1f1f] space-y-3 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6">
            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Исполнитель:</span>
              <span className="text-white font-semibold">
                {artistsNames}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Альбом:</span>
              <span className="text-white font-semibold truncate max-w-[200px]">
                {item.release.title}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Стиль:</span>
              <span className="text-[#c084fc] font-semibold truncate max-w-[200px]">
                {item.release.style.join(', ') || item.release.genre.join(', ') || 'Не указан'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Лейбл:</span>
              <span className="text-white font-semibold truncate max-w-[200px]">
                {item.release.label || 'Не указан'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Страна производства:</span>
              <span className="text-white font-bold">
                {releaseCountry}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Страна авторов / исполнителя:</span>
              <span className="text-[#c084fc] font-bold">
                {artistCountry}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Год выпуска:</span>
              <span className="text-white font-bold">
                {item.release.year || 'Не указан'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Тип издания:</span>
              <span className="text-white font-semibold">
                {item.release_type || 'Оригинал'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Формат:</span>
              <span className="text-white font-semibold truncate max-w-[200px]">
                {item.release.format_details || '12" LP'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Состояние конверта:</span>
              <span className="text-emerald-400 font-bold">
                {item.condition_sleeve || 'NM'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#171717] pb-1.5">
              <span className="text-[#737373]">Состояние пластинки:</span>
              <span className="text-[#8b5cf6] font-bold">
                {item.condition_media || 'NM-'}
              </span>
            </div>
          </div>
        </div>

        {/* Дополнительная техническая информация (Каталожный номер, Матрица, Runout) */}
        {(item.extra_info || item.release.catno) && (
          <div className="bg-[#141414] border border-[#222222] rounded-2xl p-4 sm:p-5 space-y-2">
            <h3 className="text-xs font-mono text-[#888888] uppercase tracking-wider flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-[#8b5cf6]" />
              <span>Дополнительная информация (Matrix / Runout / Каталог)</span>
            </h3>
            <div className="text-xs font-mono text-[#d4d4d4] whitespace-pre-line leading-relaxed bg-[#0c0c0c] p-3 rounded-xl border border-[#1f1f1f]">
              {item.extra_info || `Каталожный номер: ${item.release.catno}`}
            </div>
          </div>
        )}

        {/* ОПИСАНИЕ РЕЛИЗА ИЗ DISCOGS (Notes / Описание) */}
        {(item.release.discogs_notes || item.description) && (
          <div className="bg-[#141414] border border-[#222222] rounded-2xl p-4 sm:p-5 space-y-2 font-mono">
            <h3 className="text-xs text-[#888888] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#8b5cf6]" />
              <span>Описание релиза</span>
            </h3>
            <div className="text-xs text-[#cccccc] leading-relaxed whitespace-pre-line bg-[#0c0c0c] p-3.5 rounded-xl border border-[#1f1f1f]">
              {item.release.discogs_notes || item.description}
            </div>
          </div>
        )}

        {/* ТРЕКЛИСТ РЕЛИЗА ИЗ DISCOGS (ВСЕ ТРЕКИ) */}
        {tracklist.length > 0 && (
          <div className="bg-[#141414] border border-[#222222] rounded-2xl p-4 sm:p-5 space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-[#222222] pb-2.5">
              <h3 className="text-xs text-white font-bold uppercase tracking-wider flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-[#8b5cf6]" />
                <span>Все треки из релиза</span>
              </h3>
              <span className="text-[11px] text-[#737373]">
                {tracklist.length} треков
              </span>
            </div>

            <div className="divide-y divide-[#1c1c1c] text-xs">
              {tracklist.map((track, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#181818] px-2 rounded-lg transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[#8b5cf6] font-bold shrink-0 w-8 text-[11px]">
                      {track.position || `${idx + 1}`}
                    </span>
                    <span className="text-white truncate font-medium">
                      {track.title}
                    </span>
                  </div>
                  {track.duration && (
                    <span className="text-[#737373] text-[11px] shrink-0 font-mono">
                      {track.duration}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Прямая ссылка на релиз в Discogs */}
        {discogsCode && (
          <div className="pt-1">
            <a
              href={item.release.discogs_uri || `https://www.discogs.com/release/${discogsCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#171717] hover:bg-[#202020] text-xs font-mono text-[#a3a3a3] hover:text-white border border-[#2a2a2a] transition"
            >
              <ExternalLink className="w-4 h-4 text-[#8b5cf6]" />
              <span>Посмотреть официальный релиз на Discogs.com (#{discogsCode})</span>
            </a>
          </div>
        )}

        {/* Локация магазина в Санкт-Петербурге */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] rounded-2xl p-4 flex items-center gap-3 text-xs font-mono">
          <MapPin className="w-4 h-4 text-[#8b5cf6] shrink-0" />
          <div className="space-y-0.5">
            <span className="font-semibold text-white">г. Санкт-Петербург, магазин ул. Рубинштейна</span>
            <p className="text-[#737373] text-[11px]">Каталог оригинальных виниловых пластинок в наличии</p>
          </div>
        </div>

        {/* Стоимость пластинки и статус витрины */}
        <div className="pt-4 border-t border-[#222222] flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono text-[#888888] block">Стоимость пластинки:</span>
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
              {item.price > 0 ? `${item.price.toLocaleString('ru-RU')} ₽` : 'Цена по запросу'}
            </span>
          </div>

          <div className="px-5 py-3 rounded-2xl font-mono text-xs text-[#a3a3a3] bg-[#141414] border border-[#262626] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>В наличии в Санкт-Петербурге</span>
          </div>
        </div>
      </div>

      {/* Другие релизы */}
      {sameArtistItems.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-sm font-bold font-mono uppercase text-white px-1">
            Другие пластинки в наличии ({sameArtistItems.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {sameArtistItems.map((relItem) => {
              const cover = relItem.photos[0] || relItem.release.default_cover_url;
              return (
                <Link
                  key={relItem.id}
                  to={`/record/${relItem.id}`}
                  onClick={() => haptic.light()}
                  className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden hover:border-[#8b5cf6]/50 transition group"
                >
                  <div className="aspect-square bg-black overflow-hidden flex items-center justify-center">
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <Disc3 className="w-8 h-8 text-[#333333]" />
                    )}
                  </div>
                  <div className="p-2.5 space-y-1 font-mono">
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-[#8b5cf6]">
                      {relItem.release.title}
                    </h4>
                    <p className="text-[11px] text-[#888888]">
                      {relItem.price > 0 ? `${relItem.price.toLocaleString('ru-RU')} ₽` : 'По запросу'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
