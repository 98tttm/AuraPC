import { Injectable, signal, inject } from '@angular/core';

export type ToastType = 'otp' | 'info';

export interface ToastState {
  message: string;
  type: ToastType;
}

const OTP_DURATION_MS = 6000;
const DEFAULT_DURATION_MS = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  /** null = ẩn toast */
  readonly toast = signal<ToastState | null>(null);

  /**
   * Hiển thị toast màu xanh, chữ trắng với mã OTP.
   * Dùng cho đăng nhập (dev) và xác nhận COD.
   */
  showOtp(otp: string): void {
    this.clear();
    this.toast.set({ message: `Mã OTP: ${otp}`, type: 'otp' });
    this.timeoutId = setTimeout(() => {
      this.dismiss();
    }, OTP_DURATION_MS);
  }

  showInfo(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.clear();
    this.toast.set({ message, type: 'info' });
    this.timeoutId = setTimeout(() => this.dismiss(), durationMs);
  }

  dismiss(): void {
    this.clear();
    this.toast.set(null);
  }

  private clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
