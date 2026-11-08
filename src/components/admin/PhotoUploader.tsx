import React, { useState } from 'react';
import { Image, Globe, Upload, Trash2, Loader2 } from 'lucide-react';

interface Props {
  discogsReleaseId?: string | null;
  coverUrl: string;
  customImages: string[];
  onUpdateCover: (url: string) => void;
  onUpdateCustomImages: (urls: string[]) => void;
}

export const PhotoUploader: React.FC<Props> = ({
  discogsReleaseId,
  coverUrl,
  customImages,
  onUpdateCover,
  onUpdateCustomImages,
}) => {
  const [loadingDiscogs, setLoadingDiscogs] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Автоматическое получение обложки с Discogs по ID релиза
  const fetchFromDiscogs = async () => {
    if (!discogsReleaseId) {
      alert('У этой пластинки нет ID релиза Discogs');
      return;
    }
    setLoadingDiscogs(true);
    try {
      const res = await fetch(`https://api.discogs.com/releases/${discogsReleaseId}`, {
        headers: { 'User-Agent': 'VinylEffectApp/1.0' },
      });
      const data = await res.json();
      const primaryImage = data?.images?.[0]?.uri || data?.thumb;
      if (primaryImage) {
        onUpdateCover(primaryImage);
      } else {
        alert('Обложка в базе Discogs не найдена, вставьте ссылку на фото вручную.');
      }
    } catch {
      alert('Ошибка связи с Discogs. Попробуйте вставить ссылку на картинку вручную.');
    } finally {
      setLoadingDiscogs(false);
    }
  };

  // Загрузка собственной фотографии с компьютера или телефона
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!coverUrl) {
        onUpdateCover(result);
      } else {
        onUpdateCustomImages([...customImages, result]);
      }
    };
    reader.readAsDataURL(file);
  };

  // Добавление фото по прямой ссылке
  const handleAddByUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (!coverUrl) {
      onUpdateCover(trimmed);
    } else {
      onUpdateCustomImages([...customImages, trimmed]);
    }
    setImageUrlInput('');
  };

  return (
    <div className="space-y-3 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <Image className="w-4 h-4 text-amber-500" />
          Фотографии пластинки (Discogs и свои)
        </span>

        {discogsReleaseId && (
          <button
            type="button"
            onClick={fetchFromDiscogs}
            disabled={loadingDiscogs}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-amber-400 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition"
          >
            {loadingDiscogs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            <span>Подтянуть с Discogs</span>
          </button>
        )}
      </div>

      {/* Превью загруженных фотографий */}
      <div className="flex gap-2 overflow-x-auto py-1">
        {coverUrl && (
          <div className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-amber-500 shrink-0">
            <img src={coverUrl} alt="Обложка" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onUpdateCover('')}
              className="absolute top-1 right-1 bg-black/70 text-red-400 p-1 rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
        {customImages.map((img, idx) => (
          <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
            <img src={img} alt="Фото" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onUpdateCustomImages(customImages.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 bg-black/70 text-red-400 p-1 rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Поле ссылки и кнопка загрузки файла */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2">
        <input
          type="text"
          value={imageUrlInput}
          onChange={(e) => setImageUrlInput(e.target.value)}
          placeholder="Ссылка на фото с Discogs..."
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white"
        />
        <button
          type="button"
          onClick={handleAddByUrl}
          className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-lg shrink-0"
        >
          По ссылке
        </button>
        <label className="cursor-pointer bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 relative overflow-hidden shrink-0 select-none">
          <Upload className="w-3.5 h-3.5" />
          <span>Свое фото</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
      </div>
    </div>
  );
};
