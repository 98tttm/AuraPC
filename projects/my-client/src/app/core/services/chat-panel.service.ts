import { Injectable, signal } from '@angular/core';

export type ActiveChatPanel = 'none' | 'chatbot' | 'support';

@Injectable({ providedIn: 'root' })
export class ChatPanelService {
  readonly active = signal<ActiveChatPanel>('none');

  open(panel: 'chatbot' | 'support'): void {
    this.active.set(panel);
  }

  close(): void {
    this.active.set('none');
  }

  toggle(panel: 'chatbot' | 'support'): void {
    this.active.set(this.active() === panel ? 'none' : panel);
  }
}
