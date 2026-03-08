import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, productDisplayPrice, productMainImage } from '../../core/services/api.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';

@Component({
  selector: 'app-recently-viewed-section',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './recently-viewed-section.component.html',
  styleUrl: './recently-viewed-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentlyViewedSectionComponent {
  private recentlyViewed = inject(RecentlyViewedService);

  title = input('SẢN PHẨM VỪA XEM');
  limit = input(4);
  showEmpty = input(false);

  items = signal<Product[]>([]);

  constructor() {
    effect(() => {
      this.items.set(this.recentlyViewed.list(this.limit()));
    });
  }

  productKey(product: Product): string {
    return String(product._id || product.product_id || product.slug || product.name || '');
  }

  productRoute(product: Product): string[] {
    return product.slug ? ['/san-pham', product.slug] : ['/san-pham'];
  }

  productQueryParams(product: Product): Record<string, string> | null {
    return product.slug ? null : product.name ? { search: product.name } : null;
  }

  image(product: Product): string {
    return productMainImage(product);
  }

  price(product: Product): string {
    const value = productDisplayPrice(product);
    if (!value || value <= 0) return 'Liên hệ';
    return `${value.toLocaleString('vi-VN')}đ`;
  }

  oldPrice(product: Product): string {
    const value = Number(product.old_price) || 0;
    if (value <= 0 || value <= productDisplayPrice(product)) return '';
    return `${value.toLocaleString('vi-VN')}đ`;
  }
}
