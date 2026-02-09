import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { CartService } from '../../core/services/cart.service';
import { productDisplayPrice, productMainImage, productHasSale, productSalePercent } from '../../core/services/api.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  template: `
    <section class="cart-page">
      <div class="container">
        <h1 class="cart-title">Giỏ hàng của bạn</h1>
        
        @if (cartItems().length === 0) {
          <div class="cart-empty">
            <p>Giỏ hàng trống</p>
            <a routerLink="/san-pham" class="btn btn--primary">Tiếp tục mua sắm</a>
          </div>
        } @else {
          <div class="cart-content">
            <div class="cart-items">
              @for (item of cartItems(); track item.product._id) {
                <div class="cart-item">
                  <div class="cart-item__image">
                    <img [src]="getImage(item.product)" [alt]="item.product.name" />
                  </div>
                  <div class="cart-item__info">
                    <h3 class="cart-item__name">{{ item.product.name }}</h3>
                    <p class="cart-item__price">{{ getPrice(item.product) | number:'1.0-0' }}₫</p>
                    @if (hasSale(item.product)) {
                      <span class="cart-item__sale">-{{ salePercent(item.product) }}%</span>
                    }
                  </div>
                  <div class="cart-item__qty">
                    <button class="qty-btn" (click)="decreaseQty(item.product._id!)">−</button>
                    <span class="qty-value">{{ item.qty }}</span>
                    <button class="qty-btn" (click)="increaseQty(item.product._id!)">+</button>
                  </div>
                  <div class="cart-item__subtotal">
                    {{ getPrice(item.product) * item.qty | number:'1.0-0' }}₫
                  </div>
                  <button class="cart-item__remove" (click)="remove(item.product._id!)">×</button>
                </div>
              }
            </div>
            
            <div class="cart-summary">
              <h3>Tổng đơn hàng</h3>
              <div class="cart-summary__row">
                <span>Số lượng</span>
                <span>{{ cartCount() }} sản phẩm</span>
              </div>
              <div class="cart-summary__row cart-summary__total">
                <span>Tổng tiền</span>
                <span>{{ cartTotal() | number:'1.0-0' }}₫</span>
              </div>
              <a routerLink="/checkout" class="btn btn--primary btn--full">Tiến hành thanh toán</a>
              <a routerLink="/san-pham" class="btn btn--outline btn--full">Tiếp tục mua sắm</a>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .cart-page { padding: 2rem 0 4rem; min-height: 60vh; background: var(--bg-primary, #0a0a0f); }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
    .cart-title { font-size: 2rem; margin-bottom: 2rem; color: var(--text-primary, #fff); }
    .cart-empty { text-align: center; padding: 4rem 0; color: var(--text-secondary, #888); }
    .cart-empty p { margin-bottom: 1.5rem; font-size: 1.25rem; }
    .cart-content { display: grid; gap: 2rem; }
    @media (min-width: 768px) {
      .cart-content { grid-template-columns: 1fr 320px; }
    }
    .cart-items { display: flex; flex-direction: column; gap: 1rem; }
    .cart-item {
      display: grid; grid-template-columns: 80px 1fr auto auto auto; gap: 1rem; align-items: center;
      background: var(--bg-secondary, #1a1a25); border-radius: 8px; padding: 1rem;
    }
    .cart-item__image { width: 80px; height: 80px; border-radius: 6px; overflow: hidden; background: #222; }
    .cart-item__image img { width: 100%; height: 100%; object-fit: cover; }
    .cart-item__info { min-width: 0; }
    .cart-item__name { font-size: 0.95rem; color: var(--text-primary, #fff); margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cart-item__price { color: var(--accent, #a855f7); font-weight: 600; }
    .cart-item__sale { background: #ef4444; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem; }
    .cart-item__qty { display: flex; align-items: center; gap: 0.5rem; }
    .qty-btn { width: 28px; height: 28px; border: 1px solid var(--border, #333); background: transparent; color: var(--text-primary, #fff); border-radius: 4px; cursor: pointer; }
    .qty-btn:hover { background: var(--accent, #a855f7); border-color: var(--accent, #a855f7); }
    .qty-value { min-width: 2rem; text-align: center; color: var(--text-primary, #fff); }
    .cart-item__subtotal { font-weight: 600; color: var(--text-primary, #fff); min-width: 120px; text-align: right; }
    .cart-item__remove { width: 28px; height: 28px; border: none; background: transparent; color: #888; font-size: 1.25rem; cursor: pointer; }
    .cart-item__remove:hover { color: #ef4444; }
    .cart-summary { background: var(--bg-secondary, #1a1a25); border-radius: 8px; padding: 1.5rem; height: fit-content; }
    .cart-summary h3 { font-size: 1.25rem; margin-bottom: 1rem; color: var(--text-primary, #fff); }
    .cart-summary__row { display: flex; justify-content: space-between; margin-bottom: 0.75rem; color: var(--text-secondary, #aaa); }
    .cart-summary__total { font-size: 1.25rem; font-weight: 700; color: var(--text-primary, #fff); border-top: 1px solid var(--border, #333); padding-top: 1rem; margin-top: 1rem; }
    .btn { display: inline-block; padding: 0.875rem 1.5rem; border-radius: 6px; font-weight: 600; text-align: center; text-decoration: none; cursor: pointer; transition: all 0.2s; }
    .btn--primary { background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; border: none; }
    .btn--primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4); }
    .btn--outline { background: transparent; border: 1px solid var(--border, #333); color: var(--text-primary, #fff); margin-top: 0.75rem; }
    .btn--outline:hover { border-color: var(--accent, #a855f7); color: var(--accent, #a855f7); }
    .btn--full { width: 100%; display: block; }
  `]
})
export class CartComponent {
  private cart = inject(CartService);

  cartItems = computed(() => this.cart.getItems());
  cartCount = this.cart.cartCount;
  cartTotal = this.cart.cartTotal;

  getImage(p: any) { return productMainImage(p); }
  getPrice(p: any) { return productDisplayPrice(p); }
  hasSale(p: any) { return productHasSale(p); }
  salePercent(p: any) { return productSalePercent(p); }

  increaseQty(productId: string) {
    const item = this.cartItems().find(i => i.product._id === productId);
    if (item) this.cart.setQty(productId, item.qty + 1);
  }

  decreaseQty(productId: string) {
    const item = this.cartItems().find(i => i.product._id === productId);
    if (item && item.qty > 1) this.cart.setQty(productId, item.qty - 1);
    else if (item) this.cart.remove(productId);
  }

  remove(productId: string) {
    this.cart.remove(productId);
  }
}
