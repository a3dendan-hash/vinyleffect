import React from 'react';
import { X, MapPin, Disc3, ShieldCheck, Layers, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#222222] rounded-3xl max-w-lg w-full p-6 sm:p-7 relative text-white max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-2 rounded-full bg-[#1c1c1c] transition border border-[#2e2e2e]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Шапка и логотип с вращающейся пластинкой */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full vinyl-grooves spin-vinyl border border-[#8b5cf6]/40 flex items-center justify-center p-0.5 shrink-0">
            <div className="w-5 h-5 rounded-full bg-[#0a0a0a] border border-[#262626] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>ВИНИЛПИТЕР</span>
              <span className="text-[11px] font-mono text-[#8b5cf6]">.РФ</span>
            </h2>
            <p className="text-xs font-mono text-[#888888]">Магазин виниловых пластинок</p>
          </div>
        </div>

        <p className="text-xs text-[#cccccc] leading-relaxed">
          Добро пожаловать в <strong>ВИНИЛПИТЕР.РФ</strong> — магазин виниловых пластинок в Санкт-Петербурге. Все релизы отобраны вручную, с подробной каталогизацией по базе Discogs: оригинальные издания, страна производства, происхождение авторов, матрицы и треклисты.
        </p>

        {/* Локация магазина */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] rounded-2xl p-4 space-y-2 font-mono text-xs">
          <div className="flex items-center gap-2.5 text-white">
            <MapPin className="w-4 h-4 text-[#8b5cf6] shrink-0" />
            <span className="font-semibold">г. Санкт-Петербург, магазин ул. Рубинштейна</span>
          </div>
          <p className="text-[#737373] text-[11px] leading-relaxed">
            Витрина и архив пластинок в центре города. Коллекция регулярно обновляется редкими европейскими, японскими и американскими изданиями.
          </p>
        </div>

        {/* Градация состояния винила Goldmine */}
        <div>
          <div className="flex items-center gap-2 mb-2 text-[#8b5cf6] font-semibold text-xs uppercase tracking-wider font-mono">
            <ShieldCheck className="w-4 h-4" />
            <h3>Стандарты градации</h3>
          </div>
          <div className="text-xs font-mono text-[#a3a3a3] bg-[#141414] p-3.5 rounded-2xl border border-[#222222] space-y-2 leading-relaxed">
            <p className="text-white font-medium">Оценка состояния пластинок и конвертов:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>M (Mint)</strong> — новая запечатанная пластинка.</li>
              <li><strong>NM / NM- (Near Mint)</strong> — близкое к идеальному состояние, без щелчков и песка.</li>
              <li><strong>EX (Excellent)</strong> — отличное состояние с минимальными следами бережного хранения.</li>
              <li><strong>VG+ (Very Good Plus)</strong> — очень хорошее звучание, допустимы легкие поверхностные волоски.</li>
            </ul>
          </div>
        </div>

        {/* Хранение и упаковка */}
        <div>
          <div className="flex items-center gap-2 mb-2 text-[#8b5cf6] font-semibold text-xs uppercase tracking-wider font-mono">
            <Layers className="w-4 h-4" />
            <h3>Хранение коллекции</h3>
          </div>
          <div className="text-xs font-mono text-[#a3a3a3] bg-[#141414] p-3.5 rounded-2xl border border-[#222222] space-y-1.5">
            <p>Пластинки очищены от статики и хранятся в защитных японских антистатических внутренних пакетах и плотных наружных конвертах.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
