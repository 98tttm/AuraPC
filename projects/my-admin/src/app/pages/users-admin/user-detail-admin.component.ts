import { Component, signal, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { AdminApiService, User } from '../../core/admin-api.service';
import { ORDER_STATUS_LABELS } from '../../core/constants';

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

  user = signal<User | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.getUser(id).subscribe({
        next: (user) => {
          this.user.set(user);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error || 'Không tìm thấy khách hàng');
          this.loading.set(false);
        },
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
    return ORDER_STATUS_LABELS[status] || status;
  }
}
