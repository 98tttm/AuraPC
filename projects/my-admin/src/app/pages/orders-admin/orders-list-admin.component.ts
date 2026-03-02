import { Component, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { AdminApiService } from '../../core/admin-api.service';

@Component({
  selector: 'app-orders-list-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders-list-admin.component.html',
  styleUrl: './orders-list-admin.component.css',
})
export class OrdersListAdminComponent implements OnInit {
  orders = signal<any[]>([]);
  total = signal(0);
  loading = signal(true);
  page = 1;
  limit = 20;
  statusFilter = '';
  searchQuery = '';

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.api.getOrders({ page: this.page, limit: this.limit, status: this.statusFilter, search: this.searchQuery }).subscribe({
      next: (res) => {
        this.orders.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFilterChange(): void {
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

  get totalPages(): number {
    return Math.ceil(this.total() / this.limit);
  }

  getCustomerName(order: any): string {
    return order.user?.profile?.fullName || order.shippingAddress?.fullName || order.user?.phoneNumber || 'N/A';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', processing: 'Đang xử lý',
      shipped: 'Đang giao', delivered: 'Hoàn thành', cancelled: 'Đã huỷ',
    };
    return map[status] || status;
  }
}
