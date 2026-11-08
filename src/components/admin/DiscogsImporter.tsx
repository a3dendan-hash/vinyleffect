import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, Key, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { haptic } from '../../lib/telegram';

interface DiscogsRow {
  release_id?: string;
  releaseid?: string;
  id?: string;
  CatalogNo?: string;
  'Catalog#'?: string;
  Artist?: string;
  Title?: string;
  Label?: string;
  Released?: string;
  Format?: string;
  Rating?: string;
  Notes?: string;
  notes?: string;
  'Collection Notes'?: string;
  'Collection Media Condition'?: string;
  'Collection Sleeve Condition'?: string;
  [key: string]: string | undefined;
}

interface DiscogsApiResponse {
  id: number;
  title: string;
  artists_sort?: string;
  artists?: Array<{ id: number; name: string }>;
  year?: number;
  released?: string;
  genres?: string[];
  styles?: string[];
  labels?: Array<{ name: string; catno: string }>;
  country?: string;
  uri?: string;
  notes?: string;
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
}

interface Props {
  onImportComplete: () => void;
}

export const DiscogsImporter: React.FC<Props> = ({ onImportComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTitle: '' });
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [discogsToken, setDiscogsToken] = useState<string>(() => localStorage.getItem('discogs_token') || '');
  const [fetchFromApi, setFetchFromApi] = useState<boolean>(true);

  const cleanArtist = (raw: string) => raw.replace(/\s+\(\d+\)$/, '').trim();

  const mapGrade = (raw?: string) => {
    if (!raw) return 'NM-';
    const upper = raw.toUpperCase();
    if (upper.includes('NEAR MINT') || upper === 'NM') return 'NM';
    if (upper.includes('MINT') || upper === 'M') return 'M';
    if (upper.includes('VERY GOOD PLUS') || upper === 'VG+') return 'VG+';
    if (upper.includes('VERY GOOD') || upper === 'VG') return 'VG';
    if (upper.includes('EXCELLENT') || upper === 'EX') return 'EX';
    if (upper.includes('GOOD PLUS') || upper === 'G+') return 'G+';
    if (upper.includes('GOOD') || upper === 'G') return 'G';
    return 'NM-';
  };

  const fetchDiscogsRelease = async (releaseId: string): Promise<DiscogsApiResponse | null> => {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'VinylPeterMarketplace/1.0 (+https://t.me/vinyleffect)',
      };
      if (discogsToken.trim()) {
        headers['Authorization'] = `Discogs token=${discogsToken.trim()}`;
      }

      const res = await fetch(`https://api.discogs.com/releases/${releaseId}`, { headers });
      if (!res.ok) {
        console.warn(`Discogs API returned status ${res.status} for ${releaseId}`);
        return null;
      }
      return (await res.json()) as DiscogsApiResponse;
    } catch (e) {
      console.error(`Discogs fetch error for release ${releaseId}:`, e);
      return null;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResultMsg(null);
    setProgress({ current: 0, total: 0, currentTitle: 'Анализ CSV файла...' });

    if (discogsToken) {
      localStorage.setItem('discogs_token', discogsToken.trim());
    }

    Papa.parse<DiscogsRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.filter((r) => r.Title || r.Artist || r.release_id || r.releaseid || r.id);
        const total = rows.length;
        setProgress({ current: 0, total, currentTitle: 'Начало импорта...' });

        let importedCount = 0;
        let errorsCount = 0;

        try {
          for (let i = 0; i < total; i++) {
            const row = rows[i];
            const rawRelId = (row.release_id || row.releaseid || row.id || '').trim();
            const rawArtist = cleanArtist(row.Artist || 'Unknown Artist');
            const rawTitle = (row.Title || 'Без названия').trim();

            setProgress({
              current: i + 1,
              total,
              currentTitle: `${rawArtist} — ${rawTitle}`,
            });

            let discogsData: DiscogsApiResponse | null = null;
            if (fetchFromApi && rawRelId) {
              discogsData = await fetchDiscogsRelease(rawRelId);
              // Throttling to respect Discogs rate-limit
              await new Promise((resolve) => setTimeout(resolve, discogsToken ? 300 : 1100));
            }

            // 1. Resolve Primary Artist
            const finalArtistName = discogsData?.artists?.[0]?.name
              ? cleanArtist(discogsData.artists[0].name)
              : rawArtist;
            const discogsArtistId = discogsData?.artists?.[0]?.id ? String(discogsData.artists[0].id) : null;

            let artistId: string;
            const { data: existingArtist } = await supabase
              .from('artists')
              .select('id')
              .eq('name', finalArtistName)
              .maybeSingle();

            if (existingArtist) {
              artistId = existingArtist.id;
            } else {
              const { data: newArtist } = await supabase
                .from('artists')
                .insert({
                  name: finalArtistName,
                  discogs_artist_id: discogsArtistId,
                })
                .select('id')
                .single();
              artistId = newArtist?.id || '';
            }

            // 2. Format details and identifiers extraction
            const formatStr = discogsData?.formats
              ? discogsData.formats
                  .map((f) => [f.name, ...(f.descriptions || []), f.text].filter(Boolean).join(' '))
                  .join(', ')
              : row.Format || '12" LP';

            const matrixIdentifiers = discogsData?.identifiers
              ? discogsData.identifiers
                  .map((id) => `${id.type}${id.description ? ` (${id.description})` : ''}: ${id.value}`)
                  .join('\n')
              : '';

            const primaryLabel = discogsData?.labels?.[0]?.name || row.Label?.trim() || null;
            const primaryCatNo = discogsData?.labels?.[0]?.catno || row['Catalog#'] || row.CatalogNo || null;
            const photoUrls = (discogsData?.images || []).map((img) => img.uri);
            const coverUrl = photoUrls[0] || null;

            const yearMatch = row.Released?.match(/\b(19\d{2}|20\d{2})\b/);
            const finalYear = discogsData?.year || (yearMatch ? parseInt(yearMatch[1], 10) : null);

            // 3. Upsert Release
            let releaseDbId: string;
            const discogsRelKey = rawRelId || (discogsData ? String(discogsData.id) : null);

            let existingRelease = null;
            if (discogsRelKey) {
              const { data } = await supabase
                .from('releases')
                .select('id')
                .eq('discogs_release_id', discogsRelKey)
                .maybeSingle();
              existingRelease = data;
            }

            const releasePayload = {
              title: discogsData?.title || rawTitle,
              year: finalYear,
              genre: discogsData?.genres || [],
              style: discogsData?.styles || [],
              label: primaryLabel,
              country: discogsData?.country || null,
              discogs_release_id: discogsRelKey,
              default_cover_url: coverUrl,
              cover_url: coverUrl,
              tracklist: discogsData?.tracklist || [],
              discogs_photos: photoUrls,
              format_details: formatStr,
              catno: primaryCatNo,
              discogs_uri: discogsData?.uri || (discogsRelKey ? `https://www.discogs.com/release/${discogsRelKey}` : null),
              discogs_notes: discogsData?.notes || null,
            };

            if (existingRelease) {
              releaseDbId = existingRelease.id;
              await supabase.from('releases').update(releasePayload).eq('id', releaseDbId);
            } else {
              const { data: newRelease } = await supabase
                .from('releases')
                .insert(releasePayload)
                .select('id')
                .single();
              releaseDbId = newRelease?.id || '';
            }

            if (artistId && releaseDbId) {
              await supabase
                .from('release_artists')
                .upsert({ artist_id: artistId, release_id: releaseDbId }, { onConflict: 'artist_id,release_id' });
            }

            // 4. Construct Item / Draft
            const isOriginal = finalYear && finalYear <= 1990 ? 'Оригинал' : 'Переиздание';
            const importantDetailsList: string[] = [];

            if (discogsData?.formats?.some((f) => f.descriptions?.some((d) => /limited/i.test(d)))) {
              importantDetailsList.push('Limited edition');
            }
            if (discogsData?.formats?.some((f) => f.descriptions?.some((d) => /numbered/i.test(d)))) {
              importantDetailsList.push('Numbered');
            }
            if (
              discogsData?.formats?.some((f) => /coloured|color|marbled|clear|splatter|red|blue|white/i.test(f.text || '')) ||
              /color|marbled/i.test(row.Format || '')
            ) {
              importantDetailsList.push('Цветной винил');
            }

            const extraNotes = [
              primaryCatNo ? `Каталожный номер: ${primaryCatNo}` : null,
              matrixIdentifiers ? `Матрицы / Номера:\n${matrixIdentifiers}` : null,
              row['Collection Notes'] || row.Notes || row.notes || null,
            ]
              .filter(Boolean)
              .join('\n\n');

            const itemDraftPayload = {
              release_id: releaseDbId,
              status: 'draft',
              price: 0,
              condition_media: mapGrade(row['Collection Media Condition']),
              condition_sleeve: mapGrade(row['Collection Sleeve Condition']),
              release_type: isOriginal,
              important_details: importantDetailsList.join(', ') || null,
              extra_info: extraNotes || null,
              photos: photoUrls,
              custom_images: photoUrls,
              description: discogsData?.notes || [row.Format ? `Формат: ${row.Format}` : '', extraNotes].filter(Boolean).join(' | '),
            };

            const { error: itemErr } = await supabase.from('items').insert(itemDraftPayload);
            if (itemErr) {
              console.error('Error inserting item draft:', itemErr);
              errorsCount++;
            } else {
              importedCount++;
            }
          }

          haptic.success();
          setResultMsg({
            type: 'success',
            text: `Импорт завершен! Успешно добавлено ${importedCount} пластинок в Черновики${errorsCount ? ` (${errorsCount} пропущено)` : ''}.`,
          });
          onImportComplete();
        } catch (err: any) {
          haptic.error();
          setResultMsg({
            type: 'error',
            text: err.message || 'Ошибка импорта. Проверьте права доступа.',
          });
        } finally {
          setIsProcessing(false);
          e.target.value = '';
        }
      },
    });
  };

  return (
    <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 mb-6 text-white shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 flex items-center justify-center text-[#8b5cf6]">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Импорт Wantlist / Collection (.csv) из Discogs</h3>
            <p className="text-[11px] text-[#888888]">Пластинки загружаются в черновики с автоматическим обогащением</p>
          </div>
        </div>

        <label className="cursor-pointer inline-flex items-center gap-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#8b5cf6]/20 select-none shrink-0">
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {progress.current}/{progress.total}
              </span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Загрузить wantlist.csv</span>
            </>
          )}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={isProcessing}
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {/* Опции обогащения данными Discogs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#222222] text-xs">
        <label className="flex items-center gap-2.5 cursor-pointer text-[#cccccc]">
          <input
            type="checkbox"
            checked={fetchFromApi}
            onChange={(e) => setFetchFromApi(e.target.checked)}
            className="w-4 h-4 rounded bg-[#1a1a1a] border-[#333333] text-[#8b5cf6] focus:ring-0"
          />
          <span>Запрашивать у Discogs API фото, матричные номера, стили и страну</span>
        </label>

        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-[#888888] shrink-0" />
          <input
            type="password"
            value={discogsToken}
            onChange={(e) => setDiscogsToken(e.target.value)}
            placeholder="Discogs Personal Access Token (опционально, для ускорения)"
            className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#666666] focus:border-[#8b5cf6] focus:outline-none font-mono"
          />
        </div>
      </div>

      {isProcessing && (
        <div className="mt-4 p-3 bg-[#171717] border border-[#2a2a2a] rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#8b5cf6] truncate mr-2">
              <RefreshCw className="w-3.5 h-3.5 inline animate-spin mr-1.5" />
              {progress.currentTitle}
            </span>
            <span className="text-white shrink-0 font-bold">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#8b5cf6] h-full transition-all duration-300"
              style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {resultMsg && (
        <div
          className={`mt-4 p-3 rounded-xl flex items-center gap-2.5 text-xs ${
            resultMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {resultMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{resultMsg.text}</span>
        </div>
      )}
    </div>
  );
};
