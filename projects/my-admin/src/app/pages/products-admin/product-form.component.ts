import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, Product, Category } from '../../core/admin-api.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/toast.service';
import { generateSlug } from '../../core/constants';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.css',
})
export class ProductFormComponent implements OnInit {
  id = signal<string | null>(null);
  categories = signal<Category[]>([]);
  loading = signal(false);
  error = signal('');
  touched = signal(false);
  dirty = signal(false);
  model: Partial<Product> = {
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    brand: '',
    price: 0,
    salePrice: undefined,
    category: undefined,
    images: [],
    stock: 0,
    featured: false,
    active: true,
  };
  imageUrlInput = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: AdminApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.api.getCategories().subscribe({
      next: (list) => this.categories.set(list),
      error: () => {},
    });
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.id.set(id);
      this.api.getProduct(id).subscribe({
        next: (p) => {
          const cat = p.category;
          this.model = {
            name: p.name,
            slug: p.slug,
            shortDescription: p.shortDescription,
            description: p.description,
            brand: p.brand || '',
            price: p.price,
            salePrice: p.salePrice,
            category: (cat && typeof cat === 'object' && '_id' in cat) ? cat._id : cat as string | undefined,
            images: this.normalizeImages(p.images),
            stock: p.stock,
            featured: p.featured,
            active: p.active !== false,
          };
        },
        error: () => this.error.set('Không tìm thấy sản phẩm'),
      });
    }
  }

  onNameChange(): void {
    this.dirty.set(true);
    if (!this.id() && this.model.name) {
      this.model.slug = generateSlug(this.model.name);
    }
  }

  onFieldChange(): void {
    this.dirty.set(true);
  }

  get nameError(): string {
    if (!this.touched()) return '';
    if (!this.model.name?.trim()) return 'Vui lòng nhập tên sản phẩm';
    return '';
  }

  get priceError(): string {
    if (!this.touched()) return '';
    if (this.model.price == null || this.model.price < 0) return 'Giá phải >= 0';
    return '';
  }

  get salePriceError(): string {
    if (!this.touched()) return '';
    if (this.model.salePrice != null && this.model.salePrice > 0 && this.model.price != null && this.model.salePrice > this.model.price) {
      return 'Giá khuyến mãi phải <= giá gốc';
    }
    return '';
  }

  get stockError(): string {
    if (!this.touched()) return '';
    if (this.model.stock != null && this.model.stock < 0) return 'Tồn kho phải >= 0';
    return '';
  }

  addImageUrl(): void {
    if (!this.imageUrlInput.trim()) return;
    if (!this.model.images) this.model.images = [];
    this.model.images.push({ url: this.imageUrlInput.trim() });
    this.imageUrlInput = '';
    this.dirty.set(true);
  }

  removeImage(index: number): void {
    this.model.images?.splice(index, 1);
    this.dirty.set(true);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  categoryOptions(): Category[] {
    return [...this.categories()].sort((a, b) => {
      const levelA = Number(a.level ?? 0);
      const levelB = Number(b.level ?? 0);
      if (levelA !== levelB) return levelA - levelB;

      const orderA = Number(a.display_order ?? Number.MAX_SAFE_INTEGER);
      const orderB = Number(b.display_order ?? Number.MAX_SAFE_INTEGER);
      if (orderA !== orderB) return orderA - orderB;

      return a.name.localeCompare(b.name, 'vi');
    });
  }

  categoryOptionLabel(category: Category): string {
    const level = Math.max(0, Number(category.level ?? 0));
    return `${'— '.repeat(level)}${category.name}`;
  }

  selectedCategoryName(): string {
    const selected = this.model.category;
    if (selected == null || selected === '') return 'Chưa chọn danh mục';

    const found = this.categories().find((category) =>
      this.sameRef(category._id, selected)
      || this.sameRef(category.category_id, selected)
      || this.sameRef(category.slug, selected)
    );
    return found?.name || String(selected);
  }

  firstImageUrl(): string {
    const images = this.model.images ?? [];
    if (!Array.isArray(images) || images.length === 0) return '';
    const first = images[0];
    return typeof first === 'string' ? first : first?.url || '';
  }

  imageCount(): number {
    return Array.isArray(this.model.images) ? this.model.images.length : 0;
  }

  sellingPrice(): number {
    if (this.model.salePrice != null && this.model.salePrice > 0 && this.model.price != null && this.model.salePrice <= this.model.price) {
      return this.model.salePrice;
    }
    return this.model.price ?? 0;
  }

  hasDiscount(): boolean {
    return this.model.salePrice != null
      && this.model.salePrice > 0
      && this.model.price != null
      && this.model.salePrice < this.model.price;
  }

  discountPercent(): number {
    if (!this.hasDiscount() || !this.model.price) return 0;
    return Math.round(((this.model.price - (this.model.salePrice ?? 0)) / this.model.price) * 100);
  }

  visibilityLabel(): string {
    return this.model.active === false ? 'Đang ẩn' : 'Đang hiển thị';
  }

  featuredLabel(): string {
    return this.model.featured ? 'Có' : 'Không';
  }

  stockLabel(): string {
    const stock = this.model.stock ?? 0;
    if (stock <= 0) return 'Hết hàng';
    if (stock < 10) return `Sắp hết (${stock})`;
    return `${stock} sản phẩm`;
  }

  formatPrice(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `${value.toLocaleString('vi-VN')}đ`;
  }

  private normalizeImages(images: Product['images']): { url: string; alt?: string }[] {
    if (!Array.isArray(images)) return [];
    const normalized: Array<{ url: string; alt?: string } | null> = images.map((image) => {
      if (typeof image === 'string') return { url: image };
      if (image && typeof image === 'object' && 'url' in image && image.url) {
        return { url: image.url, alt: image.alt };
      }
      return null;
    });
    return normalized.filter((image): image is { url: string; alt?: string } => image !== null);
  }

  private sameRef(a: unknown, b: unknown): boolean {
    if (a == null || b == null) return false;
    return String(a) === String(b);
  }

  submit(): void {
    this.touched.set(true);
    this.error.set('');
    if (this.nameError || this.priceError || this.salePriceError || this.stockError) return;

    this.loading.set(true);
    const id = this.id();
    const body = { ...this.model };
    if (id) {
      this.api.updateProduct(id, body).subscribe({
        next: () => {
          this.toast.success('Cập nhật sản phẩm thành công');
          this.dirty.set(false);
          this.router.navigate(['/products']);
        },
        error: (err) => {
          this.error.set(err?.error?.error || 'Cập nhật thất bại');
          this.loading.set(false);
        },
      });
    } else {
      this.api.createProduct(body).subscribe({
        next: () => {
          this.toast.success('Tạo sản phẩm thành công');
          this.dirty.set(false);
          this.router.navigate(['/products']);
        },
        error: (err) => {
          this.error.set(err?.error?.error || 'Tạo thất bại');
          this.loading.set(false);
        },
      });
    }
  }
}
