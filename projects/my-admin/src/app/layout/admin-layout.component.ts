import { Component, signal, ChangeDetectionStrategy, inject, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminAuthService } from '../core/auth/admin-auth.service';
import { ThemeService } from '../core/theme.service';
import { AdminApiService, AdminNotification } from '../core/admin-api.service';
import { AdminRealtimeService } from '../core/services/realtime.service';
import { ToastComponent } from '../shared/toast.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ToastComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = signal(false);
  admin = this.auth.currentAdmin;
  themeService = inject(ThemeService);
  notifications = signal<AdminNotification[]>([]);
  unreadCount = signal(0);
  notifOpen = signal(false);
  notifLoading = signal(false);
  private notifPollTimer: ReturnType<typeof setInterval> | null = null;
  private orderUpdatedSub: Subscription | null = null;

  @ViewChild('notifMenu') notifMenu?: ElementRef<HTMLElement>;
  @ViewChild('notifButton') notifButton?: ElementRef<HTMLButtonElement>;

  constructor(
    public router: Router,
    private auth: AdminAuthService,
    private api: AdminApiService,
    private realtime: AdminRealtimeService,
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.notifPollTimer = setInterval(() => {
      this.loadNotifications(true);
    }, 30000);
    this.orderUpdatedSub = this.realtime.orderUpdated$.subscribe(() => {
      this.loadNotifications(true);
    });
  }

  ngOnDestroy(): void {
    this.orderUpdatedSub?.unsubscribe();
    if (this.notifPollTimer) {
      clearInterval(this.notifPollTimer);
      this.notifPollTimer = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.notifOpen()) return;
    const target = event.target as Node;
    if (this.notifMenu?.nativeElement.contains(target)) return;
    if (this.notifButton?.nativeElement.contains(target)) return;
    this.notifOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleNotifications(event?: MouseEvent): void {
    event?.stopPropagation();
    const open = !this.notifOpen();
    this.notifOpen.set(open);
    if (open) this.loadNotifications(true);
  }

  loadNotifications(silent = false): void {
    if (!silent) this.notifLoading.set(true);
    this.api.getNotifications(20).subscribe({
      next: (res) => {
        this.notifications.set(res.items || []);
        this.unreadCount.set(res.unreadCount || 0);
        this.notifLoading.set(false);
      },
      error: () => {
        this.notifLoading.set(false);
      },
    });
  }

  isNotificationUnread(item: AdminNotification): boolean {
    const adminId = this.admin()?._id;
    if (!adminId) return false;
    return !(item.readBy || []).includes(adminId);
  }

  markAllNotificationsRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: () => this.loadNotifications(true),
      error: () => {},
    });
  }

  openNotification(item: AdminNotification): void {
    const nav = () => {
      this.notifOpen.set(false);
      this.router.navigate(['/orders', item.orderNumber]);
    };

    if (!this.isNotificationUnread(item)) {
      nav();
      return;
    }

    this.api.markNotificationRead(item._id).subscribe({
      next: () => {
        const adminId = this.admin()?._id;
        this.unreadCount.set(Math.max(0, this.unreadCount() - 1));
        this.notifications.update(list => list.map(n => {
          if (n._id !== item._id) return n;
          if (!adminId) return n;
          return { ...n, readBy: [...(n.readBy || []), adminId] };
        }));
        nav();
      },
      error: () => nav(),
    });
  }

  notificationTypeLabel(type: AdminNotification['type']): string {
    if (type === 'order_new') return 'Đơn mới';
    if (type === 'order_cancel_request') return 'Yêu cầu hủy';
    if (type === 'order_return_request') return 'Yêu cầu hoàn trả';
    if (type === 'order_delivered') return 'Đơn hoàn tất';
    return 'Thông báo';
  }

  notificationTimeAgo(createdAt?: string): string {
    if (!createdAt) return '';
    const diffMs = Date.now() - new Date(createdAt).getTime();
    if (diffMs < 60_000) return 'vừa xong';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} phút trước`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} giờ trước`;
    return `${Math.floor(diffMs / 86_400_000)} ngày trước`;
  }
}
