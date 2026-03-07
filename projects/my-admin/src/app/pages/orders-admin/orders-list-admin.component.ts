import { Component, signal, OnInit, OnDestroy, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminApiService, Order } from '../../core/admin-api.service';
import { AdminRealtimeService } from '../../core/services/realtime.service';
import { ThemeService } from '../../core/theme.service';
import { ORDER_STATUS_LABELS } from '../../core/constants';

/** Màu biểu đồ theo theme — dùng ThemeService vì [data-theme] đặt trên body, đọc từ body. */
function getChartThemeColors(theme: 'light' | 'dark'): {
  line: string;
  area: string;
  pointBorder: string;
  grid: string;
  text: string;
} {
  if (theme === 'dark') {
    return {
      line: '#ffffff',
      area: 'rgba(255, 255, 255, 0.12)',
      pointBorder: '#1a1d27',
      grid: '#2a2d37',
      text: '#6b7280',
    };
  }
  return {
    line: '#1a1a2e',
    area: 'rgba(26, 26, 46, 0.12)',
    pointBorder: '#ffffff',
    grid: '#f0f0f0',
    text: '#9ca3af',
  };
}

@Component({
  selector: 'app-orders-list-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders-list-admin.component.html',
  styleUrl: './orders-list-admin.component.css',
})
export class OrdersListAdminComponent implements OnInit, OnDestroy {
  private api = inject(AdminApiService);
  private router = inject(Router);
  private realtime = inject(AdminRealtimeService);
  private themeService = inject(ThemeService);

  private orderUpdatedSub: Subscription | null = null;
  private lastTrendLabels: string[] = [];
  private lastTrendCounts: number[] = [];
  private lastStatusKeys: string[] = [];
  private lastStatusValues: number[] = [];
  private lastStatusColors = ['#16a34a', '#0d9488', '#7c3aed', '#eab308', '#dc2626'];

