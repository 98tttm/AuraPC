import { Component, inject, computed, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';

const PENDING_KEY = 'aurapc_momo_pending';

interface PendingPayload {
  items: { product: string; name: string; price: number; qty: number }[];
  shippingAddress: Record<string, string>;
  originalTotal?: number;
  directDiscount?: number;
  amount?: number;
}

@Component({
  selector: 'app-checkout-momo-return',
  standalone: true,
  imports: [],
  templateUrl: './checkout-momo-return.component.html',
  styleUrls: ['./checkout-momo-return.component.css'],
})
export class CheckoutMomoReturnComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private cart = inject(CartService);

  isSuccess = false;
  message = '';
  orderNumber = '';

  constructor() {
    this.orderNumber = this.route.snapshot.queryParamMap.get('orderId') ?? '';
  }

  ngOnInit(): void {
    const resultCode = this.route.snapshot.queryParamMap.get('resultCode');
    const msg = this.route.snapshot.queryParamMap.get('message');

    // MoMo resultCode == 0 nghĩa là thanh toán thành công
    if (resultCode === '0') {
      this.isSuccess = true;
      this.message = 'Thanh toán MoMo thành công!';
      // Clear cart
      this.cart.clear();
      try {
        sessionStorage.removeItem('aurapc_checkout_payment_method');
      } catch { }
    } else {
      this.isSuccess = false;
      this.message = msg || 'Thanh toán thất bại hoặc đã bị hủy.';
    }
  }

  continueShopping(): void {
    this.router.navigate(['/']);
  }
}
