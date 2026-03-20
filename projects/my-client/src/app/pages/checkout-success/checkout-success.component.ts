import { Component, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CheckoutStepperComponent } from '../../components/checkout-stepper/checkout-stepper.component';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [RouterLink, CheckoutStepperComponent],
  template: `
    <section class="success-page">
      <div class="container">
        <app-checkout-stepper [step]="4"></app-checkout-stepper>
        <div class="success-card">
          <div class="success-icon">&#10003;</div>
          <h1>Đặt hàng thành công!</h1>
          <p>Cảm ơn bạn đã đặt hàng tại AuraPC</p>
          @if (orderNumber) {
            <p class="order-number">Mã đơn hàng: <strong>{{ orderNumber }}</strong></p>
          }
          <p class="success-note">Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất để xác nhận đơn hàng.</p>
          <div class="success-actions">
            @if (orderNumber) {
              <button type="button" class="btn btn--invoice" (click)="downloadInvoice()" [disabled]="downloading()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {{ downloading() ? 'Đang tải...' : 'Tải hóa đơn PDF' }}
              </button>
            }
            <a routerLink="/" class="btn btn--primary">Về trang chủ</a>
            <a routerLink="/san-pham" class="btn btn--outline">Tiếp tục mua sắm</a>
          </div>
          @if (invoiceError()) {
            <p class="invoice-error">{{ invoiceError() }}</p>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .success-page { padding: 4rem 0; min-height: 60vh; background: #f0f0f0; display: flex; align-items: center; font-family: 'Inter', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 0 1.25rem; }
    .success-card { background: #fff; border-radius: 12px; padding: 3rem 2rem; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .success-icon { width: 80px; height: 80px; margin: 0 auto 1.5rem; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #fff; }
    .success-card h1 { font-size: 1.75rem; color: #1a1a1a; margin-bottom: 0.5rem; }
    .success-card p { color: #333; margin-bottom: 0.5rem; }
    .order-number { margin: 1.5rem 0; font-size: 1.1rem; color: #1a1a1a; }
    .order-number strong { color: #FF6D2D; }
    .success-note { font-size: 0.9rem; margin-top: 1rem; color: #666; }
    .success-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }
    .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1.5rem; border-radius: 8px; font-weight: 600; text-decoration: none; transition: all 0.2s; border: none; cursor: pointer; font-size: 0.95rem; }
    .btn--primary { background: #1a1a1a; color: #fff; }
    .btn--primary:hover { background: #333; transform: translateY(-1px); }
    .btn--outline { background: #fff; border: 1px solid #d9d9d9; color: #1a1a1a; }
    .btn--outline:hover { border-color: #FF6D2D; color: #FF6D2D; }
    .btn--invoice { background: #FF6D2D; color: #fff; }
    .btn--invoice:hover { background: #e55a1b; transform: translateY(-1px); }
    .btn--invoice:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .invoice-error { color: #dc2626; font-size: 0.85rem; margin-top: 1rem; }
  `]
})
export class CheckoutSuccessComponent {
  private api = inject(ApiService);
  orderNumber: string | null = null;
  downloading = signal(false);
  invoiceError = signal<string | null>(null);

  constructor(private route: ActivatedRoute) {
    this.orderNumber = this.route.snapshot.queryParamMap.get('order');
  }

  downloadInvoice(): void {
    if (!this.orderNumber || this.downloading()) return;
    this.downloading.set(true);
    this.invoiceError.set(null);
    this.api.downloadInvoice(this.orderNumber).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HoaDon_${this.orderNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: () => {
        this.invoiceError.set('Không thể tải hóa đơn. Vui lòng thử lại sau.');
        this.downloading.set(false);
      },
    });
  }
}
