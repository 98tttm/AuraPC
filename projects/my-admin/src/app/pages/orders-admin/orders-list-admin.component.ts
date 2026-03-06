import { Component, signal, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminApiService, Order } from '../../core/admin-api.service';
import { ORDER_STATUS_LABELS } from '../../core/constants';

@Component({
  selector: 'app-orders-list-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders-list-admin.component.html',
  styleUrl: './orders-list-admin.component.css',
})
export class OrdersListAdminComponent implements OnInit {
  private api = inject(AdminApiService);
  private router = inject(Router);

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

  // Order Trends area chart
  trendChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  trendChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    interaction: { intersect: false, mode: 'index' },
    scales: {
      y: { beginAtZero: true, grid: { color: 'var(--chart-grid)' }, ticks: { color: 'var(--chart-text)', precision: 0 } },
      x: { grid: { display: false }, ticks: { color: 'var(--chart-text)' } },
    },
  };

  // Order Status horizontal bar
  statusChartData = signal<ChartConfiguration<'bar'>['data']>({ labels: [], datasets: [] });
  statusChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, grid: { color: 'var(--chart-grid)' }, ticks: { color: 'var(--chart-text)', precision: 0 } },
      y: { grid: { display: false }, ticks: { color: 'var(--chart-text)' } },
    },
  };

  // Status filter pills
  statusOptions = [
    { value: '', label: 'Tất cả' },
    { value: 'pending', label: ORDER_STATUS_LABELS['pending'] },
    { value: 'processing', label: ORDER_STATUS_LABELS['processing'] },
    { value: 'shipped', label: ORDER_STATUS_LABELS['shipped'] },
    { value: 'delivered', label: ORDER_STATUS_LABELS['delivered'] },
    { value: 'cancelled', label: ORDER_STATUS_LABELS['cancelled'] },
  ];

  ngOnInit(): void {
    this.loadOrders();
    this.loadStats();
    this.loadOrderChart();
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
          datasets: [{ data: keys.map(k => statusMap[k] || 0), backgroundColor: colors, borderRadius: 4, barThickness: 18 }],
        });
      },
      error: () => {},
    });
  }

  private loadOrderChart(): void {
    this.api.getOrderChart(30).subscribe({
      next: (data) => {
        this.trendChartData.set({
          labels: data.map(d => {
            const date = new Date(d._id);
            return `${date.getDate()}/${date.getMonth() + 1}`;
          }),
          datasets: [{
            data: data.map(d => d.count),
            borderColor: '#1a1a2e',
            backgroundColor: 'rgba(26, 26, 46, 0.06)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#1a1a2e',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          }],
        });
      },
      error: () => {},
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
