import { Component } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CheckoutStepperComponent } from '../../components/checkout-stepper/checkout-stepper.component';

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [RouterLink, CheckoutStepperComponent],
  template: `
    <section class="success-page">
      <div class="container">
        <app-checkout-stepper [step]="4"></app-checkout-stepper>
        <div class="success-card">
          <div class="success-icon">✓</div>
          <h1>Đặt hàng thành công!</h1>
          <p>Cảm ơn bạn đã đặt hàng tại AuraPC</p>
          @if (orderNumber) {
            <p class="order-number">Mã đơn hàng: <strong>{{ orderNumber }}</strong></p>
          }
          <p class="success-note">Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất để xác nhận đơn hàng.</p>
          <div class="success-actions">
            <a routerLink="/" class="btn btn--primary">Về trang chủ</a>
            <a routerLink="/san-pham" class="btn btn--outline">Tiếp tục mua sắm</a>
          </div>
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
    .btn { display: inline-block; padding: 0.875rem 1.5rem; border-radius: 8px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
    .btn--primary { background: #1a1a1a; color: #fff; }
    .btn--primary:hover { background: #333; transform: translateY(-1px); }
    .btn--outline { background: #fff; border: 1px solid #d9d9d9; color: #1a1a1a; }
    .btn--outline:hover { border-color: #FF6D2D; color: #FF6D2D; }
  `]
})
export class CheckoutSuccessComponent {
  orderNumber: string | null = null;

  constructor(private route: ActivatedRoute) {
    this.orderNumber = this.route.snapshot.queryParamMap.get('order');
  }
}
