import { Component, signal, OnInit, OnDestroy, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { AdminApiService, Order } from '../../core/admin-api.service';
import { AdminRealtimeService } from '../../core/services/realtime.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { ORDER_STATUS_LABELS } from '../../core/constants';

type StatusOption = {
  value: string;
  label: string;
};

const ADMIN_STATUS_OPTIONS: Record<string, string[]> = {
  pending: [],
  confirmed: ['shipped'],
  processing: ['shipped'],
  shipped: [],
  delivered: [],
  cancelled: [],
};

@Component({
  selector: 'app-order-detail-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail-admin.component.html',
  styleUrl: './order-detail-admin.component.css',
})
export class OrderDetailAdminComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(AdminApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private realtime = inject(AdminRealtimeService);

  private orderUpdatedSub: Subscription | null = null;

  order = signal<Order | null>(null);
  loading = signal(true);
  error = signal('');
  updating = signal(false);
  processingRequest = signal(false);
  statuses = signal<StatusOption[]>([]);
  newStatus = '';
  orderNumber = '';

  // Stepper steps (excluding cancelled)
  stepperSteps = ['pending', 'processing', 'shipped', 'delivered'];

  ngOnInit(): void {
    this.orderNumber = this.route.snapshot.paramMap.get('orderNumber') || '';
    if (this.orderNumber) this.loadOrder(this.orderNumber);
    this.orderUpdatedSub = this.realtime.orderUpdated$.subscribe((data) => {
      if (data.orderNumber === this.orderNumber) this.loadOrder(this.orderNumber);
    });
  }

  ngOnDestroy(): void {
    this.orderUpdatedSub?.unsubscribe();
  }

  private loadOrder(orderNumber: string): void {
    this.loading.set(true);
    this.api.getOrder(orderNumber).subscribe({
      next: (order) => {
        this.syncOrderState(order);
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
    if (!o || !this.canUpdateStatus() || this.newStatus === o.status) return;

    const confirmed = await this.confirm.confirm({
      title: 'Cập nhật trạng thái',
      message: `Đổi trạng thái đơn #${o.orderNumber} từ "${this.getStatusLabel(o.status)}" sang "${this.getStatusLabel(this.newStatus)}"?`,
      confirmText: 'Cập nhật',
    });
    if (!confirmed) return;

    this.updating.set(true);
    this.api.updateOrderStatus(o.orderNumber, this.newStatus).subscribe({
      next: (updated) => {
        this.syncOrderState(updated);
        this.updating.set(false);
        this.toast.success('Đã cập nhật trạng thái');
      },
      error: (err) => {
        this.updating.set(false);
        this.toast.error(err?.error?.error || 'Cập nhật thất bại');
      },
    });
  }

  canApproveOrder(): boolean {
    return this.order()?.status === 'pending';
  }

  canUpdateStatus(): boolean {
    return this.statuses().length > 0;
  }

  async approvePendingOrder(): Promise<void> {
    const o = this.order();
    if (!o || o.status !== 'pending') return;

    const confirmed = await this.confirm.confirm({
      title: 'Duyệt đơn hàng',
      message: `Xác nhận duyệt đơn #${o.orderNumber}? Trạng thái sẽ chuyển sang "${this.getStatusLabel('processing')}".`,
      confirmText: 'Duyệt đơn',
    });
    if (!confirmed) return;

    this.updating.set(true);
    this.api.updateOrderStatus(o.orderNumber, 'processing').subscribe({
      next: (updated) => {
        this.syncOrderState(updated);
        this.updating.set(false);
        this.toast.success('Đã duyệt đơn hàng và chuyển sang Đang xử lý');
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
        this.syncOrderState(updated);
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
        this.syncOrderState(updated);
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

  /** SĐT để link tel: (Liên hệ khách). Trả về undefined nếu không có. */
  contactPhone(): string | undefined {
    const o = this.order();
    const v = o?.shippingAddress?.phone || o?.user?.phoneNumber;
    return v && v !== 'N/A' ? v : undefined;
  }

  /** Email để link mailto: (Liên hệ khách). Trả về undefined nếu không có. */
  contactEmail(): string | undefined {
    const o = this.order();
    const v = o?.shippingAddress?.email || o?.user?.email;
    return v && v !== 'N/A' ? v : undefined;
  }

  getShippingAddress(): string {
    const o = this.order();
    const address = o?.shippingAddress;
    if (!address) return 'N/A';

    return [address.address, address.ward, address.district, address.city]
      .filter(Boolean)
      .join(', ') || 'N/A';
  }

  getStatusHint(): string {
    const o = this.order();
    if (!o) return '';

    if (o.cancelRequest?.status === 'pending') {
      return 'Đơn đang có yêu cầu hủy chờ xử lý. Admin cần xử lý yêu cầu này trước khi tiếp tục giao hàng.';
    }

    switch (o.status) {
      case 'pending':
        return 'Admin chỉ có thể duyệt đơn. Sau khi duyệt, đơn sẽ chuyển sang "Đang xử lý".';
      case 'confirmed':
        return 'Đơn đang ở trạng thái cũ "Đã xác nhận". Admin có thể chuyển tiếp sang "Đang giao".';
      case 'processing':
        return 'Khi xử lý xong, admin chuyển đơn sang "Đang giao".';
      case 'shipped':
        return 'Khách hàng sẽ xác nhận "Đã nhận hàng" để đơn chuyển sang "Đã giao".';
      case 'delivered':
        return 'Đơn đã được khách hàng xác nhận nhận hàng.';
      case 'cancelled':
        return 'Đơn đã hủy. Trạng thái này chỉ được cập nhật qua yêu cầu hủy hoặc hoàn trả.';
      default:
        return '';
    }
  }

  hasPendingCancelRequest(): boolean {
    return this.order()?.cancelRequest?.status === 'pending';
  }

  hasPendingReturnRequest(): boolean {
    return this.order()?.returnRequest?.status === 'pending';
  }

  getStepIndex(status: string): number {
    return this.stepperSteps.indexOf(this.normalizeStepperStatus(status));
  }

  isStepComplete(step: string): boolean {
    const o = this.order();
    if (!o || o.status === 'cancelled') return false;
    return this.getStepIndex(o.status) >= this.getStepIndex(step);
  }

  isStepCurrent(step: string): boolean {
    return this.normalizeStepperStatus(this.order()?.status || '') === step;
  }

  private syncOrderState(order: Order): void {
    const statuses = this.getStatusOptions(order.status);
    this.order.set(order);
    this.statuses.set(statuses);
    this.newStatus = statuses[0]?.value || order.status;
  }

  private getStatusOptions(status: string): StatusOption[] {
    const nextStatuses = ADMIN_STATUS_OPTIONS[status] || [];
    return nextStatuses.map((value) => ({
      value,
      label: this.getStatusLabel(value),
    }));
  }

  private normalizeStepperStatus(status: string): string {
    return status === 'confirmed' ? 'processing' : status;
  }
}
