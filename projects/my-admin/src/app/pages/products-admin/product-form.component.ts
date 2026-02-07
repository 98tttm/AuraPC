import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, Product, Category } from '../../core/admin-api.service';
import { FormsModule } from '@angular/forms';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: AdminApiService,
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
          this.model = {
            name: p.name,
            slug: p.slug,
            shortDescription: p.shortDescription,
            description: p.description,
            price: p.price,
            salePrice: p.salePrice,
            category: (p as any).category?._id ?? p.category,
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

  submit(): void {
    this.error.set('');
    this.loading.set(true);
    const id = this.id();
    const body = { ...this.model };
    if (!body.name?.trim()) {
      this.error.set('Vui lòng nhập tên sản phẩm.');
      this.loading.set(false);
      return;
    }
    if (id) {
      this.api.updateProduct(id, body).subscribe({
        next: () => this.router.navigate(['/products']),
        error: (err) => {
          this.error.set(err?.error?.error || 'Cập nhật thất bại');
          this.loading.set(false);
        },
      });
    } else {
      this.api.createProduct(body).subscribe({
        next: () => this.router.navigate(['/products']),
        error: (err) => {
          this.error.set(err?.error?.error || 'Tạo thất bại');
          this.loading.set(false);
        },
      });
    }
  }
}
