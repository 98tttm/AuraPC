import { Component, OnInit, signal, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminApiService, Product } from '../../core/admin-api.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { getStockStatus, getStockLabel, getStockPercent } from '../../core/constants';

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
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  items = signal<Product[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  page = 1;
  limit = 20;
  searchQuery = '';
  sortColumn = '';
  sortDir: 'asc' | 'desc' = 'asc';

  // Stats from total (not page data)
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

  toggleSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
    const sorted = [...this.items()].sort((a, b) => {
      let valA: number | string = '';
      let valB: number | string = '';
      if (column === 'name') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
      else if (column === 'price') { valA = a.salePrice ?? a.price; valB = b.salePrice ?? b.price; }
      else if (column === 'stock') { valA = a.stock ?? 0; valB = b.stock ?? 0; }
      if (valA < valB) return this.sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    this.items.set(sorted);
  }

  async delete(id: string, name: string): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Xóa sản phẩm',
      message: `Bạn có chắc muốn xóa sản phẩm "${name}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (!confirmed) return;
    this.api.deleteProduct(id).subscribe({
      next: () => {
        this.toast.success('Đã xóa sản phẩm');
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Xóa thất bại'),
    });
  }

  price(p: Product): number {
    return p.salePrice ?? p.price;
  }

  categoryName(p: Product): string {
    const cat = p.category;
    if (cat && typeof cat === 'object' && 'name' in cat) return cat.name;
    return 'Khác';
  }

  getProductImage(p: Product): string {
    if (p.images && Array.isArray(p.images) && p.images.length > 0) {
      const img = p.images[0];
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && 'url' in img) return img.url;
    }
    return '';
  }

  getStockStatus(p: Product): string {
    return getStockStatus(p.stock ?? 0);
  }

  getStockPercent(p: Product): number {
    return getStockPercent(p.stock ?? 0);
  }

  getStockLabel(p: Product): string {
    return getStockLabel(p.stock ?? 0, p.active);
  }
}
