import { Injectable, signal } from '@angular/core';
import type { Product } from './api.service';

const STORAGE_KEY = 'aurapc_recently_viewed_products';
const MAX_ITEMS = 12;

@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private items = signal<Product[]>(this.read());

  private read(): Product[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(items: Product[]): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch {
      // Ignore storage failures.
    }
  }

  private productKey(product: Product | null | undefined): string {
    if (!product) return '';
    return String(product._id || product.product_id || product.slug || '').trim();
  }

  track(product: Product): void {
    const key = this.productKey(product);
    if (!key) return;

    const snapshot: Product = {
      _id: product._id,
      product_id: product.product_id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      old_price: product.old_price ?? null,
      salePrice: product.salePrice ?? null,
      images: Array.isArray(product.images) ? [...product.images] : [],
      category: product.category,
      brand: product.brand,
      rating: product.rating,
      reviewCount: product.reviewCount,
      shortDescription: product.shortDescription,
    };

    const next = [snapshot, ...this.items().filter((item) => this.productKey(item) !== key)];
    this.items.set(next.slice(0, MAX_ITEMS));
    this.write(next);
  }

  list(limit = 4, excludeKey?: string): Product[] {
    const normalizedExclude = String(excludeKey || '').trim();
    const items = this.items().filter((item) => this.productKey(item) !== normalizedExclude);
    return items.slice(0, Math.max(0, limit));
  }
}
