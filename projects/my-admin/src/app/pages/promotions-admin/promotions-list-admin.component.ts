import { Component, OnInit, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, Promotion } from '../../core/admin-api.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-promotions-list-admin',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './promotions-list-admin.component.html',
  styleUrl: './promotions-list-admin.component.css',
})
export class PromotionsListAdminComponent implements OnInit {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  items = signal<Promotion[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  searchQuery = '';
  page = 1;
  limit = 20;
  statusFilter: 'all' | 'active' | 'expired' | 'upcoming' = 'all';

  totalPromotions = computed(() => this.total());
  activeCount = computed(() => this.items().filter(p => this.getStatus(p) === 'active').length);
  expiredCount = computed(() => this.items().filter(p => this.getStatus(p) === 'expired').length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getPromotions({ page: this.page, limit: this.limit, search: this.searchQuery || undefined }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Lỗi tải danh sách');
        this.loading.set(false);
      },
    });
  }

  getStatus(p: Promotion): 'active' | 'expired' | 'upcoming' | 'inactive' {
    if (!p.isActive) return 'inactive';
    const now = new Date();
    if (now < new Date(p.startDate)) return 'upcoming';
    if (now > new Date(p.endDate)) return 'expired';
    return 'active';
  }

  getStatusLabel(p: Promotion): string {
    const s = this.getStatus(p);
    if (s === 'active') return 'Đang hoạt động';
    if (s === 'expired') return 'Đã hết hạn';
    if (s === 'upcoming') return 'Sắp diễn ra';
    return 'Đã tắt';
  }

  getStatusClass(p: Promotion): string {
    const s = this.getStatus(p);
    if (s === 'active') return 'badge--active';
    if (s === 'expired') return 'badge--inactive';
    if (s === 'upcoming') return 'badge--warning';
    return 'badge--inactive';
  }

  filteredItems(): Promotion[] {
    let list = this.items();
    if (this.statusFilter !== 'all') {
      list = list.filter(p => this.getStatus(p) === this.statusFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(p => p.code.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }
    return list;
  }

  setStatusFilter(filter: 'all' | 'active' | 'expired' | 'upcoming'): void {
    this.statusFilter = filter;
  }

  goToPage(p: number): void {
    this.page = p;
    this.load();
  }

  get totalPages(): number {
    return Math.ceil(this.total() / this.limit);
  }

  formatPrice(n: number | null | undefined): string {
    if (n == null || n <= 0) return '-';
    return n.toLocaleString('vi-VN') + '₫';
  }

  usageLabel(p: Promotion): string {
    const used = p.usedCount || 0;
    if (p.maxUsage != null) return `${used}/${p.maxUsage}`;
    return `${used}/∞`;
  }

  async delete(id: string, code: string): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Xóa khuyến mãi',
      message: `Bạn có chắc muốn xóa mã "${code}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (!confirmed) return;
    this.api.deletePromotion(id).subscribe({
      next: () => {
        this.toast.success('Đã xóa khuyến mãi');
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Xóa thất bại'),
    });
  }
}
