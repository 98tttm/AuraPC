import { Component, OnInit, signal, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, WarrantyRecord } from '../../core/admin-api.service';

@Component({
  selector: 'app-warranty-admin',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warranty-admin.component.html',
  styleUrl: './warranty-admin.component.css',
})
export class WarrantyAdminComponent implements OnInit {
  private api = inject(AdminApiService);

  items = signal<WarrantyRecord[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  page = 1;
  limit = 20;
  searchQuery = '';
  statusFilter = '';

  // Stats
  statsTotal = signal(0);
  statsValid = signal(0);
  statsExpired = signal(0);

  ngOnInit(): void {
    this.load();
    this.loadStats();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getWarrantyRecords({
      page: this.page,
      limit: this.limit,
      search: this.searchQuery || undefined,
      status: this.statusFilter || undefined,
    }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Lỗi tải danh sách bảo hành');
        this.loading.set(false);
      },
    });
  }

  private loadStats(): void {
    this.api.getWarrantyStats().subscribe({
      next: (res) => {
        this.statsTotal.set(res.total);
        this.statsValid.set(res.valid);
        this.statsExpired.set(res.expired);
      },
      error: () => {},
    });
  }

  onSearch(): void {
    this.page = 1;
    this.load();
  }

  onStatusFilter(): void {
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

  get visiblePages(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    let start = Math.max(2, this.page - 1);
    let end = Math.min(total - 1, this.page + 1);
    if (this.page <= 3) { start = 2; end = Math.min(5, total - 1); }
    if (this.page >= total - 2) { start = Math.max(2, total - 4); end = total - 1; }
    if (start > 2) pages.push(-1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push(-1);
    pages.push(total);
    return pages;
  }

  formatDate(s: string | null | undefined): string {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  getStatusLabel(status: string): string {
    if (status === 'valid') return 'Còn bảo hành';
    if (status === 'expired') return 'Hết bảo hành';
    return 'Không xác định';
  }

  daysRemaining(expiryDate: string | null): number | null {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
