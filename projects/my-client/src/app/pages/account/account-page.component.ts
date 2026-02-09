import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPageComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly user = this.auth.currentUser;

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

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
