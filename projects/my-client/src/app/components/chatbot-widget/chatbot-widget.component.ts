import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
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
export class ChatbotWidgetComponent {
  private chat = inject(ChatbotService);
  private auth = inject(AuthService);
  private router = inject(Router);

  isOpen = signal(false);
  isSending = signal(false);
  inputText = signal('');
  messages = signal<ChatMessage[]>([]);
  sessionId = `aru_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  readonly hasMessages = computed(() => this.messages().length > 0);

  // Dùng getter/setter để bind với ngModel
  get inputTextValue(): string {
    return this.inputText();
  }

  set inputTextValue(v: string) {
    this.inputText.set(v ?? '');
  }

  toggleOpen(): void {
    this.isOpen.update((v) => !v);
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

    this.chat.sendMessage(text, history, this.sessionId).subscribe({
      next: (res) => {
        const reply: ChatMessage = {
          role: 'assistant',
          content: res.reply || 'Xin lỗi, hiện tại AruBot đang bận. Bạn thử lại sau nhé.',
          products: res.products ?? [],
        };
        this.messages.set([...this.messages(), reply]);
        this.isSending.set(false);
      },
      error: () => {
        this.messages.set([
          ...this.messages(),
          { role: 'assistant', content: 'Xin lỗi, hiện tại AruBot đang bận. Bạn thử lại sau nhé.' },
        ]);
        this.isSending.set(false);
      },
    });
  }

  openProduct(p: ChatProduct | undefined | null): void {
    if (!p) return;
    const slugOrId = p.slug || p.id;
    if (!slugOrId) return;
    this.router.navigate(['/san-pham', slugOrId]);
  }
}

