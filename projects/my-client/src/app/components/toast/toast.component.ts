import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (toast(); as t) {
      <div class="toast toast--{{ t.type }}" role="status" aria-live="polite">
        <span class="toast__message">{{ t.message }}</span>
        <button type="button" class="toast__close" (click)="dismiss()" aria-label="Đóng">×</button>
      </div>
    }
  `,
  styles: [`
    .toast {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      animation: toastIn 0.3s ease-out;
    }
    .toast--otp {
      background: #16a34a;
      color: #fff;
    }
    .toast--info {
      background: #1e40af;
      color: #fff;
    }
    .toast__message {
      font-weight: 600;
      font-size: 0.9375rem;
      letter-spacing: 0.02em;
    }
    .toast__close {
      background: none;
      border: none;
      color: inherit;
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
      opacity: 0.9;
      padding: 0 0.25rem;
    }
    .toast__close:hover {
      opacity: 1;
    }
    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateY(-100%);
      }
      to {
        opacity: 1;
        transform: translateY(0);
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
