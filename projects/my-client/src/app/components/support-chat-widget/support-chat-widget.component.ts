import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService, SupportMessagePayload } from '../../core/services/realtime.service';
import { SupportChatService, SupportConversation, SupportMessage } from '../../core/services/support-chat.service';

@Component({
  selector: 'app-support-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support-chat-widget.component.html',
  styleUrl: './support-chat-widget.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportChatWidgetComponent implements OnInit, OnDestroy, AfterViewChecked {
  private auth = inject(AuthService);
  private realtime = inject(RealtimeService);
  private supportChat = inject(SupportChatService);

  @ViewChild('messagesContainer') private messagesEl?: ElementRef<HTMLDivElement>;

  readonly currentUser = this.auth.currentUser;
  readonly isLoggedIn = computed(() => !!this.currentUser());
  readonly unreadCount = computed(() => this.conversation()?.unreadForUser || 0);
  readonly hasMessages = computed(() => this.messages().length > 0);
  readonly assignedAdminName = computed(() => this.conversation()?.assignedAdmin?.name || 'Nhân viên tư vấn');

  isOpen = signal(false);
  loading = signal(false);
  sending = signal(false);
  error = signal('');
  inputText = signal('');
  conversation = signal<SupportConversation | null>(null);
  messages = signal<SupportMessage[]>([]);
  adminTyping = signal(false);

  private lastUserId = '';
  private scrollPending = false;
  private subscriptions = new Subscription();
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  get inputTextValue(): string {
    return this.inputText();
  }

  set inputTextValue(value: string) {
    this.inputText.set(value ?? '');
  }

  constructor() {
    effect(() => {
      const user = this.currentUser();
      const userId = user?._id || '';

      if (!userId) {
        this.lastUserId = '';
        this.resetState();
        return;
      }

      if (userId !== this.lastUserId) {
        this.lastUserId = userId;
        this.loadConversation(true);
      }
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.realtime.supportConversationUpdated$.subscribe((conversation) => {
        const currentUserId = this.currentUser()?._id;
        if (!currentUserId || conversation.user?._id !== currentUserId) return;
        this.conversation.set(conversation);
        if (this.isOpen() && (conversation.unreadForUser || 0) > 0) {
          this.markRead();
        }
      })
    );

    this.subscriptions.add(
      this.realtime.supportMessageCreated$.subscribe((payload) => {
        this.handleRealtimeMessage(payload);
      })
    );

    this.subscriptions.add(
      this.realtime.supportTyping$.subscribe((data) => {
        const convId = this.conversation()?._id;
        if (!convId || data.conversationId !== convId) return;
        this.adminTyping.set(true);
        this.queueScroll();
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.adminTyping.set(false), 3000);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (!this.scrollPending) return;
    const container = this.messagesEl?.nativeElement;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    this.scrollPending = false;
  }

  toggleOpen(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);

    if (!next) return;

    if (this.isLoggedIn()) {
      if (!this.conversation() && !this.loading()) {
        this.loadConversation();
      } else {
        this.markRead();
        this.queueScroll();
      }
    }
  }

  openLoginPopup(): void {
    this.auth.showLoginPopup$.next();
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.send();
    }
  }

  send(): void {
    if (!this.isLoggedIn()) {
      this.openLoginPopup();
      return;
    }

    const content = this.inputText().trim();
    if (!content || this.sending()) return;

    this.error.set('');
    this.sending.set(true);

    this.supportChat.sendMyMessage(content).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.inputText.set('');
        this.conversation.set(res.conversation);
        this.upsertMessage(res.message);
        this.queueScroll();
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err?.error?.error || 'Không gửi được tin nhắn. Vui lòng thử lại.');
      },
    });
  }

  trackMessage(index: number, message: SupportMessage): string {
    return message._id || `${message.conversationId}-${index}`;
  }

  displayTime(value?: string | null): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(value));
  }

  isOwnMessage(message: SupportMessage): boolean {
    return message.senderType === 'user';
  }

  private loadConversation(silent = false): void {
    if (!this.isLoggedIn()) return;

    if (!silent) {
      this.loading.set(true);
      this.error.set('');
    }

    this.supportChat.getMyConversation().subscribe({
      next: (res) => {
        this.conversation.set(res.conversation);
        this.messages.set(res.messages || []);
        this.loading.set(false);
        if (this.isOpen()) {
          this.markRead();
          this.queueScroll();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Không tải được cuộc trò chuyện.');
      },
    });
  }

  private markRead(): void {
    const conversation = this.conversation();
    if (!conversation || conversation.unreadForUser <= 0) return;

    this.supportChat.markMyConversationRead().subscribe({
      next: (res) => {
        if (res.conversation) {
          this.conversation.set(res.conversation);
        }
      },
      error: () => {},
    });
  }

  private handleRealtimeMessage(payload: SupportMessagePayload): void {
    const currentUserId = this.currentUser()?._id;
    if (!currentUserId || payload.conversation.user?._id !== currentUserId) return;

    this.conversation.set(payload.conversation);
    this.upsertMessage(payload.message);

    if (payload.message.senderType === 'admin') {
      this.adminTyping.set(false);
      if (this.typingTimeout) clearTimeout(this.typingTimeout);
      if (this.isOpen()) this.markRead();
    }
  }

  private upsertMessage(message: SupportMessage): void {
    const current = this.messages();
    const index = current.findIndex((item) => item._id === message._id);

    if (index >= 0) {
      const next = [...current];
      next[index] = message;
      this.messages.set(next);
    } else {
      this.messages.set([...current, message].sort((a, b) => {
        const left = new Date(a.createdAt || 0).getTime();
        const right = new Date(b.createdAt || 0).getTime();
        return left - right;
      }));
    }

    this.queueScroll();
  }

  private queueScroll(): void {
    this.scrollPending = true;
  }

  private resetState(): void {
    this.isOpen.set(false);
    this.loading.set(false);
    this.sending.set(false);
    this.error.set('');
    this.inputText.set('');
    this.conversation.set(null);
    this.messages.set([]);
  }
}
