import React from 'react';
import { X, MapPin, Phone, CreditCard, Truck, Disc } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 relative text-white max-h-[90vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-lg bg-zinc-800/60 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Шапка и приветствие */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center text-black shrink-0">
            <Disc className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">О магазине VinylEffect</h2>
            <p className="text-xs text-zinc-400">Кураторский магазин виниловых пластинок</p>
          </div>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed mb-5">
          Добро пожаловать в <strong>VinylEffect</strong>! Мы бережно собираем, проверяем и оцениваем виниловые пластинки по международному стандарту Goldmine. У нас вы найдете как редкие коллекционные издания, так и проверенную временем классику. Каждая пластинка надежно упаковывается перед отправкой.
        </p>

        {/* Контакты и город */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-5 space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm">
            <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
            <span>г. Санкт-Петербург</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Phone className="w-4 h-4 text-amber-500 shrink-0" />
            <a href="tel:+79679675105" className="text-amber-400 hover:underline font-semibold">
              +7 967 967-51-05
            </a>
          </div>
        </div>

        {/* Оплата */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2 text-amber-500 font-semibold text-sm">
            <CreditCard className="w-4 h-4" />
            <h3>Оплата</h3>
          </div>
          <ul className="text-xs text-zinc-300 space-y-2 list-disc list-inside bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
            <li>Наличными при встрече (в пределах Санкт-Петербурга и его окрестностей);</li>
            <li>Перевод на карту Сбербанка (из любого отделения Сбербанка РФ).</li>
          </ul>
        </div>

        {/* Доставка */}
        <div>
          <div className="flex items-center gap-2 mb-2 text-amber-500 font-semibold text-sm">
            <Truck className="w-4 h-4" />
            <h3>Доставка</h3>
          </div>
          <div className="text-xs text-zinc-300 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80 space-y-2">
            <p>Доставка осуществляется по всей стране и по городу:</p>
            <ul className="space-y-1.5 list-disc list-inside font-medium text-white">
              <li>Почта России</li>
              <li>Яндекс Доставка</li>
              <li>СДЭК</li>
              <li>Личная встреча (Санкт-Петербург и окрестности)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
