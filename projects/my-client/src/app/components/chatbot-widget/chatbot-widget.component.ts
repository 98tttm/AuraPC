import { Component, ChangeDetectionStrategy, signal, computed, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService, ChatMessage, ChatProduct } from '../../core/services/chatbot.service';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-widget.component.html',
  styleUrls: ['./chatbot-widget.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatbotWidgetComponent implements AfterViewChecked {
  private chat = inject(ChatbotService);
  private auth = inject(AuthService);
  private router = inject(Router);

  @ViewChild('messagesContainer') private messagesEl!: ElementRef<HTMLDivElement>;
  @ViewChild('scrollAnchor') private scrollAnchor!: ElementRef<HTMLDivElement>;

  isOpen = signal(false);
  isSending = signal(false);
  inputText = signal('');
  messages = signal<ChatMessage[]>([]);
  sessionId = `aru_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  readonly hasMessages = computed(() => this.messages().length > 0);

  private scrollTarget: 'bottom' | 'last-message' | null = null;
  private lastMessageIdx = -1;

  get inputTextValue(): string {
    return this.inputText();
  }

  set inputTextValue(v: string) {
    this.inputText.set(v ?? '');
  }

  ngAfterViewChecked(): void {
    if (!this.scrollTarget) return;

    const container = this.messagesEl?.nativeElement;
    if (!container) return;

    if (this.scrollTarget === 'last-message' && this.lastMessageIdx >= 0) {
      // Scroll to show the start of the newest message
      const msgEl = container.querySelector<HTMLElement>(`[data-idx="${this.lastMessageIdx}"]`);
      if (msgEl) {
        // Scroll so the new message's top is visible with some padding
        const containerRect = container.getBoundingClientRect();
        const msgRect = msgEl.getBoundingClientRect();
        const offset = msgRect.top - containerRect.top + container.scrollTop - 8;
        container.scrollTo({ top: offset, behavior: 'smooth' });
        this.scrollTarget = null;
        return;
      }
    }

    // Default: scroll to very bottom
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    this.scrollTarget = null;
  }

  toggleOpen(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.scrollTarget = 'bottom';
    }
  }

  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (!e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.isSending()) return;
    const history = this.messages();
    const userMsg: ChatMessage = { role: 'user', content: text };
    this.messages.set([...history, userMsg]);
    this.inputText.set('');
    this.isSending.set(true);

    // Scroll to show user message
    this.lastMessageIdx = this.messages().length - 1;
    this.scrollTarget = 'bottom';

    this.chat.sendMessage(text, history, this.sessionId).subscribe({
      next: (res) => {
        const reply: ChatMessage = {
          role: 'assistant',
          content: res.reply || 'Xin lỗi, hiện tại AruBot đang bận. Bạn thử lại sau nhé.',
          products: res.products ?? [],
        };
        this.messages.set([...this.messages(), reply]);
        this.isSending.set(false);

        // Scroll to start of bot's reply
        this.lastMessageIdx = this.messages().length - 1;
        this.scrollTarget = 'last-message';
      },
      error: () => {
        this.messages.set([
          ...this.messages(),
          { role: 'assistant', content: 'Xin lỗi, hiện tại AruBot đang bận. Bạn thử lại sau nhé.' },
        ]);
        this.isSending.set(false);
        this.lastMessageIdx = this.messages().length - 1;
        this.scrollTarget = 'last-message';
      },
    });
  }

  discountPercent(oldPrice: number, price: number): number {
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }

  openProduct(p: ChatProduct | undefined | null): void {
    if (!p) return;
    const slugOrId = p.slug || p.id;
    if (slugOrId) {
      this.router.navigate(['/san-pham', slugOrId]);
    } else if (p.name) {
      this.router.navigate(['/san-pham'], { queryParams: { search: p.name } });
    } else {
      return;
    }
    this.isOpen.set(false);
  }
}
