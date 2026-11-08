import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
  Info,
  MapPin,
  Phone,
  CreditCard,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { initTelegramApp, isAdminUser, WebApp, haptic, getTelegramUser } from './lib/telegram';
import { supabase } from './lib/supabase';
import { CartProvider, useCart } from './context/CartContext';
import { Catalog } from './pages/Catalog';
import { RecordDetails } from './pages/RecordDetails';
import { ArtistView } from './pages/ArtistView';
import { AdminDashboard } from './pages/AdminDashboard';
import { InfoModal } from './components/InfoModal';

// Синхронизация системной кнопки Назад в Telegram Mini App
const TelegramBackButtonManager: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleBack = () => {
      haptic.light();
      navigate(-1);
    };

    try {
      if (location.pathname !== '/') {
        WebApp.BackButton.show();
        WebApp.BackButton.onClick(handleBack);
      } else {
        WebApp.BackButton.hide();
      }
    } catch {}

    return () => {
      try {
        WebApp.BackButton.offClick(handleBack);
      } catch {}
    };
  }, [location.pathname, navigate]);

  return null;
};

const MainLayout: React.FC = () => {
  const isAdmin = isAdminUser();
  const { items, removeFromCart, totalPrice, checkout } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [deliveryMethod, setDeliveryMethod] = useState<'cdek' | 'yandex' | 'post' | 'pickup'>('cdek');
  const [paymentMethod, setPaymentMethod] = useState<'sber' | 'cash'>('sber');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [createdOrderCode, setCreatedOrderCode] = useState<string | null>(null);

  const location = useLocation();

  const handleConfirmOrder = async () => {
    if (deliveryMethod !== 'pickup' && !deliveryAddress.trim()) {
      alert('Пожалуйста, укажите адрес или пункт выдачи для доставки.');
      return;
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const tgUser = getTelegramUser();

    try {
      for (const item of items) {
        await supabase.from('orders').insert({
          order_code: code,
          item_id: item.id,
          buyer_telegram_id: tgUser ? String(tgUser.id) : 'anonymous',
          buyer_username: tgUser?.username || tgUser?.first_name || 'Покупатель',
          buyer_phone: buyerPhone.trim() || null,
          delivery_method: deliveryMethod,
          delivery_address: deliveryMethod === 'pickup' ? 'Личная встреча (СПб)' : deliveryAddress.trim(),
          payment_method: paymentMethod,
          total_price: item.price,
          status: 'new',
        });
      }
    } catch (e) {
      console.error('Ошибка записи заказа в базу:', e);
    }

    await checkout();
    setCreatedOrderCode(code);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-12 font-sans selection:bg-[#8b5cf6] selection:text-white">
      <TelegramBackButtonManager />

      {/* Верхний инфобар (Санкт-Петербург + контакты) */}
      <div className="border-b border-[#1f1f1f] bg-[#0c0c0c] text-[11px] font-mono text-[#888888] px-3 py-1.5 rounded-xl mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
          <span className="text-[#e5e5e5]">Санкт-Петербург</span>
          <span className="text-[#333333] hidden sm:inline">|</span>
          <span className="hidden sm:inline">Оригинальные пластинки</span>
        </div>
        <a href="tel:+79219675106" className="text-[#8b5cf6] hover:underline font-bold">
          +7 921 967-51-06
        </a>
      </div>

      {/* Хедер с вращающейся фиолетовой пластинкой с черным центром */}
      <header className="flex items-center justify-between mb-6 py-2 border-b border-[#222222]">
        <Link to="/" className="flex items-center gap-3 group" onClick={() => haptic.light()}>
          <div className="relative w-11 h-11 rounded-full vinyl-grooves border border-[#8b5cf6]/40 flex items-center justify-center p-0.5 spin-vinyl shrink-0 transition-transform group-hover:scale-105">
            <div className="w-5 h-5 rounded-full bg-[#0a0a0a] border border-[#262626] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#f5f5f5]" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white">ВИНИЛПИТЕР</span>
              <span className="text-[11px] font-mono text-[#8b5cf6] font-semibold">.РФ</span>
            </div>
            <span className="text-[10px] text-[#737373] tracking-widest font-mono uppercase block">
              Каталог в Санкт-Петербурге
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              haptic.light();
              setInfoOpen(true);
            }}
            className="px-3 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 bg-[#141414] hover:bg-[#1f1f1f] text-[#d4d4d4] border border-[#262626] transition"
          >
            <Info className="w-4 h-4 text-[#8b5cf6]" />
            <span className="hidden sm:inline">О магазине и доставке</span>
            <span className="sm:hidden">Инфо</span>
          </button>

          {isAdmin && (
            <Link
              to={location.pathname === '/admin' ? '/' : '/admin'}
              onClick={() => haptic.light()}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition ${
                location.pathname === '/admin'
                  ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                  : 'bg-[#141414] text-[#8b5cf6] border-[#262626] hover:bg-[#1f1f1f]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Админка</span>
            </Link>
          )}

          <button
            onClick={() => {
              haptic.light();
              setCreatedOrderCode(null);
              setCartOpen(true);
            }}
            className="relative p-2.5 rounded-xl bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-white transition"
          >
            <ShoppingBag className="w-4 h-4 text-[#8b5cf6]" />
            {items.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#8b5cf6] text-black text-[10px] font-extrabold flex items-center justify-center">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Роутинг страниц */}
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/record/:id" element={<RecordDetails />} />
        <Route path="/artist/:id" element={<ArtistView />} />
        {isAdmin && <Route path="/admin" element={<AdminDashboard />} />}
      </Routes>

      {/* Модалка О магазине и доставке */}
      <InfoModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} />

      {/* Боковая панель корзины и оформления */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#111111] border-t sm:border border-[#262626] w-full max-w-xl rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <h3 className="font-bold text-sm font-mono uppercase tracking-wider text-white">
                Корзина заказа ({items.length})
              </h3>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-full bg-[#1c1c1c] text-[#737373] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdOrderCode ? (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-lg font-bold text-white">Заказ успешно сформирован!</h4>
                <p className="text-xs text-[#888888] max-w-sm mx-auto">
                  Сохраните номер заказа. Назовите его при встрече или напишите администратору:
                </p>
                <div className="bg-[#0a0a0a] border-2 border-[#8b5cf6] rounded-2xl py-3 px-6 inline-block">
                  <span className="text-2xl font-black font-mono tracking-widest text-[#8b5cf6]">
                    #{createdOrderCode}
                  </span>
                </div>
                <p className="text-xs font-mono text-[#888888] pt-2">
                  Санкт-Петербург: <strong className="text-white">+7 921 967-51-06</strong>
                </p>
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs font-mono text-[#666666] py-10 text-center">Ваша корзина пуста.</p>
            ) : (
              <>
                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 divide-y divide-[#1c1c1c]">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between pt-2.5">
                      <div className="min-w-0 pr-3">
                        <p className="text-[11px] font-mono text-[#8b5cf6] truncate">
                          {it.release.artists.map((a) => a.name).join(', ')}
                        </p>
                        <h4 className="text-xs font-bold text-white truncate">{it.release.title}</h4>
                        <span className="text-xs font-mono font-bold text-white">
                          {it.price.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                      <button
                        onClick={() => removeFromCart(it.id)}
                        className="p-2 text-[#666666] hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#222222] space-y-3">
                  <div className="flex justify-between items-baseline font-mono text-sm">
                    <span className="text-[#888888]">Итого:</span>
                    <span className="text-lg font-bold text-white">{totalPrice.toLocaleString('ru-RU')} ₽</span>
                  </div>

                  {/* Доставка и контакты */}
                  <div className="space-y-2 text-xs font-mono">
                    <label className="text-[#888888] block">Способ получения:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('pickup')}
                        className={`p-2.5 rounded-xl border text-left text-xs ${
                          deliveryMethod === 'pickup'
                            ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] text-white font-bold'
                            : 'bg-[#141414] border-[#262626] text-[#888888]'
                        }`}
                      >
                        Личная встреча (СПб)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('cdek')}
                        className={`p-2.5 rounded-xl border text-left text-xs ${
                          deliveryMethod === 'cdek'
                            ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] text-white font-bold'
                            : 'bg-[#141414] border-[#262626] text-[#888888]'
                        }`}
                      >
                        СДЭК / Доставка по РФ
                      </button>
                    </div>

                    {deliveryMethod !== 'pickup' && (
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Город, адрес или пункт выдачи СДЭК..."
                        className="w-full bg-[#141414] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:border-[#8b5cf6] focus:outline-none"
                      />
                    )}

                    <input
                      type="tel"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="Ваш контактный телефон для подтверждения..."
                      className="w-full bg-[#141414] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:border-[#8b5cf6] focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleConfirmOrder}
                    className="w-full py-3.5 bg-white hover:bg-[#8b5cf6] text-black hover:text-white font-mono font-semibold text-xs tracking-wider uppercase transition-colors rounded-xl"
                  >
                    Подтвердить и забронировать
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Футер по стандарту Atelier Monolith */}
      <footer className="mt-16 pt-8 border-t border-[#1f1f1f] text-xs font-mono text-[#737373] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <span className="text-white font-bold block">ВИНИЛПИТЕР.РФ</span>
            <p className="text-[11px] leading-relaxed">
              Магазин оригинальных виниловых пластинок в Санкт-Петербурге. Каталог синхронизирован с Discogs.
            </p>
          </div>
          <div className="space-y-1.5">
            <span className="text-white font-bold block">Контакты</span>
            <p className="text-[11px]">г. Санкт-Петербург, ул. Рубинштейна</p>
            <a href="tel:+79219675106" className="text-[#8b5cf6] hover:underline block font-bold">
              +7 921 967-51-06
            </a>
          </div>
          <div className="space-y-1.5">
            <span className="text-white font-bold block">Стандарт Goldmine</span>
            <p className="text-[11px]">
              M (Mint) / NM (Near Mint) / EX (Excellent) / VG+ / VG
            </p>
          </div>
        </div>
        <div className="pt-4 border-t border-[#171717] flex justify-between items-center text-[11px]">
          <span>© ВИНИЛПИТЕР.РФ — Санкт-Петербург</span>
          <span className="text-[#8b5cf6]">Строгий аналоговый стандарт</span>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  useEffect(() => {
    initTelegramApp();
  }, []);

  return (
    <HashRouter>
      <CartProvider>
        <MainLayout />
      </CartProvider>
    </HashRouter>
  );
};

export default App;
