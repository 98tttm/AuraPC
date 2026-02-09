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
  currentImage = signal<string>('');
  loading = signal(true);
  error = signal(false);
  showFullDesc = signal(false);
  showSpecsModal = signal(false);

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
        this.currentImage.set(productMainImage(p));
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

  /** Danh sách ảnh gallery (bao gồm ảnh chính). */
  imageList(p: Product): string[] {
    if (!p.images || !p.images.length) return [];
    return p.images.map((img) => (typeof img === 'string' ? img : img.url));
  }

  selectImage(img: string) {
    this.currentImage.set(img);
  }

  prevImage() {
    const p = this.product();
    if (!p) return;
    const list = this.imageList(p);
    if (!list.length) return;
    const current = this.currentImage();
    const idx = list.indexOf(current);
    const prevIdx = (idx - 1 + list.length) % list.length;
    this.currentImage.set(list[prevIdx]);
  }

  nextImage() {
    const p = this.product();
    if (!p) return;
    const list = this.imageList(p);
    if (!list.length) return;
    const current = this.currentImage();
    const idx = list.indexOf(current);
    const nextIdx = (idx + 1) % list.length;
    this.currentImage.set(list[nextIdx]);
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

  /** Thông số tóm tắt hiển thị ở phần info (CPU, VGA, RAM, SSD, Màn hình). */
  shortSpecs(p: Product): { label: string; value: string }[] {
    const s = (p.specs ?? p.techSpecs ?? {}) as Record<string, string>;
    const keys = [
      { label: 'CPU', find: ['CPU', 'Vi xử lý', 'Chipset'] },
      { label: 'RAM', find: ['RAM', 'Bộ nhớ trong', 'Memory'] },
      { label: 'Ổ cứng', find: ['Ổ cứng', 'SSD', 'Storage'] },
      { label: 'VGA', find: ['VGA', 'Card đồ họa', 'GPU'] },
      { label: 'Màn hình', find: ['Màn hình', 'Display', 'LCD'] },
    ];
    const res: { label: string; value: string }[] = [];
    for (const k of keys) {
      for (const f of k.find) {
        // Tìm key (case insensitive)
        const foundKey = Object.keys(s).find((sk) => sk.toLowerCase() === f.toLowerCase());
        if (foundKey && s[foundKey]) {
          res.push({ label: k.label, value: String(s[foundKey]) });
          break; // Tìm thấy 1 key ưu tiên thì dừng
        }
      }
    }
    return res;
  }

  brandName(p: Product): string {
    if (p.brand) return p.brand;
    // Extract from name or category
    if (p.category?.name) {
      if (p.category.name.toLowerCase().includes('asus')) return 'ASUS';
      if (p.category.name.toLowerCase().includes('acer')) return 'ACER';
      if (p.category.name.toLowerCase().includes('msi')) return 'MSI';
      if (p.category.name.toLowerCase().includes('dell')) return 'DELL';
      if (p.category.name.toLowerCase().includes('hp')) return 'HP';
      if (p.category.name.toLowerCase().includes('lenovo')) return 'LENOVO';
      if (p.category.name.toLowerCase().includes('apple')) return 'APPLE';
    }
    const name = p.name.toUpperCase();
    if (name.startsWith('ASUS')) return 'ASUS';
    if (name.startsWith('ACER')) return 'ACER';
    if (name.startsWith('MSI')) return 'MSI';
    if (name.startsWith('DELL')) return 'DELL';
    if (name.startsWith('HP')) return 'HP';
    if (name.startsWith('LENOVO')) return 'LENOVO';
    if (name.startsWith('MACBOOK') || name.startsWith('APPLE')) return 'APPLE';
    if (name.startsWith('GIGABYTE')) return 'GIGABYTE';
    return 'Khác';
  }

  sku(p: Product): string {
    return p.product_id ?? p._id?.substring(0, 8).toUpperCase() ?? 'N/A';
  }

  toggleDesc() {
    this.showFullDesc.update((v) => !v);
  }

  toggleSpecsModal() {
    this.showSpecsModal.update((v) => !v);
  }

  get visibleSpecEntries(): { key: string; value: string }[] {
    const p = this.product();
    if (!p) return [];
    const all = this.specEntries(p);
    return all.slice(0, 10); // Show only first 10 rows initially
  }
}
