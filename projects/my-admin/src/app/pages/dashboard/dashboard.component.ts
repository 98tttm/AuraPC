import { Component, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminApiService } from '../../core/admin-api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  loading = signal(true);

  totalRevenue = signal(0);
  totalOrders = signal(0);
  totalUsers = signal(0);
  totalProducts = signal(0);
  ordersThisMonth = signal(0);
  ordersLastMonth = signal(0);
  revenueThisMonth = signal(0);
  revenueLastMonth = signal(0);
  recentOrders = signal<any[]>([]);

  // Bar chart — weekly orders
  barChartData = signal<ChartConfiguration<'bar'>['data']>({
    labels: [],
    datasets: [],
  });
  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { precision: 0 } },
      x: { grid: { display: false } },
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
    plugins: { legend: { position: 'bottom' } },
  };

  // Line chart — revenue trend
  lineChartData = signal<ChartConfiguration<'line'>['data']>({
    labels: [],
    datasets: [],
  });
  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
      x: { grid: { display: false } },
    },
  };

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadOrderChart();
    this.loadRevenueChart();
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

        // Doughnut chart data
        const statusMap = stats.ordersByStatus || {};
        const statusLabels = ['Chờ xử lý', 'Đã xác nhận', 'Đang xử lý', 'Đang giao', 'Hoàn thành', 'Đã huỷ'];
        const statusKeys = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        const statusColors = ['#FFBB38', '#0284C7', '#7C3AED', '#2563EB', '#16A34A', '#DC2626'];
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

  private loadOrderChart(): void {
    this.api.getOrderChart().subscribe({
      next: (data) => {
        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        this.barChartData.set({
          labels: data.map((d: any) => {
            const date = new Date(d._id);
            return days[date.getDay()];
          }),
          datasets: [{
            data: data.map((d: any) => d.count),
            backgroundColor: '#396AFF',
            borderRadius: 6,
            barThickness: 28,
          }],
        });
      },
    });
  }

  private loadRevenueChart(): void {
    this.api.getRevenueChart().subscribe({
      next: (data) => {
        const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
        this.lineChartData.set({
          labels: data.map((d: any) => {
            const month = parseInt(d._id.split('-')[1], 10);
            return monthNames[month - 1];
          }),
          datasets: [{
            data: data.map((d: any) => d.revenue),
            borderColor: '#396AFF',
            backgroundColor: 'rgba(57, 106, 255, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#396AFF',
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
}
