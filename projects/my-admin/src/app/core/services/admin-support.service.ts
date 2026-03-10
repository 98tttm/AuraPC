import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  conversation: SupportConversation;
  messages: SupportMessage[];
}

export interface SupportConversationsResponse {
  items: SupportConversation[];
  counts: {
    open: number;
    archived: number;
    all: number;
    unread: number;
  };
}

export interface SupportSendMessageResponse {
  conversation: SupportConversation;
  message: SupportMessage;
}

@Injectable({ providedIn: 'root' })
export class AdminSupportService {
  constructor(private http: HttpClient) {}

  getConversations(tab: 'open' | 'archived' | 'all', search = ''): Observable<SupportConversationsResponse> {
    let params = new HttpParams().set('tab', tab);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<SupportConversationsResponse>(`${BASE}/admin/support`, { params });
  }

  getConversation(conversationId: string): Observable<SupportConversationDetailResponse> {
    return this.http.get<SupportConversationDetailResponse>(`${BASE}/admin/support/${conversationId}`);
  }

  markConversationRead(conversationId: string): Observable<{ success: boolean; conversation: SupportConversation }> {
    return this.http.put<{ success: boolean; conversation: SupportConversation }>(`${BASE}/admin/support/${conversationId}/read`, {});
  }

  archiveConversation(conversationId: string, archived: boolean): Observable<{ success: boolean; conversation: SupportConversation }> {
    return this.http.put<{ success: boolean; conversation: SupportConversation }>(`${BASE}/admin/support/${conversationId}/archive`, { archived });
  }

  sendMessage(conversationId: string, content: string): Observable<SupportSendMessageResponse> {
    return this.http.post<SupportSendMessageResponse>(`${BASE}/admin/support/${conversationId}/messages`, { content });
  }
}
