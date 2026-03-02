import { Component, signal, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { AdminApiService } from '../../core/admin-api.service';

@Component({
  selector: 'app-order-detail-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail-admin.component.html',
  styleUrl: './order-detail-admin.component.css',
})
export class OrderDetailAdminComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(AdminApiService);

  order = signal<any>(null);
  loading = signal(true);
  updating = signal(false);
  newStatus = '';

  statuses = [
    { value: 'pending', label: 'Chờ xử lý' },
    { value: 'confirmed', label: 'Đã xác nhận' },
    { value: 'processing', label: 'Đang xử lý' },
    { value: 'shipped', label: 'Đang giao' },
    { value: 'delivered', label: 'Hoàn thành' },
    { value: 'cancelled', label: 'Đã huỷ' },
  ];

  ngOnInit(): void {
    const orderNumber = this.route.snapshot.paramMap.get('orderNumber');
    if (orderNumber) {
      this.api.getOrder(orderNumber).subscribe({
        next: (order) => {
          this.order.set(order);
          this.newStatus = order.status;
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  updateStatus(): void {
    const o = this.order();
    if (!o || this.newStatus === o.status) return;

    this.updating.set(true);
    this.api.updateOrderStatus(o.orderNumber, this.newStatus).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.updating.set(false);
      },
      error: () => this.updating.set(false),
    });
  }

  getStatusLabel(status: string): string {
    return this.statuses.find((s) => s.value === status)?.label || status;
  }

  getCustomerName(): string {
    const o = this.order();
    return o?.user?.profile?.fullName || o?.shippingAddress?.fullName || o?.user?.phoneNumber || 'N/A';
  }
}
