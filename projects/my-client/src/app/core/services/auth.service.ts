import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, tap, Subject } from 'rxjs';

const BASE = `${environment.apiUrl}/auth`;
const STORAGE_KEY = 'aurapc_user';
const TOKEN_KEY = 'aurapc_token';

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
  googleId?: string;
  facebookId?: string;
  authProvider?: 'phone' | 'google' | 'facebook';
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
  token?: string;
  message?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  readonly currentUser = signal<User | null>(null);
  readonly showLoginPopup$ = new Subject<void>();

  constructor() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const user = JSON.parse(raw) as User;
        if (user && (user.phoneNumber || user.googleId || user.facebookId)) this.currentUser.set(user);
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
    } catch { }
  }

  private persistToken(token: string | null): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { }
  }

  getToken(): string | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
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
          if (res.token) this.persistToken(res.token);
        }
      })
    );
  }

  loginWithGoogle(idToken: string): Observable<VerifyOtpResponse> {
    return this.http.post<VerifyOtpResponse>(`${BASE}/google`, { idToken }).pipe(
      tap((res) => {
        if (res.success && res.user) {
          this.currentUser.set(res.user);
          this.persistUser(res.user);
          if (res.token) this.persistToken(res.token);
        }
      })
    );
  }

  loginWithFacebook(accessToken: string): Observable<VerifyOtpResponse> {
    return this.http.post<VerifyOtpResponse>(`${BASE}/facebook`, { accessToken }).pipe(
      tap((res) => {
        if (res.success && res.user) {
          this.currentUser.set(res.user);
          this.persistUser(res.user);
          if (res.token) this.persistToken(res.token);
        }
      })
    );
  }

  setUser(user: User | null): void {
    this.currentUser.set(user);
    this.persistUser(user);
  }

  updateProfile(payload: { email?: string; profile?: Partial<UserProfile> }): Observable<{ success: boolean; user: User }> {
    const user = this.currentUser();
    if (!user) throw new Error('User not logged in');
    return this.http.put<{ success: boolean; user: User }>(`${BASE}/profile`, {
      userId: user._id || user.id,
      email: payload.email,
      profile: payload.profile,
    }).pipe(
      tap((res) => {
        if (res.success && res.user) {
          this.setUser(res.user);
        }
      })
    );
  }

  uploadAvatar(file: File): Observable<{ success: boolean; user: User; avatarUrl: string }> {
    const user = this.currentUser();
    if (!user) throw new Error('User not logged in');

    const formData = new FormData();
    formData.append('userId', user._id || user.id || '');
    formData.append('avatar', file);

    return this.http.post<{ success: boolean; user: User; avatarUrl: string }>(
      `${BASE}/avatar`,
      formData
    ).pipe(
      tap((res) => {
        if (res.success && res.user) {
          this.setUser(res.user);
        }
      })
    );
  }

  logout(): void {
    this.currentUser.set(null);
    this.persistUser(null);
    this.persistToken(null);
  }
}
