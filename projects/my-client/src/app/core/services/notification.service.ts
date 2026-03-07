import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService, UserNotification } from './api.service';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  private items = signal<UserNotification[]>([]);
  private unreadCountInternal = signal(0);
  private loading = signal(false);

  notifications = this.items.asReadonly();
  unreadCount = this.unreadCountInternal.asReadonly();
  notifLoading = this.loading.asReadonly();

  loadNotifications(silent = false): void {
    if (!this.auth.currentUser()) return;
    if (!silent) this.loading.set(true);
    this.api.getNotifications(20).subscribe({
      next: (res) => {
        this.items.set(res.items || []);
        this.unreadCountInternal.set(res.unreadCount ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  isUnread(item: UserNotification): boolean {
    return !item.readAt;
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: (res) => {
        this.unreadCountInternal.set(0);
        this.items.update((list) =>
          list.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
        );
      },
    });
  }

  openNotification(item: UserNotification): void {
    const orderNumber = item.metadata?.orderNumber;
    if (orderNumber) this.router.navigate(['/tai-khoan'], { queryParams: { tab: 'orders' } });
    if (this.isUnread(item)) {
      this.api.markNotificationRead(item._id).subscribe({
        next: () => {
          this.unreadCountInternal.update((c) => Math.max(0, c - 1));
          this.items.update((list) =>
            list.map((n) => (n._id === item._id ? { ...n, readAt: new Date().toISOString() } : n))
          );
        },
      });
    }
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      order_confirmed: 'Đơn đã xác nhận',
      order_processing: 'Đơn đang xử lý',
      order_shipped: 'Đơn đang giao',
      order_delivered: 'Đơn đã giao',
      order_cancelled: 'Đơn đã hủy',
      order_cancel_approved: 'Đơn đã hủy',
      order_cancel_rejected: 'Yêu cầu hủy',
      order_return_approved: 'Hoàn trả đã duyệt',
      order_return_rejected: 'Yêu cầu hoàn trả',
    };
    return labels[type] || 'Thông báo';
  }

  timeAgo(createdAt?: string): string {
    if (!createdAt) return '';
    const diffMs = Date.now() - new Date(createdAt).getTime();
    if (diffMs < 60_000) return 'vừa xong';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} phút trước`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} giờ trước`;
    return `${Math.floor(diffMs / 86_400_000)} ngày trước`;
  }
}
