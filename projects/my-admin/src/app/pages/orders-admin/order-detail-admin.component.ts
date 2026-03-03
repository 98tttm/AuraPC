import { Component, signal, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { AdminApiService, Order } from '../../core/admin-api.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { ORDER_STATUS_LABELS, ORDER_STATUS_KEYS } from '../../core/constants';

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
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  order = signal<Order | null>(null);
  loading = signal(true);
  error = signal('');
  updating = signal(false);
  newStatus = '';

  statuses = ORDER_STATUS_KEYS.map(k => ({ value: k, label: ORDER_STATUS_LABELS[k] }));

  // Stepper steps (excluding cancelled)
  stepperSteps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

  ngOnInit(): void {
    const orderNumber = this.route.snapshot.paramMap.get('orderNumber');
    if (orderNumber) {
      this.api.getOrder(orderNumber).subscribe({
        next: (order) => {
          this.order.set(order);
          this.newStatus = order.status;
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error || 'Không tìm thấy đơn hàng');
          this.loading.set(false);
        },
      });
    }
  }

  async updateStatus(): Promise<void> {
    const o = this.order();
    if (!o || this.newStatus === o.status) return;

    const confirmed = await this.confirm.confirm({
      title: 'Cập nhật trạng thái',
      message: `Đổi trạng thái đơn hàng #${o.orderNumber} từ "${this.getStatusLabel(o.status)}" sang "${this.getStatusLabel(this.newStatus)}"?`,
      confirmText: 'Cập nhật',
    });
    if (!confirmed) return;

    this.updating.set(true);
    this.api.updateOrderStatus(o.orderNumber, this.newStatus).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.updating.set(false);
        this.toast.success('Đã cập nhật trạng thái');
      },
      error: (err) => {
        this.updating.set(false);
        this.toast.error(err?.error?.error || 'Cập nhật thất bại');
      },
    });
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  getCustomerName(): string {
    const o = this.order();
    return o?.user?.profile?.fullName || o?.shippingAddress?.fullName || o?.user?.phoneNumber || 'N/A';
  }

  getStepIndex(status: string): number {
    return this.stepperSteps.indexOf(status);
  }

  isStepComplete(step: string): boolean {
    const o = this.order();
    if (!o || o.status === 'cancelled') return false;
    return this.getStepIndex(o.status) >= this.getStepIndex(step);
  }

  isStepCurrent(step: string): boolean {
    return this.order()?.status === step;
  }
}
