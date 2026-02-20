import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { ApiService, productDisplayPrice, productMainImage, Product } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { AddressService, Address } from '../../core/services/address.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
})
export class CheckoutComponent implements OnInit {
  private cart = inject(CartService);
  private api = inject(ApiService);
  private router = inject(Router);
  private auth = inject(AuthService);
  readonly addressService = inject(AddressService);

  // Auth state
  isLoggedIn = computed(() => !!this.auth.currentUser());

  // Form fields
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

  // Selected saved address ID
  selectedAddressId = '';

  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  // Cart data
  cartItems = computed(() => this.cart.getItems());
  cartTotal = this.cart.cartTotal;

  /** Original total (using old_price where a sale exists) */
  originalTotal = computed(() => {
    return this.cartItems().reduce((total, item) => {
      const p = item.product;
      const oldPrice = p?.old_price ?? 0;
      const displayPrice = productDisplayPrice(p);
      const price = (oldPrice > 0 && oldPrice > displayPrice) ? oldPrice : displayPrice;
      return total + (price * item.qty);
    }, 0);
  });

  /** Direct discount = sum of (old_price - display_price) * qty */
  directDiscount = computed(() => {
    return this.cartItems().reduce((total, item) => {
      const p = item.product;
      const displayPrice = productDisplayPrice(p);
      const oldPrice = p?.old_price ?? 0;
      if (oldPrice > 0 && displayPrice < oldPrice) {
        return total + ((oldPrice - displayPrice) * item.qty);
      }
      return total;
    }, 0);
  });

  /** Selected total (after sale discounts) */
  selectedTotal = computed(() => {
    return this.cartItems().reduce((total, item) => {
      return total + (productDisplayPrice(item.product) * item.qty);
    }, 0);
  });

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      // Auto-fill buyer info from profile
      this.fullName = user.profile?.fullName || '';
      this.phone = this.formatPhoneDisplay(user.phoneNumber);
      this.email = user.email || '';

      // Load saved addresses
      this.addressService.load();

      // Wait a tick for addresses to load, then select default
      setTimeout(() => {
        const defaultAddr = this.addressService.getDefault();
        if (defaultAddr) {
          this.applyAddress(defaultAddr);
          this.selectedAddressId = defaultAddr._id;
        }
      }, 500);
    }
  }

  private formatPhoneDisplay(phone: string): string {
    if (!phone) return '';
    const d = phone.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('84')) return '0' + d.slice(2);
    return phone;
  }

  /** Apply a saved address to the form */
  applyAddress(addr: Address) {
    this.receiverName = addr.fullName;
    this.receiverPhone = addr.phone;
    this.address = addr.address;
    this.city = addr.city;
    this.district = addr.district;
    this.ward = addr.ward;
  }

  onAddressSelect() {
    const addr = this.addressService.addresses().find(a => a._id === this.selectedAddressId);
    if (addr) {
      this.applyAddress(addr);
    } else {
      // "New address" selected — clear fields
      this.receiverName = '';
      this.receiverPhone = '';
      this.address = '';
      this.city = '';
      this.district = '';
      this.ward = '';
    }
  }

  getImage(p: Product) { return productMainImage(p); }
  getPrice(p: Product) { return productDisplayPrice(p); }

  priceLabel(p: Product): string {
    const price = productDisplayPrice(p);
    if (!price || price <= 0) return 'Liên hệ';
    return price.toLocaleString('vi-VN') + '₫';
  }

  formatPrice(n: number): string {
    if (!n || n <= 0) return '0₫';
    return n.toLocaleString('vi-VN') + '₫';
  }

  directDiscountLabel(): string {
    const d = this.directDiscount();
    if (!d || d <= 0) return '0₫';
    return '-' + d.toLocaleString('vi-VN') + '₫';
  }

  removeItem(productId: string) {
    this.cart.remove(productId);
    if (this.cartItems().length === 0) {
      this.router.navigate(['/cart']);
    }
  }

  submitOrder() {
    this.errorMessage.set(null);

    if (!this.fullName.trim() || !this.phone.trim()) {
      this.errorMessage.set('Vui lòng điền họ tên và số điện thoại.');
      return;
    }

    if (!this.address.trim()) {
      this.errorMessage.set('Vui lòng nhập địa chỉ nhận hàng.');
      return;
    }

    const items = this.cartItems().map(i => ({
      product: i.product._id!,
      name: i.product.name,
      price: productDisplayPrice(i.product),
      qty: i.qty,
    }));

    if (!items.length) {
      this.errorMessage.set('Giỏ hàng trống.');
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
        note: this.note,
      },
    }).subscribe({
      next: (res) => {
        this.cart.clear();
        this.router.navigate(['/checkout-success'], { queryParams: { order: res.orderNumber } });
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      },
    });
  }
}
