import React, { useState } from 'react';
import { X, Camera, Trash2, Sparkles, Loader2, Check, Globe, Upload, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { VinylItem, MediaCondition, SleeveCondition, ItemStatus } from '../../types/database';
import { haptic } from '../../lib/telegram';

const MEDIA_GRADES: MediaCondition[] = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'];
const SLEEVE_GRADES: SleeveCondition[] = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P', 'Generic'];

interface Props {
  item: VinylItem;
  onClose: () => void;
  onSaved: () => void;
}

export const ItemEditorModal: React.FC<Props> = ({ item, onClose, onSaved }) => {
  const [price, setPrice] = useState<string>(item.price ? String(item.price) : '');
  const [conditionMedia, setConditionMedia] = useState<MediaCondition>(item.condition_media || 'VG+');
  const [conditionSleeve, setConditionSleeve] = useState<SleeveCondition>(item.condition_sleeve || 'VG+');
  const [description, setDescription] = useState<string>(item.description || '');
  const [photos, setPhotos] = useState<string[]>(item.photos || []);
  const [coverUrl, setCoverUrl] = useState<string>(item.release.default_cover_url || '');
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Метаданные релиза (жанры, стили, страна, год)
  const [genresInput, setGenresInput] = useState<string>(item.release.genre.join(', '));
  const [stylesInput, setStylesInput] = useState<string>(item.release.style.join(', '));
  const [country, setCountry] = useState<string>(item.release.country || '');
  const [year, setYear] = useState<string>(item.release.year ? String(item.release.year) : '');

  const [uploading, setUploading] = useState(false);
  const [fetchingDiscogs, setFetchingDiscogs] = useState(false);
  const [saving, setSaving] = useState(false);

  // Загрузка живых фотографий пластинки в Supabase Storage бакет 'vinyl-photos'
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

  // Автоматическое получение обложки и метаданных с Discogs по release_id
  const enrichFromDiscogs = async () => {
    const discogsId = item.release.discogs_release_id;
    if (!discogsId) {
      alert('У этой пластинки нет ID релиза Discogs');
      return;
    }

    setFetchingDiscogs(true);
    try {
      const res = await fetch(`https://api.discogs.com/releases/${discogsId}`, {
        headers: { 'User-Agent': 'VinylEffectApp/1.0' },
      });
      if (!res.ok) throw new Error('Не удалось получить данные от Discogs API');
      const data = await res.json();

      if (Array.isArray(data.genres)) setGenresInput(data.genres.join(', '));
      if (Array.isArray(data.styles)) setStylesInput(data.styles.join(', '));
      if (data.country) setCountry(data.country);
      if (data.year) setYear(String(data.year));
      
      const primaryImage = data?.images?.[0]?.uri || data?.thumb;
      if (primaryImage && !coverUrl) {
        setCoverUrl(primaryImage);
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
    if (!coverUrl) {
      setCoverUrl(trimmed);
    } else {
      setPhotos((prev) => [...prev, trimmed]);
    }
    setImageUrlInput('');
  };

  const handleSave = async (targetStatus: ItemStatus) => {
    const numericPrice = parseFloat(price);
    if (targetStatus === 'active' && (isNaN(numericPrice) || numericPrice <= 0)) {
      haptic.error();
      alert('Укажите корректную цену перед публикацией пластинки на витрину.');
      return;
    }

    setSaving(true);
    try {
      const genres = genresInput.split(',').map((s) => s.trim()).filter(Boolean);
      const styles = stylesInput.split(',').map((s) => s.trim()).filter(Boolean);

      // 1. Обновляем метаданные релиза (обложка, жанры, год)
      const { error: relErr } = await supabase
        .from('releases')
        .update({
          genre: genres,
          style: styles,
          country: country.trim() || null,
          year: year ? parseInt(year, 10) : null,
          default_cover_url: coverUrl || photos[0] || null,
        })
        .eq('id', item.release.id);

      if (relErr) throw relErr;

      // 2. Обновляем экземпляр пластинки
      const { error: itemErr } = await supabase
        .from('items')
        .update({
          price: isNaN(numericPrice) ? 0 : numericPrice,
          condition_media: conditionMedia,
          condition_sleeve: conditionSleeve,
          description: description.trim(),
          photos,
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-zinc-900 border-t sm:border border-zinc-800 w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden">
        {/* Шапка */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="pr-4">
            <span className="text-[11px] uppercase tracking-wider text-amber-500 font-semibold">
              Предпродажная подготовка
            </span>
            <h2 className="text-base font-bold text-white line-clamp-1">
              {item.release.artists.map((a) => a.name).join(', ')} — {item.release.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело формы */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* Управление обложкой и фото */}
          <div className="space-y-3 bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-500" />
                Обложка и фотографии
              </span>

              {item.release.discogs_release_id && (
                <button
                  type="button"
                  onClick={enrichFromDiscogs}
                  disabled={fetchingDiscogs}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-amber-400 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                >
                  {fetchingDiscogs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  <span>Заполнить из Discogs</span>
                </button>
              )}
            </div>

            {/* Превью */}
            <div className="flex gap-2 overflow-x-auto py-1">
              {coverUrl && (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-amber-500 shrink-0">
                  <img src={coverUrl} alt="Обложка" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverUrl('')}
                    className="absolute top-1 right-1 bg-black/70 text-red-400 p-1 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              {photos.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-700 shrink-0">
                  <img src={url} alt="Фото" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 bg-black/70 text-red-400 p-1 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Добавление по ссылке или файлом */}
            <div className="flex gap-2">
              <input
                type="text"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="Ссылка на фото..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleAddByUrl}
                className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-2 rounded-xl shrink-0"
              >
                По ссылке
              </button>
              <label className="cursor-pointer bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 relative overflow-hidden shrink-0">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Свое фото</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  disabled={uploading}
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>
          </div>

          {/* Цена */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Цена (₽)</label>
            <input
              type="number"
              placeholder="Например: 4500"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Состояние винила */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Состояние пластинки (Media — Goldmine)
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {MEDIA_GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setConditionMedia(grade);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    conditionMedia === grade
                      ? 'bg-amber-500 text-black border-amber-500'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Состояние конверта */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Состояние конверта (Sleeve — Goldmine)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {SLEEVE_GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => {
                    haptic.selection();
                    setConditionSleeve(grade);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    conditionSleeve === grade
                      ? 'bg-amber-500 text-black border-amber-500'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Метаданные релиза */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Метаданные релиза</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Жанры (через запятую)</label>
                <input
                  type="text"
                  placeholder="Rock, Jazz"
                  value={genresInput}
                  onChange={(e) => setGenresInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Стили (через запятую)</label>
                <input
                  type="text"
                  placeholder="Psychedelic Rock"
                  value={stylesInput}
                  onChange={(e) => setStylesInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Страна</label>
                <input
                  type="text"
                  placeholder="UK / US / Japan"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Год</label>
                <input
                  type="number"
                  placeholder="1975"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Описание */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Описание особенностей / матрицы / комплектации
            </label>
            <textarea
              rows={3}
              placeholder="Первый британский пресс..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Подвал с действиями */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="flex-1 py-3 rounded-2xl border border-zinc-700 text-zinc-300 font-semibold text-xs hover:bg-zinc-800 transition"
          >
            В черновики
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('active')}
            className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>На витрину</span>
          </button>
        </div>
      </div>
    </div>
  );
};
