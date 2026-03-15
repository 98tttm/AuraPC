import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService, Promotion } from '../../core/admin-api.service';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-promotion-form',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './promotion-form.component.html',
  styleUrl: './promotion-form.component.css',
})
export class PromotionFormComponent implements OnInit {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  id = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
  touched = signal(false);

  model: Partial<Promotion> = {
    code: '',
    description: '',
    discountPercent: 10,
    maxDiscountAmount: undefined,
    minOrderAmount: 0,
    maxUsage: undefined,
    maxUsagePerUser: 1,
    startDate: this.todayStr(),
    endDate: this.oneMonthLaterStr(),
    isActive: true,
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.id.set(id);
      this.api.getPromotion(id).subscribe({
        next: (p) => {
          this.model = {
            code: p.code,
            description: p.description,
            discountPercent: p.discountPercent,
            maxDiscountAmount: p.maxDiscountAmount ?? undefined,
            minOrderAmount: p.minOrderAmount,
            maxUsage: p.maxUsage ?? undefined,
            maxUsagePerUser: p.maxUsagePerUser,
            startDate: this.toInputDate(p.startDate),
            endDate: this.toInputDate(p.endDate),
            isActive: p.isActive,
          };
        },
        error: () => this.error.set('Không tìm thấy khuyến mãi'),
      });
    }
  }

  get codeError(): string {
    if (!this.touched()) return '';
    if (!this.model.code?.trim()) return 'Vui lòng nhập mã';
    return '';
  }

  get discountError(): string {
    if (!this.touched()) return '';
    const v = this.model.discountPercent;
    if (v == null || v < 1 || v > 100) return 'Phần trăm giảm phải từ 1-100';
    return '';
  }

  get dateError(): string {
    if (!this.touched()) return '';
    if (!this.model.startDate || !this.model.endDate) return 'Vui lòng chọn ngày bắt đầu và kết thúc';
    if (new Date(this.model.endDate) <= new Date(this.model.startDate)) return 'Ngày kết thúc phải sau ngày bắt đầu';
    return '';
  }

  submit(): void {
    this.touched.set(true);
    this.error.set('');
    if (this.codeError || this.discountError || this.dateError) return;

    this.loading.set(true);
    const body = { ...this.model };
    // Convert empty strings to null for optional numbers
    if (!body.maxDiscountAmount) body.maxDiscountAmount = null as any;
    if (!body.maxUsage) body.maxUsage = null as any;

    const id = this.id();
    if (id) {
      this.api.updatePromotion(id, body).subscribe({
        next: () => {
          this.toast.success('Cập nhật khuyến mãi thành công');
          this.router.navigate(['/promotions']);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Cập nhật thất bại');
          this.loading.set(false);
        },
      });
    } else {
      this.api.createPromotion(body).subscribe({
        next: () => {
          this.toast.success('Tạo khuyến mãi thành công');
          this.router.navigate(['/promotions']);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Tạo thất bại');
          this.loading.set(false);
        },
      });
    }
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private oneMonthLaterStr(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  private toInputDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toISOString().slice(0, 10);
  }
}
