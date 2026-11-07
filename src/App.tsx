import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Disc3, ShieldCheck, ShoppingBag, Trash2, X } from 'lucide-react';
import { initTelegramApp, isAdminUser, WebApp, haptic } from './lib/telegram';
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
  const location = useLocation();

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-w-xl mx-auto px-3.5 pt-3">
      <TelegramBackButtonManager />

      {/* Верхняя навигационная панель */}
      <header className="flex items-center justify-between mb-4 py-2">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => haptic.light()}>
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20">
            <Disc3 className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <span className="font-black text-base tracking-tight block leading-none">
              VinylEffect
            </span>
            <span className="text-[10px] text-zinc-400">Кураторский магазин винила</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              to={location.pathname === '/admin' ? '/' : '/admin'}
              onClick={() => haptic.light()}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                location.pathname === '/admin'
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-zinc-900 text-amber-400 border-zinc-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Админка</span>
            </Link>
          )}

          <button
            onClick={() => {
              haptic.light();
              setCartOpen(true);
            }}
            className="relative p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white"
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

      {/* Модальное окно корзины (для проверки позиций и резервная кнопка для браузера) */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-zinc-900 border-t border-zinc-800 w-full max-w-xl rounded-t-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Корзина ({items.length})</h3>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-full bg-zinc-800 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">Ваша корзина пуста.</p>
            ) : (
              <>
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
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

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-zinc-400 block">Итого к оплате</span>
                    <span className="text-lg font-black text-white">
                      {totalPrice.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <button
                    onClick={checkout}
                    disabled={isCheckingOut}
                    className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                  >
                    {isCheckingOut ? 'Бронируем...' : 'Подтвердить заказ'}
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