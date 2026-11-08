import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Disc3,
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
  const { items, removeFromCart, totalPrice, checkout, isCheckingOut } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Поля оформления заказа в корзине
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
      // Сохраняем заказ с кодом и выбранной доставкой в таблицу orders
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
      console.error('Ошибка записи заказа:', e);
    }

    await checkout();
    setCreatedOrderCode(code);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-10">
      <TelegramBackButtonManager />

      {/* Верхняя навигационная панель */}
      <header className="flex items-center justify-between mb-6 py-2 border-b border-zinc-900">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => haptic.light()}>
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 shrink-0">
            <Disc3 className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <span className="font-black text-base sm:text-lg tracking-tight block leading-none">
              VinylEffect
            </span>
            <span className="text-[11px] text-zinc-400">Санкт-Петербург · Магазин винила</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {/* Кнопка "О магазине и доставке" */}
          <button
            onClick={() => {
              haptic.light();
              setInfoOpen(true);
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition"
          >
            <Info className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">О магазине и доставке</span>
            <span className="sm:hidden">Инфо</span>
          </button>

          {isAdmin && (
            <Link
              to={location.pathname === '/admin' ? '/' : '/admin'}
              onClick={() => haptic.light()}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                location.pathname === '/admin'
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-zinc-900 text-amber-400 border-zinc-800 hover:bg-zinc-800'
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
            className="relative p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white transition"
          >
            <ShoppingBag className="w-4 h-4" />
            {items.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-extrabold flex items-center justify-center">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Контент маршрутов */}
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/record/:id" element={<RecordDetails />} />
        <Route path="/artist/:id" element={<ArtistView />} />
        {isAdmin && <Route path="/admin" element={<AdminDashboard />} />}
      </Routes>

      {/* Модальное окно "О магазине / Оплата и доставка" */}
      {infoOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 relative text-white max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setInfoOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-full bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center text-black shrink-0">
                <Disc3 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">О магазине VinylEffect</h2>
                <p className="text-xs text-zinc-400">Кураторский магазин виниловых пластинок</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed mb-5">
              Добро пожаловать в <strong>VinylEffect</strong>! Мы бережно собираем, проверяем и оцениваем виниловые пластинки по международному стандарту Goldmine. У нас вы найдете как редкие коллекционные издания, так и проверенную временем классику. Каждая пластинка надежно упаковывается перед отправкой.
            </p>

            {/* Контакты */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-5 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                <span>г. Санкт-Петербург</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                <a href="tel:+79679675105" className="text-amber-400 hover:underline font-bold">
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
              <ul className="text-xs text-zinc-300 space-y-2 list-disc list-inside bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-800/80">
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
              <div className="text-xs text-zinc-300 bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-800/80 space-y-2">
                <p>Доставка осуществляется почтой России, Яндекс Доставкой, СДЭКом, а также возможна личная встреча:</p>
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
      )}

      {/* Модальное окно корзины и оформления заказа */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-zinc-900 border-t sm:border border-zinc-800 w-full max-w-xl rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Корзина ({items.length})</h3>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdOrderCode ? (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-lg font-bold text-white">Заказ успешно оформлен!</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Сохраните ваш уникальный код заказа. Назовите или напишите его администратору при получении или оплате:
                </p>
                <div className="bg-zinc-950 border-2 border-amber-500 rounded-2xl py-3 px-6 inline-block">
                  <span className="text-2xl font-black tracking-widest text-amber-400">
                    #{createdOrderCode}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 pt-2">
                  По любым вопросам: <strong className="text-white">+7 967 967-51-05</strong> (Санкт-Петербург)
                </p>
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">Ваша корзина пуста.</p>
            ) : (
              <>
                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-2xl"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-[11px] text-amber-400 truncate">
                          {it.release.artists.map((a) => a.name).join(', ')}
                        </p>
                        <h4 className="text-xs font-bold text-white truncate">
                          {it.release.title}
                        </h4>
                        <span className="text-xs font-extrabold text-zinc-300">
                          {it.price.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                      <button
                        onClick={() => removeFromCart(it.id)}
                        className="p-2 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Выбор доставки */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <label className="text-xs font-semibold text-zinc-400 block">Способ доставки:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'cdek', label: 'СДЭК' },
                      { id: 'yandex', label: 'Яндекс Доставка' },
                      { id: 'post', label: 'Почта России' },
                      { id: 'pickup', label: 'Личная встреча (СПб)' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setDeliveryMethod(m.id as any);
                          if (m.id !== 'pickup' && paymentMethod === 'cash') {
                            setPaymentMethod('sber');
                          }
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition ${
                          deliveryMethod === m.id
                            ? 'bg-amber-500/15 border-amber-500 text-amber-400 font-bold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {deliveryMethod !== 'pickup' && (
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Город и адрес / номер пункта выдачи..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 mt-2"
                    />
                  )}
                </div>

                {/* Выбор оплаты */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 block">Способ оплаты:</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('sber')}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition ${
                        paymentMethod === 'sber'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-400 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      Перевод на карту Сбербанка (из любого отделения Сбербанка РФ)
                    </button>
                    {deliveryMethod === 'pickup' && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition ${
                          paymentMethod === 'cash'
                            ? 'bg-amber-500/15 border-amber-500 text-amber-400 font-bold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                        }`}
                      >
                        Наличными при встрече (Санкт-Петербург и окрестности)
                      </button>
                    )}
                  </div>
                </div>

                {/* Телефон для связи */}
                <div>
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="Ваш телефон для связи (необязательно)"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-zinc-400 block">Итого к оплате</span>
                    <span className="text-lg font-black text-white">
                      {totalPrice.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <button
                    onClick={handleConfirmOrder}
                    disabled={isCheckingOut}
                    className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition"
                  >
                    {isCheckingOut ? 'Оформляем...' : 'Подтвердить заказ'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  useEffect(() => {
    initTelegramApp();
    try {
      WebApp.expand();
    } catch {}
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
