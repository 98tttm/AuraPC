import { Component, OnInit, signal, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminApiService, Product } from '../../core/admin-api.service';

@Component({
  selector: 'app-products-list-admin',
  standalone: true,
  imports: [DecimalPipe, RouterLink, FormsModule, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-list-admin.component.html',
  styleUrl: './products-list-admin.component.css',
})
export class ProductsListAdminComponent implements OnInit {
  private api = inject(AdminApiService);

  items = signal<Product[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  page = 1;
  limit = 20;
  searchQuery = '';

  // Computed stats
  totalProducts = computed(() => this.total());
  activeProducts = computed(() => this.items().filter(p => p.active !== false).length);
  lowStockProducts = computed(() => this.items().filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) < 5).length);
  outOfStockProducts = computed(() => this.items().filter(p => (p.stock ?? 0) === 0).length);

  // Categories doughnut
  categoryChartData = signal<ChartConfiguration<'doughnut'>['data']>({ labels: [], datasets: [] });
  categoryChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } } },
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getProducts({ page: this.page, limit: this.limit, search: this.searchQuery }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.buildCategoryChart(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Lỗi tải danh sách');
        this.loading.set(false);
      },
    });
  }

  private buildCategoryChart(products: Product[]): void {
    const catMap = new Map<string, number>();
    products.forEach(p => {
      const cat = this.categoryName(p);
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    const entries = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const colors = ['#1a1a2e', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db'];
    this.categoryChartData.set({
      labels: entries.map(e => e[0]),
      datasets: [{ data: entries.map(e => e[1]), backgroundColor: colors.slice(0, entries.length), borderWidth: 0 }],
    });
  }

  onSearch(): void {
    this.page = 1;
    this.load();
  }

  goToPage(p: number): void {
    this.page = p;
    this.load();
  }

  get totalPages(): number {
    return Math.ceil(this.total() / this.limit);
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
    return (cat && typeof cat === 'object' && cat.name) ? cat.name : 'Khác';
  }

  getProductImage(p: Product): string {
    if (p.images && Array.isArray(p.images) && p.images.length > 0) {
      const img = p.images[0];
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && 'url' in img) return (img as any).url;
    }
    return '';
  }

  getStockStatus(p: Product): string {
    const stock = p.stock ?? 0;
    if (stock === 0) return 'out-of-stock';
    if (stock < 5) return 'low-stock';
    return 'active';
  }

  getStockPercent(p: Product): number {
    return Math.min(100, ((p.stock ?? 0) / 50) * 100);
  }

  getStockLabel(p: Product): string {
    const stock = p.stock ?? 0;
    if (stock === 0) return 'Hết hàng';
    if (stock < 5) return 'Sắp hết';
    if (p.active === false) return 'Ẩn';
    return 'Đang bán';
  }
}
