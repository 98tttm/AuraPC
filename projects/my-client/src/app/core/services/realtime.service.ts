import { Injectable, inject, effect } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';
import type { SupportConversation, SupportMessage } from './support-chat.service';

const TOKEN_KEY = 'aurapc_token';

export interface OrderUpdatedPayload {
  orderNumber: string;
  status?: string;
  userId?: string;
}

export interface SupportMessagePayload {
  conversation: SupportConversation;
  message: SupportMessage;
}

export interface SupportTypingPayload {
  conversationId: string;
  adminName: string;
}

/**
 * Realtime sync: khi đơn hàng thay đổi (khách "Đã nhận", admin đổi trạng thái, ...)
 * server push qua Socket.IO → client cập nhật danh sách đơn và thông báo.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private auth = inject(AuthService);
  private notif = inject(NotificationService);

  private socket: Socket | null = null;

  /** Emit khi server gửi order:updated (để account page refresh danh sách đơn). */
  readonly orderUpdated$ = new Subject<OrderUpdatedPayload>();
  readonly supportConversationUpdated$ = new Subject<SupportConversation>();
  readonly supportMessageCreated$ = new Subject<SupportMessagePayload>();
  readonly supportTyping$ = new Subject<SupportTypingPayload>();

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
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
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;

    const host = this.getSocketHost();
    this.socket = io(host, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('order:updated', (data: OrderUpdatedPayload) => {
      this.orderUpdated$.next(data);
      this.notif.loadNotifications(true);
    });

    this.socket.on('support:conversation:updated', (data: SupportConversation) => {
      this.supportConversationUpdated$.next(data);
    });

    this.socket.on('support:message:created', (data: SupportMessagePayload) => {
      this.supportMessageCreated$.next(data);
    });

    this.socket.on('support:typing', (data: SupportTypingPayload) => {
      this.supportTyping$.next(data);
    });

    this.socket.on('connect_error', () => {
      // Có thể dùng polling fallback; không cần log ồn
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
