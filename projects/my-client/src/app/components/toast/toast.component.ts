import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (toast(); as t) {
      <div class="popup-overlay" (click)="dismiss()">
        <div class="popup" [class]="'popup--' + t.type" (click)="$event.stopPropagation()">
          <div class="popup__icon">
            @if (t.type === 'otp') {
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            } @else {
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            }
          </div>
          <p class="popup__message">{{ t.message }}</p>
          <button type="button" class="popup__btn" (click)="dismiss()">Đã hiểu</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      animation: fadeIn 0.2s ease-out;
    }
    .popup {
      background: #fff;
      border-radius: 16px;
      padding: 2rem 2rem 1.5rem;
      max-width: 400px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      animation: popIn 0.25s ease-out;
    }
    .popup__icon {
      margin-bottom: 1rem;
    }
    .popup--info .popup__icon {
      color: #FF6D2D;
    }
    .popup--otp .popup__icon {
      color: #16a34a;
    }
    .popup__message {
      font-size: 1rem;
      font-weight: 500;
      color: #1a1a1a;
      line-height: 1.5;
      margin: 0 0 1.5rem;
    }
    .popup__btn {
      display: inline-block;
      padding: 0.625rem 2rem;
      border: none;
      border-radius: 8px;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .popup--info .popup__btn {
      background: #FF6D2D;
      color: #fff;
    }
    .popup--info .popup__btn:hover {
      background: #e55a1b;
    }
    .popup--otp .popup__btn {
      background: #16a34a;
      color: #fff;
    }
    .popup--otp .popup__btn:hover {
      background: #15803d;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes popIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `],
})
export class ToastComponent {
  private toastService = inject(ToastService);
  toast = this.toastService.toast;

  dismiss(): void {
    this.toastService.dismiss();
  }
}
