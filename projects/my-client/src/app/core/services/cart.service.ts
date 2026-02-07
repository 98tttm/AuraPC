import { Injectable, signal, computed } from '@angular/core';
import { Product } from './api.service';

export interface CartItem {
  product: Product;
  qty: number;
}

const CART_KEY = 'aurapc_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private items = signal<CartItem[]>(this.loadFromStorage());

  cartCount = computed(() => this.items().reduce((sum, i) => sum + i.qty, 0));
  cartTotal = computed(() =>
    this.items().reduce((sum, i) => sum + (i.product.salePrice ?? i.product.price) * i.qty, 0)
  );

  private loadFromStorage(): CartItem[] {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { product: Product; qty: number }[];
      return parsed.filter((x) => x.product && x.qty > 0);
    } catch {
      return [];
    }
  }

  private save(): void {
    const data = this.items().map(({ product, qty }) => ({ product, qty }));
    localStorage.setItem(CART_KEY, JSON.stringify(data));
  }

  getItems(): CartItem[] {
    return this.items();
  }

  add(product: Product, qty = 1): void {
    const list = [...this.items()];
    const idx = list.findIndex((i) => i.product._id === product._id);
    if (idx >= 0) list[idx].qty += qty;
    else list.push({ product, qty });
    this.items.set(list);
    this.save();
  }

  setQty(productId: string, qty: number): void {
    if (qty <= 0) {
      this.remove(productId);
      return;
    }
    const list = this.items().map((i) =>
      i.product._id === productId ? { ...i, qty } : i
    );
    this.items.set(list);
    this.save();
  }

  remove(productId: string): void {
    this.items.set(this.items().filter((i) => i.product._id !== productId));
    this.save();
  }

  clear(): void {
    this.items.set([]);
    this.save();
  }
}
