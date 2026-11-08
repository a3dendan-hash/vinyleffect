import React from 'react';
import { X, MapPin, Phone, CreditCard, Truck, Disc3 } from 'lucide-react';

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

        {/* Шапка и логотип с вращающейся фиолетовой пластинкой */}
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
            <p className="text-xs font-mono text-[#888888]">Оригинальные пластинки в Санкт-Петербурге</p>
          </div>
        </div>

        <p className="text-xs text-[#cccccc] leading-relaxed">
          Добро пожаловать в <strong>ВИНИЛПИТЕР</strong>! Мы отбираем, проверяем и классифицируем оригинальные виниловые издания по международному каталожному стандарту Goldmine. Каждый экземпляр тщательно проверяется и бережно упаковывается перед передачей или отправкой.
        </p>

        {/* Контакты в СПб */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] rounded-2xl p-4 space-y-2.5 font-mono text-xs">
          <div className="flex items-center gap-2.5 text-white">
            <MapPin className="w-4 h-4 text-[#8b5cf6] shrink-0" />
            <span>г. Санкт-Петербург, магазин ул. Рубинштейна</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-[#8b5cf6] shrink-0" />
            <a href="tel:+79219675106" className="text-white hover:text-[#8b5cf6] font-bold text-sm transition">
              +7 921 967-51-06
            </a>
          </div>
        </div>

        {/* Оплата */}
        <div>
          <div className="flex items-center gap-2 mb-2 text-[#8b5cf6] font-semibold text-xs uppercase tracking-wider font-mono">
            <CreditCard className="w-4 h-4" />
            <h3>Оплата</h3>
          </div>
          <ul className="text-xs font-mono text-[#a3a3a3] space-y-1.5 list-disc list-inside bg-[#141414] p-3.5 rounded-2xl border border-[#222222]">
            <li>Наличными при встрече в Санкт-Петербурге;</li>
            <li>Перевод на карту Сбербанка / Т-Банка (СБП);</li>
            <li>Безналичный расчет для коллекционеров.</li>
          </ul>
        </div>

        {/* Доставка */}
        <div>
          <div className="flex items-center gap-2 mb-2 text-[#8b5cf6] font-semibold text-xs uppercase tracking-wider font-mono">
            <Truck className="w-4 h-4" />
            <h3>Доставка</h3>
          </div>
          <div className="text-xs font-mono text-[#a3a3a3] bg-[#141414] p-3.5 rounded-2xl border border-[#222222] space-y-2">
            <p>Отправка в жестких бронекоробах с защитой уголков:</p>
            <ul className="space-y-1 list-disc list-inside font-medium text-white">
              <li>СДЭК (экспресс по России)</li>
              <li>Яндекс Доставка / Курьер по СПб</li>
              <li>Почта России</li>
              <li>Самовывоз и личная встреча (Санкт-Петербург)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
