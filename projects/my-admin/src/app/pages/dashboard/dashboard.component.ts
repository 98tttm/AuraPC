import { Component, signal, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminApiService } from '../../core/admin-api.service';
import { AdminAuthService } from '../../core/auth/admin-auth.service';

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

  loading = signal(true);
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
  recentOrders = signal<any[]>([]);
  ordersByStatus = signal<Record<string, number>>({});
  topProducts = signal<any[]>([]);

  // Area chart — revenue trend (12 months)
  areaChartData = signal<ChartConfiguration<'line'>['data']>({
    labels: [],
    datasets: [],
  });
  areaChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    interaction: { intersect: false, mode: 'index' },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'var(--chart-grid)' },
        ticks: { color: 'var(--chart-text)' },
      },
      x: {
        grid: { display: false },
        ticks: { color: 'var(--chart-text)' },
      },
    },
  };

  // Doughnut chart — order status
  doughnutChartData = signal<ChartConfiguration<'doughnut'>['data']>({
    labels: [],
    datasets: [],
  });
  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } },
    },
  };

  // Bar chart — top products
  topBarChartData = signal<ChartConfiguration<'bar'>['data']>({
    labels: [],
    datasets: [],
  });
  topBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, grid: { color: 'var(--chart-grid)' }, ticks: { color: 'var(--chart-text)' } },
      y: { grid: { display: false }, ticks: { color: 'var(--chart-text)', font: { size: 11 } } },
    },
  };

  ngOnInit(): void {
    this.loadStats();
    this.loadRevenueChart();
    this.loadTopProducts();
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
        this.recentOrders.set(stats.recentOrders || []);
        this.ordersByStatus.set(stats.ordersByStatus || {});

        const statusMap = stats.ordersByStatus || {};
        const statusLabels = ['Chờ xử lý', 'Đã xác nhận', 'Đang xử lý', 'Đang giao', 'Hoàn thành', 'Đã huỷ'];
        const statusKeys = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        const statusColors = ['#eab308', '#2563eb', '#7c3aed', '#0d9488', '#16a34a', '#dc2626'];
        this.doughnutChartData.set({
          labels: statusLabels,
          datasets: [{
            data: statusKeys.map((k) => statusMap[k] || 0),
            backgroundColor: statusColors,
            borderWidth: 0,
          }],
        });

        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadRevenueChart(): void {
    this.api.getRevenueChart(12).subscribe({
      next: (data) => {
        const monthNames = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
        this.areaChartData.set({
          labels: data.map((d: any) => {
            const month = parseInt(d._id.split('-')[1], 10);
            return monthNames[month - 1];
          }),
          datasets: [{
            data: data.map((d: any) => d.revenue),
            borderColor: '#1a1a2e',
            backgroundColor: 'rgba(26, 26, 46, 0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: '#1a1a2e',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 7,
          }],
        });
      },
    });
  }

  private loadTopProducts(): void {
    this.api.getTopProducts(5).subscribe({
      next: (data) => {
        this.topProducts.set(data);
        this.topBarChartData.set({
          labels: data.map((d: any) => d._id?.substring(0, 25) || 'N/A'),
          datasets: [{
            data: data.map((d: any) => d.totalQty),
            backgroundColor: ['#1a1a2e', '#374151', '#4b5563', '#6b7280', '#9ca3af'],
            borderRadius: 4,
            barThickness: 20,
          }],
        });
      },
    });
  }

  getPercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xử lý',
      confirmed: 'Đã xác nhận',
      processing: 'Đang xử lý',
      shipped: 'Đang giao',
      delivered: 'Hoàn thành',
      cancelled: 'Đã huỷ',
    };
    return map[status] || status;
  }

  getCustomerName(order: any): string {
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
}
