import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, tap } from 'rxjs';

const BASE = `${environment.apiUrl}/auth`;
const STORAGE_KEY = 'aurapc_user';

export interface UserProfile {
  fullName: string;
  dateOfBirth: string | null;
  gender?: string;
}

export interface User {
  _id: string;
  id?: string;
  email: string;
  phoneNumber: string;
  username: string;
  profile: UserProfile;
  address: unknown;
  avatar: string;
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestOtpResponse {
  success: boolean;
  message?: string;
  error?: string;
  /** Chỉ có khi chạy development: mã OTP để log ra console trình duyệt */
  devOtp?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  user?: User;
  message?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  readonly currentUser = signal<User | null>(null);

  constructor() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const user = JSON.parse(raw) as User;
        if (user && user.phoneNumber) this.currentUser.set(user);
      }
    } catch {
      // ignore invalid stored user
    }
  }

  private persistUser(user: User | null): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  requestOtp(phoneNumber: string): Observable<RequestOtpResponse> {
    return this.http.post<RequestOtpResponse>(`${BASE}/request-otp`, { phoneNumber });
  }

  verifyOtp(phoneNumber: string, otp: string): Observable<VerifyOtpResponse> {
    return this.http.post<VerifyOtpResponse>(`${BASE}/verify-otp`, { phoneNumber, otp }).pipe(
      tap((res) => {
        if (res.success && res.user) {
          this.currentUser.set(res.user);
          this.persistUser(res.user);
        }
      })
    );
  }

  setUser(user: User | null): void {
    this.currentUser.set(user);
    this.persistUser(user);
  }

  logout(): void {
    this.currentUser.set(null);
    this.persistUser(null);
  }
}
