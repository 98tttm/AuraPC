import { Injectable, inject, effect } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { AdminAuthService } from '../auth/admin-auth.service';
import { environment } from '../../../environments/environment';
import type { SupportConversation, SupportMessage } from './admin-support.service';

const ADMIN_TOKEN_KEY = 'aurapc_admin_token';

export interface OrderUpdatedPayload {
  orderNumber: string;
  status?: string;
  userId?: string;
}

export interface SupportMessagePayload {
  conversation: SupportConversation;
  message: SupportMessage;
}

/**
 * Realtime: khi đơn hàng thay đổi (khách "Đã nhận", yêu cầu hoàn trả, admin cập nhật...)
 * server push qua Socket.IO → admin cập nhật danh sách đơn và thông báo.
 */
@Injectable({ providedIn: 'root' })
export class AdminRealtimeService {
  private auth = inject(AdminAuthService);

  private socket: Socket | null = null;

  /** Emit khi server gửi order:updated (layout refresh notifications, orders list refresh list). */
  readonly orderUpdated$ = new Subject<OrderUpdatedPayload>();
  readonly supportConversationUpdated$ = new Subject<SupportConversation>();
  readonly supportMessageCreated$ = new Subject<SupportMessagePayload>();

  constructor() {
    effect(() => {
      const admin = this.auth.currentAdmin();
      if (admin) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private getSocketHost(): string {
    const api = environment.apiUrl ?? '';
    try {
      const u = new URL(api);
      return u.origin;
    } catch {
      return api.replace(/\/api\/?$/, '') || 'http://localhost:3000';
    }
  }

  private connect(): void {
    if (this.socket?.connected) return;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
    if (!token) return;

    const host = this.getSocketHost();
    this.socket = io(host, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('order:updated', (data: OrderUpdatedPayload) => {
      this.orderUpdated$.next(data);
    });

    this.socket.on('support:conversation:updated', (data: SupportConversation) => {
      this.supportConversationUpdated$.next(data);
    });

    this.socket.on('support:message:created', (data: SupportMessagePayload) => {
      this.supportMessageCreated$.next(data);
    });

    this.socket.on('connect_error', () => {});
  }

  /** Emit typing event so client sees "..." indicator */
  emitSupportTyping(data: { userId: string; conversationId: string; adminName: string }): void {
    if (this.socket?.connected) {
      this.socket.emit('support:typing', data);
    }
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
