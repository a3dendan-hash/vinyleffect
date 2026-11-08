import React, { useState } from 'react';
import { X, Camera, Trash2, Sparkles, Loader2, Check, Globe, Upload, Image as ImageIcon, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { VinylItem, MediaCondition, SleeveCondition, ItemStatus } from '../../types/database';
import { haptic } from '../../lib/telegram';

const MEDIA_GRADES: MediaCondition[] = ['M', 'NM', 'EX', 'VG+', 'VG', 'G+', 'G', 'F', 'P'];
const SLEEVE_GRADES: SleeveCondition[] = ['M', 'NM', 'EX', 'VG+', 'VG', 'G+', 'G', 'F', 'P', 'Generic'];

interface Props {
  item: VinylItem;
  onClose: () => void;
  onSaved: () => void;
  isOpen?: boolean;
}

export const ItemEditorModal: React.FC<Props> = ({ item, onClose, onSaved }) => {
  const [price, setPrice] = useState<string>(item.price ? String(item.price) : '');
  const [conditionMedia, setConditionMedia] = useState<MediaCondition>(item.condition_media || 'NM-');
  const [conditionSleeve, setConditionSleeve] = useState<SleeveCondition>(item.condition_sleeve || 'NM');
  const [releaseType, setReleaseType] = useState<string>(item.release_type || 'Оригинал');
  const [importantDetails, setImportantDetails] = useState<string>(item.important_details || '');
  const [extraInfo, setExtraInfo] = useState<string>(item.extra_info || '');
  const [formatDetails, setFormatDetails] = useState<string>(item.release.format_details || '12" LP');
  const [discogsUri, setDiscogsUri] = useState<string>(item.release.discogs_uri || '');
  const [description, setDescription] = useState<string>(item.description || '');
  const [photos, setPhotos] = useState<string[]>(item.photos || []);
  const [coverUrl, setCoverUrl] = useState<string>(item.release.default_cover_url || item.release.cover_url || '');
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Метаданные релиза (жанры, стили, страна, год, лейбл)
  const [genresInput, setGenresInput] = useState<string>(item.release.genre.join(', '));
  const [stylesInput, setStylesInput] = useState<string>(item.release.style.join(', '));
  const [label, setLabel] = useState<string>(item.release.label || '');
  const [country, setCountry] = useState<string>(item.release.country || '');
  const [year, setYear] = useState<string>(item.release.year ? String(item.release.year) : '');

  const [uploading, setUploading] = useState(false);
  const [fetchingDiscogs, setFetchingDiscogs] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'jpg';
        const filePath = `${item.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('vinyl-photos')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('vinyl-photos').getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }

      setPhotos((prev) => [...prev, ...uploadedUrls]);
      haptic.light();
    } catch (err: any) {
      haptic.error();
      alert(`Ошибка загрузки фото: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (urlToRemove: string) => {
    setPhotos((prev) => prev.filter((url) => url !== urlToRemove));
  };

  const enrichFromDiscogs = async () => {
    const discogsId = item.release.discogs_release_id;
    if (!discogsId) {
      alert('У этой пластинки нет ID релиза Discogs');
      return;
    }

    setFetchingDiscogs(true);
    try {
      const res = await fetch(`https://api.discogs.com/releases/${discogsId}`, {
        headers: { 'User-Agent': 'VinylPeterMarketplace/1.0' },
      });
      if (!res.ok) throw new Error('Не удалось получить данные от Discogs API');
      const data = await res.json();

      if (Array.isArray(data.genres)) setGenresInput(data.genres.join(', '));
      if (Array.isArray(data.styles)) setStylesInput(data.styles.join(', '));
      if (data.country) setCountry(data.country);
      if (data.year) setYear(String(data.year));
      if (data.labels?.[0]?.name) setLabel(data.labels[0].name);
      if (data.uri) setDiscogsUri(data.uri);

      if (data.formats) {
        const fmt = data.formats
          .map((f: any) => [f.name, ...(f.descriptions || []), f.text].filter(Boolean).join(' '))
          .join(', ');
        setFormatDetails(fmt);

        if (data.formats.some((f: any) => /coloured|color|marbled|red|white/i.test(f.text || ''))) {
          setImportantDetails((prev) => (prev ? `${prev}, Цветной винил` : 'Цветной винил'));
        }
      }

      if (data.identifiers) {
        const ids = data.identifiers.map((id: any) => `${id.type}: ${id.value}`).join('\n');
        setExtraInfo((prev) => (prev ? `${prev}\n\n${ids}` : ids));
      }

      const discogsPhotos = (data?.images || []).map((img: any) => img.uri);
      if (discogsPhotos.length > 0) {
        setPhotos((prev) => Array.from(new Set([...prev, ...discogsPhotos])));
        if (!coverUrl) setCoverUrl(discogsPhotos[0]);
      }

      haptic.success();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFetchingDiscogs(false);
    }
  };

  const handleAddByUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    setPhotos((prev) => [...prev, trimmed]);
    if (!coverUrl) setCoverUrl(trimmed);
    setImageUrlInput('');
  };

  const handleSave = async (targetStatus: ItemStatus) => {
    const numericPrice = parseFloat(price);
    if (targetStatus === 'active' && (isNaN(numericPrice) || numericPrice <= 0)) {
      haptic.error();
      alert('Укажите корректную цену перед публикацией на витрину.');
      return;
    }

    setSaving(true);
    try {
      const genres = genresInput.split(',').map((s) => s.trim()).filter(Boolean);
      const styles = stylesInput.split(',').map((s) => s.trim()).filter(Boolean);

      // 1. Обновляем реплику релиза в Supabase
      const { error: relErr } = await supabase
        .from('releases')
        .update({
          genre: genres,
          style: styles,
          country: country.trim() || null,
          year: year ? parseInt(year, 10) : null,
          label: label.trim() || null,
          format_details: formatDetails.trim() || null,
          discogs_uri: discogsUri.trim() || null,
          default_cover_url: coverUrl || photos[0] || null,
          cover_url: coverUrl || photos[0] || null,
        })
        .eq('id', item.release.id);

      if (relErr) throw relErr;

      // 2. Обновляем конкретный экземпляр
      const { error: itemErr } = await supabase
        .from('items')
        .update({
          price: isNaN(numericPrice) ? 0 : numericPrice,
          condition_media: conditionMedia,
          condition_sleeve: conditionSleeve,
          release_type: releaseType.trim() || null,
          important_details: importantDetails.trim() || null,
          extra_info: extraInfo.trim() || null,
          description: description.trim(),
          photos,
          custom_images: photos,
          status: targetStatus,
        })
        .eq('id', item.id);

      if (itemErr) throw itemErr;

      haptic.success();
      onSaved();
      onClose();
    } catch (err: any) {
      haptic.error();
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#111111] border-t sm:border border-[#222222] w-full max-w-2xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden text-white font-mono text-xs shadow-2xl">
        {/* Шапка модалки */}
        <div className="px-6 py-4 border-b border-[#222222] flex items-center justify-between bg-[#141414]">
          <div className="pr-4">
            <span className="text-[10px] uppercase tracking-wider text-[#8b5cf6] font-bold">
              Редактор пластинки · Каталог СПб
            </span>
            <h2 className="text-sm font-bold text-white truncate max-w-md">
              {item.release.artists.map((a) => a.name).join(', ')} — {item.release.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#1f1f1f] text-[#888888] hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Тело формы */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Блок быстрого обогащения Discogs */}
          <div className="bg-[#141414] border border-[#222222] p-3.5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-white font-bold block">ID релиза Discogs: #{item.release.discogs_release_id || '—'}</span>
              <span className="text-[11px] text-[#737373]">Автоматически подтягивает фото, стили, страну и матрицы</span>
            </div>
            {item.release.discogs_release_id && (
              <button
                type="button"
                onClick={enrichFromDiscogs}
                disabled={fetchingDiscogs}
                className="px-3 py-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl flex items-center gap-1.5 font-semibold transition"
              >
                {fetchingDiscogs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                <span>Синхронизировать</span>
              </button>
            )}
          </div>

          {/* Цена и статус */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#141414] p-3.5 rounded-2xl border border-[#222222]">
            <div>
              <label className="block text-[#888888] mb-1">Цена продажи (₽)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="4900"
                className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white font-bold text-sm focus:border-[#8b5cf6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[#888888] mb-1">Тип издания</label>
              <select
                value={releaseType}
                onChange={(e) => setReleaseType(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white focus:outline-none"
              >
                <option value="Оригинал">Оригинал (Original Press)</option>
                <option value="Переиздание">Переиздание (Reissue)</option>
                <option value="Коллекционное">Коллекционное издание</option>
              </select>
            </div>
          </div>

          {/* Состояние пластинки и конверта */}
          <div className="grid grid-cols-2 gap-3 bg-[#141414] p-3.5 rounded-2xl border border-[#222222]">
            <div>
              <label className="block text-[#888888] mb-1">Состояние винила (Media)</label>
              <select
                value={conditionMedia}
                onChange={(e) => setConditionMedia(e.target.value as MediaCondition)}
                className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white focus:outline-none"
              >
                {MEDIA_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#888888] mb-1">Состояние конверта (Sleeve)</label>
              <select
                value={conditionSleeve}
                onChange={(e) => setConditionSleeve(e.target.value as SleeveCondition)}
                className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white focus:outline-none"
              >
                {SLEEVE_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Важные детали и формат */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#888888] mb-1">Важные детали (через запятую)</label>
              <input
                type="text"
                value={importantDetails}
                onChange={(e) => setImportantDetails(e.target.value)}
                placeholder="Limited edition, Numbered, Цветной винил"
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white focus:border-[#8b5cf6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[#888888] mb-1">Формат пластинки</label>
              <input
                type="text"
                value={formatDetails}
                onChange={(e) => setFormatDetails(e.target.value)}
                placeholder='12" EP, 45 RPM, Maxi Single'
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white focus:border-[#8b5cf6] focus:outline-none"
              />
            </div>
          </div>

          {/* Лейбл, Страна, Год */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[#888888] mb-1">Лейбл</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Mute, Melodiya..."
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#888888] mb-1">Страна</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Germany, UK, СССР"
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#888888] mb-1">Год релиза</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="1984"
                className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Дополнительная информация и матрицы */}
          <div>
            <label className="block text-[#888888] mb-1">Дополнительная информация (Matrix / Runout / Каталожный номер)</label>
            <textarea
              rows={3}
              value={extraInfo}
              onChange={(e) => setExtraInfo(e.target.value)}
              placeholder="L12 Bong 5 / INT 126.821&#10;Red Marbled Vinyl"
              className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          {/* Ссылка на Discogs */}
          <div>
            <label className="block text-[#888888] mb-1">Ссылка на релиз на Discogs</label>
            <input
              type="url"
              value={discogsUri}
              onChange={(e) => setDiscogsUri(e.target.value)}
              placeholder="https://www.discogs.com/release/24395"
              className="w-full bg-[#171717] border border-[#262626] rounded-xl px-3 py-2 text-white focus:outline-none"
            />
          </div>

          {/* Фотографии */}
          <div className="space-y-2 bg-[#141414] p-3.5 rounded-2xl border border-[#222222]">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#8b5cf6]" />
                Фотографии ({photos.length})
              </span>
              <label className="cursor-pointer text-[#8b5cf6] hover:underline flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>Загрузить с диска</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="Или вставьте прямую ссылку на фото..."
                className="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-3 py-1.5 text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddByUrl}
                className="px-3 py-1.5 bg-[#262626] hover:bg-[#333333] text-white rounded-xl"
              >
                Добавить
              </button>
            </div>

            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pt-2">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#333333] shrink-0 group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      className="absolute inset-0 bg-red-950/80 text-red-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Футер с кнопками сохранения */}
        <div className="px-6 py-4 border-t border-[#222222] bg-[#141414] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-[#888888] hover:text-white"
          >
            Отмена
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('draft')}
              className="px-4 py-2.5 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#cccccc] hover:text-white rounded-xl transition"
            >
              Сохранить в черновики
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('active')}
              className="px-5 py-2.5 bg-white hover:bg-[#8b5cf6] text-black hover:text-white font-bold rounded-xl transition shadow"
            >
              {saving ? 'Сохранение...' : 'Опубликовать на витрину'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
