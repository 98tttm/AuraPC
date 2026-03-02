import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;
const TOKEN_KEY = 'aurapc_admin_token';
const ADMIN_KEY = 'aurapc_admin_user';

export interface AdminUser {
  _id: string;
  email: string;
  name: string;
  avatar: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  admin: AdminUser;
}

interface MeResponse {
  success: boolean;
  admin: AdminUser;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  currentAdmin = signal<AdminUser | null>(null);

  constructor(private http: HttpClient) {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(ADMIN_KEY);
      if (raw) this.currentAdmin.set(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${BASE}/admin/auth/login`, { email, password }).pipe(
      tap((res) => {
        if (res.success && res.token) {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(ADMIN_KEY, JSON.stringify(res.admin));
          this.currentAdmin.set(res.admin);
        }
      })
    );
  }

  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${BASE}/admin/auth/me`).pipe(
      tap((res) => {
        if (res.success && res.admin) {
          localStorage.setItem(ADMIN_KEY, JSON.stringify(res.admin));
          this.currentAdmin.set(res.admin);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    this.currentAdmin.set(null);
  }
}
