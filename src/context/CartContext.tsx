import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { VinylItem } from '../types/database';
import { supabase } from '../lib/supabase';
import { WebApp, getTelegramUser, haptic } from '../lib/telegram';

interface CartContextType {
  items: VinylItem[];
  addToCart: (item: VinylItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  isInCart: (itemId: string) => boolean;
  totalPrice: number;
  checkout: () => Promise<void>;
  isCheckingOut: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<VinylItem[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const isInCart = useCallback(
    (itemId: string) => items.some((i) => i.id === itemId),
    [items]
  );

  // Защита от дублирования (каждая виниловая пластинка уникальна — 1 шт.)
  const addToCart = (item: VinylItem) => {
    if (isInCart(item.id)) return;
    haptic.medium();
    setItems((prev) => [...prev, item]);
  };

  const removeFromCart = (itemId: string) => {
    haptic.light();
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const clearCart = () => setItems([]);

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);

  const checkout = useCallback(async () => {
    if (items.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      const user = getTelegramUser();
      const itemIds = items.map((i) => i.id);

      // 1. Атомарно резервируем позиции в Supabase (перевод статуса в 'reserved')
      const { error: rpcError } = await supabase.rpc('reserve_items_for_checkout', {
        p_item_ids: itemIds,
      });

      if (rpcError) throw rpcError;

      // 2. Формируем текст уведомления для администратора
      const buyerTag = user?.username ? `@${user.username}` : `ID: ${user?.id || 'Неизвестен'}`;
      const buyerName = user?.first_name || 'Покупатель';

      const lines = items.map(
        (it, idx) =>
          `${idx + 1}. ${it.release.artists.map((a) => a.name).join(', ')} — ${
            it.release.title
          } (${it.condition_media}/${it.condition_sleeve}) — ${it.price.toLocaleString('ru-RU')} ₽`
      );

      const messageText = [
        `🔥 <b>Новый заказ в VinylEffect!</b>`,
        `👤 <b>Покупатель:</b> ${buyerName} (${buyerTag})`,
        ``,
        `💿 <b>Позиции (переведены в резерв):</b>`,
        ...lines,
        ``,
        `💰 <b>Итого:</b> ${totalPrice.toLocaleString('ru-RU')} ₽`,
      ].join('\n');

      // 3. Отправка уведомления владельцу через Telegram Bot API
      const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
      const adminChatId = import.meta.env.VITE_ADMIN_TELEGRAM_ID;

      if (botToken && adminChatId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: messageText,
            parse_mode: 'HTML',
          }),
        });
      }

      haptic.success();
      clearCart();
      WebApp.showAlert(
        'Заказ успешно оформлен! Пластинки забронированы за вами. Администратор свяжется с вами в Telegram.'
      );
    } catch (err: any) {
      haptic.error();
      WebApp.showAlert(err.message || 'Произошла ошибка при оформлении заказа.');
    } finally {
      setIsCheckingOut(false);
    }
  }, [items, isCheckingOut, totalPrice]);

  // Управление нативной кнопкой Telegram MainButton
  useEffect(() => {
    try {
      if (items.length > 0) {
        WebApp.MainButton.setText(
          `Оформить заказ (${items.length} шт. • ${totalPrice.toLocaleString('ru-RU')} ₽)`
        );
        WebApp.MainButton.show();
        WebApp.MainButton.onClick(checkout);
      } else {
        WebApp.MainButton.hide();
      }
    } catch {
      // Игнорируем ошибку вне окружения Telegram
    }

    return () => {
      try {
        WebApp.MainButton.offClick(checkout);
      } catch {}
    };
  }, [items, totalPrice, checkout]);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        clearCart,
        isInCart,
        totalPrice,
        checkout,
        isCheckingOut,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};