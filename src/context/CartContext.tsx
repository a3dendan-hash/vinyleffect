import React, { createContext, useContext, useEffect, useState } from 'react';
import { VinylItem } from '../types/database';
import { haptic } from '../lib/telegram';

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

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'vinyl_marketplace_cart_v2';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<VinylItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Не удалось сохранить корзину в localStorage:', e);
    }
  }, [items]);

  const addToCart = (item: VinylItem) => {
    setItems((prev) => {
      if (prev.some((it) => it.id === item.id)) return prev;
      haptic.medium();
      return [...prev, item];
    });
  };

  const removeFromCart = (itemId: string) => {
    haptic.light();
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const isInCart = (itemId: string) => items.some((it) => it.id === itemId);

  const totalPrice = items.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

  const checkout = async () => {
    setIsCheckingOut(true);
    try {
      haptic.success();
      clearCart();
    } finally {
      setIsCheckingOut(false);
    }
  };

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
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
