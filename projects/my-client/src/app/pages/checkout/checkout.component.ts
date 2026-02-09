import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { CartService } from '../../core/services/cart.service';
import { ApiService, productDisplayPrice, productMainImage } from '../../core/services/api.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <section class="checkout-page">
      <div class="container">
        <h1 class="checkout-title">Thanh toán</h1>
        
        <div class="checkout-content">
          <div class="checkout-form">
            <h2>Thông tin giao hàng</h2>
            <div class="form-group">
              <label>Họ và tên *</label>
              <input type="text" [(ngModel)]="fullName" placeholder="Nhập họ và tên" />
            </div>
            <div class="form-group">
              <label>Số điện thoại *</label>
              <input type="tel" [(ngModel)]="phone" placeholder="Nhập số điện thoại" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="email" placeholder="Nhập email" />
            </div>
            <div class="form-group">
              <label>Địa chỉ *</label>
              <input type="text" [(ngModel)]="address" placeholder="Số nhà, tên đường" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tỉnh/Thành *</label>
                <input type="text" [(ngModel)]="city" placeholder="Tỉnh/Thành phố" />
              </div>
              <div class="form-group">
                <label>Quận/Huyện *</label>
                <input type="text" [(ngModel)]="district" placeholder="Quận/Huyện" />
              </div>
            </div>
            <div class="form-group">
              <label>Ghi chú</label>
              <textarea [(ngModel)]="note" placeholder="Ghi chú cho đơn hàng"></textarea>
            </div>
            
            @if (errorMessage()) {
              <p class="error-message">{{ errorMessage() }}</p>
            }
            
            <button class="btn btn--primary btn--full" (click)="submitOrder()" [disabled]="submitting()">
              {{ submitting() ? 'Đang xử lý...' : 'Đặt hàng' }}
            </button>
          </div>
          
          <div class="order-summary">
            <h2>Đơn hàng của bạn</h2>
            <div class="order-items">
              @for (item of cartItems(); track item.product._id) {
                <div class="order-item">
                  <div class="order-item__image">
                    <img [src]="getImage(item.product)" [alt]="item.product.name" />
                    <span class="order-item__qty">{{ item.qty }}</span>
                  </div>
                  <div class="order-item__info">
                    <p class="order-item__name">{{ item.product.name }}</p>
                    <p class="order-item__price">{{ getPrice(item.product) * item.qty | number:'1.0-0' }}₫</p>
                  </div>
                </div>
              }
            </div>
            <div class="order-totals">
              <div class="order-row">
                <span>Tạm tính</span>
                <span>{{ cartTotal() | number:'1.0-0' }}₫</span>
              </div>
              <div class="order-row">
                <span>Phí vận chuyển</span>
                <span>Liên hệ</span>
              </div>
              <div class="order-row order-total">
                <span>Tổng cộng</span>
                <span>{{ cartTotal() | number:'1.0-0' }}₫</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .checkout-page { padding: 5.5rem 0 4rem; min-height: 60vh; background: var(--bg-primary, #0a0a0f); }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 1rem; }
    .checkout-title { font-size: 2rem; margin-bottom: 2rem; color: var(--text-primary, #fff); }
    .checkout-content { display: grid; gap: 2rem; }
    @media (min-width: 768px) {
      .checkout-content { grid-template-columns: 1fr 380px; }
    }
    .checkout-form, .order-summary { background: var(--bg-secondary, #1a1a25); border-radius: 8px; padding: 1.5rem; }
    .checkout-form h2, .order-summary h2 { font-size: 1.25rem; margin-bottom: 1.5rem; color: var(--text-primary, #fff); }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; color: var(--text-secondary, #aaa); font-size: 0.9rem; }
    .form-group input, .form-group textarea {
      width: 100%; padding: 0.75rem 1rem; background: var(--bg-primary, #0a0a0f); border: 1px solid var(--border, #333);
      border-radius: 6px; color: var(--text-primary, #fff); font-size: 1rem;
    }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: var(--accent, #a855f7); }
    .form-group textarea { min-height: 80px; resize: vertical; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .order-items { margin-bottom: 1.5rem; }
    .order-item { display: flex; gap: 1rem; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border, #222); }
    .order-item:last-child { border-bottom: none; }
    .order-item__image { position: relative; width: 50px; height: 50px; border-radius: 6px; overflow: hidden; background: #222; }
    .order-item__image img { width: 100%; height: 100%; object-fit: cover; }
    .order-item__qty { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; background: var(--accent, #a855f7); color: #fff; border-radius: 50%; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; }
    .order-item__info { flex: 1; min-width: 0; }
    .order-item__name { font-size: 0.85rem; color: var(--text-primary, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .order-item__price { font-size: 0.9rem; color: var(--accent, #a855f7); font-weight: 600; }
    .order-totals { border-top: 1px solid var(--border, #333); padding-top: 1rem; }
    .order-row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--text-secondary, #aaa); }
    .order-total { font-size: 1.25rem; font-weight: 700; color: var(--text-primary, #fff); margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border, #333); }
    .btn { display: inline-block; padding: 0.875rem 1.5rem; border-radius: 6px; font-weight: 600; text-align: center; cursor: pointer; transition: all 0.2s; border: none; }
    .btn--primary { background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; }
    .btn--primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4); }
    .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn--full { width: 100%; display: block; margin-top: 1.5rem; }
    .error-message { color: #ef4444; margin-bottom: 1rem; font-size: 0.9rem; }
  `]
})
export class CheckoutComponent {
  private cart = inject(CartService);
  private api = inject(ApiService);
  private router = inject(Router);

  fullName = '';
  phone = '';
  email = '';
  address = '';
  city = '';
  district = '';
  note = '';

  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  cartItems = () => this.cart.getItems();
  cartTotal = this.cart.cartTotal;

  getImage(p: any) { return productMainImage(p); }
  getPrice(p: any) { return productDisplayPrice(p); }

  submitOrder() {
    this.errorMessage.set(null);

    if (!this.fullName.trim() || !this.phone.trim() || !this.address.trim() || !this.city.trim() || !this.district.trim()) {
      this.errorMessage.set('Vui lòng điền đầy đủ thông tin bắt buộc (*)');
      return;
    }

    const items = this.cartItems().map(i => ({
      product: i.product._id!,
      name: i.product.name,
      price: productDisplayPrice(i.product),
      qty: i.qty
    }));

    if (!items.length) {
      this.errorMessage.set('Giỏ hàng trống');
      return;
    }

    this.submitting.set(true);

    this.api.createOrder({
      items,
      shippingAddress: {
        fullName: this.fullName,
        phone: this.phone,
        email: this.email,
        address: this.address,
        city: this.city,
        district: this.district,
        note: this.note
      }
    }).subscribe({
      next: (res) => {
        this.cart.clear();
        this.router.navigate(['/checkout-success'], { queryParams: { order: res.orderNumber } });
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      }
    });
  }
}
