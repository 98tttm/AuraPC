import { Component, signal, OnInit, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminApiService, Order, TopProductPoint } from '../../core/admin-api.service';
import { AdminAuthService } from '../../core/auth/admin-auth.service';
import { ThemeService } from '../../core/theme.service';
import { LayoutService } from '../../core/layout.service';
import { ORDER_STATUS_LABELS, ORDER_STATUS_KEYS, ORDER_STATUS_COLORS } from '../../core/constants';

function getChartThemeColors(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    return {
      grid: '#2a2d37',
      text: '#6b7280',
      pointBorder: '#1a1d27',
      revenueLine: '#fb923c',
      revenueArea: 'rgba(251, 146, 60, 0.15)',
      ordersLine: '#f1f1f4',
      customersLine: '#3b82f6',
      barColors: ['#f1f1f4', '#9ca3af', '#6b7280', '#4b5563', '#374151'],
    };
  }
  return {
    grid: '#f0f0f0',
    text: '#9ca3af',
    pointBorder: '#ffffff',
    revenueLine: '#f97316',
    revenueArea: 'rgba(249, 115, 22, 0.12)',
    ordersLine: '#1a1a2e',
    customersLine: '#2563eb',
    barColors: ['#1a1a2e', '#374151', '#4b5563', '#6b7280', '#9ca3af'],
  };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private api = inject(AdminApiService);
  private auth = inject(AdminAuthService);
  private themeService = inject(ThemeService);
  private layoutService = inject(LayoutService);

  loading = signal(true);
  error = signal('');
  admin = this.auth.currentAdmin;
  today = new Date();

  totalRevenue = signal(0);
  totalOrders = signal(0);
  totalUsers = signal(0);
  totalProducts = signal(0);
  ordersThisMonth = signal(0);
  ordersLastMonth = signal(0);
  revenueThisMonth = signal(0);
  revenueLastMonth = signal(0);
  usersThisMonth = signal(0);
  usersLastMonth = signal(0);
  recentOrders = signal<Order[]>([]);
  ordersByStatus = signal<Record<string, number>>({});
  topProducts = signal<TopProductPoint[]>([]);

  chartMode = signal<'weekly' | 'monthly'>('weekly');

  // Cache for re-applying theme to charts
  private revenueChartLabels: string[] = [];
  private revenueChartRevenue: number[] = [];
  private revenueChartOrders: number[] = [];
  private revenueChartCustomers: number[] = [];
  // Monthly cache
  private monthlyLabels: string[] = [];
  private monthlyRevenue: number[] = [];
  private monthlyOrders: number[] = [];
  private monthlyCustomers: number[] = [];
  // Weekly cache
  private weeklyLabels: string[] = [];
  private weeklyRevenue: number[] = [];
  private weeklyOrders: number[] = [];
  private weeklyCustomers: number[] = [];
  private topBarLabels: string[] = [];
  private topBarValues: number[] = [];

  // Area chart — multi-dataset revenue/orders/customers (12 months)
  areaChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });
  areaChartOptions = signal<ChartConfiguration<'line'>['options']>(this.buildAreaChartOptions());

  // Doughnut chart — order status
  doughnutChartData = signal<ChartConfiguration<'doughnut'>['data']>({ labels: [], datasets: [] });
  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
    },
  };
  orderStatusKeys = ORDER_STATUS_KEYS;
  orderStatusLabels = ORDER_STATUS_LABELS;
  orderStatusColors = ORDER_STATUS_COLORS;

  // Bar chart — top products
  topBarChartData = signal<ChartConfiguration<'bar'>['data']>({ labels: [], datasets: [] });
  topBarChartOptions = signal<ChartConfiguration<'bar'>['options']>(this.buildBarChartOptions());

  constructor() {
    effect(() => {
      this.themeService.theme();
      this.applyThemeToCharts();
    });
    effect(() => {
      const collapsed = this.layoutService.sidebarCollapsed();
      const mode = collapsed ? 'monthly' : 'weekly';
      this.chartMode.set(mode);
      this.switchChartMode(mode);
    });
  }

  ngOnInit(): void {
    this.loadStats();
    this.loadRevenueChart();
    this.loadTopProducts();
  }

  private buildAreaChartOptions(): ChartConfiguration<'line'>['options'] {
    const c = getChartThemeColors(this.themeService.theme());
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => {
              const label = ctx.dataset.label || '';
              const val = ctx.parsed.y ?? 0;
              if (label === 'Doanh thu') return `${label}: ${val.toLocaleString('vi-VN')}đ`;
              return `${label}: ${val.toLocaleString('vi-VN')}`;
            },
          },
        },
      },
      interaction: { intersect: false, mode: 'index' },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          grid: { color: c.grid },
          ticks: {
            color: c.text,
            callback: (val) => {
              const num = Number(val);
              if (num >= 1000000) return (num / 1000000).toFixed(0) + 'tr';
              if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
              return String(num);
            },
          },
        },
        y1: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { color: c.text },
        },
        x: {
          grid: { display: false },
          ticks: { color: c.text, autoSkip: false, maxRotation: 0 },
        },
      },
    };
  }

  private buildBarChartOptions(): ChartConfiguration<'bar'>['options'] {
    const c = getChartThemeColors(this.themeService.theme());
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text } },
        y: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } },
      },
    };
  }

  private applyThemeToCharts(): void {
    this.areaChartOptions.set(this.buildAreaChartOptions());
    this.topBarChartOptions.set(this.buildBarChartOptions());

    if (this.revenueChartLabels.length > 0) {
      this.setAreaChartData();
    }
    if (this.topBarLabels.length > 0) {
      this.setTopBarChartData();
    }
  }

  private loadStats(): void {
    this.api.getDashboardStats().subscribe({
      next: (stats) => {
        this.totalRevenue.set(stats.totalRevenue);
        this.totalOrders.set(stats.totalOrders);
        this.totalUsers.set(stats.totalUsers);
        this.totalProducts.set(stats.totalProducts);
        this.ordersThisMonth.set(stats.ordersThisMonth);
        this.ordersLastMonth.set(stats.ordersLastMonth);
        this.revenueThisMonth.set(stats.revenueThisMonth);
        this.revenueLastMonth.set(stats.revenueLastMonth);
        this.usersThisMonth.set(stats.usersThisMonth);
        this.usersLastMonth.set(stats.usersLastMonth);
        this.recentOrders.set(stats.recentOrders || []);
        this.ordersByStatus.set(stats.ordersByStatus || {});

        const statusMap = stats.ordersByStatus || {};
        this.doughnutChartData.set({
          labels: ORDER_STATUS_KEYS.map(k => ORDER_STATUS_LABELS[k]),
          datasets: [{
            data: ORDER_STATUS_KEYS.map(k => statusMap[k] || 0),
            backgroundColor: ORDER_STATUS_KEYS.map(k => ORDER_STATUS_COLORS[k]),
            borderWidth: 0,
          }],
        });

        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Không thể tải dữ liệu dashboard');
        this.loading.set(false);
      },
    });
  }

  private loadRevenueChart(): void {
    // Load monthly data
    this.api.getRevenueChart(12).subscribe({
      next: (data) => {
        const monthNames = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
        const dataMap = new Map(data.map(d => [d._id, d]));
        const now = new Date();
        const labels: string[] = [];
        const revenue: number[] = [];
        const orders: number[] = [];
        const customers: number[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const entry = dataMap.get(key);
          labels.push(monthNames[d.getMonth()]);
          revenue.push(entry?.revenue || 0);
          orders.push(entry?.orders || 0);
          customers.push(entry?.newCustomers || 0);
        }
        this.monthlyLabels = labels;
        this.monthlyRevenue = revenue;
        this.monthlyOrders = orders;
        this.monthlyCustomers = customers;
        if (this.chartMode() === 'monthly') {
          this.applyChartData(labels, revenue, orders, customers);
        }
      },
      error: () => {},
    });

    // Load weekly data
    this.api.getWeeklyRevenueChart().subscribe({
      next: (data) => {
        this.weeklyLabels = data.map(d => d.label || d._id);
        this.weeklyRevenue = data.map(d => d.revenue);
        this.weeklyOrders = data.map(d => d.orders);
        this.weeklyCustomers = data.map(d => d.newCustomers);
        if (this.chartMode() === 'weekly') {
          this.applyChartData(this.weeklyLabels, this.weeklyRevenue, this.weeklyOrders, this.weeklyCustomers);
        }
      },
      error: () => {},
    });
  }

  private applyChartData(labels: string[], revenue: number[], orders: number[], customers: number[]): void {
    this.revenueChartLabels = labels;
    this.revenueChartRevenue = revenue;
    this.revenueChartOrders = orders;
    this.revenueChartCustomers = customers;
    this.setAreaChartData();
  }

  private switchChartMode(mode: 'weekly' | 'monthly'): void {
    if (mode === 'monthly' && this.monthlyLabels.length > 0) {
      this.applyChartData(this.monthlyLabels, this.monthlyRevenue, this.monthlyOrders, this.monthlyCustomers);
    } else if (mode === 'weekly' && this.weeklyLabels.length > 0) {
      this.applyChartData(this.weeklyLabels, this.weeklyRevenue, this.weeklyOrders, this.weeklyCustomers);
    }
  }

  private setAreaChartData(): void {
    const c = getChartThemeColors(this.themeService.theme());
    this.areaChartData.set({
      labels: this.revenueChartLabels,
      datasets: [
        {
          label: 'Doanh thu',
          data: this.revenueChartRevenue,
          borderColor: c.revenueLine,
          backgroundColor: c.revenueArea,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: c.revenueLine,
          pointBorderColor: c.pointBorder,
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          yAxisID: 'y',
          order: 2,
        },
        {
          label: 'Đơn hàng',
          data: this.revenueChartOrders,
          borderColor: c.ordersLine,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: c.ordersLine,
          pointBorderColor: c.pointBorder,
          pointBorderWidth: 2,
          borderWidth: 2,
          yAxisID: 'y1',
          order: 1,
        },
        {
          label: 'Khách hàng mới',
          data: this.revenueChartCustomers,
          borderColor: c.customersLine,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: c.customersLine,
          pointBorderColor: c.pointBorder,
          pointBorderWidth: 2,
          borderWidth: 2,
          borderDash: [5, 5],
          yAxisID: 'y1',
          order: 0,
        },
      ],
    });
  }

  private loadTopProducts(): void {
    this.api.getTopProducts(5).subscribe({
      next: (data) => {
        this.topProducts.set(data);
        this.topBarLabels = data.map(d => d._id?.substring(0, 25) || 'N/A');
        this.topBarValues = data.map(d => d.totalQty);
        this.setTopBarChartData();
      },
      error: () => { /* chart is non-critical */ },
    });
  }

  private setTopBarChartData(): void {
    const c = getChartThemeColors(this.themeService.theme());
    this.topBarChartData.set({
      labels: this.topBarLabels,
      datasets: [{
        data: this.topBarValues,
        backgroundColor: c.barColors,
        borderRadius: 4,
        barThickness: 20,
      }],
    });
  }

  getPercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  getCustomerName(order: Order): string {
    return order.user?.profile?.fullName || order.shippingAddress?.fullName || order.user?.phoneNumber || 'N/A';
  }

  getAvgOrderValue(): number {
    if (this.totalOrders() === 0) return 0;
    return Math.round(this.totalRevenue() / this.totalOrders());
  }

  getRevenueTarget(): number {
    return 100000000; // 100M VND target
  }

  getRevenueProgress(): number {
    const target = this.getRevenueTarget();
    if (target === 0) return 0;
    return Math.min(100, Math.round((this.revenueThisMonth() / target) * 100));
  }

  getTopProductPercent(qty: number): number {
    const total = this.topProducts().reduce((sum, p) => sum + p.totalQty, 0);
    if (total === 0) return 0;
    return Math.round((qty / total) * 100);
  }

  getPendingOrders(): number {
    return this.ordersByStatus()['pending'] || 0;
  }
}
