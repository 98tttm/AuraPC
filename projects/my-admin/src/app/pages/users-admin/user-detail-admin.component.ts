import { Component, signal, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { AdminApiService } from '../../core/admin-api.service';

@Component({
  selector: 'app-user-detail-admin',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-detail-admin.component.html',
  styleUrl: './user-detail-admin.component.css',
})
export class UserDetailAdminComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(AdminApiService);

  user = signal<any>(null);
  loading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.getUser(id).subscribe({
        next: (user) => {
          this.user.set(user);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  getUserName(): string {
    const u = this.user();
    return u?.profile?.fullName || u?.username || u?.phoneNumber || 'N/A';
  }

  getInitial(): string {
    return this.getUserName().charAt(0).toUpperCase();
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', processing: 'Đang xử lý',
      shipped: 'Đang giao', delivered: 'Hoàn thành', cancelled: 'Đã huỷ',
    };
    return map[status] || status;
  }
}
