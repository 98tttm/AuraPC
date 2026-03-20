import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CartService } from '../../core/services/cart.service';
import { ApiService } from '../../core/services/api.service';
import { environment } from '../../../environments/environment';

const API_BASE = environment.apiUrl || 'http://localhost:3000/api';

@Component({
  selector: 'app-checkout-zalopay-return',
  standalone: true,
  imports: [],
  templateUrl: './checkout-zalopay-return.component.html',
  styleUrls: ['./checkout-zalopay-return.component.css'],
})
export class CheckoutZalopayReturnComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cart = inject(CartService);
  private api = inject(ApiService);

  isSuccess = false;
  loading = true;
  message = '';
  orderNumber = '';
  downloading = signal(false);
  invoiceError = signal<string | null>(null);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    const appTransId = params.get('apptransid') || '';

    // Extract orderNumber from app_trans_id (format: yymmdd_ORDERNUM)
    if (appTransId) {
      this.orderNumber = appTransId.split('_').slice(1).join('_');
    }

    // ZaloPay status: 1 = success, -49 = user cancelled, other = failed
    if (status !== '1') {
      this.isSuccess = false;
      this.loading = false;
      this.message = status === '-49'
        ? 'Bạn đã hủy giao dịch ZaloPay.'
        : 'Thanh toán thất bại hoặc đã bị hủy.';
      return;
    }

    // Call backend to confirm payment and create the order
    this.http.get<{ success: boolean; orderNumber: string }>(`${API_BASE}/payment/zalopay/confirm`, {
      params: { apptransid: appTransId, status: status! },
    }).subscribe({
      next: (res) => {
        this.isSuccess = true;
        this.orderNumber = res.orderNumber || this.orderNumber;
        this.message = 'Thanh toán ZaloPay thành công!';
        this.loading = false;
        this.cart.clear();
        try { sessionStorage.removeItem('aurapc_checkout_payment_method'); } catch { }
      },
      error: (err) => {
        this.isSuccess = false;
        this.loading = false;
        this.message = err?.error?.message || 'Không thể xác nhận thanh toán. Vui lòng liên hệ hỗ trợ.';
      },
    });
  }

  continueShopping(): void {
    this.router.navigate(['/']);
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
