import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminApiService, Product } from '../../core/admin-api.service';

@Component({
  selector: 'app-products-list-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './products-list-admin.component.html',
  styleUrl: './products-list-admin.component.css',
})
export class ProductsListAdminComponent implements OnInit {
  items = signal<Product[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getProducts({ page: 1, limit: 50 }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Lỗi tải danh sách');
        this.loading.set(false);
      },
    });
  }

  delete(id: string, name: string): void {
    if (!confirm(`Xóa sản phẩm "${name}"?`)) return;
    this.api.deleteProduct(id).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.error || 'Xóa thất bại'),
    });
  }

  price(p: Product): number {
    return p.salePrice ?? p.price;
  }

  categoryName(p: Product): string {
    const cat = (p as { category?: { name?: string } }).category;
    return (cat && typeof cat === 'object' && cat.name) ? cat.name : '-';
  }
}
