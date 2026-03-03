import { Component, signal, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminApiService, User } from '../../core/admin-api.service';
import { getUserSegment, getUserSegmentLabel } from '../../core/constants';

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

  users = signal<User[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal('');
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
    this.error.set('');
    this.api.getUsers({ page: this.page, limit: this.limit, search: this.searchQuery }).subscribe({
      next: (res) => {
        this.users.set(res.items);
        this.total.set(res.total);
        this.buildSegmentChart(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Lỗi tải danh sách khách hàng');
        this.loading.set(false);
      },
    });
  }

  private loadStats(): void {
    this.api.getDashboardStats().subscribe({
      next: (stats) => {
        this.totalUsers.set(stats.totalUsers);
        this.totalOrders.set(stats.totalOrders);
      },
      error: () => {},
    });
  }

  private buildSegmentChart(users: User[]): void {
    let vip = 0, regular = 0, newUser = 0, atRisk = 0;
    users.forEach(u => {
      const seg = getUserSegment(u.orderCount || 0);
      if (seg === 'vip') vip++;
      else if (seg === 'regular') regular++;
      else if (seg === 'new') newUser++;
      else atRisk++;
    });
    this.segmentChartData.set({
      labels: ['VIP', 'Thường xuyên', 'Mới', 'Chưa mua'],
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

  getUserName(user: User): string {
    return user.profile?.fullName || user.username || user.phoneNumber;
  }

  getInitial(user: User): string {
    return this.getUserName(user).charAt(0).toUpperCase();
  }

  getUserLocation(user: User): string {
    if (user.addresses && user.addresses.length > 0) {
      const addr = user.addresses[0];
      return [addr.district, addr.city].filter(Boolean).join(', ') || '';
    }
    return '';
  }

  getSegment(user: User): string {
    return getUserSegment(user.orderCount || 0);
  }

  getSegmentLabel(user: User): string {
    return getUserSegmentLabel(user.orderCount || 0);
  }
}
