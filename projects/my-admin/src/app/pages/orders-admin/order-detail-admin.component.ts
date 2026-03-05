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
  processingRequest = signal(false);
  newStatus = '';
  orderNumber = '';

  statuses = ORDER_STATUS_KEYS.map(k => ({ value: k, label: ORDER_STATUS_LABELS[k] }));

  // Stepper steps (excluding cancelled)
  stepperSteps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

  ngOnInit(): void {
    this.orderNumber = this.route.snapshot.paramMap.get('orderNumber') || '';
    if (this.orderNumber) this.loadOrder(this.orderNumber);
  }

  private loadOrder(orderNumber: string, keepLoading = false): void {
    if (!keepLoading) this.loading.set(true);
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

  async updateStatus(): Promise<void> {
    const o = this.order();
    if (!o || this.newStatus === o.status) return;

    const confirmed = await this.confirm.confirm({
      title: 'Cập nhật trạng thái',
      message: `Đổi trạng thái đơn #${o.orderNumber} từ "${this.getStatusLabel(o.status)}" sang "${this.getStatusLabel(this.newStatus)}"?`,
      confirmText: 'Cập nhật',
    });
    if (!confirmed) return;

    this.updating.set(true);
    this.api.updateOrderStatus(o.orderNumber, this.newStatus).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.newStatus = updated.status;
        this.updating.set(false);
        this.toast.success('Đã cập nhật trạng thái');
      },
      error: (err) => {
        this.updating.set(false);
        this.toast.error(err?.error?.error || 'Cập nhật thất bại');
      },
    });
  }

  isPendingOrder(): boolean {
    return this.order()?.status === 'pending';
  }

  async approvePendingOrder(): Promise<void> {
    const o = this.order();
    if (!o || o.status !== 'pending') return;

    const confirmed = await this.confirm.confirm({
      title: 'Duyệt đơn hàng',
      message: `Xác nhận duyệt đơn #${o.orderNumber}? Trạng thái sẽ chuyển sang "${this.getStatusLabel('confirmed')}".`,
      confirmText: 'Duyệt đơn',
    });
    if (!confirmed) return;

    this.updating.set(true);
    this.api.updateOrderStatus(o.orderNumber, 'confirmed').subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.newStatus = updated.status;
        this.updating.set(false);
        this.toast.success('Đã duyệt đơn hàng');
      },
      error: (err) => {
        this.updating.set(false);
        this.toast.error(err?.error?.error || 'Duyệt đơn thất bại');
      },
    });
  }

  async resolveCancelRequest(action: 'approve' | 'reject'): Promise<void> {
    const o = this.order();
    if (!o || o.cancelRequest?.status !== 'pending') return;

    const confirmed = await this.confirm.confirm({
      title: action === 'approve' ? 'Duyệt hủy đơn' : 'Từ chối hủy đơn',
      message: action === 'approve'
        ? `Xác nhận duyệt yêu cầu hủy đơn #${o.orderNumber}?`
        : `Xác nhận từ chối yêu cầu hủy đơn #${o.orderNumber}?`,
      confirmText: action === 'approve' ? 'Duyệt' : 'Từ chối',
      danger: action === 'approve',
    });
    if (!confirmed) return;

    this.processingRequest.set(true);
    this.api.resolveCancelRequest(o.orderNumber, action).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.newStatus = updated.status;
        this.processingRequest.set(false);
        this.toast.success(action === 'approve' ? 'Đã duyệt yêu cầu hủy' : 'Đã từ chối yêu cầu hủy');
      },
      error: (err) => {
        this.processingRequest.set(false);
        this.toast.error(err?.error?.error || 'Xử lý yêu cầu hủy thất bại');
      },
    });
  }

  async resolveReturnRequest(action: 'approve' | 'reject'): Promise<void> {
    const o = this.order();
    if (!o || o.returnRequest?.status !== 'pending') return;

    const confirmed = await this.confirm.confirm({
      title: action === 'approve' ? 'Duyệt hoàn trả' : 'Từ chối hoàn trả',
      message: action === 'approve'
        ? `Xác nhận duyệt yêu cầu hoàn trả đơn #${o.orderNumber}?`
        : `Xác nhận từ chối yêu cầu hoàn trả đơn #${o.orderNumber}?`,
      confirmText: action === 'approve' ? 'Duyệt' : 'Từ chối',
      danger: action === 'approve',
    });
    if (!confirmed) return;

    this.processingRequest.set(true);
    this.api.resolveReturnRequest(o.orderNumber, action).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.newStatus = updated.status;
        this.processingRequest.set(false);
        this.toast.success(action === 'approve' ? 'Đã duyệt yêu cầu hoàn trả' : 'Đã từ chối yêu cầu hoàn trả');
      },
      error: (err) => {
        this.processingRequest.set(false);
        this.toast.error(err?.error?.error || 'Xử lý yêu cầu hoàn trả thất bại');
      },
    });
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  getPaymentMethodLabel(method?: string): string {
    const map: Record<string, string> = {
      cod: 'COD',
      qr: 'Chuyển khoản QR',
      momo: 'MoMo',
      zalopay: 'ZaloPay',
      atm: 'ATM/Napas',
    };
    if (!method) return 'N/A';
    return map[method] || method;
  }

  getCustomerName(): string {
    const o = this.order();
    return o?.user?.profile?.fullName || o?.shippingAddress?.fullName || o?.user?.phoneNumber || 'N/A';
  }

  getCustomerPhone(): string {
    const o = this.order();
    return o?.shippingAddress?.phone || o?.user?.phoneNumber || 'N/A';
  }

  getCustomerEmail(): string {
    const o = this.order();
    return o?.shippingAddress?.email || o?.user?.email || 'N/A';
  }

  getShippingAddress(): string {
    const o = this.order();
    const address = o?.shippingAddress;
    if (!address) return 'N/A';

    return [address.address, address.ward, address.district, address.city]
      .filter(Boolean)
      .join(', ') || 'N/A';
  }

  hasPendingCancelRequest(): boolean {
    return this.order()?.cancelRequest?.status === 'pending';
  }

  hasPendingReturnRequest(): boolean {
    return this.order()?.returnRequest?.status === 'pending';
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
