import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.type" (click)="toastService.dismiss(toast.id)">
          <span class="toast__icon">
            @switch (toast.type) {
              @case ('success') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              }
              @case ('error') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              }
              @default {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              }
            }
          </span>
          <span class="toast__message">{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.825rem;
      font-weight: 500;
      box-shadow: var(--shadow-md);
      cursor: pointer;
      pointer-events: auto;
      animation: toast-slide-in 0.25s ease-out;
      max-width: 360px;
    }
    .toast--success {
      background: var(--accent-green);
      color: #fff;
    }
    .toast--error {
      background: var(--accent-red);
      color: #fff;
    }
    .toast--info {
      background: var(--accent);
      color: var(--bg-card);
    }
    .toast__icon {
      display: flex;
      flex-shrink: 0;
    }
    .toast__message {
      line-height: 1.3;
    }
    @keyframes toast-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `],
})
export class ToastComponent {
  toastService = inject(ToastService);
}
