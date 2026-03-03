import { Component, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuthService } from '../core/auth/admin-auth.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  sidebarCollapsed = signal(false);
  admin = this.auth.currentAdmin;
  themeService = inject(ThemeService);

  constructor(
    public router: Router,
    private auth: AdminAuthService
  ) {}

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
