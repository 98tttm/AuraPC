import { Component } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-checkout-success',
    standalone: true,
    imports: [RouterLink],
    template: `
    <section class="success-page">
      <div class="container">
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
    .success-page { padding: 4rem 0; min-height: 60vh; background: var(--bg-primary, #0a0a0f); display: flex; align-items: center; }
    .container { max-width: 600px; margin: 0 auto; padding: 0 1rem; }
    .success-card { background: var(--bg-secondary, #1a1a25); border-radius: 12px; padding: 3rem 2rem; text-align: center; }
    .success-icon { width: 80px; height: 80px; margin: 0 auto 1.5rem; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #fff; }
    h1 { font-size: 1.75rem; color: var(--text-primary, #fff); margin-bottom: 0.5rem; }
    p { color: var(--text-secondary, #aaa); margin-bottom: 0.5rem; }
    .order-number { margin: 1.5rem 0; font-size: 1.1rem; color: var(--text-primary, #fff); }
    .order-number strong { color: var(--accent, #a855f7); }
    .success-note { font-size: 0.9rem; margin-top: 1rem; }
    .success-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }
    .btn { display: inline-block; padding: 0.875rem 1.5rem; border-radius: 6px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
    .btn--primary { background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; }
    .btn--primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4); }
    .btn--outline { background: transparent; border: 1px solid var(--border, #333); color: var(--text-primary, #fff); }
    .btn--outline:hover { border-color: var(--accent, #a855f7); color: var(--accent, #a855f7); }
  `]
})
export class CheckoutSuccessComponent {
    orderNumber: string | null = null;

    constructor(private route: ActivatedRoute) {
        this.orderNumber = this.route.snapshot.queryParamMap.get('order');
    }
}
