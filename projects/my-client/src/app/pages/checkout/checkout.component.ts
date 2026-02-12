import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { CartService } from '../../core/services/cart.service';
import { ApiService, productDisplayPrice, productMainImage } from '../../core/services/api.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, DecimalPipe, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent {
  private cart = inject(CartService);
  private api = inject(ApiService);
  private router = inject(Router);

  fullName = '';
  phone = '';
  email = '';
  receiverName = '';
  receiverPhone = '';
  address = '';
  city = '';
  district = '';
  ward = '';
  note = '';
  couponCode = '';
  paymentMethod = 'cod';
  requestInvoice = false;

  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  cartItems = () => this.cart.getItems();
  cartTotal = this.cart.cartTotal;

  getImage(p: any) { return productMainImage(p); }
  getPrice(p: any) { return productDisplayPrice(p); }

  removeItem(productId: string) {
    this.cart.remove(productId);
  }

  submitOrder() {
    this.errorMessage.set(null);

    if (!this.fullName.trim() || !this.phone.trim() || !this.city || !this.district) {
      this.errorMessage.set('Vui lòng điền đầy đủ thông tin bắt buộc');
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
        fullName: this.receiverName || this.fullName,
        phone: this.receiverPhone || this.phone,
        email: this.email,
        address: this.address,
        city: this.city,
        district: this.district,
        ward: this.ward,
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
