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
    <div class="chk-modal-overlay chk-otp-overlay" (click)="close()">
      <div class="chk-otp-popup" (click)="$event.stopPropagation()">
        <button type="button" class="chk-otp-popup__close" (click)="close()" aria-label="Đóng">×</button>
        <h3 class="chk-otp-popup__title">Xác nhận mã OTP</h3>
        <p class="chk-otp-popup__desc">
          Mã xác thực đã gửi đến số {{ phone }}. Có hiệu lực trong {{ countdownText() }}
        </p>
        <div class="chk-otp-popup__row">
          @for (i of digits; track i) {
          <input #otpInput type="text" inputmode="numeric" maxlength="1" class="chk-otp-popup__input"
            [class.chk-otp-popup__input--error]="error()"
            [ngModel]="getDigit(i)" (ngModelChange)="setDigit(i, $event)"
            (keydown)="onKeydown($event, i)" />
          }
        </div>
        @if (error()) {
        <p class="chk-otp-popup__error" role="alert">{{ error() }}</p>
        }
        <button type="button" class="btn-submit chk-otp-popup__btn" (click)="submit()" [disabled]="submitting">
          {{ submitting ? 'Đang xử lý...' : 'Xác nhận' }}
        </button>
        <button type="button" class="chk-otp-popup__resend" (click)="resend()">Gửi lại mã</button>
      </div>
    </div>
  `,
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