  orders = signal<Order[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
  page = 1;
  limit = 20;
  statusFilter = '';
  searchQuery = '';
  dateFrom = '';
  dateTo = '';

  // Stats
  totalOrders = signal(0);
  orderRevenue = signal(0);
  avgOrderValue = signal(0);
  pendingOrders = signal(0);
  ordersThisMonth = signal(0);
  ordersLastMonth = signal(0);
  revenueThisMonth = signal(0);
  revenueLastMonth = signal(0);
  ordersByStatus = signal<Record<string, number>>({});

  // Order Trends area chart (options dùng màu resolve để canvas dark mode đọc được)
  trendChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  trendChartOptions = signal<ChartConfiguration<'line'>['options']>(this.buildTrendChartOptions());

  // Order Status horizontal bar
  statusChartData = signal<ChartConfiguration<'bar'>['data']>({ labels: [], datasets: [] });
  statusChartOptions = signal<ChartConfiguration<'bar'>['options']>(this.buildStatusChartOptions());

  private buildTrendChartOptions(): ChartConfiguration<'line'>['options'] {
    const c = getChartThemeColors(this.themeService.theme());
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      interaction: { intersect: false, mode: 'index' },
      scales: {
        y: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text, precision: 0 } },
        x: { grid: { display: false }, ticks: { color: c.text } },
      },
    };
  }

  private buildStatusChartOptions(): ChartConfiguration<'bar'>['options'] {
    const c = getChartThemeColors(this.themeService.theme());
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text, precision: 0 } },
        y: { grid: { display: false }, ticks: { color: c.text } },
      },
    };
  }

  // Status filter pills
  statusOptions = [
    { value: '', label: 'Tất cả' },
    { value: 'pending', label: ORDER_STATUS_LABELS['pending'] },
    { value: 'processing', label: ORDER_STATUS_LABELS['processing'] },
    { value: 'shipped', label: ORDER_STATUS_LABELS['shipped'] },
    { value: 'delivered', label: ORDER_STATUS_LABELS['delivered'] },
    { value: 'cancelled', label: ORDER_STATUS_LABELS['cancelled'] },
  ];

  constructor() {
    effect(() => {
      this.themeService.theme();
      this.applyThemeToCharts();
    });
  }

  ngOnInit(): void {
    this.loadOrders();
    this.loadStats();
    this.loadOrderChart();
    this.orderUpdatedSub = this.realtime.orderUpdated$.subscribe(() => {
      this.loadOrders();
      this.loadStats();
      this.loadOrderChart();
    });
  }

  private applyThemeToCharts(): void {
    const colors = getChartThemeColors(this.themeService.theme());
    this.trendChartOptions.set(this.buildTrendChartOptions());
    this.statusChartOptions.set(this.buildStatusChartOptions());
    if (this.lastTrendLabels.length === 0 && this.lastTrendCounts.length === 0 && this.lastStatusKeys.length === 0) return;
    if (this.lastTrendLabels.length > 0 || this.lastTrendCounts.length > 0) {
      const labels = this.lastTrendLabels.length ? this.lastTrendLabels : ['Chưa có dữ liệu'];
      const counts = this.lastTrendCounts.length ? this.lastTrendCounts : [0];
      this.trendChartData.set({
        labels,
        datasets: [{
          label: 'Đơn hàng',
          data: counts,
          borderColor: colors.line,
          borderWidth: 2.5,
          backgroundColor: colors.area,
          fill: true,
          tension: 0.4,
          pointRadius: counts.length > 1 || (counts.length === 1 && counts[0] > 0) ? 4 : 0,
          pointBackgroundColor: colors.line,
          pointBorderColor: colors.pointBorder,
          pointBorderWidth: 2,
        }],
      });
    }
    if (this.lastStatusKeys.length > 0) {
      this.statusChartData.set({
        labels: this.lastStatusKeys.map((key) => this.getStatusLabel(key)),
        datasets: [{
          label: 'Số đơn',
          data: this.lastStatusValues,
          backgroundColor: this.lastStatusColors,
          borderRadius: 4,
          barThickness: 18,
        }],
      });
    }
  }

  ngOnDestroy(): void {
    this.orderUpdatedSub?.unsubscribe();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getOrders({
      page: this.page,
      limit: this.limit,
      status: this.statusFilter,
      search: this.searchQuery,
      from: this.dateFrom || undefined,
      to: this.dateTo || undefined,
    }).subscribe({
      next: (res) => {
        this.orders.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Lỗi tải danh sách đơn hàng');
        this.loading.set(false);
      },
    });
  }

  private loadStats(): void {
    this.api.getDashboardStats().subscribe({
      next: (stats) => {
        this.totalOrders.set(stats.totalOrders);
        this.orderRevenue.set(stats.totalRevenue);
        this.avgOrderValue.set(stats.totalOrders > 0 ? Math.round(stats.totalRevenue / stats.totalOrders) : 0);
        this.pendingOrders.set(stats.ordersByStatus?.['pending'] || 0);
        this.ordersThisMonth.set(stats.ordersThisMonth);
        this.ordersLastMonth.set(stats.ordersLastMonth);
        this.revenueThisMonth.set(stats.revenueThisMonth);
        this.revenueLastMonth.set(stats.revenueLastMonth);
        this.ordersByStatus.set(stats.ordersByStatus || {});

        const statusMap = stats.ordersByStatus || {};
        const keys = ['delivered', 'shipped', 'processing', 'pending', 'cancelled'];
        const colors = ['#16a34a', '#0d9488', '#7c3aed', '#eab308', '#dc2626'];
        this.statusChartData.set({
          labels: keys.map((key) => this.getStatusLabel(key)),
          datasets: [{
            label: 'Số đơn',
            data: keys.map(k => statusMap[k] || 0),
            backgroundColor: colors,
            borderRadius: 4,
            barThickness: 18,
          }],
        });
      },
      error: () => {},
    });
  }

  private loadOrderChart(): void {
    this.api.getOrderChart(30).subscribe({
      next: (data) => {
        const labels = data.length
          ? data.map(d => {
              const date = new Date(d._id + 'T12:00:00');
              return `${date.getDate()}/${date.getMonth() + 1}`;
            })
          : ['Chưa có dữ liệu'];
        const counts = data.length ? data.map(d => d.count) : [0];
        this.lastTrendLabels = labels;
        this.lastTrendCounts = counts;
        const colors = getChartThemeColors(this.themeService.theme());
        this.trendChartData.set({
          labels,
          datasets: [{
            label: 'Đơn hàng',
            data: counts,
            borderColor: colors.line,
            borderWidth: 2.5,
            backgroundColor: colors.area,
            fill: true,
            tension: 0.4,
            pointRadius: data.length ? 4 : 0,
            pointBackgroundColor: colors.line,
            pointBorderColor: colors.pointBorder,
            pointBorderWidth: 2,
          }],
        });
      },
      error: () => {
        this.lastTrendLabels = ['Chưa có dữ liệu'];
        this.lastTrendCounts = [0];
        const colors = getChartThemeColors(this.themeService.theme());
        this.trendChartData.set({
          labels: ['Chưa có dữ liệu'],
          datasets: [
            {
              label: 'Đơn hàng',
              data: [0],
              borderColor: colors.line,
              borderWidth: 2.5,
              backgroundColor: colors.area,
              fill: true,
            },
          ],
        });
      },
    });
  }

  setStatusFilter(status: string): void {
    this.statusFilter = status;
    this.page = 1;
    this.loadOrders();
  }

  onDateFilterChange(): void {
    this.page = 1;
    this.loadOrders();
  }

  onSearch(): void {
    this.page = 1;
    this.loadOrders();
  }

  goToPage(p: number): void {
    this.page = p;
    this.loadOrders();
  }

  openOrderDetail(orderNumber: string): void {
    this.router.navigate(['/orders', orderNumber]);
  }

  get totalPages(): number {
    return Math.ceil(this.total() / this.limit);
  }

  getCustomerName(order: Order): string {
    return order.user?.profile?.fullName || order.shippingAddress?.fullName || order.user?.phoneNumber || 'N/A';
  }

  getCustomerEmail(order: Order): string {
    return order.shippingAddress?.email || order.user?.email || '';
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  getPercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }
}
