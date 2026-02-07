import {
  Component, ChangeDetectionStrategy, signal,
  HostListener, Inject, PLATFORM_ID, ElementRef, ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';

export interface PartnerLink {
  img: string;
  url: string;
  alt: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  @ViewChild('navMenuRef') navMenuRef!: ElementRef<HTMLUListElement>;

  activeMenu = signal<string>('products');
  isScrolled = signal<boolean>(false);
  menuOpen = signal<boolean>(false);
  searchOpen = signal<boolean>(false);
  searchQuery = signal<string>('');
  showLoginPopup = signal<boolean>(false);
  loginPhone = signal<string>('');
  navHoveredId = signal<string | null>(null);
  navIndicatorLeft = signal<number>(0);
  navIndicatorWidth = signal<number>(0);
  private isBrowser: boolean;

  readonly assets = {
    logo: 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png',
    loginLogo: 'assets/LOGO/logo152238.png',
    facebookLogo: 'assets/LOGO/facebook.png',
  };

  readonly menuItems = [
    { id: 'products', label: 'SẢN PHẨM', route: '/' },
    { id: 'guide', label: 'HƯỚNG DẪN', route: '/' },
    { id: 'auralab', label: 'AURALAB', route: '/' },
    { id: 'support', label: 'HỖ TRỢ', route: '/' },
  ];

  readonly partnerLinks: PartnerLink[] = [
    { img: 'assets/ba2a506d58ea6a7e6fa0192d6e841831806c3981.png', url: 'https://drop.com/home', alt: 'Drop' },
    { img: 'assets/0e69c190680bbaf4eabbd6a9fcd7403ed66c1741.png', url: 'https://www.fanatec.com/eu/en', alt: 'Fanatec' },
    { img: 'assets/04ff4911162dc0c16135d97b21dcad117192621b.png', url: 'https://www.corsair.com/us/en', alt: 'Corsair' },
    { img: 'assets/5a7d80d715d44d479e3f007c460888c8a8c24722.png', url: 'https://www.originpc.com/', alt: 'Origin PC' },
  ];

  cartCount = this.cart.cartCount;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private cart: CartService,
    private router: Router,
  ) {
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

  onNavItemHover(e: MouseEvent, itemId: string): void {
    this.navHoveredId.set(itemId);
    const li = (e.currentTarget as HTMLElement);
    const menu = this.navMenuRef?.nativeElement;
    if (!menu) return;
    const rect = li.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    this.navIndicatorLeft.set(rect.left - menuRect.left + menu.scrollLeft);
    this.navIndicatorWidth.set(rect.width);
  }

  clearNavHover(): void {
    this.navHoveredId.set(null);
  }

  toggleSearch(): void {
    this.searchOpen.update(v => !v);
    if (!this.searchOpen()) this.searchQuery.set('');
  }

  submitSearch(): void {
    const q = this.searchQuery().trim();
    if (q) this.router.navigate(['/'], { queryParams: { search: q } });
    this.toggleSearch();
  }

  openUser(): void {
    this.showLoginPopup.set(true);
    this.menuOpen.set(false);
  }

  closeLoginPopup(): void {
    this.showLoginPopup.set(false);
    this.loginPhone.set('');
  }

  onLoginContinue(): void {
    // TODO: gửi OTP / xử lý đăng nhập
    this.closeLoginPopup();
  }

  toggleMenu(): void { this.menuOpen.update(v => !v); }
  closeMenu(): void { this.menuOpen.set(false); }
  openCart(): void { this.menuOpen.set(false); /* Chưa có trang giỏ hàng, giữ nút hiển thị */ }
}
