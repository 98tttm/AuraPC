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
  relatedProducts = signal<Product[]>([]);

  // Review & QA filters
  reviewFilter = 'all';
  qaFilter = 'all';

  // Mock reviews data
  mockReviews = [
    {
      id: 1, name: 'Quốc NC', date: '15/01/2026', rating: 5,
      text: 'Thiết bị rất tốt, chạy mượt các tác vụ từ làm việc đến chơi game. Máy được lắp ráp gọn gàng, hiệu năng cao với hệ thống làm mát hiệu quả. Nhận được hỗ trợ tận tình, 5 sao nhé.'
    },
    {
      id: 2, name: 'An Phạm', date: '12/01/2026', rating: 5,
      text: 'PC dùng rất mạnh mẽ, chạy mượt đa tác vụ và kể cả đồ chơi game. Máy được lắp rất gọn gàng. Sản phẩm hoàn toàn xứng đáng với giá tiền.'
    },
    {
      id: 3, name: 'Minh Trần', date: '08/01/2026', rating: 4,
      text: 'Sản phẩm tốt, đóng gói cẩn thận. Giao hàng nhanh, nhân viên tư vấn nhiệt tình. Sẽ ủng hộ shop tiếp!'
    },
    {
      id: 4, name: 'Hùng Lê', date: '03/01/2026', rating: 5,
      text: 'PC rất ok, cấu hình mạnh, chơi game max setting mượt mà. Bên shop tư vấn rất nhiệt tình. Recommend cho ae game thủ.'
    },
  ];

  // Mock Q&A data
  mockQA = [
    {
      id: 1, name: 'Quốc PC', date: '17/01/2026',
      question: 'Máy có chương trình giảm giá gì thêm k?',
      reply: 'Hiện sản phẩm đang giảm PC đang có ưu đãi giảm giá 10.000.000đ, và nhiều ưu đãi trang gia từ thương hiệu. Anh vui lòng liên hệ AuraPC để được tư vấn chi tiết ạ.'
    },
    {
      id: 2, name: 'An Thanh Thịnh', date: '14/01/2026',
      question: 'Hiện tại sản phẩm này bên PC đang có mức giá 50.18.000d, và ngoài ra nhiều ưu đãi gia hàng gì không ạ? Hiện tại em rất quan tâm đến sản phẩm này ạ',
      reply: 'Hiện tại sản phẩm này còn có chương trình mua kèm phụ kiện giảm thêm 5%. Anh/chị liên hệ hotline để được tư vấn chi tiết nhé.'
    },
    {
      id: 3, name: 'Thanh Phong', date: '10/01/2026',
      question: 'Máy có chương trình giảm giá gì ạ?',
      reply: 'Hiện tại, sản phẩm Aura PC đang có mức giảm 10.200.000đ, và khách hàng mua trong tháng này sẽ được tặng thêm bộ phụ kiện gaming cao cấp.'
    },
  ];

  // Rating summary computed from mock data
  get avgRating(): number {
    const total = this.mockReviews.reduce((sum, r) => sum + r.rating, 0);
    return this.mockReviews.length ? total / this.mockReviews.length : 0;
  }

  get ratingBars(): { star: number; count: number; percent: number }[] {
    const total = this.mockReviews.length || 1;
    return [5, 4, 3, 2, 1].map(star => {
      const count = this.mockReviews.filter(r => r.rating === star).length;
      return { star, count, percent: (count / total) * 100 };
    });
  }

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
        // Load related products from same category
        if (p.category) {
          const catSlug = p.category.slug || p.category.category_id;
          this.api.getProducts({ category: catSlug, limit: 4 }).subscribe({
            next: (res) => {
              this.relatedProducts.set(
                res.items.filter(rp => rp._id !== p._id).slice(0, 4)
              );
            }
          });
        }
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
        const foundKey = Object.keys(s).find((sk) => sk.toLowerCase() === f.toLowerCase());
        if (foundKey && s[foundKey]) {
          res.push({ label: k.label, value: String(s[foundKey]) });
          break;
        }
      }
    }
    return res;
  }

  brandName(p: Product): string {
    if (p.brand) return p.brand;
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
    return all.slice(0, 10);
  }
}
