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
            price: p.price,
            salePrice: p.salePrice,
            category: (cat && typeof cat === 'object' && '_id' in cat) ? cat._id : cat as string | undefined,
            images: p.images || [],
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

  submit(): void {
    this.touched.set(true);
    this.error.set('');
    if (this.nameError || this.priceError || this.stockError) return;

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
