import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService, Product, productMainImage, productDisplayPrice, productHasSale, productSalePercent } from '../../core/services/api.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailComponent {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private sanitizer = inject(DomSanitizer);

  product = signal<Product | null>(null);
  loading = signal(true);
  error = signal(false);

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }
    this.api.getProductBySlug(slug).subscribe({
      next: (p) => {
        this.product.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  mainImage(p: Product): string {
    return productMainImage(p);
  }

  displayPrice(p: Product): number {
    return productDisplayPrice(p);
  }

  hasSale(p: Product): boolean {
    return productHasSale(p);
  }

  salePercent(p: Product): number {
    return productSalePercent(p);
  }

  /** Giá hiển thị: "Liên hệ" nếu price = 0, ngược lại format VNĐ. */
  priceLabel(p: Product): string {
    const price = productDisplayPrice(p);
    if (price == null || price <= 0) return 'Liên hệ';
    return price.toLocaleString('vi-VN') + '₫';
  }

  /** Giá gốc (khi giảm) để gạch ngang. */
  oldPriceLabel(p: Product): string {
    if (!this.hasSale(p)) return '';
    const old = p.old_price ?? (p.price ?? 0);
    if (old <= 0) return '';
    return old.toLocaleString('vi-VN') + '₫';
  }

  /** Mô tả HTML (description_html hoặc description) dùng bypassSecurityTrustHtml để render. */
  descriptionSafe(p: Product): SafeHtml | null {
    const html = p.description_html ?? p.description;
    if (!html || typeof html !== 'string') return null;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /** Bảng specs từ p.specs (Record<string, string>). */
  specEntries(p: Product): { key: string; value: string }[] {
    const specs = p.specs ?? {};
    return Object.entries(specs)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([key, value]) => ({ key, value: String(value) }));
  }
}
