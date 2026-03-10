import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  AdminSupportService,
  SupportConversation,
  SupportMessage,
} from '../../core/services/admin-support.service';
import { AdminRealtimeService, SupportMessagePayload } from '../../core/services/realtime.service';
import { ToastService } from '../../core/toast.service';

type ConversationTab = 'open' | 'archived' | 'all';

@Component({
  selector: 'app-support-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support-admin.component.html',
  styleUrl: './support-admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportAdminComponent implements OnInit, OnDestroy, AfterViewChecked {
  private support = inject(AdminSupportService);
  private realtime = inject(AdminRealtimeService);
  private toast = inject(ToastService);

  @ViewChild('messagesContainer') private messagesEl?: ElementRef<HTMLDivElement>;

  conversations = signal<SupportConversation[]>([]);
  counts = signal({ open: 0, archived: 0, all: 0, unread: 0 });
  selectedConversation = signal<SupportConversation | null>(null);
  selectedConversationId = signal('');
  messages = signal<SupportMessage[]>([]);
  activeTab = signal<ConversationTab>('open');
  searchQuery = signal('');
  inputText = signal('');
  loadingList = signal(true);
  loadingConversation = signal(false);
  sending = signal(false);
  error = signal('');

  readonly filteredConversations = computed(() => {
    const keyword = this.searchQuery().trim().toLowerCase();
    if (!keyword) return this.conversations();

    return this.conversations().filter((conversation) => {
      const user = conversation.user;
      return [
        user?.displayName,
        user?.fullName,
        user?.username,
        user?.phoneNumber,
        user?.email,
        conversation.lastMessagePreview,
      ].some((value) => (value || '').toLowerCase().includes(keyword));
    });
  });

  readonly hasSelection = computed(() => !!this.selectedConversation());

  private subscriptions = new Subscription();
  private scrollPending = false;
  private lastTypingEmit = 0;

  get inputTextValue(): string {
    return this.inputText();
  }

  set inputTextValue(value: string) {
    this.inputText.set(value ?? '');
  }

  onTyping(): void {
    this.emitTyping();
  }

  private emitTyping(): void {
    const now = Date.now();
    if (now - this.lastTypingEmit < 2000) return;
    this.lastTypingEmit = now;

    const conversation = this.selectedConversation();
    if (!conversation) return;

    const userId = typeof conversation.user === 'string'
      ? conversation.user
      : conversation.user?._id || '';
    if (!userId) return;

    this.realtime.emitSupportTyping({
      userId,
      conversationId: conversation._id,
      adminName: conversation.assignedAdmin?.name || '',
    });
  }

  ngOnInit(): void {
    this.loadConversations();

    this.subscriptions.add(
      this.realtime.supportConversationUpdated$.subscribe((conversation) => {
        this.handleRealtimeConversation(conversation);
      })
    );

    this.subscriptions.add(
      this.realtime.supportMessageCreated$.subscribe((payload) => {
        this.handleRealtimeMessage(payload);
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

  setTab(tab: ConversationTab): void {
    if (tab === this.activeTab()) return;
    this.activeTab.set(tab);
    this.loadConversations();
  }

  selectConversation(conversationId: string): void {
    if (!conversationId) return;
    this.selectedConversationId.set(conversationId);
    this.loadConversationDetail(conversationId);
  }

  refresh(): void {
    this.loadConversations();
    if (this.selectedConversationId()) {
      this.loadConversationDetail(this.selectedConversationId(), false);
    }
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.send();
    }
  }

  send(): void {
    const conversation = this.selectedConversation();
    const content = this.inputText().trim();
    if (!conversation || !content || this.sending()) return;

    this.sending.set(true);

    this.support.sendMessage(conversation._id, content).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.inputText.set('');
        this.selectedConversation.set(res.conversation);
        this.selectedConversationId.set(res.conversation._id);
        this.upsertMessage(res.message);
        this.loadConversations(true);
      },
      error: (err) => {
        this.sending.set(false);
        this.toast.error(err?.error?.error || 'Không gửi được tin nhắn');
      },
    });
  }

  toggleArchive(): void {
    const conversation = this.selectedConversation();
    if (!conversation) return;

    const nextArchived = !conversation.archived;
    this.support.archiveConversation(conversation._id, nextArchived).subscribe({
      next: (res) => {
        this.selectedConversation.set(res.conversation);
        this.toast.success(nextArchived ? 'Đã lưu trữ cuộc trò chuyện' : 'Đã mở lại cuộc trò chuyện');
        this.loadConversations(true);

        if (this.activeTab() === 'open' && nextArchived) {
          this.clearSelection();
        }
        if (this.activeTab() === 'archived' && !nextArchived) {
          this.clearSelection();
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Không cập nhật được trạng thái cuộc trò chuyện');
      },
    });
  }

  trackConversation(index: number, conversation: SupportConversation): string {
    return conversation._id || `${index}`;
  }

  trackMessage(index: number, message: SupportMessage): string {
    return message._id || `${message.conversationId}-${index}`;
  }

  displayCustomerName(conversation: SupportConversation | null): string {
    const user = conversation?.user;
    return user?.displayName || user?.fullName || user?.username || user?.phoneNumber || 'Khách hàng';
  }

  customerInitial(conversation: SupportConversation | null): string {
    return this.displayCustomerName(conversation).trim().charAt(0).toUpperCase() || 'K';
  }

  conversationTime(value?: string | null): string {
    if (!value) return '';

    const date = new Date(value);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    return new Intl.DateTimeFormat('vi-VN', sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit' }).format(date);
  }

  messageTime(value?: string | null): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(value));
  }

  private loadConversations(silent = false): void {
    if (!silent) this.loadingList.set(true);
    this.error.set('');

    this.support.getConversations(this.activeTab()).subscribe({
      next: (res) => {
        this.conversations.set(res.items || []);
        this.counts.set(res.counts);
        this.loadingList.set(false);

        if (this.selectedConversationId()) {
          const selected = res.items.find((item) => item._id === this.selectedConversationId());
          if (selected) {
            this.selectedConversation.set(selected);
          } else if (this.activeTab() !== 'all') {
            this.clearSelection();
          }
        }
      },
      error: (err) => {
        this.loadingList.set(false);
        this.error.set(err?.error?.error || 'Không tải được danh sách cuộc trò chuyện');
      },
    });
  }

  private loadConversationDetail(conversationId: string, markRead = true): void {
    this.loadingConversation.set(true);

    this.support.getConversation(conversationId).subscribe({
      next: (res) => {
        this.selectedConversation.set(res.conversation);
        this.messages.set(res.messages || []);
        this.loadingConversation.set(false);
        this.queueScroll();

        if (markRead && (res.conversation.unreadForAdmin || 0) > 0) {
          this.markSelectedConversationRead(conversationId);
        }
      },
      error: (err) => {
        this.loadingConversation.set(false);
        this.toast.error(err?.error?.error || 'Không tải được cuộc trò chuyện');
      },
    });
  }

  private markSelectedConversationRead(conversationId: string): void {
    this.support.markConversationRead(conversationId).subscribe({
      next: (res) => {
        this.selectedConversation.set(res.conversation);
        this.loadConversations(true);
      },
      error: () => {},
    });
  }

  private handleRealtimeConversation(conversation: SupportConversation): void {
    if (conversation._id === this.selectedConversationId()) {
      this.selectedConversation.set(conversation);
    }
    this.loadConversations(true);
  }

  private handleRealtimeMessage(payload: SupportMessagePayload): void {
    if (payload.conversation._id === this.selectedConversationId()) {
      this.selectedConversation.set(payload.conversation);
      this.upsertMessage(payload.message);

      if (payload.message.senderType === 'user') {
        this.markSelectedConversationRead(payload.conversation._id);
      }
    }

    this.loadConversations(true);
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

  private clearSelection(): void {
    this.selectedConversationId.set('');
    this.selectedConversation.set(null);
    this.messages.set([]);
    this.inputText.set('');
  }
}
