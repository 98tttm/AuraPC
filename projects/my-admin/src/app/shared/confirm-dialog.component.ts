import { Component, Injectable, signal, ChangeDetectionStrategy } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  visible = signal(false);
  options = signal<ConfirmOptions>({ title: '', message: '' });
  private resolveFn: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.options.set(options);
    this.visible.set(true);
    return new Promise<boolean>(resolve => {
      this.resolveFn = resolve;
    });
  }

  accept(): void {
    this.visible.set(false);
    this.resolveFn?.(true);
    this.resolveFn = null;
  }

  cancel(): void {
    this.visible.set(false);
    this.resolveFn?.(false);
    this.resolveFn = null;
  }
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirmService.visible()) {
      <div class="confirm-backdrop" (click)="confirmService.cancel()">
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <h3 class="confirm-dialog__title">{{ confirmService.options().title }}</h3>
          <p class="confirm-dialog__message">{{ confirmService.options().message }}</p>
          <div class="confirm-dialog__actions">
            <button class="btn btn--outline" (click)="confirmService.cancel()">
              {{ confirmService.options().cancelText || 'Hủy' }}
            </button>
            <button class="btn" [class.btn--danger]="confirmService.options().danger" [class.btn--primary]="!confirmService.options().danger" (click)="confirmService.accept()">
              {{ confirmService.options().confirmText || 'Xác nhận' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: confirm-fade-in 0.15s ease-out;
    }
    .confirm-dialog {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.5rem;
      max-width: 420px;
      width: 90%;
      box-shadow: var(--shadow-md);
      animation: confirm-scale-in 0.15s ease-out;
    }
    .confirm-dialog__title {
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .confirm-dialog__message {
      font-size: 0.875rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }
    .confirm-dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    @keyframes confirm-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes confirm-scale-in {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `],
})
export class ConfirmDialogComponent {
  constructor(public confirmService: ConfirmService) {}
}
