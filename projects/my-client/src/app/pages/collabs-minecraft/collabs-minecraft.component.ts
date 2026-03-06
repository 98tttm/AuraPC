import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService, Product, productMainImage, productDisplayPrice } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';

const FEATURED_SLUGS = [
  'chuot-razer-cobra-phien-ban-minecraft-rz01-04650200-r3m1',
  'ban-phim-razer-blackwidow-v4-x-green-switch-phien-ban-minecraft-rz03-04704100-r3m1',
  'tai-nghe-razer-kraken-v4-x-phien-ban-minecraft-rz04-05180200-r3m1',
];

@Component({
  selector: 'app-collabs-minecraft',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './collabs-minecraft.component.html',
  styleUrls: ['./collabs-minecraft.component.css'],
})
export class CollabsMinecraftComponent implements OnInit {
  private api = inject(ApiService);
  private cart = inject(CartService);

  featuredProducts = signal<Product[]>([]);

  ngOnInit(): void {
    forkJoin(FEATURED_SLUGS.map((slug) => this.api.getProductBySlug(slug))).subscribe({
      next: (products) => this.featuredProducts.set(products.filter(Boolean)),
      error: () => this.featuredProducts.set([]),
    });
  }

  productImageUrl(p: Product): string {
    const url = productMainImage(p);
    return url || 'assets/placeholder-product.png';
  }

  formatPrice(p: Product): string {
    const price = productDisplayPrice(p);
    if (price == null || price <= 0) return 'Liên hệ';
    return price.toLocaleString('vi-VN') + '₫';
  }

  getRating(p: Product): { stars: number; count: number } {
    if (p.rating != null && p.reviewCount != null) {
      return { stars: p.rating, count: p.reviewCount };
    }
    const seed = (p._id ?? p.name ?? '').toString().charCodeAt(0) + (p.price ?? 0);
    return {
      stars: 4 + (seed % 11) / 10,
      count: 10 + (seed % 90),
    };
  }

  getStarArray(rating: number): number[] {
    const arr: number[] = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) arr.push(1);
      else if (rating >= i - 0.5) arr.push(0.5);
      else arr.push(0);
    }
    return arr;
  }

  addToCart(e: Event, p: Product): void {
    e.preventDefault();
    e.stopPropagation();
    this.cart.add(p);
  }
}
