import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, FaqItem } from '../../core/services/api.service';
import { RecentlyViewedSectionComponent } from '../../components/recently-viewed-section/recently-viewed-section.component';

export interface SupportServiceLink {
  label: string;
  route: string;
}

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RecentlyViewedSectionComponent],
  templateUrl: './support.component.html',
  styleUrl: './support.component.css',
})
export class SupportComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  searchQuery = signal('');
  faqs = signal<FaqItem[]>([]);
  loadingFaqs = signal(true);
  expandedFaqId = signal<string | null>(null);
  /** Mã đơn nhập tại trang Hỗ trợ — khi bấm Tra cứu sẽ chuyển sang trang tra-cuu-don-hang và truyền mã này */
  orderNumber = signal('');

  readonly serviceLinks: SupportServiceLink[] = [
    { label: 'Chính sách bảo hành', route: '/ve-aurapc/chinh-sach-doi-tra' },
    { label: 'Tra cứu đơn hàng', route: '/tra-cuu-don-hang' },
    { label: 'Đổi trả / Hoàn tiền', route: '/ve-aurapc/chinh-sach-doi-tra' },
    { label: 'Chính sách giao hàng', route: '/ve-aurapc/chinh-sach-giao-hang' },
    { label: 'Chính sách thanh toán', route: '/ve-aurapc/chinh-sach-thanh-toan' },
    { label: 'Hủy đơn / Hướng dẫn hủy', route: '/ve-aurapc/quy-che-hoat-dong' },
    { label: 'Kiểm tra hóa đơn điện tử', route: '/ve-aurapc/kiem-tra-hoa-don-dien-tu' },
    { label: 'Bảo mật dữ liệu cá nhân', route: '/ve-aurapc/chinh-sach-bao-mat-du-lieu-ca-nhan' },
  ];

  ngOnInit(): void {
    this.api.getFaqs().subscribe({
      next: (list) => {
        this.faqs.set(list);
        this.loadingFaqs.set(false);
      },
      error: () => this.loadingFaqs.set(false),
    });
  }

  get filteredFaqs(): FaqItem[] {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.faqs();
    if (!q) return list;
    return list.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        (f.answer && f.answer.toLowerCase().includes(q))
    );
  }

  toggleFaq(id: string): void {
    this.expandedFaqId.update((cur) => (cur === id ? null : id));
  }

  isExpanded(id: string): boolean {
    return this.expandedFaqId() === id;
  }

  /** Chuyển sang trang tra cứu đơn hàng và truyền mã đơn (nếu có) để trang kia tự tra cứu */
  goTrackOrder(): void {
    const num = this.orderNumber().trim().replace(/^ORD\-/i, '');
    if (num) {
      this.router.navigate(['/tra-cuu-don-hang'], { queryParams: { order: num } });
    } else {
      this.router.navigate(['/tra-cuu-don-hang']);
    }
  }
}
