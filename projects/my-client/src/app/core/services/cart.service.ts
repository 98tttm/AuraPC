import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product, productDisplayPrice } from './api.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { Subject } from 'rxjs';

export interface CartItem {
  product: Product;
  qty: number;
}

interface CartApiItem {
  product: Product;
  quantity: number;
}

interface CartApiResponse {
  success: boolean;
  items: CartApiItem[];
  message?: string;
}

const CART_KEY = 'aurapc_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private items = signal<CartItem[]>(this.loadFromStorage());
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/cart`;

  itemAdded$ = new Subject<Product>();

  cartCount = computed(() => this.items().reduce((sum, i) => sum + i.qty, 0));
  cartTotal = computed(() =>
    this.items().reduce((sum, i) => sum + productDisplayPrice(i.product) * i.qty, 0)
  );

  constructor() {
    // Logged-in user: DB is source of truth. Load cart from server.
    effect(() => {
      const user = this.auth.currentUser();
      const uid = user?._id || user?.id || '';
      if (uid) {
        this.fetchServerCart(uid);
      }
    });
  }

  private loadFromStorage(): CartItem[] {
    try {
      if (typeof localStorage === 'undefined') return [];
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CART_KEY, JSON.stringify(data));
    }
  }

  private get userId(): string | undefined {
    return this.auth.currentUser()?._id || this.auth.currentUser()?.id;
  }

  private productIdOf(product: Product | null | undefined): string | null {
    const p = product as (Product & { id?: string }) | null | undefined;
    const id = p?._id ?? p?.product_id ?? p?.id;
    return id ? String(id) : null;
  }

  private normalizeProduct(product: Product | null | undefined): Product | null {
    if (!product) return null;
    const id = this.productIdOf(product);
    if (!id) return null;
    const p = product as (Product & { id?: string });
    return { ...p, _id: id, product_id: p.product_id ?? id };
  }

  private applyServerItems(items: CartApiItem[] | undefined): void {
    const normalized: CartItem[] = Array.isArray(items)
      ? items.reduce<CartItem[]>((acc, i) => {
        const product = this.normalizeProduct(i?.product);
        const qty = Number(i?.quantity) || 0;
        if (product && qty > 0) acc.push({ product, qty });
        return acc;
      }, [])
      : [];
    this.items.set(normalized);
    this.save();
  }

  private fetchServerCart(userId: string): void {
    this.http
      .get<CartApiResponse>(`${this.apiUrl}`, { params: { userId } })
      .subscribe({
        next: (res) => {
          if (res?.success) this.applyServerItems(res.items);
        },
        error: (err) => console.error('Fetch cart api error', err),
      });
  }

  private syncWithServer(userId: string): void {
    const localItems = this.items()
      .map((i) => ({ productId: this.productIdOf(i.product), quantity: i.qty }))
      .filter((i): i is { productId: string; quantity: number } => !!i.productId);

    this.http
      .post<CartApiResponse>(`${this.apiUrl}/sync`, { userId, items: localItems })
      .subscribe({
        next: (res) => {
          if (res?.success) {
            this.applyServerItems(res.items);
          }
        },
        error: (err) => {
          console.error('Cart sync failed', err);
          this.fetchServerCart(userId);
        },
      });
  }

  private addToServer(productId: string, qty: number): void {
    const userId = this.userId;
    if (!userId) return;
    this.http
      .post<CartApiResponse>(`${this.apiUrl}/add`, { userId, productId, quantity: qty })
      .subscribe({
        next: (res) => {
          if (res?.success) this.applyServerItems(res.items);
        },
        error: (e) => {
          console.error('Add cart api error', e);
          if (userId) this.fetchServerCart(userId);
        },
      });
  }

  private updateServer(productId: string, qty: number): void {
    const userId = this.userId;
    if (!userId) return;
    this.http
      .put<CartApiResponse>(`${this.apiUrl}/update`, { userId, productId, quantity: qty })
      .subscribe({
        next: (res) => {
          if (res?.success) this.applyServerItems(res.items);
        },
        error: (e) => {
          console.error('Update cart api error', e);
          if (userId) this.fetchServerCart(userId);
        },
      });
  }

  private removeServer(productId: string): void {
    const userId = this.userId;
    if (!userId) return;
    this.http
      .delete<CartApiResponse>(
        `${this.apiUrl}/remove?userId=${encodeURIComponent(userId)}&productId=${encodeURIComponent(productId)}`
      )
      .subscribe({
        next: (res) => {
          if (res?.success) this.applyServerItems(res.items);
        },
        error: (e) => {
          console.error('Remove cart api error', e);
          if (userId) this.fetchServerCart(userId);
        },
      });
  }

  getItems(): CartItem[] {
    return this.items();
  }

  add(product: Product, qty = 1): void {
    const productId = this.productIdOf(product);
    const normalizedProduct = this.normalizeProduct(product);
    if (!productId || !normalizedProduct) return;
    const userId = this.userId;

    // Logged-in: write directly to DB, then sync UI from API response.
    if (userId) {
      this.addToServer(productId, qty);
      this.itemAdded$.next(normalizedProduct);
      return;
    }

    const list = [...this.items()];
    const idx = list.findIndex((i) => this.productIdOf(i.product) === productId);
    if (idx >= 0) list[idx].qty += qty;
    else list.push({ product: normalizedProduct, qty });

    this.items.set(list);
    this.save();
    this.itemAdded$.next(normalizedProduct);
  }

  setQty(productId: string, qty: number): void {
    const normalizedProductId = String(productId || '');
    if (!normalizedProductId) return;
    const userId = this.userId;

    // Logged-in: write directly to DB, then sync UI from API response.
    if (userId) {
      this.updateServer(normalizedProductId, qty);
      return;
    }

    if (qty <= 0) {
      this.remove(normalizedProductId);
      return;
    }
    const list = this.items().map((i) =>
      this.productIdOf(i.product) === normalizedProductId ? { ...i, qty } : i
    );
    this.items.set(list);
    this.save();
  }

  remove(productId: string): void {
    const normalizedProductId = String(productId || '');
    if (!normalizedProductId) return;
    const userId = this.userId;

    // Logged-in: write directly to DB, then sync UI from API response.
    if (userId) {
      this.removeServer(normalizedProductId);
      return;
    }

    this.items.set(this.items().filter((i) => this.productIdOf(i.product) !== normalizedProductId));
    this.save();
  }

  /**
   * Remove multiple products at once.
   * Uses a dedicated server endpoint to avoid race conditions.
   */
  removeMultiple(productIds: string[]): void {
    if (!productIds.length) return;
    const idsToRemove = new Set(productIds.map(id => String(id)));

    // Immediately remove from local state
    this.items.set(
      this.items().filter((i) => {
        const pid = this.productIdOf(i.product);
        return !!pid && !idsToRemove.has(pid);
      })
    );
    this.save();

    // Logged-in: call server bulk remove endpoint
    const userId = this.userId;
    if (userId) {
      this.http
        .post<CartApiResponse>(`${this.apiUrl}/remove-multiple`, { userId, productIds })
        .subscribe({
          next: (res) => {
            if (res?.success) this.applyServerItems(res.items);
          },
          error: (err) => {
            console.error('Remove-multiple cart api error', err);
          },
        });
    }
  }

  /**
   * Clear cart. For logged-in users: xóa trên server trước, rồi mới cập nhật state từ response.
   * Tránh race: nếu set [] trước rồi mới gọi API, effect/fetch có thể load lại giỏ cũ trước khi API xong.
   */
  clear(): void {
    const userId = this.userId;
    const currentItems = this.items();
    const productIds = currentItems
      .map((i) => this.productIdOf(i.product))
      .filter((id): id is string => !!id);

    if (userId && productIds.length > 0) {
      this.http
        .post<CartApiResponse>(`${this.apiUrl}/remove-multiple`, { userId, productIds })
        .subscribe({
          next: (res) => {
            if (res?.success) this.applyServerItems(res.items);
          },
          error: (err) => {
            console.error('Clear cart (remove-multiple) api error', err);
            this.items.set([]);
            this.save();
          },
        });
    } else {
      this.items.set([]);
      this.save();
    }
  }
}

