import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../core/auth/admin-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  touched = signal(false);

  constructor(
    private auth: AdminAuthService,
    private router: Router
  ) {
    if (auth.isLoggedIn()) {
      this.router.navigate(['/']);
    }
  }

  get emailError(): string {
    if (!this.touched()) return '';
    if (!this.email.trim()) return 'Vui lòng nhập email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) return 'Email không hợp lệ';
    return '';
  }

  get passwordError(): string {
    if (!this.touched()) return '';
    if (!this.password) return 'Vui lòng nhập mật khẩu';
    return '';
  }

  onSubmit(): void {
    this.touched.set(true);
    if (this.emailError || this.passwordError) return;

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Đăng nhập thất bại');
      },
    });
  }
}
