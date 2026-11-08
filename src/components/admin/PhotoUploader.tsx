import React, { useState } from 'react';
import { Camera, Trash2, Loader2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { haptic } from '../../lib/telegram';

interface Props {
  itemId: string;
  photos: string[];
  onChange: (photos: string[]) => void;
}

export const PhotoUploader: React.FC<Props> = ({ itemId, photos, onChange }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

        const { error } = await supabase.storage
          .from('vinyl-photos')
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        const { data } = supabase.storage.from('vinyl-photos').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }

      haptic.success();
      onChange([...photos, ...newUrls]);
    } catch (err: any) {
      haptic.error();
      alert(`Ошибка загрузки: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (urlToRemove: string) => {
    haptic.light();
    onChange(photos.filter((u) => u !== urlToRemove));
  };

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between">
        <span className="text-white font-bold flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-[#8b5cf6]" />
          Фотографии винила ({photos.length})
        </span>

        <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-[#8b5cf6] hover:underline">
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Загрузка...</span>
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              <span>Добавить фото</span>
            </>
          )}
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2">
          {photos.map((url, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[#2a2a2a] group">
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
  );
};
