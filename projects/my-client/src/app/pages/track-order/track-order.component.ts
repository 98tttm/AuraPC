import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, productMainImage } from '../../core/services/api.service';
import type { OrderListItem, Product } from '../../core/services/api.service';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './track-order.component.html',
  styleUrl: './track-order.component.css',
})
export class TrackOrderComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  orderNumber = signal('');
  result = signal<Omit<OrderListItem, 'user'> | null>(null);
  error = signal<string | null>(null);
  loading = signal(false);

  ngOnInit(): void {
    const order = this.route.snapshot.queryParamMap.get('order');
    if (order && order.trim()) {
      const num = order.trim().replace(/^ORD\-/i, '');
      this.orderNumber.set(num);
      this.track();
    }
  }

  track(): void {
    const num = this.orderNumber().trim().replace(/^ORD\-/i, '');
    if (!num) return;
    this.error.set(null);
    this.result.set(null);
    this.loading.set(true);
    this.api.trackOrder(num).subscribe({
      next: (data) => {
        this.result.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || err.message || 'Không tìm thấy đơn hàng');
        this.result.set(null);
        this.loading.set(false);
      },
    });
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      processing: 'Đang xử lý',
      shipped: 'Đã giao vận',
      delivered: 'Đã giao hàng',
      cancelled: 'Đã hủy',
    };
    return map[status] || status;
  }

  formatDate(s: string | undefined): string {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getPaymentLabel(method: string): string {
    const map: Record<string, string> = {
      cod: 'Thanh toán khi nhận hàng (COD)',
      momo: 'Ví MoMo',
      zalopay: 'ZaloPay',
      atm: 'Chuyển khoản / ATM',
      qr: 'QR Code',
    };
    return map[method] || method;
  }

  /** URL ảnh sản phẩm trong đơn (item.product đã được populate). */
  getItemImage(item: { product?: Partial<Product> }): string {
    return item?.product ? productMainImage(item.product as Product) : '';
  }
}
