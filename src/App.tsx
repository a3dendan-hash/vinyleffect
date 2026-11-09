import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Info,
  MapPin,
} from 'lucide-react';
import { initTelegramApp, isAdminUser, WebApp, haptic } from './lib/telegram';
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
      const tg = WebApp as any;
      if (tg?.BackButton) {
        if (location.pathname !== '/') {
          tg.BackButton.show?.();
          tg.BackButton.onClick?.(handleBack);
        } else {
          tg.BackButton.hide?.();
        }
      }
    } catch {}

    return () => {
      try {
        (WebApp as any)?.BackButton?.offClick?.(handleBack);
      } catch {}
    };
  }, [location.pathname, navigate]);

  return null;
};

const MainLayout: React.FC = () => {
  const isAdmin = isAdminUser();
  const [infoOpen, setInfoOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // При заходе в приложение или браузер всегда загружается только каталог (защита от случайного открытия админки)
  useEffect(() => {
    if (!isAdmin && location.pathname === '/admin') {
      navigate('/', { replace: true });
    }
  }, [isAdmin, location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] w-full max-w-[1920px] 2xl:max-w-[2400px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-12 pt-3 pb-12 font-sans selection:bg-[#8b5cf6] selection:text-white">
      <TelegramBackButtonManager />

      {/* Верхний инфобар (Санкт-Петербург · витрина магазина) */}
      <div className="border-b border-[#1f1f1f] bg-[#0c0c0c] text-[11px] font-mono text-[#888888] px-3 py-1.5 rounded-xl mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
          <span className="text-[#e5e5e5]">Санкт-Петербург</span>
          <span className="text-[#333333] hidden sm:inline">|</span>
          <span className="hidden sm:inline">Магазин оригинального винила</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#a3a3a3]">
          <MapPin className="w-3.5 h-3.5 text-[#8b5cf6]" />
          <span>ул. Рубинштейна</span>
        </div>
      </div>

      {/* Хедер с вращающейся пластинкой */}
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
            <span className="hidden sm:inline">О магазине</span>
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
        </div>
      </header>

      {/* Роутинг страниц */}
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/record/:id" element={<RecordDetails />} />
        <Route path="/artist/:id" element={<ArtistView />} />
        {isAdmin && <Route path="/admin" element={<AdminDashboard />} />}
      </Routes>

      {/* Модалка О магазине */}
      <InfoModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} />

      {/* Футер магазина */}
      <footer className="mt-16 pt-8 border-t border-[#1f1f1f] text-xs font-mono text-[#737373] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <span className="text-white font-bold block">ВИНИЛПИТЕР.РФ</span>
            <p className="text-[11px] leading-relaxed">
              Магазин оригинальных виниловых пластинок в Санкт-Петербурге. Каталог синхронизирован с Discogs.
            </p>
          </div>
          <div className="space-y-1.5">
            <span className="text-white font-bold block">Адрес</span>
            <p className="text-[11px]">г. Санкт-Петербург, ул. Рубинштейна</p>
          </div>
          <div className="space-y-1.5">
            <span className="text-white font-bold block">Магазин виниловых пластинок</span>
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
      <MainLayout />
    </HashRouter>
  );
};

export default App;
