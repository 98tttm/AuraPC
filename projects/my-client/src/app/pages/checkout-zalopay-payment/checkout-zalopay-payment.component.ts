import { Component, inject, computed, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CheckoutStepperComponent } from '../../components/checkout-stepper/checkout-stepper.component';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';

const PENDING_KEY = 'aurapc_zalopay_pending';

interface PendingPayload {
  items: { product: string; name: string; price: number; qty: number }[];
  shippingAddress: Record<string, string>;
  originalTotal?: number;
  directDiscount?: number;
  amount?: number;
}

@Component({
  selector: 'app-checkout-zalopay-payment',
  standalone: true,
  imports: [RouterLink, CheckoutStepperComponent],
  templateUrl: './checkout-zalopay-payment.component.html',
  styleUrls: ['./checkout-zalopay-payment.component.css'],
})
export class CheckoutZalopayPaymentComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private cart = inject(CartService);

  orderNumber = '';
  amount = 0;
  originalTotal = 0;
  directDiscount = 0;
  confirmSubmitting = false;
  confirmError = '';

  qrContent = computed(() => {
    const a = this.amount;
    if (a <= 0) return '';
    if (this.orderNumber) return `AURAPC|${this.orderNumber}|${a}|Thanh toan ZaloPay AuraPC`;
    return `AURAPC|${a}|${Date.now()}|Thanh toan ZaloPay AuraPC`;
  });

  constructor() {
    this.orderNumber = this.route.snapshot.queryParamMap.get('order') ?? '';
    const amountStr = this.route.snapshot.queryParamMap.get('amount') ?? '0';
    this.amount = parseInt(amountStr, 10) || 0;
  }

  ngOnInit(): void {
    if (this.amount <= 0) {
      this.router.navigate(['/checkout']);
      return;
    }
    const pending = this.getPending();
    if (!pending && !this.orderNumber) {
      this.router.navigate(['/checkout']);
      return;
    }
    if (pending?.originalTotal != null) this.originalTotal = Number(pending.originalTotal);
    if (pending?.directDiscount != null) this.directDiscount = Number(pending.directDiscount);
  }

  private getPending(): PendingPayload | null {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PendingPayload;
    } catch {
      return null;
    }
  }

  directDiscountLabel(): string {
    if (!this.directDiscount || this.directDiscount <= 0) return '0₫';
    return '-' + this.directDiscount.toLocaleString('vi-VN') + '₫';
  }

  formatPrice(n: number): string {
    if (!n || n <= 0) return '0₫';
    return n.toLocaleString('vi-VN') + '₫';
  }

  onConfirmTransfer(): void {
    const pending = this.getPending();
    if (!pending?.items?.length) {
      this.confirmError = 'Phiên không còn hợp lệ. Vui lòng quay lại trang đặt hàng và thử lại.';
      return;
    }
    this.confirmError = '';
    this.confirmSubmitting = true;
    this.api.createOrder({
      items: pending.items,
      shippingAddress: pending.shippingAddress,
    }).subscribe({
      next: (res) => {
        this.cart.clear();
        try {
          sessionStorage.removeItem(PENDING_KEY);
          sessionStorage.removeItem('aurapc_checkout_payment_method');
        } catch {}
        this.confirmSubmitting = false;
        this.router.navigate(['/checkout-success'], { queryParams: { order: res.orderNumber } });
      },
      error: (err) => {
        this.confirmSubmitting = false;
        this.confirmError = err?.error?.message || 'Không tạo được đơn. Vui lòng thử lại.';
      },
    });
  }
}
