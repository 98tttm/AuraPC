import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPageComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly user = this.auth.currentUser;
  activeTab = signal<'profile' | 'orders' | 'address'>('profile');
  editMode = signal(false);

  // Edit form fields
  editName = '';
  editGender = '';
  editDob = '';
  editAvatar = ''; // Keep for compatibility if needed, but primarily using file upload

  // Mock orders data
  mockOrders = [
    { id: 'ORD-20260115001', date: '15/01/2026', status: 'Đã giao', total: 25890000, items: 2 },
    { id: 'ORD-20260108002', date: '08/01/2026', status: 'Đang vận chuyển', total: 15200000, items: 1 },
    { id: 'ORD-20251228003', date: '28/12/2025', status: 'Đã giao', total: 42500000, items: 3 },
  ];

  // Mock addresses data
  mockAddresses = [
    { id: 1, name: 'Nhà riêng', fullName: 'Nguyễn Văn A', phone: '0901234567', address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM', isDefault: true },
    { id: 2, name: 'Công ty', fullName: 'Nguyễn Văn A', phone: '0907654321', address: '456 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM', isDefault: false },
  ];

  constructor() {
    if (!this.auth.currentUser()) {
      this.router.navigate(['/'], { queryParams: { login: '1' } });
    }
  }

  displayName = computed(() => {
    const u = this.user();
    if (!u) return '';
    const name = u.profile?.fullName?.trim();
    return name || this.formatPhone(u.phoneNumber);
  });

  displayPhone = computed(() => {
    const u = this.user();
    return u ? this.formatPhone(u.phoneNumber) : '';
  });

  displayGender = computed(() => {
    const u = this.user();
    const g = u?.profile?.gender?.trim();
    if (!g) return null;
    const map: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };
    return map[g.toLowerCase()] || g;
  });

  displayDob = computed(() => {
    const u = this.user();
    const d = u?.profile?.dateOfBirth;
    if (!d) return null;
    const date = typeof d === 'string' ? new Date(d) : d;
    return isNaN(date.getTime()) ? null : date;
  });

  formatPhone(phone: string): string {
    if (!phone) return '';
    const d = phone.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('84')) return '0' + d.slice(2);
    return phone;
  }

  formatDate(d: Date): string {
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN') + '₫';
  }

  switchTab(tab: 'profile' | 'orders' | 'address') {
    this.activeTab.set(tab);
    this.editMode.set(false);
  }

  startEdit() {
    const u = this.user();
    this.editName = u?.profile?.fullName || '';
    this.editGender = u?.profile?.gender || '';
    this.editDob = u?.profile?.dateOfBirth || '';
    this.editAvatar = u?.avatar || '';
    this.editMode.set(true);
  }

  cancelEdit() {
    this.editMode.set(false);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.auth.uploadAvatar(file).subscribe({
        next: (res) => {
          if (res.success) {
            // Success - updated automatically in signal
          }
        },
        error: (err) => alert('Lỗi upload ảnh: ' + (err.message || 'Không xác định'))
      });
    }
  }

  saveProfile() {
    this.auth.updateProfile({
      fullName: this.editName,
      gender: this.editGender,
      dateOfBirth: this.editDob
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.editMode.set(false);
        }
      },
      error: (err) => alert('Lỗi cập nhật: ' + (err.message || 'Không xác định'))
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  getStatusClass(status: string): string {
    if (status === 'Đã giao') return 'status--delivered';
    if (status === 'Đang vận chuyển') return 'status--shipping';
    if (status === 'Đã hủy') return 'status--cancelled';
    return 'status--pending';
  }

  getAvatarUrl(path: string | undefined | null): string {
    if (!path) return 'assets/AVT/avtdefaut.png';
    if (path.startsWith('http')) return path;
    // Remove /api suffix to get base URL
    const baseUrl = environment.apiUrl.replace(/\/api$/, '');
    return `${baseUrl}${path}`;
  }
}
