import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

export interface SupportChatUser {
  _id: string;
  fullName?: string;
  username?: string;
  phoneNumber?: string;
  email?: string;
  avatar?: string;
  displayName?: string;
}

export interface SupportChatAdmin {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
}

export interface SupportConversation {
  _id: string;
  archived: boolean;
  lastMessagePreview: string;
  lastMessageBy: 'user' | 'admin';
  lastMessageAt?: string | null;
  unreadForAdmin: number;
  unreadForUser: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  user: SupportChatUser | null;
  assignedAdmin?: SupportChatAdmin | null;
}

export interface SupportMessage {
  _id: string;
  conversationId: string;
  senderType: 'user' | 'admin';
  content: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  sender: {
    _id: string;
    name: string;
    avatar?: string;
    role: 'user' | 'admin';
  };
}

export interface SupportConversationDetailResponse {
  conversation: SupportConversation | null;
  messages: SupportMessage[];
}

export interface SupportSendMessageResponse {
  conversation: SupportConversation;
  message: SupportMessage;
}

@Injectable({ providedIn: 'root' })
export class SupportChatService {
  constructor(private http: HttpClient) {}

  getMyConversation(): Observable<SupportConversationDetailResponse> {
    return this.http.get<SupportConversationDetailResponse>(`${BASE}/support/me`);
  }

  markMyConversationRead(): Observable<{ success: boolean; conversation: SupportConversation | null }> {
    return this.http.put<{ success: boolean; conversation: SupportConversation | null }>(`${BASE}/support/me/read`, {});
  }

  sendMyMessage(content: string): Observable<SupportSendMessageResponse> {
    return this.http.post<SupportSendMessageResponse>(`${BASE}/support/me/messages`, { content });
  }
}
