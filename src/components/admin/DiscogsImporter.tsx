import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { haptic } from '../../lib/telegram';

interface DiscogsRow {
  release_id?: string;
  Artist?: string;
  Title?: string;
  Label?: string;
  Released?: string;
  Format?: string;
  Notes?: string;
  notes?: string;
  'Collection Notes'?: string;
  'Collection Media Condition'?: string;
  'Collection Sleeve Condition'?: string;
}

interface Props {
  onImportComplete: () => void;
}

export const DiscogsImporter: React.FC<Props> = ({ onImportComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const cleanArtist = (raw: string) => raw.replace(/\s+\(\d+\)$/, '').trim();

  // Преобразование текстового грейда Discogs в наш стандарт (Goldmine)
  const mapGrade = (raw?: string) => {
    if (!raw) return 'VG+';
    if (raw.includes('Near Mint')) return 'NM';
    if (raw.includes('Mint')) return 'M';
    if (raw.includes('Very Good Plus')) return 'VG+';
    if (raw.includes('Very Good')) return 'VG';
    if (raw.includes('Good Plus')) return 'G+';
    if (raw.includes('Good')) return 'G';
    return 'VG+';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResultMsg(null);
    setProgress({ current: 0, total: 0 });

    Papa.parse<DiscogsRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.filter((r) => r.Title && r.Artist);
        const total = rows.length;
        setProgress({ current: 0, total });

        try {
          // 1. Собираем уникальных артистов и загружаем их пачкой
          const artistNamesSet = new Set<string>();
          rows.forEach((r) => {
            const raw = r.Artist || '';
            raw.split(/\s*\/\s*|\s*,\s*|\s+Feat\.\s+/i).forEach((a) => {
              const cleaned = cleanArtist(a);
              if (cleaned) artistNamesSet.add(cleaned);
            });
          });

          const artistNames = Array.from(artistNamesSet);
          const { data: insertedArtists, error: artErr } = await supabase
            .from('artists')
            .upsert(
              artistNames.map((name) => ({ name })),
              { onConflict: 'name' }
            )
            .select('id, name');

          if (artErr) throw new Error(`Ошибка сохранения артистов: ${artErr.message}`);

          const artistMap = new Map<string, string>();
          insertedArtists?.forEach((a) => artistMap.set(a.name, a.id));

          // 2. Обрабатываем пластинки чанками по 50 штук
          const CHUNK_SIZE = 50;
          let processed = 0;

          for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);

            // Создаем пачку релизов
            const releasesPayload = chunk.map((r) => {
              const yearMatch = r.Released?.match(/\b(19\d{2}|20\d{2})\b/);
              return {
                title: r.Title?.trim() || 'Без названия',
                discogs_release_id: r.release_id?.trim() || null,
                year: yearMatch ? parseInt(yearMatch[1], 10) : null,
                label: r.Label?.trim() || null,
              };
            });

            const { data: createdReleases, error: relErr } = await supabase
              .from('releases')
              .upsert(releasesPayload, { onConflict: 'discogs_release_id' })
              .select('id, discogs_release_id');

            if (relErr) throw new Error(`Ошибка релизов: ${relErr.message}`);

            const releaseMap = new Map<string, string>();
            createdReleases?.forEach((rel) => {
              if (rel.discogs_release_id) releaseMap.set(rel.discogs_release_id, rel.id);
            });

            // Связи артистов и создание черновиков (items)
            const linksPayload: { artist_id: string; release_id: string }[] = [];
            const itemsPayload: any[] = [];

            chunk.forEach((r) => {
              const relId = releaseMap.get(r.release_id?.trim() || '');
              if (!relId) return;

              // Связи
              const splitArtists = (r.Artist || '')
                .split(/\s*\/\s*|\s*,\s*|\s+Feat\.\s+/i)
                .map(cleanArtist);

              splitArtists.forEach((aName) => {
                const aId = artistMap.get(aName);
                if (aId) linksPayload.push({ artist_id: aId, release_id: relId });
              });

              // Экземпляр в черновик с подтягиванием состояния из CSV
              const note = r['Collection Notes'] || r.Notes || r.notes || '';
              itemsPayload.push({
                release_id: relId,
                status: 'draft',
                price: 0,
                condition_media: mapGrade(r['Collection Media Condition']),
                condition_sleeve: mapGrade(r['Collection Sleeve Condition']),
                description: [r.Format ? `Формат: ${r.Format}` : '', note]
                  .filter(Boolean)
                  .join(' | '),
              });
            });

            if (linksPayload.length > 0) {
              await supabase
                .from('release_artists')
                .upsert(linksPayload, { onConflict: 'artist_id,release_id' });
            }

            if (itemsPayload.length > 0) {
              const { error: itemErr } = await supabase.from('items').insert(itemsPayload);
              if (itemErr) throw new Error(`Ошибка добавления в items: ${itemErr.message}`);
            }

            processed += chunk.length;
            setProgress({ current: Math.min(processed, total), total });
          }

          haptic.success();
          setResultMsg({
            type: 'success',
            text: `Успешно загружено ${total} пластинок в черновики!`,
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-sm text-white">Импорт коллекции Discogs (.csv)</h3>
        </div>
        <label className="cursor-pointer inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs px-3.5 py-2 rounded-xl transition">
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
              <span>Загрузить CSV</span>
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

      <p className="text-xs text-zinc-400">
        Автоматически импортирует названия, артистов, лейблы, форматы и оценки состояния из вашей коллекции Discogs.
      </p>

      {resultMsg && (
        <div
          className={`mt-3 p-3 rounded-xl flex items-center gap-2 text-xs ${
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
