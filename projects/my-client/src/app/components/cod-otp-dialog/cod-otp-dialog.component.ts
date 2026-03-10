import { Component, EventEmitter, Input, Output, signal, ViewChildren, QueryList, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Standalone COD OTP Dialog Component.
 * Extracted from CheckoutComponent to reduce complexity.
 *
 * Usage:
 * <app-cod-otp-dialog
 *   [phone]="codOtpPhone"
 *   [submitting]="submitting()"
 *   (verified)="onOtpVerified()"
 *   (closed)="showCodOtpPopup.set(false)"
 * />
 */
@Component({
    selector: 'app-cod-otp-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="otp-overlay" (click)="close()">
      <div class="otp-popup" (click)="$event.stopPropagation()">
        <button type="button" class="otp-popup__close" (click)="close()" aria-label="Đóng">×</button>
        <h3 class="otp-popup__title">Xác nhận mã OTP</h3>
        <p class="otp-popup__desc">
          Mã xác thực đã gửi đến số {{ phone }}. Có hiệu lực trong {{ countdownText() }}
        </p>
        <div class="otp-popup__row">
          @for (i of digits; track i) {
          <input #otpInput type="text" inputmode="numeric" maxlength="1" class="otp-popup__input"
            [class.otp-popup__input--error]="error()"
            [ngModel]="getDigit(i)" (ngModelChange)="setDigit(i, $event)"
            (keydown)="onKeydown($event, i)" />
          }
        </div>
        @if (error()) {
        <p class="otp-popup__error" role="alert">{{ error() }}</p>
        }
        <button type="button" class="otp-popup__btn" (click)="submit()" [disabled]="submitting">
          {{ submitting ? 'Đang xử lý...' : 'Xác nhận' }}
        </button>
        <button type="button" class="otp-popup__resend" (click)="resend()">Gửi lại mã</button>
      </div>
    </div>
  `,
    styles: [`
    .otp-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      padding: 1rem;
      animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .otp-popup {
      position: relative;
      background: #fff;
      border-radius: 16px;
      padding: 2rem 1.5rem;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
      text-align: center;
    }
    .otp-popup__close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      font-size: 1.5rem;
      line-height: 1;
      color: #666;
      cursor: pointer;
      padding: 0.25rem;
    }
    .otp-popup__close:hover { color: #1a1a1a; }
    .otp-popup__title {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
      font-weight: 700;
      color: #1a1a1a;
    }
    .otp-popup__desc {
      margin: 0 0 1.25rem;
      font-size: 0.9rem;
      color: #666;
      line-height: 1.4;
    }
    .otp-popup__row {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-bottom: 0.75rem;
    }
    .otp-popup__input {
      width: 44px;
      height: 48px;
      text-align: center;
      font-size: 1.25rem;
      font-weight: 600;
      border: 1px solid #ddd;
      border-radius: 10px;
      box-sizing: border-box;
      transition: border-color 0.2s;
      outline: none;
    }
    .otp-popup__input:focus { border-color: #1a1a1a; }
    .otp-popup__input--error { border-color: #d32f2f; }
    .otp-popup__error {
      margin: 0 0 0.75rem;
      font-size: 0.875rem;
      color: #d32f2f;
    }
    .otp-popup__btn {
      width: 100%;
      padding: 0.875rem;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 0.75rem;
      transition: opacity 0.2s;
    }
    .otp-popup__btn:hover { opacity: 0.85; }
    .otp-popup__btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .otp-popup__resend {
      display: block;
      width: 100%;
      background: none;
      border: none;
      font-size: 0.875rem;
      color: #FF6D2D;
      cursor: pointer;
      padding: 0.5rem;
    }
    .otp-popup__resend:hover { text-decoration: underline; }
  `],
})
export class CodOtpDialogComponent implements OnDestroy {
    @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

    @Input() phone = '';
    @Input() submitting = false;

    @Output() verified = new EventEmitter<string>();   // emits the 6-digit OTP
    @Output() closed = new EventEmitter<void>();
    @Output() resendOtp = new EventEmitter<void>();

    readonly digits = [0, 1, 2, 3, 4, 5];

    error = signal<string | null>(null);
    otpValue = signal('');
    countdownSeconds = signal(0);
    private countdownInterval: ReturnType<typeof setInterval> | null = null;

    /** Call from parent after requestOtp succeeds. */
    startCountdown(durationMs = 5 * 60 * 1000): void {
        this.stopCountdown();
        const expiresAt = Date.now() + durationMs;
        const tick = () => {
            const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            this.countdownSeconds.set(left);
            if (left <= 0) this.stopCountdown();
        };
        tick();
        this.countdownInterval = setInterval(tick, 1000);

        // Focus first input
        setTimeout(() => this.focusInput(0), 100);
    }

    countdownText(): string {
        const s = this.countdownSeconds();
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    getDigit(index: number): string {
        const s = this.otpValue();
        return index >= 0 && index < s.length ? s[index] : '';
    }

    setDigit(index: number, value: string): void {
        const v = value.replace(/\D/g, '').slice(0, 1);
        const cur = this.otpValue().split('');
        while (cur.length < 6) cur.push('');
        cur[index] = v;
        this.otpValue.set(cur.join(''));
        if (v && index < 5) setTimeout(() => this.focusInput(index + 1), 0);
    }

    onKeydown(event: KeyboardEvent, index: number): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.submit();
            return;
        }
        if (event.key === 'Backspace' && !this.getDigit(index) && index > 0) {
            const cur = this.otpValue().split('');
            cur[index - 1] = '';
            this.otpValue.set(cur.join(''));
            setTimeout(() => this.focusInput(index - 1), 0);
        }
    }

    submit(): void {
        this.error.set(null);
        const otp = this.otpValue().replace(/\D/g, '');
        if (otp.length !== 6) {
            this.error.set('Vui lòng nhập đủ 6 chữ số.');
            return;
        }
        this.verified.emit(otp);
    }

    resend(): void {
        this.error.set(null);
        this.resendOtp.emit();
    }

    close(): void {
        this.otpValue.set('');
        this.error.set(null);
        this.stopCountdown();
        this.closed.emit();
    }

    ngOnDestroy(): void {
        this.stopCountdown();
    }

    private focusInput(index: number): void {
        const list = this.otpInputs;
        if (list && index >= 0 && index < list.length) list.get(index)?.nativeElement.focus();
    }

    private stopCountdown(): void {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.countdownSeconds.set(0);
    }
}
