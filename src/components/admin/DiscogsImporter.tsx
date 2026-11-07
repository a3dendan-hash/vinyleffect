import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { haptic } from '../../lib/telegram';

interface DiscogsCsvRow {
  release_id?: string;
  Artist?: string;
  Title?: string;
  Label?: string;
  Released?: string;
  Format?: string;
  Notes?: string;
  notes?: string;
}

interface Props {
  onImportComplete: () => void;
}

export const DiscogsImporter: React.FC<Props> = ({ onImportComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Очистка суффиксов нумерации Discogs у артистов, например "Nirvana (2)" -> "Nirvana"
  const cleanArtistName = (raw: string) => raw.replace(/\s+\(\d+\)$/, '').trim();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setResultMsg(null);

    Papa.parse<DiscogsCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        setProgress({ current: 0, total: rows.length });
        let importedCount = 0;

        try {
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            setProgress({ current: i + 1, total: rows.length });

            const title = row.Title?.trim();
            const rawArtist = row.Artist?.trim();
            if (!title || !rawArtist) continue;

            // 1. Разбиваем строку исполнителей (если это сплит или фит: "Artist A / Artist B" или "Artist A, Artist B")
            const artistNames = Array.from(
              new Set(
                rawArtist
                  .split(/\s*\/\s*|\s*,\s*|\s+Feat\.\s+/i)
                  .map(cleanArtistName)
                  .filter(Boolean)
              )
            );

            // 2. Upsert каждого артиста в таблицу artists
            const artistIds: string[] = [];
            for (const name of artistNames) {
              const { data: artistData, error: artistErr } = await supabase
                .from('artists')
                .upsert({ name }, { onConflict: 'name' })
                .select('id')
                .single();

              if (!artistErr && artistData) {
                artistIds.push(artistData.id);
              }
            }

            // 3. Извлекаем год релиза из поля Released (например, "1973" или "1973-05-01")
            const yearMatch = row.Released?.match(/\b(19\d{2}|20\d{2})\b/);
            const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
            const discogsReleaseId = row.release_id?.trim() || null;

            // 4. Upsert релиза в таблицу releases
            let releaseId: string | null = null;

            if (discogsReleaseId) {
              const { data: relData, error: relErr } = await supabase
                .from('releases')
                .upsert(
                  {
                    discogs_release_id: discogsReleaseId,
                    title,
                    year,
                    label: row.Label?.trim() || null,
                  },
                  { onConflict: 'discogs_release_id' }
                )
                .select('id')
                .single();

              if (relErr) throw relErr;
              releaseId = relData.id;
            } else {
              const { data: relData, error: relErr } = await supabase
                .from('releases')
                .insert({
                  title,
                  year,
                  label: row.Label?.trim() || null,
                })
                .select('id')
                .single();

              if (relErr) throw relErr;
              releaseId = relData.id;
            }

            // 5. Связываем релиз и артистов в release_artists
            if (releaseId && artistIds.length > 0) {
              const links = artistIds.map((artist_id) => ({
                artist_id,
                release_id: releaseId!,
              }));
              await supabase
                .from('release_artists')
                .upsert(links, { onConflict: 'artist_id,release_id' });
            }

            // 6. Создаем черновик экземпляра пластинки в items
            const noteText = [row.Format ? `Формат: ${row.Format}` : '', row.Notes || row.notes || '']
              .filter(Boolean)
              .join(' | ');

            const { error: itemErr } = await supabase.from('items').insert({
              release_id: releaseId,
              status: 'draft',
              price: 0,
              description: noteText,
            });

            if (!itemErr) importedCount++;
          }

          haptic.success();
          setResultMsg({
            type: 'success',
            text: `Успешно импортировано черновиков: ${importedCount} из ${rows.length}`,
          });
          onImportComplete();
        } catch (err: any) {
          haptic.error();
          setResultMsg({
            type: 'error',
            text: `Ошибка импорта: ${err.message || 'Неизвестная ошибка'}`,
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
          <h3 className="font-semibold text-sm text-white">Импорт Discogs Wantlist (.csv)</h3>
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
        Поддерживаются стандартные поля экспорта Discogs: <code className="text-zinc-300">release_id</code>,{' '}
        <code className="text-zinc-300">Artist</code>, <code className="text-zinc-300">Title</code>,{' '}
        <code className="text-zinc-300">Label</code>, <code className="text-zinc-300">Released</code>,{' '}
        <code className="text-zinc-300">Format</code>, <code className="text-zinc-300">notes</code>.
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