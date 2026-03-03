import { Component, signal, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminApiService } from '../../core/admin-api.service';

@Component({
  selector: 'app-users-list-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-list-admin.component.html',
  styleUrl: './users-list-admin.component.css',
})
export class UsersListAdminComponent implements OnInit {
  private api = inject(AdminApiService);

  users = signal<any[]>([]);
  total = signal(0);
  loading = signal(true);
  page = 1;
  limit = 20;
  searchQuery = '';

  // Stats
  totalUsers = signal(0);
  totalOrders = signal(0);

  // Segments doughnut
  segmentChartData = signal<ChartConfiguration<'doughnut'>['data']>({ labels: [], datasets: [] });
  segmentChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } } },
  };

  ngOnInit(): void {
    this.loadUsers();
    this.loadStats();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.api.getUsers({ page: this.page, limit: this.limit, search: this.searchQuery }).subscribe({
      next: (res) => {
        this.users.set(res.items);
        this.total.set(res.total);
        this.buildSegmentChart(res.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadStats(): void {
    this.api.getDashboardStats().subscribe({
      next: (stats) => {
        this.totalUsers.set(stats.totalUsers);
        this.totalOrders.set(stats.totalOrders);
      },
    });
  }

  private buildSegmentChart(users: any[]): void {
    let vip = 0, regular = 0, newUser = 0, atRisk = 0;
    users.forEach(u => {
      const orders = u.orderCount || 0;
      if (orders >= 10) vip++;
      else if (orders >= 3) regular++;
      else if (orders >= 1) newUser++;
      else atRisk++;
    });
    this.segmentChartData.set({
      labels: ['VIP', 'Thường xuyên', 'Mới', 'Rủi ro'],
      datasets: [{
        data: [vip, regular, newUser, atRisk],
        backgroundColor: ['#7c3aed', '#0d9488', '#2563eb', '#dc2626'],
        borderWidth: 0,
      }],
    });
  }

  onSearch(): void {
    this.page = 1;
    this.loadUsers();
  }

  goToPage(p: number): void {
    this.page = p;
    this.loadUsers();
  }

  get totalPages(): number {
    return Math.ceil(this.total() / this.limit);
  }

  getUserName(user: any): string {
    return user.profile?.fullName || user.username || user.phoneNumber;
  }

  getInitial(user: any): string {
    return this.getUserName(user).charAt(0).toUpperCase();
  }

  getUserLocation(user: any): string {
    if (user.addresses?.length > 0) {
      const addr = user.addresses[0];
      return [addr.district, addr.city].filter(Boolean).join(', ') || '';
    }
    return '';
  }

  getSegment(user: any): string {
    const orders = user.orderCount || 0;
    if (orders >= 10) return 'vip';
    if (orders >= 3) return 'regular';
    if (orders >= 1) return 'new';
    return 'inactive';
  }

  getSegmentLabel(user: any): string {
    const map: Record<string, string> = { vip: 'VIP', regular: 'Thường xuyên', new: 'Mới', inactive: 'Chưa mua' };
    return map[this.getSegment(user)] || '';
  }
}
