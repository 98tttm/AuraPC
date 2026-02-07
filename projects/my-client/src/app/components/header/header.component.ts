import {
  Component, ChangeDetectionStrategy, signal,
  HostListener, Inject, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  activeMenu = signal<string>('products');
  isScrolled = signal<boolean>(false);
  menuOpen = signal<boolean>(false);
  private isBrowser: boolean;

  readonly assets = {
    logo: 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png',
  };

  readonly menuItems = [
    { id: 'products', label: 'SẢN PHẨM' },
    { id: 'guide', label: 'HƯỚNG DẪN' },
    { id: 'auralab', label: 'AURALAB' },
    { id: 'support', label: 'HỖ TRỢ' },
  ];

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isBrowser) return;
    this.isScrolled.set(window.scrollY > 80);
  }

  setActiveMenu(menuId: string): void {
    this.activeMenu.set(menuId);
    this.menuOpen.set(false);
  }
  toggleMenu(): void { this.menuOpen.update(v => !v); }
  closeMenu(): void { this.menuOpen.set(false); }
  toggleSearch(): void { console.log('Toggle search'); }
  openUser(): void { console.log('Open user account'); }
  openCart(): void { console.log('Open cart'); }
}
