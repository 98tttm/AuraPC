import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

export interface ChatProduct {
  id: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  old_price?: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  products?: ChatProduct[];
}

export interface ChatResponse {
  reply: string;
  products?: ChatProduct[];
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private http = inject(HttpClient);

  sendMessage(message: string, history: ChatMessage[] = [], sessionId?: string) {
    return this.http.post<ChatResponse>(`${BASE}/chat`, {
      message,
      history,
      sessionId,
    });
  }
}

